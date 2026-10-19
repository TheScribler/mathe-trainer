// Registry aller Generatoren. Ab Phase 3 kommen integral.js usw. dazu.

import { FINANZ_GENERATOREN } from './finanz.js';
import { DIFF_GENERATOREN } from './diff.js';

export const GENERATOREN = [...FINANZ_GENERATOREN, ...DIFF_GENERATOREN];

export function findeGenerator(id) {
  return GENERATOREN.find((g) => g.id === id);
}
