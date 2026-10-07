import type { Etape, Scenario, TypeEtape } from "./types";

type SansId<T> = T extends unknown ? Omit<T, "id"> : never;

export function nouvelId(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function nouvelleEtape(type: TypeEtape): Etape {
  const id = nouvelId("e");
  switch (type) {
    case "vol":
      return { id, type, vers: "", duree: 0, compagnie: "", numero: "", commentaire: "" };
    case "escale":
      return { id, type, duree: 120, intitule: "Correspondance", commentaire: "" };
    case "transfert":
      return { id, type, vers: "", mode: "bus", duree: 0, commentaire: "" };
    case "sejour":
      return { id, type, nuits: 3, heureDepart: "12:00", hebergement: "", commentaire: "" };
  }
}

export function nouveauScenario(): Scenario {
  const dans30Jours = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return {
    id: nouvelId("s"),
    nom: "Nouveau voyage",
    voyageurs: "",
    depart: { lieu: "aero-CDG", date: dans30Jours, heure: "10:00" },
    etapes: [],
    introduction: "",
    motDeFin: "",
    lieuxPerso: [],
    modifieLe: Date.now(),
  };
}

/** Copie indépendante, avec de nouveaux identifiants. */
export function dupliquerScenario(s: Scenario): Scenario {
  return {
    ...structuredClone(s),
    id: nouvelId("s"),
    nom: `${s.nom} (copie)`,
    etapes: s.etapes.map((e) => ({ ...structuredClone(e), id: nouvelId("e") })),
    modifieLe: Date.now(),
  };
}

/** Scénario d'exemple : une Omra au départ de Paris, escale à Abu Dhabi. */
export function scenarioExemple(): Scenario {
  const e = (x: SansId<Etape>): Etape => ({ ...x, id: nouvelId("e") }) as Etape;
  return {
    id: nouvelId("s"),
    nom: "Omra en famille — avril 2027",
    voyageurs: "Toute la famille",
    depart: { lieu: "aero-CDG", date: "2027-04-15", heure: "10:35" },
    introduction:
      "Paris, Abu Dhabi, puis La Mecque et Médine : voici comment le voyage va se dérouler, étape par étape. Toutes les heures sont données en heure locale.",
    motDeFin: "Merci d'avoir suivi le voyage ! On vous donne des nouvelles à chaque étape.",
    lieuxPerso: [],
    modifieLe: Date.now(),
    etapes: [
      e({
        type: "vol",
        vers: "aero-AUH",
        duree: 400,
        compagnie: "Etihad Airways",
        numero: "",
        commentaire: "Rendez-vous à l'aéroport 3 h avant le décollage. Passeports, visas et réservations sont dans la pochette bleue.",
      }),
      e({
        type: "escale",
        duree: 180,
        intitule: "Correspondance",
        commentaire: "On reste en zone de transit, pas besoin de repasser la douane. On en profite pour manger un morceau.",
      }),
      e({ type: "vol", vers: "aero-JED", duree: 190, compagnie: "Etihad Airways", numero: "", commentaire: "Arrivée en pleine nuit à Djeddah." }),
      e({
        type: "escale",
        duree: 90,
        intitule: "Passeports et bagages",
        commentaire: "Contrôle des passeports puis récupération des valises : compter environ 1 h 30.",
      }),
      e({ type: "transfert", vers: "ville-la-mecque", mode: "bus", duree: 90, commentaire: "Un bus nous attend à la sortie de l'aéroport et nous dépose à l'hôtel." }),
      e({
        type: "sejour",
        nuits: 6,
        heureDepart: "13:00",
        hebergement: "Hôtel près du Haram (à confirmer)",
        commentaire: "Six nuits sur place. Le petit-déjeuner est servi à l'hôtel.",
      }),
      e({ type: "transfert", vers: "ville-medine", mode: "train", duree: 150, commentaire: "Train à grande vitesse Haramain, bagages compris." }),
      e({
        type: "sejour",
        nuits: 4,
        heureDepart: "07:30",
        hebergement: "Hôtel à Médine (à confirmer)",
        commentaire: "Quatre nuits à Médine avant de rentrer.",
      }),
      e({ type: "transfert", vers: "aero-MED", mode: "taxi", duree: 30, commentaire: "" }),
      e({ type: "escale", duree: 150, intitule: "Enregistrement", commentaire: "Enregistrement des bagages et contrôle de sécurité." }),
      e({ type: "vol", vers: "aero-AUH", duree: 170, compagnie: "Etihad Airways", numero: "", commentaire: "" }),
      e({ type: "escale", duree: 165, intitule: "Correspondance", commentaire: "Dernière escale avant la maison." }),
      e({ type: "vol", vers: "aero-CDG", duree: 455, compagnie: "Etihad Airways", numero: "", commentaire: "Atterrissage à Paris en fin de soirée." }),
    ],
  };
}
