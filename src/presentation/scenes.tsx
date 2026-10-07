import type { ReactNode } from "react";
import { BedDouble, Bus, Car, CarTaxiFront, Clock3, Footprints, Globe2, Hourglass, Moon, Plane, PlaneLanding, Route, TrainFront } from "lucide-react";
import type { Chronologie, Segment } from "../domaine/calcul";
import { itineraire, LIBELLE_MODE, programmeParJour, titreTrajet, type LigneProgramme } from "../domaine/programme";
import {
  ajouterJours,
  dateAvecAnnee,
  dateLongue,
  ecartJours,
  formatDecalage,
  formatDuree,
  formatKm,
  heureDecimale,
  heureLocale,
  jourCourt,
  localVersUtc,
  utcVersLocal,
} from "../domaine/temps";
import type { EtapeEscale, EtapeSejour, EtapeTransfert, EtapeVol, Lieu, ModeTransfert, Scenario } from "../domaine/types";
import { barycentre, cadrer, interpolerCamera, type ArcCarte, type Camera, type LonLat, type PointCarte } from "./Carte";
import { Apparait, compteur, easeInOutCubic, fenetre, SousTitre, TitreAnime, VITESSE_ECRITURE } from "./elements";
import { a, de } from "../domaine/francais";

/* Les scènes sont composées à partir de la chronologie du scénario : une
   ouverture, une scène par étape (vol, escale, transfert, séjour), le
   programme jour par jour, puis le récapitulatif. Changer une durée, un
   lieu ou un commentaire dans l'éditeur change le film. */

/** Scène fixe de 1600 × 900, mise à l'échelle de l'écran. */
export const SCENE = { w: 1600, h: 900, cx: 1130, cy: 450, rayonBase: 360, rayonVue: 280 };

export const OR = "#F5C56B";
export const TURQUOISE = "#5EEAD4";

export interface CoucheCarte {
  arcs: ArcCarte[];
  points: PointCarte[];
  pays: Set<string>;
}

export interface Actions {
  rejouer: () => void;
  quitter: () => void;
}

export interface Scene {
  cle: string;
  chapitre: string;
  /** ms ; Infinity = la scène attend l'utilisateur. */
  duree: number;
  camera: (t: number) => Camera;
  carte: (t: number) => CoucheCarte;
  /** Opacité du voile sombre à gauche (lisibilité du texte). */
  voile: number;
  rendu: (t: number, actions: Actions) => ReactNode;
}

const pos = (l: Lieu): LonLat => [l.lon, l.lat];
const estDeplacement = (g: Segment) => g.etape.type === "vol" || g.etape.type === "transfert";
const couleurDe = (g: Segment) => (g.etape.type === "vol" ? OR : TURQUOISE);
const dureeLecture = (texte: string) => texte.length * VITESSE_ECRITURE;
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Espaces insécables : « La Mecque » ne se coupe jamais en fin de ligne. */
const insecable = (s: string) => s.replace(/ /g, "\u00A0");
/** Taille de titre dégressive : un nom long tient sur la largeur du panneau. */
const tailleTitre = (texte: string, base: number) =>
  Math.round(base * (texte.length <= 14 ? 1 : texte.length <= 18 ? 0.9 : texte.length <= 24 ? 0.8 : 0.68));
/** Étiquette d'arrivée : « Aéroport de Médine » plutôt que son nom officiel. */
const etiquetteArrivee = (depuis: Lieu, vers: Lieu) =>
  depuis.nom !== vers.nom ? vers.nom : vers.type === "aeroport" ? `Aéroport ${de(vers.nom)}` : vers.detail ?? vers.nom;

const ICONE_MODE: Record<ModeTransfert, typeof Bus> = {
  bus: Bus,
  train: TrainFront,
  voiture: Car,
  taxi: CarTaxiFront,
  pied: Footprints,
};

function travelling(debut: Camera, fin: Camera, duree = 2400) {
  return (t: number) => interpolerCamera(debut, fin, easeInOutCubic(fenetre(t, 0, duree)));
}

export function construireScenes(s: Scenario, c: Chronologie): Scene[] {
  const scenes: Scene[] = [];
  if (!c.depart) return scenes;
  const depart = c.depart;
  const segments = c.segments;
  const deplacements = segments.filter(estDeplacement);
  const vols = segments.filter((g) => g.etape.type === "vol");

  // Tous les lieux du voyage, dans l'ordre, sans doublon.
  const lieux: Lieu[] = [depart];
  for (const g of segments) if (!lieux.some((l) => l.id === g.vers.id)) lieux.push(g.vers);
  const centreVoyage = barycentre(lieux.map(pos));
  const camGlobale = cadrer(lieux.map(pos), SCENE.rayonBase, SCENE.rayonVue, 18);

  const arcsAvant = (i: number, opacite = 0.55): ArcCarte[] =>
    segments
      .slice(0, i)
      .filter(estDeplacement)
      .map((g) => ({ de: pos(g.de), vers: pos(g.vers), progression: 1, couleur: couleurDe(g), sol: g.etape.type === "transfert", opacite }));
  const lieuxJusqua = (i: number): Lieu[] => {
    const vus: Lieu[] = [depart];
    for (const g of segments.slice(0, i + 1)) if (!vus.some((l) => l.id === g.vers.id)) vus.push(g.vers);
    return vus;
  };
  const paysDe = (ls: Lieu[]) => new Set(ls.map((l) => l.m49).filter((m): m is string => !!m));
  const pointsDiscrets = (ls: Lieu[]): PointCarte[] => ls.map((l) => ({ pos: pos(l), couleur: "rgba(245,197,107,0.7)" }));
  /** Étiquettes : une par nom de ville (Médine et l'aéroport de Médine = une). */
  const pointsEtiquetes = (ls: Lieu[]): PointCarte[] => {
    const noms = new Set<string>();
    return ls.map((l, k) => {
      const etiquette = noms.has(l.nom) ? undefined : l.nom;
      noms.add(l.nom);
      return { pos: pos(l), etiquette, priorite: k === 0 ? 100 : 50 - k };
    });
  };

  let camera: Camera = { centre: [centreVoyage[0] + 38, centreVoyage[1] - 8], zoom: 1 };

  /* ── Ouverture ─────────────────────────────────────────────────── */
  {
    const debutCam = camera;
    const duree = Math.max(12_000, 3_400 + dureeLecture(s.introduction) + 3_000);
    const parArc = deplacements.length > 0 ? 5_000 / deplacements.length : 0;
    scenes.push({
      cle: "ouverture",
      chapitre: "Le voyage",
      duree,
      voile: 1,
      camera: travelling(debutCam, camGlobale, 6_500),
      carte: (t) => ({
        arcs: deplacements.map((g, k) => ({
          de: pos(g.de),
          vers: pos(g.vers),
          progression: fenetre(t, 1_400 + k * parArc, parArc * 1.1),
          couleur: couleurDe(g),
          sol: g.etape.type === "transfert",
        })),
        points: pointsEtiquetes(lieux),
        pays: paysDe(lieux),
      }),
      rendu: (t) => <SceneOuverture t={t} s={s} c={c} />,
    });
    camera = camGlobale;
  }

  /* ── Une scène par étape ───────────────────────────────────────── */
  segments.forEach((g, i) => {
    const e = g.etape;
    const vusAvant = lieuxJusqua(i - 1);
    const debutCam = camera;

    if (e.type === "vol" || e.type === "transfert") {
      const estVol = e.type === "vol";
      const fin = cadrer([pos(g.de), pos(g.vers)], SCENE.rayonBase, SCENE.rayonVue, estVol ? 6 : 1.6);
      const duree = Math.max(estVol ? 12_500 : 10_500, 2_600 + dureeLecture(e.commentaire) + 3_500);
      const debutTrace = 1_700;
      const dureeTrace = Math.min(duree - debutTrace - 2_500, estVol ? 8_000 : 5_500);
      const progression = (t: number) => easeInOutCubic(fenetre(t, debutTrace, dureeTrace));
      const numero = vols.indexOf(g) + 1;
      scenes.push({
        cle: `etape-${e.id}`,
        chapitre: estVol ? `Vol ${numero} sur ${vols.length}` : `Transfert ${LIBELLE_MODE[e.mode]}`,
        duree,
        voile: 1,
        camera: travelling(debutCam, fin, 2_300),
        carte: (t) => ({
          arcs: [
            ...arcsAvant(i),
            { de: pos(g.de), vers: pos(g.vers), progression: progression(t), couleur: couleurDe(g), sol: !estVol, vehicule: true, fantome: true },
          ],
          points: [
            ...pointsDiscrets(vusAvant),
            { pos: pos(g.de), etiquette: g.de.nom, priorite: 5 },
            { pos: pos(g.vers), etiquette: etiquetteArrivee(g.de, g.vers), actif: progression(t) >= 1, priorite: 6 },
          ],
          pays: paysDe(lieuxJusqua(i)),
        }),
        rendu: (t) => <SceneTrajet t={t} g={g} e={e} numero={numero} total={vols.length} progression={progression(t)} />,
      });
      camera = fin;
      return;
    }

    const fin = cadrer([pos(g.de)], SCENE.rayonBase, SCENE.rayonVue, e.type === "escale" ? 7 : 4.5);
    const duree = Math.max(e.type === "escale" ? 9_500 : 11_000, 2_400 + dureeLecture(e.commentaire) + 3_500);
    scenes.push({
      cle: `etape-${e.id}`,
      chapitre: `${e.type === "escale" ? "Escale" : "Séjour"} · ${g.de.nom}`,
      duree,
      voile: 1,
      camera: travelling(debutCam, fin, 2_000),
      carte: () => ({
        arcs: arcsAvant(i, 0.7),
        points: [...pointsDiscrets(vusAvant), { pos: pos(g.de), etiquette: g.de.nom, actif: true, priorite: 9 }],
        pays: paysDe(lieuxJusqua(i)),
      }),
      rendu: (t) => (e.type === "escale" ? <SceneEscale t={t} g={g} e={e} /> : <SceneSejour t={t} g={g} e={e} />),
    });
    camera = fin;
  });

  /* ── Programme ─────────────────────────────────────────────────── */
  if (segments.length > 0) {
    const debutCam = camera;
    const nbLignes = programmeParJour(c).reduce((a, j) => a + j.lignes.length, 0);
    scenes.push({
      cle: "programme",
      chapitre: "Le programme",
      duree: 14_000 + nbLignes * 350,
      voile: 1,
      camera: (t) => {
        const k = easeInOutCubic(fenetre(t, 0, 3_000));
        const base = interpolerCamera(debutCam, camGlobale, k);
        return { centre: [base.centre[0] + t * 0.0015, base.centre[1]], zoom: base.zoom };
      },
      carte: () => ({ arcs: arcsAvant(segments.length, 0.35), points: pointsDiscrets(lieux), pays: paysDe(lieux) }),
      rendu: (t) => <SceneProgramme t={t} c={c} />,
    });
    camera = camGlobale;
  }

  /* ── Récapitulatif ─────────────────────────────────────────────── */
  {
    const debutCam = camera;
    const finCam: Camera = { centre: centreVoyage, zoom: 1 };
    scenes.push({
      cle: "fin",
      chapitre: "Récapitulatif",
      duree: Infinity,
      voile: 1,
      camera: (t) => {
        const base = interpolerCamera(debutCam, finCam, easeInOutCubic(fenetre(t, 0, 3_000)));
        // Puis la Terre tourne doucement sur elle-même.
        const derive = Math.max(0, t - 3_000) * 0.004;
        return { centre: [base.centre[0] - derive, base.centre[1]], zoom: base.zoom };
      },
      carte: () => ({ arcs: arcsAvant(segments.length, 0.9), points: pointsEtiquetes(lieux), pays: paysDe(lieux) }),
      rendu: (t, actions) => <SceneFin t={t} s={s} c={c} actions={actions} />,
    });
  }

  return scenes;
}

/* ════════════════════════════════════════════════════════════════════
   Rendus
   ════════════════════════════════════════════════════════════════════ */

function Eyebrow({ t, children, debut = 120 }: { t: number; children: ReactNode; debut?: number }) {
  return (
    <Apparait t={t} debut={debut}>
      <p className="pz-eyebrow">{children}</p>
    </Apparait>
  );
}

function periode(c: Chronologie): string {
  if (!c.depart) return "";
  const finLieu = c.segments[c.segments.length - 1]?.vers ?? c.depart;
  if (c.segments.length === 0) return `Le ${dateLongue(c.debut, c.depart.fuseau)} ${utcVersLocal(c.debut, c.depart.fuseau).date.slice(0, 4)}`;
  const anneeDebut = utcVersLocal(c.debut, c.depart.fuseau).date.slice(0, 4);
  const anneeFin = utcVersLocal(c.fin, finLieu.fuseau).date.slice(0, 4);
  const debut = dateLongue(c.debut, c.depart.fuseau) + (anneeDebut !== anneeFin ? ` ${anneeDebut}` : "");
  return `Du ${debut} au ${dateLongue(c.fin, finLieu.fuseau)} ${anneeFin}`;
}

/* ── Ouverture ──────────────────────────────────────────────────────── */
function SceneOuverture({ t, s, c }: { t: number; s: Scenario; c: Chronologie }) {
  const tot = c.totaux;
  const villes = itineraire(c);
  const puces: { icone: typeof Plane; texte: string }[] = [];
  if (tot.jours > 0 && c.segments.length > 0) puces.push({ icone: Clock3, texte: `${Math.round(compteur(t, 1_500, 1_800, tot.jours))} jours` });
  if (tot.nuits > 0) puces.push({ icone: Moon, texte: `${Math.round(compteur(t, 1_600, 1_800, tot.nuits))} nuits` });
  if (tot.nbVols > 0) puces.push({ icone: Plane, texte: `${tot.nbVols} vol${tot.nbVols > 1 ? "s" : ""}` });
  if (tot.distanceKm > 0) puces.push({ icone: Route, texte: formatKm(compteur(t, 1_700, 2_400, tot.distanceKm)) });
  if (tot.pays.length > 1) puces.push({ icone: Globe2, texte: `${tot.pays.length} pays` });
  return (
    <>
      <div className="absolute left-[100px] top-[150px] w-[720px]">
        <Eyebrow t={t} debut={200}>
          {s.voyageurs || "Carnet de route"}
        </Eyebrow>
        <TitreAnime t={t} texte={s.nom || "Notre voyage"} className="mt-5" style={{ fontSize: tailleTitre(s.nom || "Notre voyage", 88) }} debut={400} />
        <Apparait t={t} debut={1_100} className="mt-6 text-[26px] text-white/80">
          {periode(c)}
        </Apparait>
        <Apparait t={t} debut={1_400} className="mt-8 flex flex-wrap gap-3">
          {puces.map((p) => (
            <span key={p.texte.replace(/[\d\s]/g, "")} className="pz-puce">
              <p.icone className="h-5 w-5 text-[#F5C56B]" />
              {p.texte}
            </span>
          ))}
        </Apparait>
        {villes.length > 1 && (
          <Apparait t={t} debut={2_000} className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-1 text-[21px] text-white/75">
            {villes.map((v, i) => (
              <span key={i} className="inline-flex items-center gap-3">
                {i > 0 && <span className="text-[#F5C56B]">→</span>}
                <span className={i === 0 || i === villes.length - 1 ? "font-semibold text-white" : ""}>{v}</span>
              </span>
            ))}
          </Apparait>
        )}
      </div>
      <SousTitre texte={s.introduction} t={t} debut={3_400} />
    </>
  );
}

/* ── Vol ou transfert ───────────────────────────────────────────────── */
function TuileHoraire({
  t,
  debut,
  libelle,
  ms,
  lieu,
  note,
  badge,
}: {
  t: number;
  debut: number;
  libelle: string;
  ms: number;
  lieu: Lieu;
  note: string;
  badge?: string;
}) {
  return (
    <Apparait t={t} debut={debut} className="pz-tuile relative">
      <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-white/50">{libelle}</p>
      <p className="mt-3 text-[19px] text-white/75">{majuscule(dateLongue(ms, lieu.fuseau))}</p>
      <p className="pz-chiffre mt-1.5 text-[58px] text-[#F5C56B]">{heureLocale(ms, lieu.fuseau)}</p>
      <p className="mt-3 text-[19px] font-semibold leading-snug">
        {lieu.nom}
        {lieu.code && <span className="font-normal text-white/50"> · {lieu.code}</span>}
      </p>
      {lieu.detail && <p className="text-[15px] leading-snug text-white/55">{lieu.detail}</p>}
      <p className="mt-2 text-[13px] text-white/45">{note}</p>
      {badge && (
        <span className="absolute right-5 top-5 rounded-full bg-[#F5C56B]/15 px-3 py-1 text-[13px] font-semibold text-[#F5C56B] ring-1 ring-[#F5C56B]/40">
          {badge}
        </span>
      )}
    </Apparait>
  );
}

function BarreTrajet({ progression, couleur, Icone }: { progression: number; couleur: string; Icone: typeof Plane }) {
  return (
    <div className="relative h-10">
      <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/12" style={{ background: "rgba(255,255,255,0.12)" }} />
      <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ width: `${progression * 100}%`, background: couleur, boxShadow: `0 0 14px ${couleur}` }} />
      <span className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: couleur }} />
      <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2" style={{ borderColor: couleur, background: progression >= 1 ? couleur : "#0B1426" }} />
      <span
        className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0B1426]"
        style={{ left: `${progression * 100}%`, boxShadow: `0 0 0 2px ${couleur}` }}
      >
        <Icone className="h-5 w-5" style={{ color: couleur, transform: Icone === Plane ? "rotate(45deg)" : undefined }} />
      </span>
    </div>
  );
}

function SceneTrajet({
  t,
  g,
  e,
  numero,
  total,
  progression,
}: {
  t: number;
  g: Segment;
  e: EtapeVol | EtapeTransfert;
  numero: number;
  total: number;
  progression: number;
}) {
  const estVol = e.type === "vol";
  const eyebrow = estVol ? [`Vol ${numero} sur ${total}`, e.compagnie, e.numero].filter(Boolean).join(" · ") : `Transfert ${LIBELLE_MODE[e.mode]}`;
  const memeHeure = g.decalageMin === 0;
  const jours = ecartJours(utcVersLocal(g.debut, g.de.fuseau).date, utcVersLocal(g.fin, g.vers.fuseau).date);
  const Icone = estVol ? Plane : ICONE_MODE[e.mode];
  const titre = g.de.nom !== g.vers.nom ? `${insecable(g.de.nom)} → ${insecable(g.vers.nom)}` : titreTrajet(g);
  return (
    <>
      <div className="absolute left-[100px] top-[118px] w-[720px]">
        <Eyebrow t={t}>{eyebrow}</Eyebrow>
        <TitreAnime t={t} texte={titre} className="mt-4" style={{ fontSize: tailleTitre(titre, 72) }} />
        <div className="mt-9 grid grid-cols-2 gap-5">
          <TuileHoraire t={t} debut={650} libelle="Départ" ms={g.debut} lieu={g.de} note={memeHeure ? "heure locale" : `heure ${de(g.de.nom)}`} />
          <TuileHoraire
            t={t}
            debut={850}
            libelle="Arrivée"
            ms={g.fin}
            lieu={g.vers}
            note={memeHeure ? "heure locale" : `heure ${de(g.vers.nom)}`}
            badge={jours > 0 ? `+${jours} jour${jours > 1 ? "s" : ""}` : undefined}
          />
        </div>
        <Apparait t={t} debut={1_150} className="mt-7 px-5">
          <BarreTrajet progression={progression} couleur={estVol ? OR : TURQUOISE} Icone={Icone} />
        </Apparait>
        <Apparait t={t} debut={1_400} className="mt-6 flex flex-wrap gap-3">
          <span className="pz-puce">
            <Clock3 className="h-5 w-5 text-[#F5C56B]" />
            {formatDuree(g.dureeMin)} {estVol ? "de vol" : "de trajet"}
          </span>
          {g.distanceKm >= 1 && (
            <span className="pz-puce">
              <Route className="h-5 w-5 text-[#F5C56B]" />
              {formatKm(g.distanceKm)}
            </span>
          )}
          {!memeHeure && (
            <span className="pz-puce">
              <Globe2 className="h-5 w-5 text-[#F5C56B]" />
              Décalage {formatDecalage(g.decalageMin)}
            </span>
          )}
        </Apparait>
      </div>
      <SousTitre texte={e.commentaire} t={t} debut={2_600} />
    </>
  );
}

/* ── Escale ─────────────────────────────────────────────────────────── */
function arcSvg(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Cadran de 24 h : l'arc doré couvre les heures passées sur place. */
function Cadran24h({ debutH, dureeMin, progression, taille = 300 }: { debutH: number; dureeMin: number; progression: number; taille?: number }) {
  const c = taille / 2;
  const r = c - 34;
  const angle = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2;
  const a0 = angle(debutH);
  const etendue = Math.min(dureeMin / 1440, 0.999) * Math.PI * 2 * progression;
  const a1 = a0 + etendue;
  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={18} />
      {Array.from({ length: 24 }, (_, h) => {
        const a = angle(h);
        const long = h % 6 === 0;
        return (
          <line
            key={h}
            x1={c + (r + 14) * Math.cos(a)}
            y1={c + (r + 14) * Math.sin(a)}
            x2={c + (r + (long ? 24 : 19)) * Math.cos(a)}
            y2={c + (r + (long ? 24 : 19)) * Math.sin(a)}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={long ? 2.5 : 1.2}
          />
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = angle(h);
        return (
          <text key={h} x={c + (r - 32) * Math.cos(a)} y={c + (r - 32) * Math.sin(a) + 5} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={14} fontWeight={600}>
            {h} h
          </text>
        );
      })}
      {etendue > 0.001 && (
        <path d={arcSvg(c, c, r, a0, a1)} fill="none" stroke={OR} strokeWidth={18} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${OR}99)` }} />
      )}
      <circle cx={c + r * Math.cos(a0)} cy={c + r * Math.sin(a0)} r={7} fill="#0B1426" stroke="#fff" strokeWidth={3} />
      <circle cx={c + r * Math.cos(a1)} cy={c + r * Math.sin(a1)} r={7} fill="#fff" />
      <Hourglass x={c - 16} y={c - 16} width={32} height={32} color={OR} strokeWidth={1.8} />
    </svg>
  );
}

function SceneEscale({ t, g, e }: { t: number; g: Segment; e: EtapeEscale }) {
  const fz = g.de.fuseau;
  const jours = ecartJours(utcVersLocal(g.debut, fz).date, utcVersLocal(g.fin, fz).date);
  const nuit = jours > 0 && g.dureeMin >= 240;
  const anime = compteur(t, 900, 2_200, g.dureeMin);
  return (
    <>
      <div className="absolute left-[100px] top-[118px] w-[760px]">
        <Eyebrow t={t}>Escale · {g.de.nom}</Eyebrow>
        <TitreAnime t={t} texte={e.intitule || "Escale"} className="mt-4" style={{ fontSize: tailleTitre(e.intitule || "Escale", 76) }} />
        <div className="mt-10 flex items-center gap-12">
          <Apparait t={t} debut={600}>
            <Cadran24h debutH={heureDecimale(g.debut, fz)} dureeMin={g.dureeMin} progression={easeInOutCubic(fenetre(t, 900, 2_200))} />
          </Apparait>
          <div>
            <Apparait t={t} debut={800}>
              <p className="pz-chiffre text-[78px] text-[#F5C56B]">{formatDuree(Math.round(anime / 5) * 5)}</p>
              <p className="mt-2 text-[15px] font-semibold uppercase tracking-[0.25em] text-white/50">sur place</p>
            </Apparait>
            <Apparait t={t} debut={1_300} className="mt-8">
              <p className="text-[26px]">
                De <b>{heureLocale(g.debut, fz)}</b> à <b>{heureLocale(g.fin, fz)}</b>
              </p>
              <p className="mt-1 text-[17px] text-white/55">
                heure locale · {jours > 0 ? `du ${dateLongue(g.debut, fz)} au ${dateLongue(g.fin, fz)}` : dateLongue(g.debut, fz)}
              </p>
            </Apparait>
            {nuit && (
              <Apparait t={t} debut={1_700} className="mt-6">
                <span className="pz-puce">
                  <Moon className="h-5 w-5 text-[#F5C56B]" />
                  Nuit sur place
                </span>
              </Apparait>
            )}
          </div>
        </div>
      </div>
      <SousTitre texte={e.commentaire} t={t} debut={2_400} />
    </>
  );
}

/* ── Séjour ─────────────────────────────────────────────────────────── */
function SceneSejour({ t, g, e }: { t: number; g: Segment; e: EtapeSejour }) {
  const fz = g.de.fuseau;
  const arrivee = utcVersLocal(g.debut, fz).date;
  const n = Math.max(0, e.nuits);
  const MAX = 14;
  const nuits = Array.from({ length: Math.min(n, MAX) }, (_, k) => jourCourt(localVersUtc(ajouterJours(arrivee, k), "20:00", fz), fz));
  const pas = Math.min(220, 2_400 / Math.max(1, nuits.length));
  const titreSejour = `${n} nuit${n > 1 ? "s" : ""} ${insecable(a(g.de.nom))}`;
  return (
    <>
      <div className="absolute left-[100px] top-[118px] w-[780px]">
        <Eyebrow t={t}>Séjour · {g.de.nom}</Eyebrow>
        <TitreAnime t={t} texte={titreSejour} className="mt-4" style={{ fontSize: tailleTitre(titreSejour, 76) }} />
        <div className="mt-8 flex flex-wrap gap-2.5">
          {nuits.map((j, k) => {
            const allume = fenetre(t, 1_000 + k * pas, 450);
            return (
              <div
                key={k}
                className="flex w-[76px] flex-col items-center rounded-2xl border py-2.5"
                style={{
                  opacity: 0.25 + allume * 0.75,
                  borderColor: allume > 0.5 ? "rgba(245,197,107,0.55)" : "rgba(255,255,255,0.15)",
                  background: allume > 0.5 ? "rgba(245,197,107,0.1)" : "rgba(255,255,255,0.04)",
                  transform: `translateY(${(1 - allume) * 10}px)`,
                }}
              >
                <Moon className="h-5 w-5" style={{ color: allume > 0.5 ? OR : "rgba(255,255,255,0.5)", fill: allume > 0.5 ? OR : "none" }} />
                <span className="mt-1.5 text-[13px] text-white/60">{j.jour}</span>
                <span className="text-[22px] font-bold">{j.numero}</span>
              </div>
            );
          })}
          {n > MAX && (
            <div className="flex w-[76px] items-center justify-center rounded-2xl border border-white/15 text-[18px] font-semibold text-white/70" style={{ opacity: fenetre(t, 3_400, 400) }}>
              +{n - MAX}
            </div>
          )}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-5">
          <Apparait t={t} debut={1_300} className="pz-tuile">
            <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-white/50">Arrivée</p>
            <p className="mt-2 text-[19px] text-white/75">{majuscule(dateLongue(g.debut, fz))}</p>
            <p className="pz-chiffre mt-1.5 text-[46px] text-[#F5C56B]">{heureLocale(g.debut, fz)}</p>
          </Apparait>
          <Apparait t={t} debut={1_500} className="pz-tuile">
            <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-white/50">Départ</p>
            <p className="mt-2 text-[19px] text-white/75">{majuscule(dateLongue(g.fin, fz))}</p>
            <p className="pz-chiffre mt-1.5 text-[46px] text-[#F5C56B]">{heureLocale(g.fin, fz)}</p>
          </Apparait>
        </div>
        {e.hebergement && (
          <Apparait t={t} debut={1_900} className="mt-6 flex items-center gap-3 text-[22px]">
            <BedDouble className="h-6 w-6 text-[#F5C56B]" />
            {e.hebergement}
          </Apparait>
        )}
      </div>
      <SousTitre texte={e.commentaire} t={t} debut={2_400} />
    </>
  );
}

/* ── Programme ──────────────────────────────────────────────────────── */
const ICONE_LIGNE: Record<LigneProgramme["type"], typeof Plane> = {
  vol: Plane,
  arrivee: PlaneLanding,
  escale: Hourglass,
  transfert: Bus,
  sejour: BedDouble,
};

function SceneProgramme({ t, c }: { t: number; c: Chronologie }) {
  const jours = programmeParJour(c);
  const nbLignes = jours.reduce((a, j) => a + j.lignes.length, 0);
  const serre = nbLignes + jours.length > 26;
  const colonnes = jours.length > 3 || nbLignes > 10 ? 3 : 2;
  const pas = Math.min(140, 4_000 / Math.max(1, nbLignes));
  let rang = 0;
  return (
    <>
      <div className="absolute inset-0" style={{ background: "rgba(5,10,20,0.72)" }} />
      <div className="absolute left-[100px] right-[100px] top-[92px]">
        <Eyebrow t={t}>Le programme</Eyebrow>
        <Apparait t={t} debut={250}>
          <h2 className="mt-3 text-[50px] font-extrabold tracking-tight">{periode(c)}</h2>
        </Apparait>
        <div className="mt-8" style={{ columnCount: colonnes, columnGap: 56 }}>
          {jours.map((j) => (
            <div key={j.date} className="mb-6" style={{ breakInside: "avoid" }}>
              <Apparait t={t} debut={500 + rang * pas} duree={500} depuis={12}>
                <p className="mb-2 border-b border-white/10 pb-1.5 text-[14px] font-semibold uppercase tracking-[0.2em] text-[#F5C56B]">{j.libelle}</p>
              </Apparait>
              {j.lignes.map((l) => {
                const Icone = ICONE_LIGNE[l.type];
                const debut = 500 + ++rang * pas;
                return (
                  <Apparait key={l.cle} t={t} debut={debut} duree={500} depuis={12} className={`flex gap-3 ${serre ? "py-1" : "py-1.5"}`}>
                    <span className={`w-[78px] shrink-0 font-bold tabular-nums text-[#F5C56B] ${serre ? "text-[16px]" : "text-[18px]"}`}>{l.heure}</span>
                    <Icone className={`mt-0.5 shrink-0 text-white/60 ${serre ? "h-4 w-4" : "h-5 w-5"}`} />
                    <div className="min-w-0">
                      <p className={`font-semibold leading-snug ${serre ? "text-[15px]" : "text-[18px]"}`}>{l.texte}</p>
                      {l.detail && <p className={`leading-snug text-white/55 ${serre ? "text-[12px]" : "text-[14px]"}`}>{l.detail}</p>}
                    </div>
                  </Apparait>
                );
              })}
            </div>
          ))}
        </div>
        <Apparait t={t} debut={600 + nbLignes * pas} className="mt-2 text-[14px] text-white/40">
          Toutes les heures sont en heure locale.
        </Apparait>
      </div>
    </>
  );
}

/* ── Récapitulatif ──────────────────────────────────────────────────── */
function SceneFin({ t, s, c, actions }: { t: number; s: Scenario; c: Chronologie; actions: Actions }) {
  const tot = c.totaux;
  const tuiles: { valeur: string; libelle: string }[] = [];
  if (tot.distanceKm > 0) tuiles.push({ valeur: Math.round(compteur(t, 700, 2_400, tot.distanceKm)).toLocaleString("fr-FR"), libelle: "kilomètres" });
  if (tot.minutesVol > 0) tuiles.push({ valeur: formatDuree(Math.round(compteur(t, 850, 2_400, tot.minutesVol) / 5) * 5), libelle: "de vol" });
  if (tot.nuits > 0) tuiles.push({ valeur: String(Math.round(compteur(t, 1_000, 2_000, tot.nuits))), libelle: tot.nuits > 1 ? "nuits" : "nuit" });
  if (tot.jours > 0 && c.segments.length > 0) tuiles.push({ valeur: String(Math.round(compteur(t, 1_150, 2_000, tot.jours))), libelle: "jours" });
  if (tot.pays.length > 0) tuiles.push({ valeur: String(tot.pays.length), libelle: "pays" });
  const finLieu = c.segments[c.segments.length - 1]?.vers;
  return (
    <>
      <div className="absolute left-[100px] top-[110px] w-[700px]">
        <Eyebrow t={t}>Récapitulatif</Eyebrow>
        <TitreAnime t={t} texte={s.nom || "Notre voyage"} className="mt-5" style={{ fontSize: tailleTitre(s.nom || "Notre voyage", 76) }} />
        {finLieu && c.depart && (
          <Apparait t={t} debut={600} className="mt-4 text-[22px] text-white/70">
            Arrivée {a(finLieu.nom)} le {dateAvecAnnee(c.fin, finLieu.fuseau)} à {heureLocale(c.fin, finLieu.fuseau)} (heure locale)
          </Apparait>
        )}
        <div className="mt-9 grid grid-cols-3 gap-4">
          {tuiles.map((x, i) => (
            <Apparait key={x.libelle} t={t} debut={700 + i * 150} className="pz-tuile">
              <p className="pz-chiffre text-[46px] text-[#F5C56B]">{x.valeur}</p>
              <p className="mt-2 text-[14px] font-semibold uppercase tracking-[0.2em] text-white/50">{x.libelle}</p>
            </Apparait>
          ))}
        </div>
        <Apparait t={t} debut={1_800} className="mt-9 flex gap-3">
          <button type="button" className="pz-bouton" onClick={actions.rejouer}>
            Rejouer la présentation
          </button>
          <button type="button" className="pz-bouton-discret" onClick={actions.quitter}>
            Retour à l'éditeur
          </button>
        </Apparait>
      </div>
      <SousTitre texte={s.motDeFin} t={t} debut={2_200} />
    </>
  );
}

