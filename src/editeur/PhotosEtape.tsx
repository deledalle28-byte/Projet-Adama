import { useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, ImageOff, ImagePlus, LoaderCircle, X } from "lucide-react";
import type { Images } from "../domaine/stockage";
import type { ImageEtape } from "../domaine/types";

/** Ajoute des fichiers aux photos de l'étape ; renvoie les messages d'erreur. */
export type AjouterPhotos = (fichiers: File[]) => Promise<string[]>;

const EST_IMAGE = /\.(jpe?g|png|webp|gif|bmp|avif|hei[cf])$/i;

export function PhotosEtape({
  photos,
  images,
  onChange,
  ajouterPhotos,
}: {
  photos: ImageEtape[];
  images: Images;
  onChange: (photos: ImageEtape[]) => void;
  ajouterPhotos: AjouterPhotos;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(0);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [survol, setSurvol] = useState(false);

  const ajouter = async (fichiers: File[]) => {
    const retenus = fichiers.filter((f) => f.type.startsWith("image/") || EST_IMAGE.test(f.name));
    if (retenus.length === 0) return;
    setErreurs([]);
    setEnCours((n) => n + retenus.length);
    const messages = await ajouterPhotos(retenus);
    setEnCours((n) => n - retenus.length);
    setErreurs(messages);
  };

  const deplacer = (i: number, sens: -1 | 1) => {
    const copie = [...photos];
    const [x] = copie.splice(i, 1);
    copie.splice(i + sens, 0, x!);
    onChange(copie);
  };

  const deposer = (e: DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    void ajouter([...e.dataTransfer.files]);
  };

  return (
    <div
      className={`rounded-xl transition ${survol ? "bg-or/10 ring-2 ring-or/50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={deposer}
    >
      <span className="champ-libelle">Photos affichées pendant la présentation</span>
      <div className="flex flex-wrap gap-3">
        {photos.map((p, i) => {
          const src = images.get(p.id);
          return (
            <figure key={p.id} className="w-[148px]">
              <div className="group relative h-[100px] overflow-hidden rounded-lg bg-[#EFEAE1]">
                {src ? (
                  <img src={src} alt={p.legende || `Photo ${i + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1 text-xs text-slate-500">
                    <ImageOff className="h-5 w-5" /> Photo introuvable
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-rose-600 focus:opacity-100 group-hover:opacity-100"
                  title="Retirer la photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {photos.length > 1 && (
                  <div className="absolute bottom-1 left-1 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => deplacer(i, -1)}
                      disabled={i === 0}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                      title="Avant"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(i, 1)}
                      disabled={i === photos.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                      title="Après"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <input
                className="champ mt-1.5 !px-2 !py-1 text-xs"
                value={p.legende}
                onChange={(e) => onChange(photos.map((x) => (x.id === p.id ? { ...x, legende: e.target.value } : x)))}
                placeholder="Légende (facultatif)"
                aria-label={`Légende de la photo ${i + 1}`}
              />
            </figure>
          );
        })}
        <button
          type="button"
          onClick={() => champ.current?.click()}
          className="flex h-[100px] w-[148px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#D6CDBD] text-xs font-medium text-slate-500 transition hover:border-or hover:bg-or/5 hover:text-nuit"
        >
          {enCours > 0 ? (
            <>
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Préparation…
            </>
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              Ajouter des photos
              <span className="font-normal text-slate-400">ou les glisser ici</span>
            </>
          )}
        </button>
      </div>
      <input
        ref={champ}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => {
          void ajouter([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      {erreurs.map((m) => (
        <p key={m} className="mt-2 text-sm text-rose-700">
          {m}
        </p>
      ))}
    </div>
  );
}
