// Registry aller Generatoren. Ab Phase 2 kommen diff.js usw. dazu.

import { FINANZ_GENERATOREN } from './finanz.js';

export const GENERATOREN = [...FINANZ_GENERATOREN];

export function findeGenerator(id) {
  return GENERATOREN.find((g) => g.id === id);
}
