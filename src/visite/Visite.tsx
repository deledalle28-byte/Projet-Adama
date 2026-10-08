import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Eye, Globe2, Moon, Plane, Play, Route } from "lucide-react";
import { calculerChronologie, type Chronologie } from "../domaine/calcul";
import { itineraire } from "../domaine/programme";
import { formatKm } from "../domaine/temps";
import type { Lieu, Scenario } from "../domaine/types";
import { cadrer, Carte, type ArcCarte, type LonLat, type PointCarte } from "../presentation/Carte";
import { Apparait, Etoiles, TitreAnime } from "../presentation/elements";
import { Presentation, useEchelleScene } from "../presentation/Presentation";
import { construireScenes, OR, periode, SCENE, tailleTitre, TURQUOISE } from "../presentation/scenes";

/* La visite telle que la voient les proches : un écran d'accueil (le
   voyage en un coup d'œil et « Lancer la visite »), puis la présentation
   en plein écran. Le même composant sert au fichier de visite exporté et à
   l'aperçu dans le carnet : ce qu'on prévisualise est ce qu'on envoie. */

export function Visite({ scenario, onFermerApercu }: { scenario: Scenario; onFermerApercu?: () => void }) {
  const chrono = useMemo(() => calculerChronologie(scenario), [scenario]);
  const [lancee, setLancee] = useState(false);
  if (lancee) {
    return <Presentation scenario={scenario} chronologie={chrono} libelleRetour="Retour à l'accueil" onQuitter={() => setLancee(false)} />;
  }
  return <Accueil s={scenario} c={chrono} onLancer={() => setLancee(true)} onFermerApercu={onFermerApercu} />;
}

/** Millisecondes écoulées depuis l'affichage, image par image. */
function useHorloge(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const debut = performance.now();
    let raf = 0;
    const tick = (maintenant: number) => {
      setT(maintenant - debut);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

const pos = (l: Lieu): LonLat => [l.lon, l.lat];

function Accueil({ s, c, onLancer, onFermerApercu }: { s: Scenario; c: Chronologie; onLancer: () => void; onFermerApercu?: () => void }) {
  const t = useHorloge();
  const echelle = useEchelleScene();

  const { camera, arcs, points, pays, minutes } = useMemo(() => {
    const lieux: Lieu[] = c.depart ? [c.depart] : [];
    for (const g of c.segments) if (!lieux.some((l) => l.id === g.vers.id)) lieux.push(g.vers);
    const noms = new Set<string>();
    const points: PointCarte[] = lieux.map((l, k) => {
      const etiquette = noms.has(l.nom) ? undefined : l.nom;
      noms.add(l.nom);
      return { pos: pos(l), etiquette, priorite: k === 0 ? 100 : 50 - k };
    });
    const arcs: ArcCarte[] = c.segments
      .filter((g) => g.etape.type === "vol" || g.etape.type === "transfert")
      .map((g) => ({ de: pos(g.de), vers: pos(g.vers), progression: 1, couleur: g.etape.type === "vol" ? OR : TURQUOISE, sol: g.etape.type === "transfert" }));
    const duree = construireScenes(s, c).reduce((a, sc) => a + (Number.isFinite(sc.duree) ? sc.duree : 0), 0);
    return {
      camera: cadrer(lieux.map(pos), SCENE.rayonBase, SCENE.rayonVue, 18),
      arcs,
      points,
      pays: new Set(lieux.map((l) => l.m49).filter((m): m is string => !!m)),
      minutes: Math.max(1, Math.round(duree / 60_000)),
    };
  }, [s, c]);

  // Le globe se balance doucement autour du trajet (rafraîchi 20 fois par seconde).
  const tCarte = Math.floor(t / 50) * 50;
  const vue = { centre: [camera.centre[0] + 7 * Math.sin(tCarte / 7_000), camera.centre[1]] as LonLat, zoom: camera.zoom };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onLancer();
      } else if (e.key === "Escape") onFermerApercu?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLancer, onFermerApercu]);

  const tot = c.totaux;
  const villes = itineraire(c);
  const puces: { icone: typeof Plane; texte: string }[] = [];
  if (c.segments.length > 0) puces.push({ icone: Clock3, texte: `${tot.jours} jours` });
  if (tot.nuits > 0) puces.push({ icone: Moon, texte: `${tot.nuits} nuit${tot.nuits > 1 ? "s" : ""}` });
  if (tot.nbVols > 0) puces.push({ icone: Plane, texte: `${tot.nbVols} vol${tot.nbVols > 1 ? "s" : ""}` });
  if (tot.distanceKm > 0) puces.push({ icone: Route, texte: formatKm(tot.distanceKm) });
  if (tot.pays.length > 1) puces.push({ icone: Globe2, texte: `${tot.pays.length} pays` });
  const titre = s.nom || "Notre voyage";

  return (
    <div className="pz-scene" role="dialog" aria-modal="true" aria-label={`Visite : ${titre}`}>
      <Etoiles />
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: SCENE.w, height: SCENE.h, transform: `translate(-50%, -50%) scale(${echelle})`, transformOrigin: "center" }}
      >
        <div className="absolute inset-0" style={{ opacity: Math.min(1, t / 1_200) }}>
          <Carte
            largeur={SCENE.w}
            hauteur={SCENE.h}
            cx={SCENE.cx}
            cy={SCENE.cy}
            rayonBase={SCENE.rayonBase}
            camera={vue}
            arcs={arcs}
            points={points}
            paysAllumes={pays}
          />
        </div>
        <div className="pz-voile" />
        <div className="absolute left-[100px] top-[130px] w-[720px]">
          <Apparait t={t} debut={150}>
            <p className="pz-eyebrow">{s.voyageurs || "Carnet de route"}</p>
          </Apparait>
          <TitreAnime t={t} texte={titre} className="mt-5" style={{ fontSize: tailleTitre(titre, 88) }} debut={300} />
          <Apparait t={t} debut={800} className="mt-6 text-[26px] text-white/80">
            {periode(c)}
          </Apparait>
          {puces.length > 0 && (
            <Apparait t={t} debut={1_000} className="mt-8 flex flex-wrap gap-3">
              {puces.map((p) => (
                <span key={p.texte} className="pz-puce">
                  <p.icone className="h-5 w-5 text-[#F5C56B]" />
                  {p.texte}
                </span>
              ))}
            </Apparait>
          )}
          {villes.length > 1 && (
            <Apparait t={t} debut={1_200} className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[21px] text-white/75">
              {villes.map((v, i) => (
                <span key={i} className="inline-flex items-center gap-3">
                  {i > 0 && <span className="text-[#F5C56B]">→</span>}
                  <span className={i === 0 || i === villes.length - 1 ? "font-semibold text-white" : ""}>{v}</span>
                </span>
              ))}
            </Apparait>
          )}
          <Apparait t={t} debut={1_500} className="mt-12 flex items-center gap-6">
            <button type="button" className="pz-bouton inline-flex items-center gap-3 !px-9 !py-[18px] !text-[20px]" onClick={onLancer}>
              <Play className="h-5 w-5 fill-current" />
              Lancer la visite
            </button>
            <span className="text-[16px] leading-snug text-white/55">
              Environ {minutes} minute{minutes > 1 ? "s" : ""}, en plein écran.
              <br />
              Espace : pause · ← → : avancer ou revenir
            </span>
          </Apparait>
        </div>
      </div>

      {onFermerApercu && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white/80 backdrop-blur">
            <Eye className="h-4 w-4 text-[#F5C56B]" />
            Aperçu : voici ce que verront tes proches en ouvrant le fichier de visite
          </span>
          <button type="button" className="pz-bouton-discret inline-flex items-center gap-2 !py-2.5 !text-sm" onClick={onFermerApercu}>
            <ArrowLeft className="h-4 w-4" />
            Retour au carnet
          </button>
        </div>
      )}
    </div>
  );
}
