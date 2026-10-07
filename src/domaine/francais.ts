/* Prépositions devant un nom de lieu : « d'Abu Dhabi », « du Caire »,
   « au Caire », « à La Mecque ». Le h n'élide pas (« de Hambourg »). */

const VOYELLE = /^[aeiouyâàäéèêëîïôöûüAEIOUYÂÀÄÉÈÊËÎÏÔÖÛÜ]/;

export function de(nom: string): string {
  if (/^Le[\s ]/.test(nom)) return `du ${nom.slice(3)}`;
  if (/^Les[\s ]/.test(nom)) return `des ${nom.slice(4)}`;
  return VOYELLE.test(nom) ? `d'${nom}` : `de ${nom}`;
}

export function a(nom: string): string {
  if (/^Le[\s ]/.test(nom)) return `au ${nom.slice(3)}`;
  if (/^Les[\s ]/.test(nom)) return `aux ${nom.slice(4)}`;
  return `à ${nom}`;
}
