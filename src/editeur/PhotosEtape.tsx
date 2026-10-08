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
      <span className="champ-libelle">Photos</span>
      <p className="-mt-0.5 mb-2.5 text-xs text-slate-500">
        Pendant la visite, elles arrivent après le lieu ou le trajet et défilent l'une après l'autre, avec leur texte.
      </p>
      <div className="flex flex-wrap gap-3">
        {photos.map((p, i) => {
          const src = images.get(p.id);
          const maj = (patch: Partial<ImageEtape>) => onChange(photos.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
          return (
            <figure key={p.id} className="w-[200px] rounded-xl border border-[#E7E1D6] bg-[#FBF9F5] p-2">
              <div className="group relative h-[124px] overflow-hidden rounded-lg bg-[#EFEAE1]">
                {src ? (
                  <img src={src} alt={p.legende || `Photo ${i + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1 text-xs text-slate-500">
                    <ImageOff className="h-5 w-5" /> Photo introuvable
                  </span>
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-rose-600 focus:opacity-100 group-hover:opacity-100"
                  title="Retirer la photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {photos.length > 1 && (
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => deplacer(i, -1)}
                      disabled={i === 0}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                      title="Montrer plus tôt"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(i, 1)}
                      disabled={i === photos.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                      title="Montrer plus tard"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <textarea
                className="champ mt-2 min-h-[52px] resize-y !px-2 !py-1.5 text-xs leading-snug"
                rows={2}
                value={p.legende}
                onChange={(e) => maj({ legende: e.target.value })}
                placeholder="Légende ou petit commentaire (facultatif)"
                aria-label={`Texte de la photo ${i + 1}`}
              />
              <div className="mt-1.5 grid grid-cols-2 gap-0.5 rounded-lg bg-[#EFEAE1] p-0.5 text-[11px] font-medium" role="radiogroup" aria-label="Place du texte">
                {(["sous", "sur"] as const).map((placement) => (
                  <button
                    key={placement}
                    type="button"
                    role="radio"
                    aria-checked={p.placement === placement}
                    onClick={() => maj({ placement })}
                    className={`rounded-md py-1 transition ${p.placement === placement ? "bg-white text-nuit shadow-sm" : "text-slate-500 hover:text-nuit"}`}
                  >
                    {placement === "sous" ? "Sous la photo" : "Sur la photo"}
                  </button>
                ))}
              </div>
            </figure>
          );
        })}
        <button
          type="button"
          onClick={() => champ.current?.click()}
          className="flex h-[124px] w-[200px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#D6CDBD] text-xs font-medium text-slate-500 transition hover:border-or hover:bg-or/5 hover:text-nuit"
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
