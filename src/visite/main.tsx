import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { scenarioExemple } from "../domaine/fabrique";
import { lireVisite } from "../domaine/stockage";
import { Visite } from "./Visite";
import "../styles.css";

// Le scénario et ses photos sont glissés dans le fichier au moment de
// l'export. Sans eux (gabarit ouvert tel quel, développement), on montre
// l'exemple.
const { scenario, images } = lireVisite() ?? { scenario: scenarioExemple(), images: new Map<string, string>() };
document.title = `${scenario.nom || "Voyage"} — la visite`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Visite scenario={scenario} images={images} />
  </StrictMode>,
);
