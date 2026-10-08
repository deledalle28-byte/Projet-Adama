import { nouvelId } from "./fabrique";

/* Préparation des photos ajoutées à une étape : redimensionnées à 1600 px
   au plus et réencodées en JPEG. Une photo de téléphone de 4 Mo pèse alors
   200 à 400 Ko : la mémoire du navigateur et le fichier de visite restent
   légers, et la qualité suffit largement pour un écran. */

const COTE_MAX = 1600;
const QUALITE = 0.84;

async function decoder(fichier: File): Promise<{ source: CanvasImageSource; largeur: number; hauteur: number }> {
  if ("createImageBitmap" in window) {
    try {
      const b = await createImageBitmap(fichier, { imageOrientation: "from-image" });
      return { source: b, largeur: b.width, hauteur: b.height };
    } catch {
      /* format que createImageBitmap refuse : on tente l'élément <img> */
    }
  }
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, largeur: img.naturalWidth, hauteur: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function preparerImage(fichier: File): Promise<{ id: string; donnees: string }> {
  let image;
  try {
    image = await decoder(fichier);
  } catch {
    const heic = /\.hei[cf]$/i.test(fichier.name) || /hei[cf]/i.test(fichier.type);
    throw new Error(
      heic
        ? `« ${fichier.name} » est au format HEIC (iPhone), que le navigateur ne sait pas lire. Convertis-la en JPEG, ou règle l'iPhone sur « Le plus compatible ».`
        : `« ${fichier.name} » n'est pas une image lisible.`,
    );
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(image.largeur, image.hauteur));
  const l = Math.max(1, Math.round(image.largeur * echelle));
  const h = Math.max(1, Math.round(image.hauteur * echelle));
  const canvas = document.createElement("canvas");
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Préparation de l'image impossible.");
  ctx.fillStyle = "#0B1426"; // fond des zones transparentes (PNG)
  ctx.fillRect(0, 0, l, h);
  ctx.drawImage(image.source, 0, 0, l, h);
  if ("close" in image.source) (image.source as ImageBitmap).close();
  return { id: nouvelId("img"), donnees: canvas.toDataURL("image/jpeg", QUALITE) };
}
