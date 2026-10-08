import abudhabi from "./photos/abudhabi.jpg";
import departs from "./photos/departs.jpg";
import hublot from "./photos/hublot.jpg";
import medine from "./photos/medine.jpg";
import mecque from "./photos/mecque.jpg";
import paris from "./photos/paris.jpg";
import train from "./photos/train.jpg";

/* Photos du scénario d'exemple : des illustrations façon affiches de
   voyage, dessinées pour le carnet. Elles sont incluses dans le carnet
   seulement (pas dans le lecteur de visite) et rangées dans la mémoire du
   navigateur quand le scénario d'exemple est ajouté. Les identifiants sont
   ceux qu'utilise scenarioExemple() (domaine/fabrique.ts). */

export const PHOTOS_EXEMPLE = new Map<string, string>([
  ["exemple-hublot", hublot],
  ["exemple-abudhabi", abudhabi],
  ["exemple-departs", departs],
  ["exemple-train", train],
  ["exemple-mecque", mecque],
  ["exemple-medine", medine],
  ["exemple-paris", paris],
]);
