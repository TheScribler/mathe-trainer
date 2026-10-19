// Registry aller Generatoren. Ab Phase 2 kommen diff.js usw. dazu.

import { dummyAddition } from './dummy.js';
import { FINANZ_GENERATOREN } from './finanz.js';

export const GENERATOREN = [dummyAddition, ...FINANZ_GENERATOREN];

export function findeGenerator(id) {
  return GENERATOREN.find((g) => g.id === id);
}
