import { useMemo } from "react";
import { geoInterpolate, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import monde from "world-atlas/countries-110m.json";
import { AlertTriangle, BedDouble, Bus, Hourglass, Plane, PlaneLanding } from "lucide-react";
import type { Chronologie } from "../domaine/calcul";
import { programmeParJour, type LigneProgramme } from "../domaine/programme";
import { formatDuree, formatKm } from "../domaine/temps";
import type { Lieu } from "../domaine/types";

/* Colonne de droite de l'éditeur : aperçu du trajet, chiffres clés et
   programme jour par jour, recalculés à chaque frappe. */

const topo = monde as unknown as Topology;
const PAYS = (feature(topo, topo.objects.countries as GeometryCollection) as FeatureCollection<Geometry>).features;

const ICONE: Record<LigneProgramme["type"], typeof Plane> = {
  vol: Plane,
  arrivee: PlaneLanding,
  escale: Hourglass,
  transfert: Bus,
  sejour: BedDouble,
};

export function FeuilleDeRoute({ c }: { c: Chronologie }) {
  const jours = useMemo(() => programmeParJour(c), [c]);
  const t = c.totaux;
  const chiffres = [
    { v: c.segments.length > 0 ? String(t.jours) : "–", l: "jours" },
    { v: String(t.nuits), l: "nuits" },
    { v: String(t.nbVols), l: t.nbVols > 1 ? "vols" : "vol" },
    { v: t.distanceKm > 0 ? formatKm(t.distanceKm) : "–", l: "parcourus" },
    { v: t.minutesVol > 0 ? formatDuree(t.minutesVol) : "–", l: "de vol" },
    { v: String(t.pays.length), l: "pays" },
  ];
  return (
    <div className="space-y-4">
      {c.alertes.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {c.alertes.length === 1 ? "1 point à vérifier" : `${c.alertes.length} points à vérifier`} dans les étapes.
        </div>
      )}
      <div className="carte p-4">
        <p className="champ-libelle">Aperçu du trajet</p>
        <ApercuCarte c={c} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {chiffres.map((x) => (
            <div key={x.l} className="rounded-xl bg-[#F7F4EE] px-2 py-2 text-center">
              <p className="text-[15px] font-bold tabular-nums">{x.v}</p>
              <p className="text-[11px] text-slate-500">{x.l}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="carte p-4">
        <p className="champ-libelle">Programme</p>
        {jours.length === 0 && <p className="py-4 text-sm text-slate-500">Ajoute une première étape pour voir le programme.</p>}
        <div className="space-y-4">
          {jours.map((j) => (
            <div key={j.date}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-or-fonce">{j.libelle}</p>
              <ul className="space-y-1.5">
                {j.lignes.map((l) => {
                  const Icone = ICONE[l.type];
                  return (
                    <li key={l.cle} className="flex gap-2.5 text-sm">
                      <span className="w-14 shrink-0 font-semibold tabular-nums">{l.heure}</span>
                      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0">
                        <span className="block leading-snug">{l.texte}</span>
                        {l.detail && <span className="block text-xs leading-snug text-slate-500">{l.detail}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {jours.length > 0 && <p className="mt-4 text-xs text-slate-400">Toutes les heures sont en heure locale.</p>}
      </div>
    </div>
  );
}

const L = 340;
const H = 200;

function ApercuCarte({ c }: { c: Chronologie }) {
  const rendu = useMemo(() => {
    if (!c.depart) return null;
    const lieux: Lieu[] = [c.depart];
    for (const g of c.segments) if (!lieux.some((l) => l.id === g.vers.id)) lieux.push(g.vers);
    // Coins à ±1,5° autour de chaque lieu : un trajet court reste lisible.
    const coins = lieux.flatMap((l) => [
      [l.lon - 1.5, l.lat - 1.5],
      [l.lon + 1.5, l.lat + 1.5],
    ]);
    const proj = geoMercator()
      .fitExtent(
        [
          [18, 18],
          [L - 18, H - 18],
        ],
        { type: "MultiPoint", coordinates: coins },
      )
      .clipExtent([
        [0, 0],
        [L, H],
      ]);
    const path = geoPath(proj);
    const pays = PAYS.map((f, i) => ({ k: i, d: path(f) ?? "" })).filter((p) => p.d);
    const traits = c.segments
      .filter((g) => g.etape.type === "vol" || g.etape.type === "transfert")
      .map((g) => {
        const interp = geoInterpolate([g.de.lon, g.de.lat], [g.vers.lon, g.vers.lat]);
        const coords = Array.from({ length: 41 }, (_, i) => interp(i / 40));
        return { k: g.etape.id, d: path({ type: "LineString", coordinates: coords }) ?? "", sol: g.etape.type === "transfert" };
      });
    const noms = new Set<string>();
    const points = lieux.map((l) => {
      const xy = proj([l.lon, l.lat]) ?? [0, 0];
      const etiquette = noms.has(l.nom) ? null : l.nom;
      noms.add(l.nom);
      return { k: l.id, xy, etiquette };
    });
    return { pays, traits, points };
  }, [c]);

  if (!rendu) return <div className="h-[200px] rounded-xl bg-[#E3EAF1]" />;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="block w-full rounded-xl" style={{ background: "#DCE5EE" }} aria-label="Carte du trajet">
      {rendu.pays.map((p) => (
        <path key={p.k} d={p.d} fill="#F4F0E8" stroke="#CDC3B2" strokeWidth={0.6} />
      ))}
      {rendu.traits.map((t) => (
        <path
          key={t.k}
          d={t.d}
          fill="none"
          stroke={t.sol ? "#1BA597" : "#D79A2B"}
          strokeWidth={t.sol ? 2.2 : 2}
          strokeDasharray={t.sol ? "1 4" : undefined}
          strokeLinecap="round"
        />
      ))}
      {rendu.points.map((p) => (
        <g key={p.k} transform={`translate(${p.xy[0]}, ${p.xy[1]})`}>
          <circle r={3.6} fill="#0B1426" stroke="#fff" strokeWidth={1.4} />
          {p.etiquette && (
            <text x={6} y={-5} fontSize={10} fontWeight={600} fill="#0B1426" stroke="#F4F0E8" strokeWidth={3} paintOrder="stroke">
              {p.etiquette}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
