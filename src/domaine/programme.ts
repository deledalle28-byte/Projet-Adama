import type { Chronologie, Segment } from "./calcul";
import { dateLongue, formatDecalage, formatDuree, formatKm, heureLocale, utcVersLocal } from "./temps";
import type { Lieu, ModeTransfert, TypeEtape } from "./types";
import { a, de } from "./francais";

/* Le programme jour par jour : les horaires du voyage en lignes lisibles,
   chacune à l'heure locale de l'endroit où l'on se trouve. Sert à la
   feuille de route de l'éditeur et à la scène « Le programme ». */

export const LIBELLE_MODE: Record<ModeTransfert, string> = {
  bus: "en bus",
  train: "en train",
  voiture: "en voiture",
  taxi: "en taxi",
  pied: "à pied",
};

const NOM_MODE: Record<ModeTransfert, string> = {
  bus: "Bus",
  train: "Train",
  voiture: "Voiture",
  taxi: "Taxi",
  pied: "À pied",
};

export interface LigneProgramme {
  cle: string;
  ms: number;
  fuseau: string;
  heure: string;
  type: TypeEtape | "arrivee";
  texte: string;
  detail: string;
  /** Index de l'étape dans le scénario. */
  index: number;
}

export interface JourProgramme {
  date: string;
  libelle: string;
  lignes: LigneProgramme[];
}

const avecCode = (l: Lieu) => (l.code ? `${l.nom} (${l.code})` : l.nom);

/** « Vers l'aéroport de Médine » quand on reste dans la même ville. */
export function libelleDestination(depuis: Lieu, vers: Lieu): string {
  if (depuis.nom !== vers.nom) return vers.nom;
  if (vers.type === "aeroport") return `l'aéroport ${de(vers.nom)}`;
  return vers.detail ?? vers.nom;
}

export function titreTrajet(g: Segment): string {
  if (g.de.nom !== g.vers.nom) return `${g.de.nom} → ${g.vers.nom}`;
  return `Direction ${libelleDestination(g.de, g.vers)}`;
}

export function lignesProgramme(c: Chronologie): LigneProgramme[] {
  const lignes: LigneProgramme[] = [];
  const ligne = (g: Segment, cle: string, ms: number, lieu: Lieu, type: LigneProgramme["type"], texte: string, detail: string) =>
    lignes.push({ cle: `${g.etape.id}-${cle}`, ms, fuseau: lieu.fuseau, heure: heureLocale(ms, lieu.fuseau), type, texte, detail, index: g.index });

  c.segments.forEach((g, i) => {
    const e = g.etape;
    const suivant = c.segments[i + 1];
    const resteSurPlace = suivant && (suivant.etape.type === "escale" || suivant.etape.type === "sejour");
    switch (e.type) {
      case "vol": {
        const vol = [e.compagnie, e.numero].filter(Boolean).join(" ");
        ligne(g, "dep", g.debut, g.de, "vol", `Décollage ${de(avecCode(g.de))}`, [`vers ${g.vers.nom}`, formatDuree(g.dureeMin), vol].filter(Boolean).join(" · "));
        const decalage = g.decalageMin !== 0 ? ` · décalage ${formatDecalage(g.decalageMin)}` : "";
        ligne(g, "arr", g.fin, g.vers, "arrivee", `Atterrissage ${a(avecCode(g.vers))}`, `heure locale${decalage}`);
        break;
      }
      case "transfert": {
        const dest = libelleDestination(g.de, g.vers);
        ligne(g, "dep", g.debut, g.de, "transfert", `${NOM_MODE[e.mode]} vers ${dest}`, [formatDuree(g.dureeMin), g.distanceKm >= 1 ? formatKm(g.distanceKm) : ""].filter(Boolean).join(" · "));
        if (!resteSurPlace) ligne(g, "arr", g.fin, g.vers, "arrivee", `Arrivée ${a(g.vers.nom)}`, "");
        break;
      }
      case "escale":
        ligne(g, "esc", g.debut, g.de, "escale", `${e.intitule || "Escale"} ${a(g.de.nom)}`, `${formatDuree(g.dureeMin)}, jusqu'à ${heureLocale(g.fin, g.de.fuseau)}`);
        break;
      case "sejour": {
        const nuits = `${e.nuits} nuit${e.nuits > 1 ? "s" : ""}`;
        const depart = `départ le ${dateLongue(g.fin, g.de.fuseau)} à ${heureLocale(g.fin, g.de.fuseau)}`;
        ligne(g, "sej", g.debut, g.de, "sejour", `Séjour ${a(g.de.nom)} · ${nuits}`, [e.hebergement, depart].filter(Boolean).join(" · "));
        break;
      }
    }
  });
  return lignes;
}

export function programmeParJour(c: Chronologie): JourProgramme[] {
  const jours: JourProgramme[] = [];
  for (const l of lignesProgramme(c)) {
    const date = utcVersLocal(l.ms, l.fuseau).date;
    let jour = jours[jours.length - 1];
    if (!jour || jour.date !== date) {
      const libelle = dateLongue(l.ms, l.fuseau);
      jour = { date, libelle: libelle.charAt(0).toUpperCase() + libelle.slice(1), lignes: [] };
      jours.push(jour);
    }
    jour.lignes.push(l);
  }
  return jours;
}

/** « Paris → Abu Dhabi → Djeddah → La Mecque → … » */
export function itineraire(c: Chronologie): string[] {
  if (!c.depart) return [];
  const villes = [c.depart.nom];
  for (const g of c.segments) {
    if (g.vers.nom !== villes[villes.length - 1]) villes.push(g.vers.nom);
  }
  return villes;
}
