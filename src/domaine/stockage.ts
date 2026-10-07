import { nouvelId, scenarioExemple } from "./fabrique";
import type { Etape, Lieu, Scenario } from "./types";

/* Où vivent les scénarios.

   1. Dans le navigateur (localStorage) : sauvegarde automatique à chaque
      modification. Pratique, mais propre à ce navigateur sur cet ordinateur.
   2. Dans le fichier lui-même : « Enregistrer une copie » télécharge un
      nouveau carnet-de-route.html qui embarque les scénarios. C'est la
      vraie sauvegarde, et c'est ce fichier qu'on envoie à quelqu'un.

   Une copie a son propre espace dans le navigateur (clé suffixée par son
   identifiant d'export) : ouvrir une copie ne mélange pas ses scénarios
   avec ceux de l'original. */

const CLE_BASE = "carnet-de-route.v1";
const ID_DONNEES = "donnees-carnet";

export interface Etat {
  scenarios: Scenario[];
  actif: string | null;
}

interface Embarque extends Etat {
  exportId: string;
}

/** Source HTML du fichier, capturée au démarrage avant le rendu. */
let SOURCE = "";
export function capturerSource(): void {
  SOURCE = "<!doctype html>\n" + document.documentElement.outerHTML;
}

function lireEmbarque(): Embarque | null {
  const el = document.getElementById(ID_DONNEES);
  if (!el?.textContent) return null;
  try {
    const brut = JSON.parse(el.textContent) as Partial<Embarque>;
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
  /** Vrai quand le fichier ouvert est une copie avec scénarios embarqués. */
  copie: boolean;
}

export function charger(): Chargement {
  const embarque = lireEmbarque();
  const cle = embarque ? `${CLE_BASE}.${embarque.exportId}` : CLE_BASE;
  try {
    const brut = localStorage.getItem(cle);
    if (brut) {
      const e = JSON.parse(brut) as Partial<Etat>;
      const scenarios = (e.scenarios ?? []).map(normaliserScenario).filter((s): s is Scenario => s != null);
      if (scenarios.length > 0) {
        const actif = scenarios.some((s) => s.id === e.actif) ? e.actif! : scenarios[0]!.id;
        return { etat: { scenarios, actif }, cle, copie: !!embarque };
      }
    }
  } catch {
    /* stockage indisponible ou illisible : on repart du fichier */
  }
  if (embarque) return { etat: { scenarios: embarque.scenarios, actif: embarque.actif }, cle, copie: true };
  const exemple = scenarioExemple();
  return { etat: { scenarios: [exemple], actif: exemple.id }, cle, copie: false };
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

/* ── Fichiers ───────────────────────────────────────────────────────── */

export function nomDeFichier(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "voyage";
}

function telecharger(contenu: Blob, nom: string): void {
  const url = URL.createObjectURL(contenu);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Vrai quand le fichier courant peut produire une copie de lui-même. */
export function copiePossible(): boolean {
  // En développement (vite), le code est chargé depuis /src : pas de copie.
  return SOURCE !== "" && !import.meta.env.DEV;
}

/**
 * Télécharge une copie de ce fichier HTML avec les scénarios embarqués.
 * Passe par DOMParser : aucune balise <script> n'est écrite en dur dans le
 * code (elle couperait le script inliné du fichier).
 */
export function enregistrerCopie(etat: Etat, nomFichier: string): void {
  const doc = new DOMParser().parseFromString(SOURCE, "text/html");
  doc.getElementById(ID_DONNEES)?.remove();
  const donnees: Embarque = { ...etat, exportId: nouvelId("x") };
  const el = doc.createElement("script");
  el.id = ID_DONNEES;
  el.type = "application/json";
  // « < » échappé : un commentaire contenant « </script> » ne casse rien.
  el.textContent = JSON.stringify(donnees).replace(/</g, "\\u003c");
  doc.body.appendChild(el);
  const html = "<!doctype html>\n" + doc.documentElement.outerHTML;
  telecharger(new Blob([html], { type: "text/html;charset=utf-8" }), `${nomFichier}.html`);
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
