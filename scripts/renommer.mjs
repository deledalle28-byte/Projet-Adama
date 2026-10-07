// Le build sort dist/index.html : on lui donne un nom parlant.
import { renameSync, statSync } from "node:fs";

renameSync("dist/index.html", "dist/carnet-de-route.html");
const ko = Math.round(statSync("dist/carnet-de-route.html").size / 1024);
console.log(`dist/carnet-de-route.html généré (${ko} Ko)`);
