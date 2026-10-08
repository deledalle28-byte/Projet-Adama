import { demanderPersistance, ecrireEtatBase, lireEtatBase, lireImages, nettoyerImages } from "./base";
import { nouvelId, scenarioExemple } from "./fabrique";
import type { Etape, Lieu, Scenario } from "./types";

/* Où vivent les scénarios.

   Le carnet les garde dans la mémoire du navigateur, sauvegardés à chaque
   modification : dans IndexedDB (scénarios et photos, voir base.ts) et,
   en double, dans localStorage (scénarios seuls). Un scénario importé y
   reste donc enregistré, comme ceux créés à la main. Pour les mettre à
   l'abri ou les passer sur un autre ordinateur : Exporter / Importer
   (.json, photos comprises). Ce qu'on montre aux proches, c'est la
   visite : un fichier HTML à part qui ne contient que le scénario choisi
   (voir exportVisite.ts). */

const CLE_BASE = "carnet-de-route.v1";
/** Les « copies » de la v1 embarquaient leurs scénarios : elles s'ouvrent
    toujours, chacune dans son propre espace du navigateur. */
const ID_COPIE_V1 = "donnees-carnet";
/** Balise du scénario embarqué dans un fichier de visite. */
export const ID_VISITE = "donnees-visite";

export interface Etat {
  scenarios: Scenario[];
  actif: string | null;
}

/** Photos par identifiant, en data URL (JPEG). */
export type Images = Map<string, string>;

interface EtatDate extends Etat {
  /** Horodatage de la sauvegarde, pour départager les deux mémoires. */
  sauveLe: number;
}

interface CopieV1 extends Etat {
  exportId: string;
}

function lireCopieV1(): CopieV1 | null {
  const el = document.getElementById(ID_COPIE_V1);
  if (!el?.textContent) return null;
  try {
    const brut = JSON.parse(el.textContent) as Partial<CopieV1>;
    const scenarios = (brut.scenarios ?? []).map(normaliserScenario).filter((s): s is Scenario => s != null);
    if (!brut.exportId || scenarios.length === 0) return null;
    return { exportId: brut.exportId, scenarios, actif: brut.actif ?? scenarios[0]!.id };
  } catch {
    return null;
  }
}

function normaliserEtat(brut: unknown): EtatDate | null {
  if (!brut || typeof brut !== "object") return null;
  const e = brut as Partial<EtatDate>;
  const scenarios = (Array.isArray(e.scenarios) ? e.scenarios : []).map(normaliserScenario).filter((s): s is Scenario => s != null);
  if (scenarios.length === 0) return null;
  const actif = scenarios.some((s) => s.id === e.actif) ? e.actif! : scenarios[0]!.id;
  return { scenarios, actif, sauveLe: typeof e.sauveLe === "number" ? e.sauveLe : 0 };
}

/** Identifiants des photos utilisées par une liste de scénarios. */
export function imagesUtilisees(scenarios: Scenario[]): Set<string> {
  const ids = new Set<string>();
  for (const s of scenarios) for (const e of s.etapes) for (const i of e.images) ids.add(i.id);
  return ids;
}

export interface Chargement {
  etat: Etat;
  images: Images;
  cle: string;
}

export async function charger(): Promise<Chargement> {
  const copie = lireCopieV1();
  const cle = copie ? `${CLE_BASE}.${copie.exportId}` : CLE_BASE;
  let local: EtatDate | null = null;
  try {
    local = normaliserEtat(JSON.parse(localStorage.getItem(cle) ?? "null"));
  } catch {
    /* localStorage indisponible ou illisible */
  }
  const base = normaliserEtat(await lireEtatBase(cle));
  // La plus récente des deux mémoires l'emporte.
  const memoire = base && (!local || base.sauveLe >= local.sauveLe) ? base : local;
  const etat: Etat = memoire
    ? { scenarios: memoire.scenarios, actif: memoire.actif }
    : copie
      ? { scenarios: copie.scenarios, actif: copie.actif }
      : (() => {
          const exemple = scenarioExemple();
          return { scenarios: [exemple], actif: exemple.id };
        })();
  const images = await lireImages(imagesUtilisees(etat.scenarios));
  demanderPersistance();
  void nettoyerImages((etats) => imagesUtilisees(etats.flatMap((x) => normaliserEtat(x)?.scenarios ?? [])));
  return { etat, images, cle };
}

/** Sauvegarde dans le navigateur ; renvoie false si elle a entièrement échoué. */
export async function sauver(cle: string, etat: Etat): Promise<boolean> {
  const date: EtatDate = { ...etat, sauveLe: Date.now() };
  let local = false;
  try {
    localStorage.setItem(cle, JSON.stringify(date));
    local = true;
  } catch {
    /* plein ou indisponible : IndexedDB prend le relais */
  }
  const base = await ecrireEtatBase(cle, date);
  return base || local;
}

/** Contenu d'un fichier de visite : le scénario et ses photos, ou null. */
export function lireVisite(): { scenario: Scenario; images: Images } | null {
  const el = document.getElementById(ID_VISITE);
  if (!el?.textContent) return null;
  try {
    const brut = JSON.parse(el.textContent) as { scenario?: unknown; images?: unknown };
    const scenario = normaliserScenario(brut.scenario);
    return scenario ? { scenario, images: lireImagesJson(brut.images) } : null;
  } catch {
    return null;
  }
}

/* ── Fichiers ───────────────────────────────────────────────────────── */

export function nomDeFichier(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "voyage";
}

export function telecharger(contenu: Blob, nom: string): void {
  const url = URL.createObjectURL(contenu);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Les photos d'un scénario, prêtes à être écrites dans un fichier. */
export function imagesDuScenario(s: Scenario, images: Images): Record<string, string> {
  const r: Record<string, string> = {};
  for (const id of imagesUtilisees([s])) {
    const donnees = images.get(id);
    if (donnees) r[id] = donnees;
  }
  return r;
}

function lireImagesJson(x: unknown): Images {
  const r: Images = new Map();
  if (x && typeof x === "object") {
    for (const [id, donnees] of Object.entries(x as Record<string, unknown>)) {
      if (typeof donnees === "string" && donnees.startsWith("data:image/")) r.set(id, donnees);
    }
  }
  return r;
}

export function exporterJson(s: Scenario, images: Images): void {
  const contenu = JSON.stringify({ format: "carnet-de-route", version: 2, scenario: s, images: imagesDuScenario(s, images) }, null, 2);
  telecharger(new Blob([contenu], { type: "application/json" }), `${nomDeFichier(s.nom)}.json`);
}

/** Lit un fichier .json exporté : le scénario (nouveaux ids) et ses photos. */
export async function importerJson(fichier: File): Promise<{ scenario: Scenario; images: Images }> {
  const brut = JSON.parse(await fichier.text()) as { scenario?: unknown; images?: unknown } | unknown;
  const enveloppe = brut && typeof brut === "object" && "scenario" in brut ? (brut as { scenario: unknown; images?: unknown }) : null;
  const s = normaliserScenario(enveloppe ? enveloppe.scenario : brut);
  if (!s) throw new Error("Ce fichier ne contient pas de scénario de voyage.");
  return {
    scenario: { ...s, id: nouvelId("s"), etapes: s.etapes.map((e) => ({ ...e, id: nouvelId("e") })), modifieLe: Date.now() },
    images: lireImagesJson(enveloppe?.images),
  };
}

/* ── Validation : tout ce qui vient d'un fichier ou du navigateur ───── */

const str = (v: unknown, defaut = "") => (typeof v === "string" ? v : defaut);
const num = (v: unknown, defaut = 0) => (typeof v === "number" && Number.isFinite(v) ? v : defaut);

function normaliserEtape(x: unknown): Etape | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const images = Array.isArray(o.images)
    ? o.images
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && typeof (i as Record<string, unknown>).id === "string")
        .map((i) => ({
          id: str(i.id),
          legende: str(i.legende),
          placement: i.placement === "sur" ? ("sur" as const) : ("sous" as const),
          ...(typeof i.ratio === "number" && i.ratio > 0 && Number.isFinite(i.ratio) ? { ratio: i.ratio } : {}),
        }))
    : [];
  const base = { id: str(o.id) || nouvelId("e"), commentaire: str(o.commentaire), images };
  switch (o.type) {
    case "vol":
      return { ...base, type: "vol", vers: str(o.vers), duree: num(o.duree), compagnie: str(o.compagnie), numero: str(o.numero) };
    case "escale":
      return { ...base, type: "escale", duree: num(o.duree), intitule: str(o.intitule) };
    case "transfert": {
      const modes = ["bus", "train", "voiture", "taxi", "pied"] as const;
      const mode = modes.find((m) => m === o.mode) ?? "bus";
      return { ...base, type: "transfert", vers: str(o.vers), mode, duree: num(o.duree) };
    }
    case "sejour":
      return { ...base, type: "sejour", nuits: num(o.nuits, 1), heureDepart: str(o.heureDepart, "12:00"), hebergement: str(o.hebergement) };
    default:
      return null;
  }
}

function normaliserLieu(x: unknown): Lieu | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!str(o.id) || !str(o.nom) || typeof o.lat !== "number" || typeof o.lon !== "number") return null;
  const type = o.type === "aeroport" || o.type === "site" ? o.type : "ville";
  return {
    id: str(o.id),
    nom: str(o.nom),
    detail: str(o.detail) || undefined,
    code: str(o.code) || undefined,
    pays: str(o.pays),
    m49: str(o.m49) || undefined,
    lat: o.lat,
    lon: o.lon,
    fuseau: str(o.fuseau, "Europe/Paris"),
    type,
  };
}

export function normaliserScenario(x: unknown): Scenario | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const d = (o.depart && typeof o.depart === "object" ? o.depart : {}) as Record<string, unknown>;
  if (!Array.isArray(o.etapes)) return null;
  return {
    id: str(o.id) || nouvelId("s"),
    nom: str(o.nom, "Voyage"),
    voyageurs: str(o.voyageurs),
    depart: { lieu: str(d.lieu), date: str(d.date), heure: str(d.heure, "10:00") },
    etapes: o.etapes.map(normaliserEtape).filter((e): e is Etape => e != null),
    introduction: str(o.introduction),
    motDeFin: str(o.motDeFin),
    lieuxPerso: Array.isArray(o.lieuxPerso) ? o.lieuxPerso.map(normaliserLieu).filter((l): l is Lieu => l != null) : [],
    modifieLe: num(o.modifieLe, Date.now()),
  };
}
