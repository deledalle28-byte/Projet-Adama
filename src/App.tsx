import { useCallback, useEffect, useMemo, useState } from "react";
import { ecrireImages } from "./domaine/base";
import { calculerChronologie } from "./domaine/calcul";
import { exporterVisite } from "./domaine/exportVisite";
import { dupliquerScenario, nouveauScenario, scenarioExemple } from "./domaine/fabrique";
import { preparerImage } from "./domaine/images";
import { charger, exporterJson, importerJson, imagesUtilisees, sauver, type Chargement, type Etat, type Images } from "./domaine/stockage";
import type { ImageEtape, Scenario } from "./domaine/types";
import { Editeur, type ActionsEditeur } from "./editeur/Editeur";
import { PHOTOS_EXEMPLE } from "./exemple/photos";
import { Visite } from "./visite/Visite";

/** Photos d'exemple utilisées par les scénarios mais absentes de la mémoire. */
function photosExempleManquantes(etat: Etat, images: Images): Images {
  const manquantes: Images = new Map();
  for (const id of imagesUtilisees(etat.scenarios)) {
    const donnees = PHOTOS_EXEMPLE.get(id);
    if (donnees && !images.has(id)) manquantes.set(id, donnees);
  }
  return manquantes;
}

export function App() {
  const [init, setInit] = useState<Chargement | null>(null);
  useEffect(() => {
    void charger().then(setInit);
  }, []);
  if (!init) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Ouverture du carnet…</div>;
  }
  return <Carnet init={init} />;
}

function Carnet({ init }: { init: Chargement }) {
  const [etat, setEtat] = useState<Etat>(init.etat);
  // Le scénario d'exemple créé au premier lancement : ses photos viennent du carnet.
  const [photosExemple] = useState(() => photosExempleManquantes(init.etat, init.images));
  const [images, setImages] = useState<Images>(() => new Map([...init.images, ...photosExemple]));
  useEffect(() => {
    if (photosExemple.size > 0) void ecrireImages(photosExemple);
  }, [photosExemple]);
  const [apercu, setApercu] = useState(false);
  const [sauve, setSauve] = useState(true);

  // Sauvegarde automatique dans le navigateur, un quart de seconde après la dernière frappe.
  useEffect(() => {
    const id = setTimeout(() => void sauver(init.cle, etat).then(setSauve), 250);
    return () => clearTimeout(id);
  }, [etat, init.cle]);

  const actif = etat.scenarios.find((s) => s.id === etat.actif) ?? etat.scenarios[0] ?? null;
  const chrono = useMemo(() => (actif ? calculerChronologie(actif) : null), [actif]);

  const ajouter = useCallback((s: Scenario) => setEtat((e) => ({ scenarios: [...e.scenarios, s], actif: s.id })), []);

  /** Range des photos (déjà préparées) dans la mémoire du navigateur et dans l'état. */
  const rangerImages = useCallback(async (nouvelles: Images) => {
    if (nouvelles.size === 0) return true;
    setImages((m) => new Map([...m, ...nouvelles]));
    const ok = await ecrireImages(nouvelles);
    if (!ok) setSauve(false);
    return ok;
  }, []);

  /** Prépare des photos et les ajoute à une étape ; renvoie les erreurs. */
  const ajouterPhotos = useCallback(
    async (scenarioId: string, etapeId: string, fichiers: File[]): Promise<string[]> => {
      const preparees: Images = new Map();
      const ratios = new Map<string, number>();
      const erreurs: string[] = [];
      for (const f of fichiers) {
        try {
          const { id, donnees, ratio } = await preparerImage(f);
          preparees.set(id, donnees);
          ratios.set(id, ratio);
        } catch (e) {
          erreurs.push(e instanceof Error ? e.message : `« ${f.name} » n'a pas pu être ajoutée.`);
        }
      }
      await rangerImages(preparees);
      // Mise à jour fonctionnelle : ce qui a été tapé pendant la préparation est conservé.
      const ajoutees: ImageEtape[] = [...preparees.keys()].map((id) => ({ id, legende: "", placement: "sous", ratio: ratios.get(id) }));
      if (ajoutees.length > 0) {
        setEtat((e) => ({
          ...e,
          scenarios: e.scenarios.map((s) =>
            s.id !== scenarioId
              ? s
              : { ...s, modifieLe: Date.now(), etapes: s.etapes.map((x) => (x.id === etapeId ? { ...x, images: [...x.images, ...ajoutees] } : x)) },
          ),
        }));
      }
      return erreurs;
    },
    [rangerImages],
  );

  const actions: ActionsEditeur = {
    selectionner: (id) => setEtat((e) => ({ ...e, actif: id })),
    creer: () => ajouter(nouveauScenario()),
    exemple: () => {
      void rangerImages(PHOTOS_EXEMPLE);
      ajouter(scenarioExemple());
    },
    dupliquer: () => actif && ajouter(dupliquerScenario(actif)),
    supprimer: () => {
      if (!actif || !window.confirm(`Supprimer le scénario « ${actif.nom} » ?`)) return;
      setEtat((e) => {
        const scenarios = e.scenarios.filter((s) => s.id !== actif.id);
        return { scenarios, actif: scenarios[0]?.id ?? null };
      });
    },
    importer: (f) => {
      importerJson(f)
        .then(async ({ scenario, images: photos }) => {
          await rangerImages(photos);
          ajouter(scenario);
        })
        .catch((err: unknown) => window.alert(err instanceof Error ? err.message : "Import impossible."));
    },
    exporterJson: () => actif && exporterJson(actif, images),
    modifier: (s) => setEtat((e) => ({ ...e, scenarios: e.scenarios.map((x) => (x.id === s.id ? { ...s, modifieLe: Date.now() } : x)) })),
    previsualiser: () => setApercu(true),
    exporterVisite: () => actif && exporterVisite(actif, images),
  };

  return (
    <>
      <Editeur
        etat={{ ...etat, actif: actif?.id ?? null }}
        actif={actif}
        chrono={chrono}
        sauve={sauve}
        images={images}
        ajouterPhotos={ajouterPhotos}
        actions={actions}
      />
      {apercu && actif && <Visite scenario={actif} images={images} onFermerApercu={() => setApercu(false)} />}
    </>
  );
}
