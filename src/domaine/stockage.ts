import { nouvelId, scenarioExemple } from "./fabrique";
import type { Etape, Lieu, Scenario } from "./types";

/* Où vivent les scénarios.

   Le carnet les garde dans le navigateur (localStorage) et les sauvegarde
   à chaque modification. Pour les mettre à l'abri ou les passer sur un
   autre ordinateur : Exporter / Importer (.json). Ce qu'on montre aux
   proches, c'est la visite : un fichier HTML à part qui ne contient que le
   scénario choisi (voir exportVisite.ts). */

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

export interface Chargement {
  etat: Etat;
  cle: string;
}

export function charger(): Chargement {
  const copie = lireCopieV1();
  const cle = copie ? `${CLE_BASE}.${copie.exportId}` : CLE_BASE;
  try {
    const brut = localStorage.getItem(cle);
    if (brut) {
      const e = JSON.parse(brut) as Partial<Etat>;
      const scenarios = (e.scenarios ?? []).map(normaliserScenario).filter((s): s is Scenario => s != null);
      if (scenarios.length > 0) {
        const actif = scenarios.some((s) => s.id === e.actif) ? e.actif! : scenarios[0]!.id;
        return { etat: { scenarios, actif }, cle };
      }
    }
  } catch {
    /* stockage indisponible ou illisible : on repart du fichier */
  }
  if (copie) return { etat: { scenarios: copie.scenarios, actif: copie.actif }, cle };
  const exemple = scenarioExemple();
  return { etat: { scenarios: [exemple], actif: exemple.id }, cle };
}

/** Sauvegarde dans le navigateur ; renvoie false si elle a échoué. */
export function sauver(cle: string, etat: Etat): boolean {
  try {
    localStorage.setItem(cle, JSON.stringify(etat));
    return true;
  } catch {
    return false;
  }
}

/** Scénario embarqué dans un fichier de visite, ou null. */
export function lireVisite(): Scenario | null {
  const el = document.getElementById(ID_VISITE);
  if (!el?.textContent) return null;
  try {
    return normaliserScenario((JSON.parse(el.textContent) as { scenario?: unknown }).scenario);
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

export function exporterJson(s: Scenario): void {
  const contenu = JSON.stringify({ format: "carnet-de-route", version: 1, scenario: s }, null, 2);
  telecharger(new Blob([contenu], { type: "application/json" }), `${nomDeFichier(s.nom)}.json`);
}

/** Lit un fichier .json exporté ; renvoie le scénario avec de nouveaux ids. */
export async function importerJson(fichier: File): Promise<Scenario> {
  const brut = JSON.parse(await fichier.text()) as { scenario?: unknown } | unknown;
  const candidat = brut && typeof brut === "object" && "scenario" in brut ? (brut as { scenario: unknown }).scenario : brut;
  const s = normaliserScenario(candidat);
  if (!s) throw new Error("Ce fichier ne contient pas de scénario de voyage.");
  return { ...s, id: nouvelId("s"), etapes: s.etapes.map((e) => ({ ...e, id: nouvelId("e") })), modifieLe: Date.now() };
}

/* ── Validation : tout ce qui vient d'un fichier ou du navigateur ───── */

const str = (v: unknown, defaut = "") => (typeof v === "string" ? v : defaut);
const num = (v: unknown, defaut = 0) => (typeof v === "number" && Number.isFinite(v) ? v : defaut);

function normaliserEtape(x: unknown): Etape | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const base = { id: str(o.id) || nouvelId("e"), commentaire: str(o.commentaire) };
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
