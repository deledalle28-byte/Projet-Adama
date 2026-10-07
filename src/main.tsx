import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { capturerSource } from "./domaine/stockage";
import { App } from "./App";
import "./styles.css";

// Avant tout rendu : la source du fichier sert à « Enregistrer une copie ».
capturerSource();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
