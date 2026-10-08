import { useCallback, useEffect, useMemo, useState } from "react";
import { calculerChronologie } from "./domaine/calcul";
import { dupliquerScenario, nouveauScenario, scenarioExemple } from "./domaine/fabrique";
import { exporterVisite } from "./domaine/exportVisite";
import { charger, exporterJson, importerJson, sauver, type Etat } from "./domaine/stockage";
import type { Scenario } from "./domaine/types";
import { Editeur, type ActionsEditeur } from "./editeur/Editeur";
import { Visite } from "./visite/Visite";

export function App() {
  const [init] = useState(charger);
  const [etat, setEtat] = useState<Etat>(init.etat);
  const [apercu, setApercu] = useState(false);
  const [sauve, setSauve] = useState(true);

  // Sauvegarde automatique dans le navigateur, un quart de seconde après la dernière frappe.
  useEffect(() => {
    const id = setTimeout(() => setSauve(sauver(init.cle, etat)), 250);
    return () => clearTimeout(id);
  }, [etat, init.cle]);

  const actif = etat.scenarios.find((s) => s.id === etat.actif) ?? etat.scenarios[0] ?? null;
  const chrono = useMemo(() => (actif ? calculerChronologie(actif) : null), [actif]);

  const ajouter = useCallback((s: Scenario) => setEtat((e) => ({ scenarios: [...e.scenarios, s], actif: s.id })), []);

  const actions: ActionsEditeur = {
    selectionner: (id) => setEtat((e) => ({ ...e, actif: id })),
    creer: () => ajouter(nouveauScenario()),
    exemple: () => ajouter(scenarioExemple()),
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
        .then(ajouter)
        .catch((err: unknown) => window.alert(err instanceof Error ? err.message : "Import impossible."));
    },
    exporterJson: () => actif && exporterJson(actif),
    modifier: (s) => setEtat((e) => ({ ...e, scenarios: e.scenarios.map((x) => (x.id === s.id ? { ...s, modifieLe: Date.now() } : x)) })),
    previsualiser: () => setApercu(true),
    exporterVisite: () => actif && exporterVisite(actif),
  };

  return (
    <>
      <Editeur etat={{ ...etat, actif: actif?.id ?? null }} actif={actif} chrono={chrono} sauve={sauve} actions={actions} />
      {apercu && actif && <Visite scenario={actif} onFermerApercu={() => setApercu(false)} />}
    </>
  );
}
