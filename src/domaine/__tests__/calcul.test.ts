import { describe, expect, it } from "vitest";
import { calculerChronologie } from "../calcul";
import { scenarioExemple } from "../fabrique";
import { formatDecalage, formatDuree, localVersUtc, utcVersLocal } from "../temps";
import type { EtapeEscale, Scenario } from "../types";

const local = (ms: number, fuseau: string) => {
  const l = utcVersLocal(ms, fuseau);
  return `${l.date} ${l.heure}`;
};

describe("fuseaux horaires", () => {
  it("convertit une heure de Paris en été (UTC+2) et en hiver (UTC+1)", () => {
    expect(new Date(localVersUtc("2027-04-15", "10:35", "Europe/Paris")).toISOString()).toBe("2027-04-15T08:35:00.000Z");
    expect(new Date(localVersUtc("2027-01-15", "10:35", "Europe/Paris")).toISOString()).toBe("2027-01-15T09:35:00.000Z");
  });

  it("fait l'aller-retour heure locale ↔ UTC à Riyad et Abu Dhabi", () => {
    const ms = localVersUtc("2027-04-16", "00:25", "Asia/Riyadh");
    expect(local(ms, "Asia/Riyadh")).toBe("2027-04-16 00:25");
    expect(local(ms, "Asia/Dubai")).toBe("2027-04-16 01:25");
  });

  it("formate durées et décalages", () => {
    expect(formatDuree(400)).toBe("6 h 40");
    expect(formatDuree(45)).toBe("45 min");
    expect(formatDuree(180)).toBe("3 h");
    expect(formatDuree(1500)).toBe("1 j 1 h");
    expect(formatDecalage(120)).toBe("+2 h");
    expect(formatDecalage(-60)).toBe("−1 h");
    expect(formatDecalage(30)).toBe("+30 min");
    expect(formatDecalage(0)).toBe("même heure");
  });
});

describe("chronologie du scénario d'exemple", () => {
  const s = scenarioExemple();
  const c = calculerChronologie(s);

  it("n'a aucune alerte", () => {
    expect(c.alertes).toEqual([]);
  });

  it("enchaîne les heures locales de chaque étape", () => {
    const [vol1, escale1, vol2, , bus, sejourMecque, train, sejourMedine] = c.segments;
    expect(local(vol1!.debut, "Europe/Paris")).toBe("2027-04-15 10:35");
    expect(local(vol1!.fin, "Asia/Dubai")).toBe("2027-04-15 19:15");
    expect(vol1!.decalageMin).toBe(120);
    expect(local(escale1!.fin, "Asia/Dubai")).toBe("2027-04-15 22:15");
    expect(local(vol2!.fin, "Asia/Riyadh")).toBe("2027-04-16 00:25");
    expect(vol2!.decalageMin).toBe(-60);
    expect(local(bus!.fin, "Asia/Riyadh")).toBe("2027-04-16 03:25");
    // Arrivée le 16 + 6 nuits → départ le 22 à 13 h.
    expect(local(sejourMecque!.fin, "Asia/Riyadh")).toBe("2027-04-22 13:00");
    expect(local(train!.fin, "Asia/Riyadh")).toBe("2027-04-22 15:30");
    expect(local(sejourMedine!.fin, "Asia/Riyadh")).toBe("2027-04-26 07:30");
    expect(local(c.fin, "Europe/Paris")).toBe("2027-04-26 22:40");
  });

  it("calcule les totaux", () => {
    expect(c.totaux.nbVols).toBe(4);
    expect(c.totaux.nuits).toBe(10);
    expect(c.totaux.jours).toBe(12);
    expect(c.totaux.pays).toEqual(["France", "Émirats arabes unis", "Arabie saoudite"]);
    expect(c.totaux.distanceKm).toBeGreaterThan(14_000);
  });

  it("décale toute la suite quand l'escale d'Abu Dhabi s'allonge", () => {
    const plusLongue: Scenario = structuredClone(s);
    (plusLongue.etapes[1] as EtapeEscale).duree = 180 + 9 * 60;
    const c2 = calculerChronologie(plusLongue);
    expect(local(c2.segments[2]!.fin, "Asia/Riyadh")).toBe("2027-04-16 09:25");
    // Le séjour reste calé sur le jour d'arrivée : même départ le 22 à 13 h.
    expect(local(c2.segments[5]!.fin, "Asia/Riyadh")).toBe("2027-04-22 13:00");
  });
});

describe("alertes", () => {
  it("signale un vol qui part d'une ville et une correspondance serrée", () => {
    const s = scenarioExemple();
    (s.etapes[1] as EtapeEscale).duree = 45;
    s.etapes.splice(5, 0, { id: "x", type: "vol", vers: "aero-MED", duree: 60, compagnie: "", numero: "", commentaire: "", images: [] });
    const messages = calculerChronologie(s).alertes.map((a) => a.message);
    expect(messages.some((m) => m.includes("moins d'une heure"))).toBe(true);
    expect(messages.some((m) => m.includes("On ne prend pas l'avion à La Mecque"))).toBe(true);
  });

  it("demande un lieu de départ", () => {
    const s = scenarioExemple();
    s.depart.lieu = "inconnu";
    expect(calculerChronologie(s).alertes[0]!.message).toBe("Choisis le lieu de départ.");
  });
});

describe("prépositions", () => {
  it("élide et contracte devant les noms de lieux", async () => {
    const { a, de } = await import("../francais");
    expect(de("Abu Dhabi")).toBe("d'Abu Dhabi");
    expect(de("Paris")).toBe("de Paris");
    expect(de("Le Caire")).toBe("du Caire");
    expect(a("Le Caire")).toBe("au Caire");
    expect(a("La Mecque")).toBe("à La Mecque");
  });
});
