import { geoDistance } from "d3-geo";
import { trouverLieu } from "./lieux";
import { ajouterJours, ecartJours, localVersUtc, decalageMinutes, utcVersLocal, formatDuree, formatKm } from "./temps";
import type { Etape, Lieu, ModeTransfert, Scenario } from "./types";
import { a } from "./francais";

/* Chronologie d'un scénario : à partir du lieu, de la date et de l'heure de
   départ, chaque étape démarre à la fin de la précédente. Tout ce que
   montrent l'éditeur et la présentation (heures locales, décalages,
   distances, totaux) sort de ce calcul unique. */

const MINUTE = 60_000;
const RAYON_TERRE_KM = 6371;

export interface Segment {
  /** Position de l'étape dans le scénario. */
  index: number;
  etape: Etape;
  /** Où l'on est au début de l'étape. */
  de: Lieu;
  /** Où l'on est à la fin (le même lieu pour une escale ou un séjour). */
  vers: Lieu;
  debut: number;
  fin: number;
  dureeMin: number;
  distanceKm: number;
  /** Changement d'heure locale entre le début et la fin, en minutes. */
  decalageMin: number;
}

export interface Alerte {
  /** Id de l'étape concernée ; null = le départ. */
  etapeId: string | null;
  message: string;
}

export interface Totaux {
  distanceKm: number;
  minutesVol: number;
  nbVols: number;
  nbTransferts: number;
  nbEscales: number;
  nuits: number;
  /** Jours calendaires du premier au dernier jour du voyage. */
  jours: number;
  pays: string[];
}

export interface Chronologie {
  depart: Lieu | null;
  debut: number;
  fin: number;
  segments: Segment[];
  alertes: Alerte[];
  totaux: Totaux;
}

export function distanceKm(a: Lieu, b: Lieu): number {
  return geoDistance([a.lon, a.lat], [b.lon, b.lat]) * RAYON_TERRE_KM;
}

/** Durée de vol plausible : 820 km/h de croisière + 30 min de roulage et montée. */
export function estimerDureeVol(km: number): number {
  return Math.max(30, Math.round((km / 820) * 12 + 6) * 5);
}

const VITESSE_KMH: Record<ModeTransfert, number> = {
  train: 180,
  bus: 65,
  voiture: 75,
  taxi: 60,
  pied: 4.5,
};

/** Durée de transfert plausible selon le mode, arrondie à 5 min. */
export function estimerDureeTransfert(km: number, mode: ModeTransfert): number {
  // Les routes ne vont pas en ligne droite : +25 % sur la distance.
  return Math.max(5, Math.round(((km * 1.25) / VITESSE_KMH[mode]) * 12) * 5);
}

export function calculerChronologie(s: Scenario): Chronologie {
  const alertes: Alerte[] = [];
  const segments: Segment[] = [];
  const depart = trouverLieu(s.depart.lieu, s) ?? null;
  const vide: Totaux = { distanceKm: 0, minutesVol: 0, nbVols: 0, nbTransferts: 0, nbEscales: 0, nuits: 0, jours: 0, pays: [] };

  if (!depart) {
    alertes.push({ etapeId: null, message: "Choisis le lieu de départ." });
    return { depart: null, debut: 0, fin: 0, segments, alertes, totaux: vide };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.depart.date) || !/^\d{2}:\d{2}$/.test(s.depart.heure)) {
    alertes.push({ etapeId: null, message: "Indique la date et l'heure de départ." });
    return { depart, debut: 0, fin: 0, segments, alertes, totaux: vide };
  }

  const debut = localVersUtc(s.depart.date, s.depart.heure, depart.fuseau);
  let ici = depart;
  let curseur = debut;

  s.etapes.forEach((e, index) => {
    const alerter = (message: string) => alertes.push({ etapeId: e.id, message });

    if (e.type === "vol" || e.type === "transfert") {
      const vers = trouverLieu(e.vers, s);
      if (!vers) {
        alerter("Choisis le lieu d'arrivée.");
        return;
      }
      if (vers.id === ici.id) alerter(`Tu es déjà ${a(ici.nom)} : choisis une autre destination.`);
      const km = distanceKm(ici, vers);
      const duree = Math.max(0, e.duree);
      if (duree <= 0) alerter("Indique la durée.");
      if (e.type === "vol") {
        if (ici.type !== "aeroport") alerter(`On ne prend pas l'avion ${a(ici.nom)} : ajoute d'abord un transfert vers un aéroport.`);
        if (vers.type !== "aeroport") alerter(`${vers.nom} n'est pas un aéroport : atterris à l'aéroport, puis ajoute un transfert.`);
        const attendu = estimerDureeVol(km);
        if (duree > 0 && km > 100 && (duree < attendu * 0.6 || duree > attendu * 1.8)) {
          alerter(`Durée inhabituelle pour ${formatKm(km)} : compter environ ${formatDuree(attendu)}.`);
        }
      }
      const fin = curseur + duree * MINUTE;
      segments.push({
        index,
        etape: e,
        de: ici,
        vers,
        debut: curseur,
        fin,
        dureeMin: duree,
        distanceKm: km,
        decalageMin: decalageMinutes(vers.fuseau, fin) - decalageMinutes(ici.fuseau, curseur),
      });
      ici = vers;
      curseur = fin;
      return;
    }

    if (e.type === "escale") {
      const duree = Math.max(0, e.duree);
      if (duree <= 0) alerter("Indique la durée de l'escale.");
      const precedente = s.etapes[index - 1];
      const suivante = s.etapes[index + 1];
      if (precedente?.type === "vol" && suivante?.type === "vol" && duree > 0 && duree < 60) {
        alerter("Correspondance de moins d'une heure : c'est serré.");
      }
      const fin = curseur + duree * MINUTE;
      segments.push({ index, etape: e, de: ici, vers: ici, debut: curseur, fin, dureeMin: duree, distanceKm: 0, decalageMin: 0 });
      curseur = fin;
      return;
    }

    // Séjour : on repart le jour d'arrivée + n nuits, à l'heure indiquée.
    const arrivee = utcVersLocal(curseur, ici.fuseau);
    const heure = /^\d{2}:\d{2}$/.test(e.heureDepart) ? e.heureDepart : "12:00";
    let fin = localVersUtc(ajouterJours(arrivee.date, Math.max(0, e.nuits)), heure, ici.fuseau);
    if (e.nuits < 1) alerter("Un séjour compte au moins une nuit. Pour quelques heures, utilise une escale.");
    if (fin <= curseur) {
      alerter("L'heure de départ tombe avant l'arrivée : vérifie le nombre de nuits ou l'heure.");
      fin = curseur;
    }
    segments.push({
      index,
      etape: e,
      de: ici,
      vers: ici,
      debut: curseur,
      fin,
      dureeMin: (fin - curseur) / MINUTE,
      distanceKm: 0,
      decalageMin: 0,
    });
    curseur = fin;
  });

  const pays: string[] = [];
  for (const l of [depart, ...segments.map((g) => g.vers)]) if (!pays.includes(l.pays)) pays.push(l.pays);
  const totaux: Totaux = {
    distanceKm: segments.reduce((a, g) => a + g.distanceKm, 0),
    minutesVol: segments.filter((g) => g.etape.type === "vol").reduce((a, g) => a + g.dureeMin, 0),
    nbVols: segments.filter((g) => g.etape.type === "vol").length,
    nbTransferts: segments.filter((g) => g.etape.type === "transfert").length,
    nbEscales: segments.filter((g) => g.etape.type === "escale").length,
    nuits: segments.reduce((a, g) => a + (g.etape.type === "sejour" ? Math.max(0, g.etape.nuits) : 0), 0),
    jours: ecartJours(utcVersLocal(debut, depart.fuseau).date, utcVersLocal(curseur, ici.fuseau).date) + 1,
    pays,
  };

  return { depart, debut, fin: curseur, segments, alertes, totaux };
}
