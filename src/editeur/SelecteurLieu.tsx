import { useState } from "react";
import { MapPinPlus } from "lucide-react";
import { CATALOGUE, FUSEAUX, libelleComplet } from "../domaine/lieux";
import { nouvelId } from "../domaine/fabrique";
import type { Lieu, TypeLieu } from "../domaine/types";

const AJOUTER = "__ajouter";

const REGIONS: { nom: string; pays: string[] }[] = [
  { nom: "France et Europe", pays: ["France", "Belgique", "Suisse", "Royaume-Uni"] },
  { nom: "Arabie saoudite", pays: ["Arabie saoudite"] },
  { nom: "Golfe et Moyen-Orient", pays: ["Émirats arabes unis", "Qatar", "Koweït", "Oman", "Turquie", "Égypte", "Jordanie"] },
  { nom: "Afrique", pays: ["Maroc", "Algérie", "Tunisie", "Sénégal", "Mali", "Côte d'Ivoire"] },
];

function groupes() {
  return REGIONS.map((r) => ({
    nom: r.nom,
    lieux: CATALOGUE.filter((l) => r.pays.includes(l.pays)).sort((a, b) => (a.type === b.type ? 0 : a.type === "aeroport" ? -1 : 1)),
  }));
}
const GROUPES = groupes();

export function SelecteurLieu({
  valeur,
  onChange,
  lieuxPerso,
  onAjouterLieu,
  id,
}: {
  valeur: string;
  onChange: (id: string) => void;
  lieuxPerso: Lieu[];
  onAjouterLieu: (l: Lieu) => void;
  id?: string;
}) {
  const [formulaire, setFormulaire] = useState(false);
  return (
    <div>
      <select
        id={id}
        className="champ"
        value={valeur}
        onChange={(ev) => {
          if (ev.target.value === AJOUTER) setFormulaire(true);
          else onChange(ev.target.value);
        }}
      >
        <option value="">Choisir un lieu…</option>
        {GROUPES.map((g) => (
          <optgroup key={g.nom} label={g.nom}>
            {g.lieux.map((l) => (
              <option key={l.id} value={l.id}>
                {libelleComplet(l)}
              </option>
            ))}
          </optgroup>
        ))}
        {lieuxPerso.length > 0 && (
          <optgroup label="Mes lieux">
            {lieuxPerso.map((l) => (
              <option key={l.id} value={l.id}>
                {libelleComplet(l)}
              </option>
            ))}
          </optgroup>
        )}
        <option value={AJOUTER}>＋ Ajouter un lieu qui n'est pas dans la liste…</option>
      </select>
      {formulaire && (
        <FormulaireLieu
          onAnnuler={() => setFormulaire(false)}
          onValider={(l) => {
            onAjouterLieu(l);
            onChange(l.id);
            setFormulaire(false);
          }}
        />
      )}
    </div>
  );
}

function FormulaireLieu({ onValider, onAnnuler }: { onValider: (l: Lieu) => void; onAnnuler: () => void }) {
  const [nom, setNom] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState<TypeLieu>("ville");
  const [code, setCode] = useState("");
  const [pays, setPays] = useState("");
  const [coords, setCoords] = useState("");
  const [fuseau, setFuseau] = useState("Asia/Riyadh");
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = () => {
    const nombres = coords.match(/-?\d+(?:[.,]\d+)?/g)?.map((x) => Number(x.replace(",", "."))) ?? [];
    const [lat, lon] = nombres;
    if (!nom.trim()) return setErreur("Donne un nom au lieu.");
    if (nombres.length !== 2 || lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return setErreur("Coordonnées attendues sous la forme « 21.4225, 39.8262 ».");
    }
    onValider({
      id: nouvelId("lieu"),
      nom: nom.trim(),
      detail: detail.trim() || undefined,
      code: type === "aeroport" && code.trim() ? code.trim().toUpperCase() : undefined,
      pays: pays.trim(),
      lat,
      lon,
      fuseau,
      type,
    });
  };

  return (
    <div className="mt-2 rounded-xl border border-or/40 bg-[#FFFBF2] p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MapPinPlus className="h-4 w-4 text-or-fonce" /> Nouveau lieu
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="champ-libelle">Nom</span>
          <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Hôtel Swissôtel" autoFocus />
        </label>
        <label>
          <span className="champ-libelle">Précision (facultatif)</span>
          <input className="champ" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="ex. Tour de l'horloge" />
        </label>
        <label>
          <span className="champ-libelle">Type</span>
          <select className="champ" value={type} onChange={(e) => setType(e.target.value as TypeLieu)}>
            <option value="ville">Ville, hôtel, adresse</option>
            <option value="aeroport">Aéroport</option>
            <option value="site">Site à visiter</option>
          </select>
        </label>
        {type === "aeroport" ? (
          <label>
            <span className="champ-libelle">Code aéroport (facultatif)</span>
            <input className="champ" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex. AUH" maxLength={4} />
          </label>
        ) : (
          <label>
            <span className="champ-libelle">Pays</span>
            <input className="champ" value={pays} onChange={(e) => setPays(e.target.value)} placeholder="ex. Arabie saoudite" />
          </label>
        )}
        <label className="sm:col-span-2">
          <span className="champ-libelle">Coordonnées GPS</span>
          <input className="champ" value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="21.4225, 39.8262" />
          <span className="mt-1 block text-xs text-slate-500">Sur Google Maps : clic droit sur le lieu, puis clic sur les coordonnées pour les copier.</span>
        </label>
        <label className="sm:col-span-2">
          <span className="champ-libelle">Fuseau horaire</span>
          <select className="champ" value={fuseau} onChange={(e) => setFuseau(e.target.value)}>
            {FUSEAUX.map((f) => (
              <option key={f.id} value={f.id}>
                {f.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>
      {erreur && <p className="mt-3 text-sm text-rose-700">{erreur}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="bouton" onClick={onAnnuler}>
          Annuler
        </button>
        <button type="button" className="bouton border-nuit bg-nuit text-white hover:bg-nuit-2" onClick={valider}>
          Ajouter ce lieu
        </button>
      </div>
    </div>
  );
}
