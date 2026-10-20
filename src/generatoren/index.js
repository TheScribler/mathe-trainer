// Registry aller Generatoren. Ab Phase 6 kommen die Zusatzthemen dazu.

import { FINANZ_GENERATOREN } from './finanz.js';
import { DIFF_GENERATOREN } from './diff.js';
import { INTEGRAL_GENERATOREN } from './integral.js';
import { ALGEBRA_GENERATOREN } from './algebra.js';

export const GENERATOREN = [...FINANZ_GENERATOREN, ...DIFF_GENERATOREN, ...INTEGRAL_GENERATOREN, ...ALGEBRA_GENERATOREN];

export function findeGenerator(id) {
  return GENERATOREN.find((g) => g.id === id);
}
