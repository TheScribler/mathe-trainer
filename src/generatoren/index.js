// Registry aller Generatoren. Ab Phase 1 kommen hier finanz.js usw. dazu.

import { dummyAddition } from './dummy.js';

export const GENERATOREN = [dummyAddition];

export function findeGenerator(id) {
  return GENERATOREN.find((g) => g.id === id);
}
