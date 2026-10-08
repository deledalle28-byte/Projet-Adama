/* La mémoire du carnet dans le navigateur.

   Scénarios et photos vivent dans IndexedDB, la base de données du
   navigateur : elle accepte des centaines de Mo, là où localStorage
   plafonne vers 5 Mo (quelques photos à peine). Les photos y sont rangées
   à part, par identifiant : modifier un texte ne réécrit pas les images.

   Si IndexedDB est indisponible, tout passe par localStorage (scénarios
   seulement : les photos ne survivraient pas à la fermeture). */

const NOM = "carnet-de-route";
const VERSION = 1;
const ETATS = "etats";
const IMAGES = "images";

let ouverture: Promise<IDBDatabase | null> | null = null;

function ouvrir(): Promise<IDBDatabase | null> {
  if (!ouverture) {
    ouverture = new Promise((resolve) => {
      try {
        const req = indexedDB.open(NOM, VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(ETATS)) db.createObjectStore(ETATS);
          if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return ouverture;
}

/** Exécute `travail` dans une transaction et attend qu'elle soit validée. */
async function transaction<T>(magasin: string, mode: IDBTransactionMode, travail: (m: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await ouvrir();
  if (!db) throw new Error("IndexedDB indisponible");
  return new Promise((resolve, reject) => {
    const tx = db.transaction(magasin, mode);
    const req = travail(tx.objectStore(magasin));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function baseDisponible(): Promise<boolean> {
  return (await ouvrir()) != null;
}

export async function lireEtatBase(cle: string): Promise<unknown> {
  try {
    return await transaction(ETATS, "readonly", (m) => m.get(cle));
  } catch {
    return undefined;
  }
}

export async function ecrireEtatBase(cle: string, etat: unknown): Promise<boolean> {
  try {
    await transaction(ETATS, "readwrite", (m) => m.put(etat, cle));
    return true;
  } catch {
    return false;
  }
}

export async function lireImages(ids: Iterable<string>): Promise<Map<string, string>> {
  const resultat = new Map<string, string>();
  const db = await ouvrir();
  if (!db) return resultat;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IMAGES, "readonly");
    const m = tx.objectStore(IMAGES);
    for (const id of ids) {
      const req = m.get(id);
      req.onsuccess = () => {
        if (typeof req.result === "string") resultat.set(id, req.result);
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  return resultat;
}

export async function ecrireImages(images: Iterable<[string, string]>): Promise<boolean> {
  try {
    await transaction(IMAGES, "readwrite", (m) => {
      for (const [id, donnees] of images) m.put(donnees, id);
    });
    return true;
  } catch {
    return false;
  }
}

/** Supprime les photos qu'aucun scénario enregistré n'utilise plus. */
export async function nettoyerImages(utilisees: (etats: unknown[]) => Set<string>): Promise<void> {
  try {
    const etats = (await transaction(ETATS, "readonly", (m) => m.getAll())) ?? [];
    const gardees = utilisees(etats);
    const cles = ((await transaction(IMAGES, "readonly", (m) => m.getAllKeys())) ?? []) as IDBValidKey[];
    const aSupprimer = cles.filter((k) => typeof k === "string" && !gardees.has(k));
    if (aSupprimer.length > 0) await transaction(IMAGES, "readwrite", (m) => aSupprimer.forEach((k) => m.delete(k)));
  } catch {
    /* sans gravité : on réessaiera au prochain démarrage */
  }
}

/** Demande au navigateur de ne pas effacer ces données pour faire de la place. */
export function demanderPersistance(): void {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* API absente : rien à faire */
  }
}
