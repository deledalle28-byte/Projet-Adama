/* Modèle d'un scénario de voyage.

   Un scénario part d'un lieu à une date et une heure, puis enchaîne des
   étapes. Chaque étape démarre quand la précédente se termine : changer la
   durée d'une escale décale automatiquement toutes les heures qui suivent.
   Les étapes de déplacement (vol, transfert) disent seulement où l'on va ;
   l'endroit d'où l'on part est toujours celui où l'on se trouve. */

export type TypeLieu = "aeroport" | "ville" | "site";

export interface Lieu {
  id: string;
  /** Nom affiché, ex. « Abu Dhabi ». */
  nom: string;
  /** Précision, ex. « Aéroport Zayed International ». */
  detail?: string;
  /** Code IATA pour un aéroport. */
  code?: string;
  pays: string;
  /** Code pays ONU (m49) pour allumer le pays sur le globe. */
  m49?: string;
  lat: number;
  lon: number;
  /** Fuseau IANA, ex. « Asia/Dubai ». */
  fuseau: string;
  type: TypeLieu;
}

export type ModeTransfert = "bus" | "train" | "voiture" | "taxi" | "pied";

interface EtapeBase {
  id: string;
  commentaire: string;
}

export interface EtapeVol extends EtapeBase {
  type: "vol";
  /** Lieu d'arrivée (id du catalogue ou d'un lieu personnalisé). */
  vers: string;
  /** Durée du vol en minutes. */
  duree: number;
  compagnie: string;
  numero: string;
}

export interface EtapeEscale extends EtapeBase {
  type: "escale";
  /** Durée sur place en minutes. */
  duree: number;
  /** Ce qu'on y fait, en quelques mots (ex. « Correspondance »). */
  intitule: string;
}

export interface EtapeTransfert extends EtapeBase {
  type: "transfert";
  vers: string;
  mode: ModeTransfert;
  duree: number;
}

export interface EtapeSejour extends EtapeBase {
  type: "sejour";
  nuits: number;
  /** Heure de départ le dernier jour, « HH:MM » heure locale. */
  heureDepart: string;
  hebergement: string;
}

export type Etape = EtapeVol | EtapeEscale | EtapeTransfert | EtapeSejour;
export type TypeEtape = Etape["type"];

export interface Scenario {
  id: string;
  nom: string;
  /** Qui voyage, ex. « Maman, Papa et Tonton Ibrahim ». */
  voyageurs: string;
  depart: {
    lieu: string;
    /** « AAAA-MM-JJ », heure locale du lieu de départ. */
    date: string;
    /** « HH:MM », heure locale du lieu de départ. */
    heure: string;
  };
  etapes: Etape[];
  /** Texte d'ouverture de la présentation. */
  introduction: string;
  /** Texte du générique de fin. */
  motDeFin: string;
  /** Lieux ajoutés à la main, hors catalogue. */
  lieuxPerso: Lieu[];
  modifieLe: number;
}
