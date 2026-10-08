import gabarit from "../../dist-visite/visite.html?raw";
import { ID_VISITE, imagesDuScenario, nomDeFichier, telecharger, type Images } from "./stockage";
import type { Scenario } from "./types";

/**
 * « Exporter la visite » : le lecteur de visite (dist-visite/visite.html,
 * compilé avant le carnet et inclus dans celui-ci) reçoit le scénario
 * choisi et ses photos, et seulement eux. Le fichier obtenu s'ouvre
 * directement sur la visite, sans éditeur.
 *
 * Passe par DOMParser : aucune balise <script> n'est écrite en dur dans le
 * code (elle couperait le script inliné du carnet).
 */
export function exporterVisite(s: Scenario, images: Images): void {
  const doc = new DOMParser().parseFromString(gabarit, "text/html");
  doc.title = `${s.nom || "Voyage"} — la visite`;
  const el = doc.createElement("script");
  el.id = ID_VISITE;
  el.type = "application/json";
  // « < » échappé : un commentaire contenant « </script> » ne casse rien.
  el.textContent = JSON.stringify({ format: "carnet-de-route/visite", version: 2, scenario: s, images: imagesDuScenario(s, images) }).replace(/</g, "\\u003c");
  doc.body.appendChild(el);
  const html = "<!doctype html>\n" + doc.documentElement.outerHTML;
  telecharger(new Blob([html], { type: "text/html;charset=utf-8" }), `visite-${nomDeFichier(s.nom)}.html`);
}
