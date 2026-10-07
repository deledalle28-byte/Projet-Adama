import { AlertTriangle, ArrowDown, ArrowUp, BedDouble, Bus, Hourglass, Plane, Sparkles, Trash2 } from "lucide-react";
import { distanceKm, estimerDureeTransfert, estimerDureeVol, type Segment } from "../domaine/calcul";
import { trouverLieu } from "../domaine/lieux";
import { LIBELLE_MODE } from "../domaine/programme";
import { dateCourte, ecartJours, formatDecalage, formatDuree, formatKm, heureLocale, utcVersLocal } from "../domaine/temps";
import type { Etape, Lieu, ModeTransfert, Scenario, TypeEtape } from "../domaine/types";
import { SelecteurLieu } from "./SelecteurLieu";
import { a } from "../domaine/francais";

export const STYLE_TYPE: Record<TypeEtape, { libelle: string; Icone: typeof Plane; pastille: string }> = {
  vol: { libelle: "Vol", Icone: Plane, pastille: "bg-[#FDF1DA] text-[#A86D10]" },
  escale: { libelle: "Escale", Icone: Hourglass, pastille: "bg-[#EEE9FB] text-[#5B45B0]" },
  transfert: { libelle: "Transfert", Icone: Bus, pastille: "bg-[#DDF5F1] text-[#137A6E]" },
  sejour: { libelle: "Séjour", Icone: BedDouble, pastille: "bg-[#E4ECF8] text-[#24467F]" },
};

const MODES: ModeTransfert[] = ["bus", "train", "voiture", "taxi", "pied"];

/** Durée en heures + minutes, stockée en minutes. */
function ChampDuree({ minutes, onChange, id }: { minutes: number; onChange: (m: number) => void; id: string }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const borne = (v: string, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        min={0}
        max={240}
        className="champ w-20 text-right"
        value={h}
        onChange={(e) => onChange(borne(e.target.value, 240) * 60 + m)}
        aria-label="Heures"
      />
      <span className="text-sm text-slate-500">h</span>
      <input
        type="number"
        min={0}
        max={59}
        step={5}
        className="champ w-20 text-right"
        value={m}
        onChange={(e) => onChange(h * 60 + borne(e.target.value, 59))}
        aria-label="Minutes"
      />
      <span className="text-sm text-slate-500">min</span>
    </div>
  );
}

export function CarteEtape({
  etape,
  numero,
  segment,
  ici,
  alertes,
  scenario,
  premier,
  dernier,
  onChange,
  onDeplacer,
  onSupprimer,
  onAjouterLieu,
}: {
  etape: Etape;
  numero: number;
  segment: Segment | undefined;
  /** Où l'on se trouve au début de cette étape. */
  ici: Lieu | undefined;
  alertes: string[];
  scenario: Scenario;
  premier: boolean;
  dernier: boolean;
  onChange: (e: Etape) => void;
  onDeplacer: (sens: -1 | 1) => void;
  onSupprimer: () => void;
  onAjouterLieu: (l: Lieu) => void;
}) {
  const style = STYLE_TYPE[etape.type];
  const champ = (nom: string) => `${etape.id}-${nom}`;

  const estimation = (() => {
    if (etape.type !== "vol" && etape.type !== "transfert") return null;
    const vers = trouverLieu(etape.vers, scenario);
    if (!vers || !ici) return null;
    const km = distanceKm(ici, vers);
    return etape.type === "vol" ? estimerDureeVol(km) : estimerDureeTransfert(km, etape.mode);
  })();

  const changerDestination = (id: string) => {
    if (etape.type !== "vol" && etape.type !== "transfert") return;
    const vers = trouverLieu(id, scenario);
    let duree = etape.duree;
    // Durée pré-remplie à partir de la distance, tant qu'elle n'a pas été saisie.
    if (duree === 0 && vers && ici) {
      const km = distanceKm(ici, vers);
      duree = etape.type === "vol" ? estimerDureeVol(km) : estimerDureeTransfert(km, etape.mode);
    }
    onChange({ ...etape, vers: id, duree });
  };

  return (
    <div className="carte overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[#EFEAE1] px-4 py-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.pastille}`}>
          <style.Icone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Étape {numero} · {style.libelle}
          </p>
          <p className="truncate font-semibold">{resume(etape, ici, scenario)}</p>
        </div>
        <button type="button" className="bouton-icone" onClick={() => onDeplacer(-1)} disabled={premier} title="Monter">
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" className="bouton-icone" onClick={() => onDeplacer(1)} disabled={dernier} title="Descendre">
          <ArrowDown className="h-4 w-4" />
        </button>
        <button type="button" className="bouton-icone hover:!bg-rose-50 hover:!text-rose-700" onClick={onSupprimer} title="Supprimer l'étape">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {(etape.type === "vol" || etape.type === "transfert") && (
          <div className="sm:col-span-2">
            <label className="champ-libelle" htmlFor={champ("vers")}>
              {etape.type === "vol" ? "Aéroport d'arrivée" : "Destination"}
            </label>
            <SelecteurLieu id={champ("vers")} valeur={etape.vers} onChange={changerDestination} lieuxPerso={scenario.lieuxPerso} onAjouterLieu={onAjouterLieu} />
          </div>
        )}

        {etape.type === "vol" && (
          <>
            <label>
              <span className="champ-libelle">Compagnie</span>
              <input className="champ" value={etape.compagnie} onChange={(e) => onChange({ ...etape, compagnie: e.target.value })} placeholder="ex. Etihad Airways" />
            </label>
            <label>
              <span className="champ-libelle">N° de vol (facultatif)</span>
              <input className="champ" value={etape.numero} onChange={(e) => onChange({ ...etape, numero: e.target.value })} placeholder="ex. EY 32" />
            </label>
          </>
        )}

        {etape.type === "transfert" && (
          <label>
            <span className="champ-libelle">Moyen de transport</span>
            <select className="champ" value={etape.mode} onChange={(e) => onChange({ ...etape, mode: e.target.value as ModeTransfert })}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {LIBELLE_MODE[m].replace(/^en |^à /, "").replace(/^./, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </label>
        )}

        {etape.type === "escale" && (
          <label>
            <span className="champ-libelle">Intitulé</span>
            <input className="champ" value={etape.intitule} onChange={(e) => onChange({ ...etape, intitule: e.target.value })} placeholder="ex. Correspondance" />
          </label>
        )}

        {(etape.type === "vol" || etape.type === "transfert" || etape.type === "escale") && (
          <div>
            <label className="champ-libelle" htmlFor={champ("duree")}>
              {etape.type === "vol" ? "Durée du vol" : etape.type === "escale" ? "Durée de l'escale" : "Durée du trajet"}
            </label>
            <ChampDuree id={champ("duree")} minutes={etape.duree} onChange={(duree) => onChange({ ...etape, duree })} />
            {estimation != null && estimation !== etape.duree && (
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-or-fonce hover:underline"
                onClick={() => onChange({ ...etape, duree: estimation })}
              >
                <Sparkles className="h-3 w-3" /> Estimer d'après la distance : {formatDuree(estimation)}
              </button>
            )}
          </div>
        )}

        {etape.type === "sejour" && (
          <>
            <label>
              <span className="champ-libelle">Nombre de nuits</span>
              <input
                type="number"
                min={1}
                max={90}
                className="champ w-28"
                value={etape.nuits}
                onChange={(e) => onChange({ ...etape, nuits: Math.max(0, Math.min(90, Math.round(Number(e.target.value) || 0))) })}
              />
            </label>
            <label>
              <span className="champ-libelle">Heure de départ le dernier jour</span>
              <input type="time" className="champ w-36" value={etape.heureDepart} onChange={(e) => onChange({ ...etape, heureDepart: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="champ-libelle">Hébergement</span>
              <input className="champ" value={etape.hebergement} onChange={(e) => onChange({ ...etape, hebergement: e.target.value })} placeholder="ex. Hôtel près du Haram" />
            </label>
          </>
        )}

        <label className="sm:col-span-2">
          <span className="champ-libelle">Commentaire affiché pendant la présentation</span>
          <textarea
            className="champ min-h-[64px] resize-y"
            rows={2}
            value={etape.commentaire}
            onChange={(e) => onChange({ ...etape, commentaire: e.target.value })}
            placeholder="Ce que les proches doivent savoir sur cette étape…"
          />
        </label>
      </div>

      {segment && <div className="border-t border-[#EFEAE1] bg-[#FBF9F5] px-4 py-2.5 text-sm text-slate-600">{horaire(segment)}</div>}
      {alertes.map((a) => (
        <div key={a} className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {a}
        </div>
      ))}
    </div>
  );
}

function resume(e: Etape, ici: Lieu | undefined, s: Scenario): string {
  const la = ici?.nom ?? "?";
  switch (e.type) {
    case "vol":
    case "transfert": {
      const vers = trouverLieu(e.vers, s);
      const mode = e.type === "transfert" ? ` ${LIBELLE_MODE[e.mode]}` : "";
      return vers ? `${la} → ${vers.nom}${mode}` : `Depuis ${la} : choisis la destination`;
    }
    case "escale":
      return `${e.intitule || "Escale"} ${a(la)} · ${formatDuree(e.duree)}`;
    case "sejour":
      return `${e.nuits} nuit${e.nuits > 1 ? "s" : ""} ${a(la)}`;
  }
}

function horaire(g: Segment) {
  const d = g.de.fuseau;
  const a = g.vers.fuseau;
  const b = (x: string) => <b className="font-semibold text-nuit">{x}</b>;
  switch (g.etape.type) {
    case "vol":
    case "transfert": {
      const jours = ecartJours(utcVersLocal(g.debut, d).date, utcVersLocal(g.fin, a).date);
      return (
        <>
          {dateCourte(g.debut, d)} : départ {b(heureLocale(g.debut, d))} → arrivée {b(heureLocale(g.fin, a))}
          {jours > 0 && <span className="ml-1 rounded bg-or/15 px-1 text-xs font-semibold text-or-fonce">+{jours} j</span>}
          <span className="text-slate-400"> · heure locale</span>
          {g.distanceKm >= 1 && <> · {formatKm(g.distanceKm)}</>}
          {g.decalageMin !== 0 && <> · décalage {formatDecalage(g.decalageMin)}</>}
        </>
      );
    }
    case "escale":
      return (
        <>
          {dateCourte(g.debut, d)} : de {b(heureLocale(g.debut, d))} à {b(heureLocale(g.fin, d))}
          {utcVersLocal(g.fin, d).date !== utcVersLocal(g.debut, d).date && <> (le {dateCourte(g.fin, d)})</>}
          <span className="text-slate-400"> · heure locale</span>
        </>
      );
    case "sejour":
      return (
        <>
          Arrivée {dateCourte(g.debut, d)} à {b(heureLocale(g.debut, d))} · départ {dateCourte(g.fin, d)} à {b(heureLocale(g.fin, d))}
        </>
      );
  }
}
