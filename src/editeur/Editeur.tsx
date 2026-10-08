import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Copy, Download, FileDown, FileUp, Play, Plus, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { calculerChronologie, type Chronologie } from "../domaine/calcul";
import { nouvelleEtape } from "../domaine/fabrique";
import { trouverLieu } from "../domaine/lieux";
import type { Etat } from "../domaine/stockage";
import { dateAvecAnnee, dateCourte, heureLocale } from "../domaine/temps";
import type { Etape, Lieu, Scenario, TypeEtape } from "../domaine/types";
import { CarteEtape, STYLE_TYPE } from "./CarteEtape";
import { FeuilleDeRoute } from "./FeuilleDeRoute";
import { SelecteurLieu } from "./SelecteurLieu";
import { de } from "../domaine/francais";

export interface ActionsEditeur {
  selectionner: (id: string) => void;
  creer: () => void;
  exemple: () => void;
  dupliquer: () => void;
  supprimer: () => void;
  importer: (f: File) => void;
  exporterJson: () => void;
  modifier: (s: Scenario) => void;
  previsualiser: () => void;
  exporterVisite: () => void;
}

const TYPES: TypeEtape[] = ["vol", "escale", "transfert", "sejour"];

export function Editeur({
  etat,
  actif,
  chrono,
  sauve,
  actions,
}: {
  etat: Etat;
  actif: Scenario | null;
  chrono: Chronologie | null;
  sauve: boolean;
  actions: ActionsEditeur;
}) {
  const pret = !!chrono?.depart;
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-[#E7E1D6] bg-papier/90 px-5 backdrop-blur">
        <Logo />
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold tracking-tight">Carnet de route</p>
          <p className="text-xs text-slate-500">Scénarios de voyage et visite animée</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`hidden items-center gap-1.5 text-xs md:inline-flex ${sauve ? "text-slate-500" : "text-amber-700"}`}>
            {sauve ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <TriangleAlert className="h-3.5 w-3.5" />}
            {sauve ? "Enregistré dans ce navigateur" : "Sauvegarde impossible : exporte tes scénarios"}
          </span>
          <button type="button" className="bouton !py-2 !px-4" onClick={actions.previsualiser} disabled={!pret} title="Voir la visite exactement comme tes proches la verront">
            <Play className="h-4 w-4" /> Prévisualiser la visite
          </button>
          <button
            type="button"
            className="bouton-principal"
            onClick={actions.exporterVisite}
            disabled={!pret}
            title="Télécharge un fichier HTML qui contient seulement la visite de ce scénario, à ouvrir ou à envoyer"
          >
            <Download className="h-4 w-4" /> Exporter la visite
          </button>
        </div>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_370px]">
        <ListeScenarios etat={etat} actions={actions} />
        {actif && chrono ? (
          <>
            <EditionScenario key={actif.id} s={actif} c={chrono} modifier={actions.modifier} />
            <aside className="lg:col-start-2 xl:col-start-auto xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-104px)] xl:self-start xl:overflow-y-auto">
              <FeuilleDeRoute c={chrono} />
            </aside>
          </>
        ) : (
          <div className="carte flex flex-col items-center justify-center gap-4 p-12 text-center xl:col-span-2">
            <p className="text-lg font-semibold">Aucun scénario pour l'instant</p>
            <div className="flex gap-2">
              <button type="button" className="bouton-principal" onClick={actions.creer}>
                <Plus className="h-4 w-4" /> Nouveau scénario
              </button>
              <button type="button" className="bouton" onClick={actions.exemple}>
                Charger l'exemple
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0B1426" />
      <path d="M14 42 Q32 8 50 42" fill="none" stroke="#F5C56B" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="0.1 9" />
      <circle cx="14" cy="42" r="5" fill="#F5C56B" />
      <circle cx="50" cy="42" r="5" fill="#0B1426" stroke="#F5C56B" strokeWidth="3" />
    </svg>
  );
}

/* ── Colonne de gauche : les scénarios ───────────────────────────────── */
function ListeScenarios({ etat, actions }: { etat: Etat; actions: ActionsEditeur }) {
  const fichier = useRef<HTMLInputElement>(null);
  const resumes = useMemo(
    () =>
      etat.scenarios.map((s) => {
        const c = calculerChronologie(s);
        const date = c.depart && c.debut ? dateCourte(c.debut, c.depart.fuseau) : "date à préciser";
        const duree = c.segments.length > 0 ? ` · ${c.totaux.jours} j` : "";
        return { id: s.id, nom: s.nom || "Sans titre", sous: `${date}${duree}` };
      }),
    [etat.scenarios],
  );
  return (
    <nav className="space-y-3 lg:sticky lg:top-[84px] lg:self-start">
      <div className="flex items-center justify-between">
        <p className="champ-libelle !mb-0">Mes scénarios</p>
        <button type="button" className="bouton !px-2 !py-1 text-xs" onClick={actions.creer}>
          <Plus className="h-3.5 w-3.5" /> Nouveau
        </button>
      </div>
      <ul className="space-y-1.5">
        {resumes.map((r) => {
          const actif = r.id === etat.actif;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => actions.selectionner(r.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  actif ? "border-or bg-white shadow-[0_2px_10px_rgba(227,169,59,0.18)]" : "border-transparent hover:border-[#E7E1D6] hover:bg-white/60"
                }`}
              >
                <span className="block truncate text-sm font-semibold">{r.nom}</span>
                <span className="block text-xs text-slate-500">{r.sous}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {etat.actif && (
        <div className="grid grid-cols-2 gap-1.5 border-t border-[#E7E1D6] pt-3">
          <button type="button" className="bouton text-xs" onClick={actions.dupliquer} title="Crée une variante à modifier (ex. escale plus longue)">
            <Copy className="h-3.5 w-3.5" /> Dupliquer
          </button>
          <button type="button" className="bouton text-xs" onClick={actions.exporterJson} title="Exporte ce scénario dans un petit fichier .json">
            <FileDown className="h-3.5 w-3.5" /> Exporter
          </button>
          <button type="button" className="bouton text-xs" onClick={() => fichier.current?.click()} title="Importe un scénario exporté (.json)">
            <FileUp className="h-3.5 w-3.5" /> Importer
          </button>
          <button type="button" className="bouton text-xs hover:!border-rose-300 hover:!text-rose-700" onClick={actions.supprimer}>
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </div>
      )}
      <input
        ref={fichier}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) actions.importer(f);
          e.target.value = "";
        }}
      />
      <p className="text-xs leading-relaxed text-slate-500">
        Tes scénarios sont gardés dans ce navigateur. Pour les mettre à l'abri ou les retrouver sur un autre ordinateur : Exporter, puis Importer.
        Pour montrer le voyage : « Exporter la visite » crée un fichier à ouvrir ou à envoyer, qui ne contient que ce scénario.
      </p>
    </nav>
  );
}

/* ── Colonne centrale : le scénario ──────────────────────────────────── */
function Section({ titre, children, aside }: { titre: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="carte p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">{titre}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function EditionScenario({ s, c, modifier }: { s: Scenario; c: Chronologie; modifier: (s: Scenario) => void }) {
  const [insertion, setInsertion] = useState<number | null>(null);
  const [annulable, setAnnulable] = useState<{ etape: Etape; index: number } | null>(null);
  useEffect(() => {
    if (!annulable) return;
    const id = setTimeout(() => setAnnulable(null), 7_000);
    return () => clearTimeout(id);
  }, [annulable]);

  const maj = (patch: Partial<Scenario>) => modifier({ ...s, ...patch });
  const majEtapes = (etapes: Etape[]) => maj({ etapes });
  const ajouterLieu = (l: Lieu) => maj({ lieuxPerso: [...s.lieuxPerso, l] });
  const inserer = (type: TypeEtape, index: number) => {
    const etapes = [...s.etapes];
    etapes.splice(index, 0, nouvelleEtape(type));
    majEtapes(etapes);
    setInsertion(null);
  };

  // Où l'on se trouve au début de chaque étape (même logique que le calcul).
  const ici: (Lieu | undefined)[] = [];
  let position = trouverLieu(s.depart.lieu, s);
  for (const e of s.etapes) {
    ici.push(position);
    if (e.type === "vol" || e.type === "transfert") position = trouverLieu(e.vers, s) ?? position;
  }
  const segmentPar = new Map(c.segments.map((g) => [g.etape.id, g]));
  const alertesDepart = c.alertes.filter((a) => a.etapeId === null).map((a) => a.message);

  return (
    <main className="min-w-0 space-y-5">
      <Section titre="Le voyage">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="champ-libelle">Nom du scénario</span>
            <input className="champ" value={s.nom} onChange={(e) => maj({ nom: e.target.value })} placeholder="ex. Omra en famille — avril 2027" />
          </label>
          <label>
            <span className="champ-libelle">Qui voyage</span>
            <input className="champ" value={s.voyageurs} onChange={(e) => maj({ voyageurs: e.target.value })} placeholder="ex. Papa, Maman et Tata" />
          </label>
          <label className="sm:col-span-2">
            <span className="champ-libelle">Texte d'ouverture</span>
            <textarea
              className="champ min-h-[64px] resize-y"
              rows={2}
              value={s.introduction}
              onChange={(e) => maj({ introduction: e.target.value })}
              placeholder="Affiché au début de la présentation"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="champ-libelle">Mot de la fin</span>
            <textarea
              className="champ min-h-[48px] resize-y"
              rows={1}
              value={s.motDeFin}
              onChange={(e) => maj({ motDeFin: e.target.value })}
              placeholder="Affiché sur le récapitulatif"
            />
          </label>
        </div>
      </Section>

      <Section titre="Départ">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px_120px]">
          <div>
            <label className="champ-libelle" htmlFor="depart-lieu">
              Lieu de départ
            </label>
            <SelecteurLieu
              id="depart-lieu"
              valeur={s.depart.lieu}
              onChange={(lieu) => maj({ depart: { ...s.depart, lieu } })}
              lieuxPerso={s.lieuxPerso}
              onAjouterLieu={ajouterLieu}
            />
          </div>
          <label>
            <span className="champ-libelle">Date</span>
            <input type="date" className="champ" value={s.depart.date} onChange={(e) => maj({ depart: { ...s.depart, date: e.target.value } })} />
          </label>
          <label>
            <span className="champ-libelle">Heure</span>
            <input type="time" className="champ" value={s.depart.heure} onChange={(e) => maj({ depart: { ...s.depart, heure: e.target.value } })} />
          </label>
        </div>
        {c.depart && c.debut > 0 && (
          <p className="mt-3 text-sm text-slate-600">
            Départ le <b className="text-nuit">{dateAvecAnnee(c.debut, c.depart.fuseau)}</b> à <b className="text-nuit">{heureLocale(c.debut, c.depart.fuseau)}</b>, heure{" "}
            {de(c.depart.nom)}.
          </p>
        )}
        {alertesDepart.map((a) => (
          <p key={a} className="mt-3 flex items-center gap-2 text-sm text-amber-800">
            <TriangleAlert className="h-4 w-4" /> {a}
          </p>
        ))}
      </Section>

      <div>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-bold">Étapes</h2>
          <p className="text-xs text-slate-500">Chaque étape commence quand la précédente se termine.</p>
        </div>
        <div>
          {s.etapes.map((e, i) => (
            <div key={e.id}>
              {i > 0 && <Inserteur ouvert={insertion === i} basculer={() => setInsertion(insertion === i ? null : i)} choisir={(t) => inserer(t, i)} />}
              <CarteEtape
                etape={e}
                numero={i + 1}
                segment={segmentPar.get(e.id)}
                ici={ici[i]}
                alertes={c.alertes.filter((a) => a.etapeId === e.id).map((a) => a.message)}
                scenario={s}
                premier={i === 0}
                dernier={i === s.etapes.length - 1}
                onChange={(nouvelle) => majEtapes(s.etapes.map((x) => (x.id === e.id ? nouvelle : x)))}
                onDeplacer={(sens) => {
                  const etapes = [...s.etapes];
                  const [x] = etapes.splice(i, 1);
                  etapes.splice(i + sens, 0, x!);
                  majEtapes(etapes);
                }}
                onSupprimer={() => {
                  setAnnulable({ etape: e, index: i });
                  majEtapes(s.etapes.filter((x) => x.id !== e.id));
                }}
                onAjouterLieu={ajouterLieu}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[#D6CDBD] bg-white/50 p-3">
          <span className="mr-1 text-sm font-medium text-slate-600">Ajouter :</span>
          {TYPES.map((t) => (
            <BoutonType key={t} type={t} onClick={() => inserer(t, s.etapes.length)} />
          ))}
        </div>
      </div>

      {annulable && (
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-nuit px-5 py-2.5 text-sm text-white shadow-xl">
          Étape supprimée.
          <button
            type="button"
            className="inline-flex items-center gap-1 font-semibold text-or-clair hover:underline"
            onClick={() => {
              const etapes = [...s.etapes];
              etapes.splice(annulable.index, 0, annulable.etape);
              majEtapes(etapes);
              setAnnulable(null);
            }}
          >
            <Undo2 className="h-4 w-4" /> Annuler
          </button>
        </div>
      )}
    </main>
  );
}

function BoutonType({ type, onClick }: { type: TypeEtape; onClick: () => void }) {
  const st = STYLE_TYPE[type];
  return (
    <button type="button" className="bouton" onClick={onClick}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-md ${st.pastille}`}>
        <st.Icone className="h-3 w-3" />
      </span>
      {st.libelle}
    </button>
  );
}

function Inserteur({ ouvert, basculer, choisir }: { ouvert: boolean; basculer: () => void; choisir: (t: TypeEtape) => void }) {
  return (
    <div className="group relative flex min-h-[28px] items-center justify-center">
      <div className="absolute left-[34px] top-0 h-full w-px bg-[#DCD5C8]" />
      {ouvert ? (
        <div className="relative z-10 my-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#E7E1D6] bg-white p-2 shadow-sm">
          <span className="px-1 text-xs text-slate-500">Insérer ici :</span>
          {TYPES.map((t) => (
            <BoutonType key={t} type={t} onClick={() => choisir(t)} />
          ))}
          <button type="button" className="bouton-icone" onClick={basculer} aria-label="Fermer">
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={basculer}
          className="relative z-10 flex h-6 items-center gap-1 rounded-full border border-transparent px-2 text-xs text-slate-400 opacity-0 transition hover:border-[#DCD5C8] hover:bg-white hover:text-nuit focus:opacity-100 group-hover:opacity-100"
        >
          <Plus className="h-3 w-3" /> Insérer une étape
        </button>
      )}
    </div>
  );
}
