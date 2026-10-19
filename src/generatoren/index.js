// Registry aller Generatoren. Ab Phase 4 kommt algebra.js dazu.

import { FINANZ_GENERATOREN } from './finanz.js';
import { DIFF_GENERATOREN } from './diff.js';
import { INTEGRAL_GENERATOREN } from './integral.js';

export const GENERATOREN = [...FINANZ_GENERATOREN, ...DIFF_GENERATOREN, ...INTEGRAL_GENERATOREN];

export function findeGenerator(id) {
  return GENERATOREN.find((g) => g.id === id);
}
