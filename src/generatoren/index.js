// Registry aller Generatoren. Ab Phase 6 kommen die Zusatzthemen dazu.

import { FINANZ_GENERATOREN, FINANZ_ZUSATZ_GENERATOREN } from './finanz.js';
import { DIFF_GENERATOREN, DIFF_ZUSATZ_GENERATOREN } from './diff.js';
import { INTEGRAL_GENERATOREN } from './integral.js';
import { ALGEBRA_GENERATOREN } from './algebra.js';

export const GENERATOREN = [
  ...FINANZ_GENERATOREN, ...FINANZ_ZUSATZ_GENERATOREN,
  ...DIFF_GENERATOREN, ...DIFF_ZUSATZ_GENERATOREN,
  ...INTEGRAL_GENERATOREN,
  ...ALGEBRA_GENERATOREN,
];

export function findeGenerator(id) {
  return GENERATOREN.find((g) => g.id === id);
}

// Für den Komposer (Probeklausur, Phase 5): Generatoren gruppiert nach Teil,
// damit je Teil eine Kombination gesucht werden kann, die dessen Punkte-Ziel
// trifft (siehe komposer.js).
export const GENERATOREN_NACH_TEIL = GENERATOREN.reduce((gruppen, g) => {
  (gruppen[g.teil] ??= []).push(g);
  return gruppen;
}, {});
