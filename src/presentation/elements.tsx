import type { CSSProperties, ReactNode } from "react";

/* Briques d'animation : tout est piloté par le temps `t` (ms écoulées dans
   la scène), donc déterministe, pausable et rembobinable. */

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x: number) => x * x * x;
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Progression 0..1 d'un élément qui démarre à `debut` ms et dure `duree` ms. */
export function fenetre(t: number, debut: number, duree: number): number {
  return clamp01((t - debut) / duree);
}

/** Compteur qui accélère puis freine, façon odomètre. */
export function compteur(t: number, debut: number, duree: number, cible: number): number {
  return cible * easeOutExpo(fenetre(t, debut, duree));
}

/** Temps d'écriture d'un sous-titre, pour régler la durée des scènes. */
export const VITESSE_ECRITURE = 28;

/** Sous-titre qui s'écrit lettre par lettre. */
export function SousTitre({ texte, t, debut = 0 }: { texte: string; t: number; debut?: number }) {
  if (!texte) return null;
  const n = Math.max(0, Math.floor((t - debut) / VITESSE_ECRITURE));
  const fini = n >= texte.length;
  return (
    <div className="pz-soustitre">
      <span>{texte.slice(0, n)}</span>
      <span className={`pz-curseur ${fini ? "pz-curseur-fin" : ""}`} aria-hidden>
        ▍
      </span>
    </div>
  );
}

/** Apparition : fondu + glissement vers le haut. */
export function Apparait({
  t,
  debut,
  duree = 700,
  depuis = 28,
  className,
  style,
  children,
}: {
  t: number;
  debut: number;
  duree?: number;
  depuis?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const p = easeOutBack(fenetre(t, debut, duree));
  const o = fenetre(t, debut, duree * 0.6);
  return (
    <div className={className} style={{ opacity: o, transform: `translateY(${(1 - p) * depuis}px)`, willChange: "transform, opacity", ...style }}>
      {children}
    </div>
  );
}

/** Titre dont chaque mot entre à son tour, comme un titre de film. */
export function TitreAnime({
  t,
  texte,
  debut = 250,
  className = "",
  style,
}: {
  t: number;
  texte: string;
  debut?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const mots = texte.split(" ");
  return (
    <h1 className={`flex flex-wrap gap-x-[0.26em] font-extrabold leading-[1.02] tracking-tight ${className}`} style={style}>
      {mots.map((m, i) => (
        <Apparait key={i} t={t} debut={debut + i * 85} duree={620} depuis={24}>
          {m}
        </Apparait>
      ))}
    </h1>
  );
}

/** Étoiles de fond, positions déterministes. */
export function Etoiles({ n = 110 }: { n?: number }) {
  const pts: { x: number; y: number; r: number; o: number; d: number }[] = [];
  let g = 7654321;
  const rnd = () => {
    g = (g * 1103515245 + 12345) % 2147483648;
    return g / 2147483648;
  };
  for (let i = 0; i < n; i++) pts.push({ x: rnd() * 100, y: rnd() * 100, r: 0.4 + rnd() * 1.2, o: 0.2 + rnd() * 0.6, d: rnd() * 6 });
  return (
    <svg className="pz-etoiles" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r * 0.08} fill="#fff" opacity={p.o} style={{ animation: `pzScintille 4s ${p.d}s ease-in-out infinite` }} />
      ))}
    </svg>
  );
}
