/* Heures locales et fuseaux horaires, sans bibliothèque : l'API Intl du
   navigateur connaît tous les fuseaux et leurs changements d'heure. Tous
   les instants sont manipulés en millisecondes UTC ; on ne repasse en
   heure locale qu'à l'affichage, dans le fuseau du lieu concerné. */

const MINUTE = 60_000;
export const JOUR = 86_400_000;

const formatteurs = new Map<string, Intl.DateTimeFormat>();
function parties(ms: number, fuseau: string) {
  let f = formatteurs.get(fuseau);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuseau,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatteurs.set(fuseau, f);
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(ms))) {
    if (x.type !== "literal") p[x.type] = Number(x.value);
  }
  return {
    annee: p.year!,
    mois: p.month!,
    jour: p.day!,
    heure: p.hour! % 24,
    minute: p.minute!,
    seconde: p.second!,
  };
}

/** Décalage du fuseau par rapport à UTC à cet instant, en minutes. */
export function decalageMinutes(fuseau: string, ms: number): number {
  const p = parties(ms, fuseau);
  const commeUtc = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde);
  return Math.round((commeUtc - Math.floor(ms / 1000) * 1000) / MINUTE);
}

/** « 2027-04-15 » + « 10:35 » à l'heure du fuseau → instant UTC (ms). */
export function localVersUtc(date: string, heure: string, fuseau: string): number {
  const [a, m, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const naif = Date.UTC(a!, (m ?? 1) - 1, j ?? 1, h ?? 0, mi ?? 0);
  // Deux passes : la première estime le décalage, la seconde le corrige
  // quand l'heure visée tombe de l'autre côté d'un changement d'heure.
  const essai = naif - decalageMinutes(fuseau, naif) * MINUTE;
  return naif - decalageMinutes(fuseau, essai) * MINUTE;
}

export interface DateLocale {
  /** « AAAA-MM-JJ » */
  date: string;
  /** « HH:MM » */
  heure: string;
}

export function utcVersLocal(ms: number, fuseau: string): DateLocale {
  const p = parties(ms, fuseau);
  const d2 = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${p.annee}-${d2(p.mois)}-${d2(p.jour)}`,
    heure: `${d2(p.heure)}:${d2(p.minute)}`,
  };
}

/** Nombre de jours calendaires entre deux dates « AAAA-MM-JJ ». */
export function ecartJours(de: string, a: string): number {
  const v = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((v(a) - v(de)) / JOUR);
}

/** Ajoute des jours à une date « AAAA-MM-JJ ». */
export function ajouterJours(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

/* ── Formats d'affichage (français) ─────────────────────────────────── */

const cacheFormats = new Map<string, Intl.DateTimeFormat>();
function formatFr(fuseau: string, options: Intl.DateTimeFormatOptions, cle: string) {
  const k = `${fuseau}|${cle}`;
  let f = cacheFormats.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, ...options });
    cacheFormats.set(k, f);
  }
  return f;
}

/** « 10:35 » */
export function heureLocale(ms: number, fuseau: string): string {
  return utcVersLocal(ms, fuseau).heure.replace(":", " h ").replace(/ h 00$/, " h");
}

/** « jeudi 15 avril » */
export function dateLongue(ms: number, fuseau: string): string {
  return formatFr(fuseau, { weekday: "long", day: "numeric", month: "long" }, "longue").format(ms);
}

/** « jeu. 15 avr. » */
export function dateCourte(ms: number, fuseau: string): string {
  return formatFr(fuseau, { weekday: "short", day: "numeric", month: "short" }, "courte").format(ms);
}

/** « 15 avril 2027 » */
export function dateAvecAnnee(ms: number, fuseau: string): string {
  return formatFr(fuseau, { day: "numeric", month: "long", year: "numeric" }, "annee").format(ms);
}

/** « 6 h 40 », « 45 min », « 1 j 3 h » */
export function formatDuree(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const j = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mi = m % 60;
  if (j > 0) return h > 0 ? `${j} j ${h} h` : `${j} j`;
  return mi > 0 ? `${h} h ${String(mi).padStart(2, "0")}` : `${h} h`;
}

/** « +2 h », « −1 h 30 », « même heure » */
export function formatDecalage(minutes: number): string {
  if (minutes === 0) return "même heure";
  const signe = minutes > 0 ? "+" : "−";
  const a = Math.abs(minutes);
  const h = Math.floor(a / 60);
  const mi = a % 60;
  return `${signe}${h > 0 ? `${h} h` : ""}${mi > 0 ? `${h > 0 ? " " : ""}${String(mi).padStart(2, "0")}${h > 0 ? "" : " min"}` : ""}`;
}

/** « 5 250 km » */
export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("fr-FR")} km`;
}

/** « ven. » et « 16 », pour les pastilles de nuits. */
export function jourCourt(ms: number, fuseau: string): { jour: string; numero: string } {
  return {
    jour: formatFr(fuseau, { weekday: "short" }, "jourSemaine").format(ms),
    numero: formatFr(fuseau, { day: "numeric" }, "numero").format(ms),
  };
}

/** Heure locale en heures décimales (19 h 15 → 19,25), pour le cadran. */
export function heureDecimale(ms: number, fuseau: string): number {
  const [h, m] = utcVersLocal(ms, fuseau).heure.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}
