import { useMemo } from "react";
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import monde from "world-atlas/countries-110m.json";
import { clamp01 } from "./elements";

/* Carte de la présentation : un globe orthographique dont la caméra
   (centre + zoom) est pilotée image par image par la scène. À zoom 1 on
   voit la Terre entière ; en zoomant, le globe déborde du cadre et devient
   une carte de la région. Un seul composant pour le vol transcontinental
   et le transfert de 80 km. */

export type LonLat = [number, number];

const topo = monde as unknown as Topology;
const PAYS = (feature(topo, topo.objects.countries as GeometryCollection) as FeatureCollection<Geometry>).features.map((f) => ({
  id: String(f.id ?? ""),
  f,
}));
const GRATICULE = geoGraticule10();

export interface Camera {
  centre: LonLat;
  zoom: number;
}

/** Centre de gravité de points sur la sphère (sans casser à l'antiméridien). */
export function barycentre(points: LonLat[]): LonLat {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lon, lat] of points) {
    const l = (lon * Math.PI) / 180;
    const p = (lat * Math.PI) / 180;
    x += Math.cos(p) * Math.cos(l);
    y += Math.cos(p) * Math.sin(l);
    z += Math.sin(p);
  }
  if (x === 0 && y === 0 && z === 0) return points[0] ?? [0, 0];
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
}

/**
 * Caméra qui cadre tous les points dans un disque de `rayonVue` pixels.
 * `angleMin` (degrés) évite de zoomer jusqu'à la rue sur un trajet court.
 */
export function cadrer(points: LonLat[], rayonBase: number, rayonVue: number, angleMin = 3): Camera {
  if (points.length === 0) return { centre: [40, 25], zoom: 1 };
  const centre = barycentre(points);
  const theta = Math.max(...points.map((p) => geoDistance(centre, p)));
  const angle = Math.min(Math.PI / 2, Math.max((angleMin * Math.PI) / 180, theta * 1.18 + 0.015));
  const zoom = Math.max(1, rayonVue / Math.sin(angle) / rayonBase);
  return { centre, zoom };
}

/** Travelling d'une caméra à l'autre : arc de grand cercle, zoom en échelle log. */
export function interpolerCamera(a: Camera, b: Camera, k: number): Camera {
  const centre = geoInterpolate(a.centre, b.centre)(k) as LonLat;
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * k);
  return { centre, zoom };
}

export interface ArcCarte {
  de: LonLat;
  vers: LonLat;
  /** Part du trajet déjà tracée (0..1). */
  progression: number;
  couleur: string;
  /** Trajet au sol : trait pointillé. */
  sol?: boolean;
  opacite?: number;
  /** Avion (ou pastille) en tête du tracé. */
  vehicule?: boolean;
  /** Trajet restant en pointillé discret. */
  fantome?: boolean;
}

export interface PointCarte {
  pos: LonLat;
  etiquette?: string;
  actif?: boolean;
  couleur?: string;
  /** Les étiquettes prioritaires se placent d'abord (anti-chevauchement). */
  priorite?: number;
}

function melanger(a: string, b: string, k: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const v = [0, 1, 2].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * k));
  return `rgb(${v.join(",")})`;
}

const AVION =
  "M0,-15 C1.7,-15 2.4,-12.8 2.4,-10.5 L2.4,-3.2 L13,3.2 L13,6.4 L2.4,3.2 L2.4,9.4 L5.4,11.8 L5.4,14 L0,12.6 L-5.4,14 L-5.4,11.8 L-2.4,9.4 L-2.4,3.2 L-13,6.4 L-13,3.2 L-2.4,-3.2 L-2.4,-10.5 C-2.4,-12.8 -1.7,-15 0,-15 Z";

export function Carte({
  largeur,
  hauteur,
  cx,
  cy,
  rayonBase,
  camera,
  arcs = [],
  points = [],
  paysAllumes,
}: {
  largeur: number;
  hauteur: number;
  cx: number;
  cy: number;
  rayonBase: number;
  camera: Camera;
  arcs?: ArcCarte[];
  points?: PointCarte[];
  paysAllumes?: Set<string>;
}) {
  // Arrondis : on ne recalcule les tracés que si la caméra a vraiment bougé.
  const lon = Math.round(camera.centre[0] * 100) / 100;
  const lat = Math.round(camera.centre[1] * 100) / 100;
  const zoom = Math.round(camera.zoom * 1000) / 1000;
  const rayon = rayonBase * zoom;

  const { proj, path } = useMemo(() => {
    const proj = geoOrthographic()
      .translate([cx, cy])
      .scale(rayon)
      .rotate([-lon, -lat, 0])
      .clipAngle(90)
      .clipExtent([
        [-20, -20],
        [largeur + 20, hauteur + 20],
      ]);
    return { proj, path: geoPath(proj) };
  }, [cx, cy, rayon, lon, lat, largeur, hauteur]);

  const fond = useMemo(() => PAYS.map((p) => ({ id: p.id, d: path(p.f) ?? "" })).filter((p) => p.d !== ""), [path]);
  const sphere = useMemo(() => path({ type: "Sphere" }) ?? "", [path]);
  const graticule = useMemo(() => path(GRATICULE) ?? "", [path]);

  const visible = (p: LonLat) => geoDistance(p, [lon, lat]) < Math.PI / 2 - 0.01;
  const halo = clamp01(1 - (zoom - 1) / 1.1);
  // Pays du voyage dorés vus de loin ; en vue rapprochée, ils rempliraient
  // tout l'écran : on garde le liseré doré et on éteint le remplissage.
  const remplissageAllume = melanger("#4A3F25", "#253252", clamp01((zoom - 1.6) / 2));

  // Étiquettes : placement glouton par priorité, on saute celles qui
  // tomberaient sur une étiquette déjà posée.
  const placees: [number, number][] = [];
  const pointsRendus = [...points]
    .sort((a, b) => (b.priorite ?? 0) - (a.priorite ?? 0))
    .filter((p) => visible(p.pos))
    .map((p) => {
      const xy = proj(p.pos);
      if (!xy) return null;
      let etiquette = p.etiquette;
      if (etiquette) {
        if (placees.some(([x, y]) => Math.abs(x - xy[0]) < 120 && Math.abs(y - xy[1]) < 34)) etiquette = undefined;
        else placees.push(xy);
      }
      return { ...p, xy, etiquette };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} className="absolute inset-0" aria-hidden>
      <defs>
        <radialGradient id="pz-ocean" gradientUnits="userSpaceOnUse" cx={cx - rayon * 0.25} cy={cy - rayon * 0.3} r={rayon * 1.3}>
          <stop offset="0%" stopColor="#1A3260" />
          <stop offset="55%" stopColor="#10224A" />
          <stop offset="100%" stopColor="#081430" />
        </radialGradient>
        <radialGradient id="pz-atmo" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={rayon + 26}>
          <stop offset="88%" stopColor="#F5C56B" stopOpacity="0" />
          <stop offset="95%" stopColor="#F5C56B" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#F5C56B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pz-reflet" gradientUnits="userSpaceOnUse" cx={cx - rayon * 0.4} cy={cy - rayon * 0.45} r={rayon * 0.9}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="pz-lueur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {halo > 0 && <circle cx={cx} cy={cy} r={rayon + 26} fill="url(#pz-atmo)" opacity={halo} />}
      <path d={sphere} fill="url(#pz-ocean)" />
      <path d={graticule} fill="none" stroke="#ffffff" strokeOpacity={0.05} strokeWidth={0.7} />
      {fond.map((p) => {
        const allume = paysAllumes?.has(p.id);
        return (
          <path
            key={p.id || p.d.slice(0, 16)}
            d={p.d}
            fill={allume ? remplissageAllume : "#1E2E52"}
            stroke={allume ? "#C99A45" : "#34487A"}
            strokeOpacity={allume ? 0.75 : 0.7}
            strokeWidth={allume ? 1.1 : 0.7}
            strokeLinejoin="round"
          />
        );
      })}
      {halo > 0 && <path d={sphere} fill="url(#pz-reflet)" opacity={halo} />}

      {arcs.map((a, i) => (
        <TraceArc key={i} arc={a} path={path} proj={proj} visible={visible} />
      ))}

      {pointsRendus.map((p, i) => (
        <g key={i} transform={`translate(${p.xy[0]}, ${p.xy[1]})`}>
          {p.actif &&
            [0, 0.8, 1.6].map((d) => (
              <circle
                key={d}
                r={26}
                fill="none"
                stroke={p.couleur ?? "#F5C56B"}
                strokeWidth={2.5}
                style={{ transformOrigin: "0 0", animation: `pzAnneau 2.4s ${d}s ease-out infinite` }}
              />
            ))}
          <circle r={p.actif ? 9 : 6} fill="#0B1426" stroke={p.couleur ?? "#F5C56B"} strokeWidth={p.actif ? 3.5 : 2.5} />
          {p.etiquette && (
            <text
              x={14}
              y={-12}
              fill="#ffffff"
              fontSize={p.actif ? 26 : 20}
              fontWeight={p.actif ? 700 : 600}
              stroke="#050A14"
              strokeWidth={6}
              strokeOpacity={0.85}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {p.etiquette}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function TraceArc({
  arc,
  path,
  proj,
  visible,
}: {
  arc: ArcCarte;
  path: ReturnType<typeof geoPath>;
  proj: ReturnType<typeof geoOrthographic>;
  visible: (p: LonLat) => boolean;
}) {
  const interp = geoInterpolate(arc.de, arc.vers);
  const angle = geoDistance(arc.de, arc.vers);
  const n = Math.min(160, Math.max(12, Math.ceil((angle * 180) / Math.PI) * 3));
  const p = clamp01(arc.progression);
  const coords: LonLat[] = [];
  for (let i = 0; i <= n; i++) coords.push(interp((p * i) / n) as LonLat);
  const fait = p > 0 ? (path({ type: "LineString", coordinates: coords }) ?? "") : "";
  const tout = arc.fantome ? (path({ type: "LineString", coordinates: Array.from({ length: n + 1 }, (_, i) => interp(i / n)) }) ?? "") : "";
  const opacite = arc.opacite ?? 1;
  const largeur = arc.sol ? 5 : 4;

  let tete: { x: number; y: number; cap: number } | null = null;
  if (arc.vehicule && p > 0 && p < 1) {
    const ici = interp(p) as LonLat;
    const avant = interp(Math.max(0, p - 0.01)) as LonLat;
    const a = proj(ici);
    const b = proj(avant);
    if (a && b && visible(ici)) tete = { x: a[0], y: a[1], cap: (Math.atan2(a[1] - b[1], a[0] - b[0]) * 180) / Math.PI + 90 };
  }

  return (
    <g opacity={opacite}>
      {tout && <path d={tout} fill="none" stroke={arc.couleur} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" />}
      {fait && (
        <>
          <path d={fait} fill="none" stroke={arc.couleur} strokeOpacity={0.35} strokeWidth={largeur + 6} strokeLinecap="round" filter="url(#pz-lueur)" />
          <path
            d={fait}
            fill="none"
            stroke={arc.couleur}
            strokeWidth={largeur}
            strokeLinecap="round"
            strokeDasharray={arc.sol ? "1 11" : undefined}
          />
        </>
      )}
      {tete &&
        (arc.sol ? (
          <circle cx={tete.x} cy={tete.y} r={9} fill="#ffffff" stroke={arc.couleur} strokeWidth={4} />
        ) : (
          <path d={AVION} transform={`translate(${tete.x}, ${tete.y}) rotate(${tete.cap}) scale(1.6)`} fill="#ffffff" stroke="#0B1426" strokeWidth={0.8} filter="url(#pz-lueur)" />
        ))}
    </g>
  );
}
