import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { scenarioExemple } from "../domaine/fabrique";
import { lireVisite } from "../domaine/stockage";
import { Visite } from "./Visite";
import "../styles.css";

// Le scénario est glissé dans le fichier au moment de l'export. Sans lui
// (gabarit ouvert tel quel, développement), on montre l'exemple.
const scenario = lireVisite() ?? scenarioExemple();
document.title = `${scenario.nom || "Voyage"} — la visite`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Visite scenario={scenario} />
  </StrictMode>,
);
