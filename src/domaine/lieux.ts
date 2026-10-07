import type { Lieu, Scenario } from "./types";

/* Catalogue des lieux proposés dans l'éditeur : aéroports de départ
   courants, hubs du Golfe et de la région, et lieux d'arrivée en Arabie
   saoudite. Un lieu absent s'ajoute à la main dans le scénario
   (lieuxPerso), avec ses coordonnées et son fuseau. */

const FR = { pays: "France", m49: "250", fuseau: "Europe/Paris" };
const SA = { pays: "Arabie saoudite", m49: "682", fuseau: "Asia/Riyadh" };
const AE = { pays: "Émirats arabes unis", m49: "784", fuseau: "Asia/Dubai" };

function aeroport(code: string, nom: string, detail: string, lat: number, lon: number, zone: { pays: string; m49: string; fuseau: string }): Lieu {
  return { id: `aero-${code}`, code, nom, detail, lat, lon, ...zone, type: "aeroport" };
}

function ville(id: string, nom: string, detail: string | undefined, lat: number, lon: number, zone: { pays: string; m49: string; fuseau: string }, type: "ville" | "site" = "ville"): Lieu {
  return { id, nom, detail, lat, lon, ...zone, type };
}

export const CATALOGUE: Lieu[] = [
  // France et voisins
  aeroport("CDG", "Paris", "Aéroport Charles-de-Gaulle", 49.0097, 2.5479, FR),
  aeroport("ORY", "Paris", "Aéroport d'Orly", 48.7262, 2.3652, FR),
  aeroport("BVA", "Beauvais", "Aéroport de Beauvais-Tillé", 49.4544, 2.1128, FR),
  aeroport("LYS", "Lyon", "Aéroport Saint-Exupéry", 45.7256, 5.0811, FR),
  aeroport("MRS", "Marseille", "Aéroport Marseille Provence", 43.4393, 5.2214, FR),
  aeroport("NCE", "Nice", "Aéroport Nice Côte d'Azur", 43.6584, 7.2159, FR),
  aeroport("TLS", "Toulouse", "Aéroport Toulouse-Blagnac", 43.6291, 1.3638, FR),
  aeroport("BOD", "Bordeaux", "Aéroport de Bordeaux-Mérignac", 44.8283, -0.7156, FR),
  aeroport("MPL", "Montpellier", "Aéroport Montpellier Méditerranée", 43.5762, 3.963, FR),
  aeroport("LIL", "Lille", "Aéroport de Lille-Lesquin", 50.5619, 3.0894, FR),
  aeroport("NTE", "Nantes", "Aéroport Nantes Atlantique", 47.1532, -1.6107, FR),
  aeroport("SXB", "Strasbourg", "Aéroport de Strasbourg-Entzheim", 48.5383, 7.6282, FR),
  aeroport("BSL", "Bâle-Mulhouse", "EuroAirport", 47.5896, 7.5299, FR),
  aeroport("BRU", "Bruxelles", "Aéroport de Bruxelles-Zaventem", 50.9014, 4.4844, { pays: "Belgique", m49: "056", fuseau: "Europe/Brussels" }),
  aeroport("CRL", "Charleroi", "Aéroport de Charleroi", 50.4592, 4.4538, { pays: "Belgique", m49: "056", fuseau: "Europe/Brussels" }),
  aeroport("GVA", "Genève", "Aéroport de Genève", 46.2381, 6.109, { pays: "Suisse", m49: "756", fuseau: "Europe/Zurich" }),
  aeroport("LHR", "Londres", "Aéroport d'Heathrow", 51.47, -0.4543, { pays: "Royaume-Uni", m49: "826", fuseau: "Europe/London" }),
  // Golfe et Moyen-Orient
  aeroport("AUH", "Abu Dhabi", "Aéroport international Zayed", 24.433, 54.6511, AE),
  aeroport("DXB", "Dubaï", "Aéroport international de Dubaï", 25.2532, 55.3657, AE),
  aeroport("DOH", "Doha", "Aéroport international Hamad", 25.2731, 51.6081, { pays: "Qatar", m49: "634", fuseau: "Asia/Qatar" }),
  aeroport("KWI", "Koweït", "Aéroport international de Koweït", 29.2266, 47.9689, { pays: "Koweït", m49: "414", fuseau: "Asia/Kuwait" }),
  aeroport("MCT", "Mascate", "Aéroport international de Mascate", 23.5933, 58.2844, { pays: "Oman", m49: "512", fuseau: "Asia/Muscat" }),
  aeroport("IST", "Istanbul", "Aéroport d'Istanbul", 41.2753, 28.7519, { pays: "Turquie", m49: "792", fuseau: "Europe/Istanbul" }),
  aeroport("CAI", "Le Caire", "Aéroport international du Caire", 30.1219, 31.4056, { pays: "Égypte", m49: "818", fuseau: "Africa/Cairo" }),
  aeroport("AMM", "Amman", "Aéroport Reine Alia", 31.7226, 35.9932, { pays: "Jordanie", m49: "400", fuseau: "Asia/Amman" }),
  // Arabie saoudite
  aeroport("JED", "Djeddah", "Aéroport international Roi Abdelaziz", 21.6796, 39.1565, SA),
  aeroport("MED", "Médine", "Aéroport Prince Mohammed ben Abdelaziz", 24.5534, 39.7051, SA),
  aeroport("TIF", "Taïf", "Aéroport de Taïf", 21.4834, 40.5443, SA),
  aeroport("RUH", "Riyad", "Aéroport international Roi Khaled", 24.9576, 46.6988, SA),
  ville("ville-la-mecque", "La Mecque", "Masjid al-Haram", 21.4225, 39.8262, SA),
  ville("ville-medine", "Médine", "Masjid an-Nabawi", 24.4672, 39.6112, SA),
  ville("ville-djeddah", "Djeddah", "Centre-ville", 21.4858, 39.1925, SA),
  ville("ville-taif", "Taïf", "Centre-ville", 21.2703, 40.4158, SA),
  ville("site-mina", "Mina", "Vallée de Mina", 21.4133, 39.8933, SA, "site"),
  ville("site-arafat", "Arafat", "Mont Arafat", 21.3549, 39.9841, SA, "site"),
  ville("site-muzdalifa", "Muzdalifa", undefined, 21.3833, 39.9333, SA, "site"),
  // Afrique du Nord et de l'Ouest
  aeroport("CMN", "Casablanca", "Aéroport Mohammed V", 33.3675, -7.5898, { pays: "Maroc", m49: "504", fuseau: "Africa/Casablanca" }),
  aeroport("ALG", "Alger", "Aéroport Houari-Boumédiène", 36.691, 3.2154, { pays: "Algérie", m49: "012", fuseau: "Africa/Algiers" }),
  aeroport("TUN", "Tunis", "Aéroport de Tunis-Carthage", 36.851, 10.2272, { pays: "Tunisie", m49: "788", fuseau: "Africa/Tunis" }),
  aeroport("DKR", "Dakar", "Aéroport Blaise-Diagne", 14.67, -17.0733, { pays: "Sénégal", m49: "686", fuseau: "Africa/Dakar" }),
  aeroport("BKO", "Bamako", "Aéroport Modibo-Keïta", 12.5335, -7.9499, { pays: "Mali", m49: "466", fuseau: "Africa/Bamako" }),
  aeroport("ABJ", "Abidjan", "Aéroport Félix-Houphouët-Boigny", 5.2614, -3.9263, { pays: "Côte d'Ivoire", m49: "384", fuseau: "Africa/Abidjan" }),
  // Centres-villes utiles pour une escale longue
  ville("ville-abu-dhabi", "Abu Dhabi", "Centre-ville", 24.4539, 54.3773, AE),
  ville("ville-dubai", "Dubaï", "Centre-ville", 25.2048, 55.2708, AE),
  ville("ville-paris", "Paris", "Centre-ville", 48.8566, 2.3522, FR),
];

const PAR_ID = new Map(CATALOGUE.map((l) => [l.id, l]));

/** Lieu par identifiant, dans le catalogue ou les lieux perso du scénario. */
export function trouverLieu(id: string, scenario: Pick<Scenario, "lieuxPerso">): Lieu | undefined {
  return PAR_ID.get(id) ?? scenario.lieuxPerso.find((l) => l.id === id);
}

/** Libellé court pour les listes : « Paris · CDG », « La Mecque ». */
export function libelleLieu(l: Lieu): string {
  return l.code ? `${l.nom} · ${l.code}` : l.nom;
}

/** Libellé complet : « Paris — Aéroport Charles-de-Gaulle (CDG) ». */
export function libelleComplet(l: Lieu): string {
  const d = l.detail ? ` — ${l.detail}` : "";
  return `${l.nom}${d}${l.code ? ` (${l.code})` : ""}`;
}

/** Fuseaux proposés pour un lieu ajouté à la main. */
export const FUSEAUX: { id: string; libelle: string }[] = [
  { id: "Europe/Paris", libelle: "France, Belgique, Suisse… (Paris)" },
  { id: "Europe/London", libelle: "Royaume-Uni (Londres)" },
  { id: "Europe/Istanbul", libelle: "Turquie (Istanbul)" },
  { id: "Africa/Casablanca", libelle: "Maroc (Casablanca)" },
  { id: "Africa/Algiers", libelle: "Algérie (Alger)" },
  { id: "Africa/Tunis", libelle: "Tunisie (Tunis)" },
  { id: "Africa/Cairo", libelle: "Égypte (Le Caire)" },
  { id: "Africa/Dakar", libelle: "Sénégal, Mali, Côte d'Ivoire… (Dakar)" },
  { id: "Asia/Amman", libelle: "Jordanie (Amman)" },
  { id: "Asia/Riyadh", libelle: "Arabie saoudite, Koweït (Riyad)" },
  { id: "Asia/Qatar", libelle: "Qatar, Bahreïn (Doha)" },
  { id: "Asia/Dubai", libelle: "Émirats, Oman (Dubaï)" },
];
