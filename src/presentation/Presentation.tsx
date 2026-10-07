import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import type { Chronologie } from "../domaine/calcul";
import type { Scenario } from "../domaine/types";
import { Carte } from "./Carte";
import { clamp01, Etoiles } from "./elements";
import { construireScenes, SCENE, type Scene } from "./scenes";

/* Moteur de la présentation : horloge pausable, enchaînement automatique
   des scènes, navigation au clavier (Espace, ← →, Échap) et à la souris.
   Toutes les scènes sont composées sur une scène fixe de 1600 × 900, mise à
   l'échelle de l'écran : même rendu sur un portable que sur une télé. */

export function Presentation({ scenario, chronologie, onQuitter }: { scenario: Scenario; chronologie: Chronologie; onQuitter: () => void }) {
  const scenes = useMemo(() => construireScenes(scenario, chronologie), [scenario, chronologie]);
  const [idx, setIdx] = useState(0);
  const [t, setT] = useState(0);
  const [pause, setPause] = useState(false);
  const idxRef = useRef(0);
  const tRef = useRef(0);
  const pauseRef = useRef(false);

  const [echelle, setEchelle] = useState(() => Math.min(window.innerWidth / SCENE.w, window.innerHeight / SCENE.h));
  useEffect(() => {
    const onResize = () => setEchelle(Math.min(window.innerWidth / SCENE.w, window.innerHeight / SCENE.h));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const aller = useCallback(
    (i: number) => {
      const borne = Math.max(0, Math.min(scenes.length - 1, i));
      idxRef.current = borne;
      tRef.current = 0;
      setIdx(borne);
      setT(0);
    },
    [scenes.length],
  );

  // Horloge : requestAnimationFrame, enchaîne les scènes à la fin de leur durée.
  useEffect(() => {
    if (scenes.length === 0) return;
    let dernier = performance.now();
    let raf = 0;
    const tick = (maintenant: number) => {
      const dt = Math.min(60, maintenant - dernier);
      dernier = maintenant;
      if (!pauseRef.current) {
        tRef.current += dt;
        const scene = scenes[idxRef.current]!;
        if (tRef.current >= scene.duree && idxRef.current < scenes.length - 1) {
          idxRef.current += 1;
          tRef.current = 0;
          setIdx(idxRef.current);
        }
        setT(tRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scenes]);

  const basculerPause = useCallback(() => {
    pauseRef.current = !pauseRef.current;
    setPause(pauseRef.current);
  }, []);

  const quitter = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    onQuitter();
  }, [onQuitter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") quitter();
      else if (e.key === " ") {
        e.preventDefault();
        basculerPause();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") aller(idxRef.current + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") aller(idxRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quitter, aller, basculerPause]);

  // Plein écran au lancement (le clic sur « Lancer » autorise la demande).
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const scene = scenes[Math.min(idx, scenes.length - 1)];
  if (!scene) return null;
  const couche = scene.carte(t);
  const actions = {
    rejouer: () => aller(0),
    quitter,
  };

  return (
    <div className="pz-scene" role="dialog" aria-modal="true" aria-label={`Présentation : ${scenario.nom}`}>
      <Etoiles />
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: SCENE.w, height: SCENE.h, transform: `translate(-50%, -50%) scale(${echelle})`, transformOrigin: "center" }}
      >
        <Carte
          largeur={SCENE.w}
          hauteur={SCENE.h}
          cx={SCENE.cx}
          cy={SCENE.cy}
          rayonBase={SCENE.rayonBase}
          camera={scene.camera(t)}
          arcs={couche.arcs}
          points={couche.points}
          paysAllumes={couche.pays}
        />
        <div className="pz-voile" style={{ opacity: scene.voile }} />
        <div key={scene.cle} className="absolute inset-0">
          {scene.rendu(t, actions)}
        </div>
      </div>

      <div className="absolute left-7 top-6 flex items-center gap-3">
        <span className="pz-eyebrow" style={{ fontSize: 12 }}>
          Carnet de route
        </span>
        <span className="text-white/35">·</span>
        <span className="text-sm text-white/60">{scene.chapitre}</span>
      </div>
      <div className="absolute right-6 top-5 flex items-center gap-2">
        <button type="button" className="pz-controle" onClick={() => aller(idx - 1)} disabled={idx === 0} aria-label="Scène précédente">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className="pz-controle" onClick={basculerPause} aria-label={pause ? "Reprendre" : "Pause"}>
          {pause ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button type="button" className="pz-controle" onClick={() => aller(idx + 1)} disabled={idx === scenes.length - 1} aria-label="Scène suivante">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className="pz-controle ml-2" onClick={quitter} aria-label="Quitter la présentation">
          <X className="h-4 w-4" />
        </button>
      </div>
      {pause && (
        <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-5 py-2 text-sm font-medium backdrop-blur">
            <Pause className="h-3.5 w-3.5" /> Pause
          </div>
        </div>
      )}
      <Rail scenes={scenes} idx={idx} t={t} aller={aller} />
      <p className="absolute bottom-3 right-7 text-[11px] text-white/35">Espace : pause · ← → : scènes · Échap : quitter</p>
    </div>
  );
}

function Rail({ scenes, idx, t, aller }: { scenes: Scene[]; idx: number; t: number; aller: (i: number) => void }) {
  const largeur = Math.max(14, Math.min(46, 900 / scenes.length - 8));
  return (
    <div className="pz-rail">
      {scenes.map((s, i) => {
        const p = i < idx ? 1 : i > idx ? 0 : s.duree === Infinity ? 1 : clamp01(t / s.duree);
        return (
          <button key={s.cle} type="button" style={{ width: largeur }} onClick={() => aller(i)} title={s.chapitre} aria-label={`Aller à : ${s.chapitre}`}>
            <div className="pz-rail-chap">
              <div style={{ width: `${p * 100}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
