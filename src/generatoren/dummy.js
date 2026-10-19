// Platzhalter-Generator nur für den Testharness in Phase 0 — kein Klausurbezug.
// Beweist, dass waehleParameter/baue, die Zufallsschicht und die Prüfung
// durchgängig funktionieren, bevor die echten Generatoren (Phase 1) folgen.

import { zufallInt } from '../rng.js';
import { zahlZuLatex } from '../latex.js';

export const dummyAddition = {
  id: 'dummy.addition',
  teil: 'dummy',
  name: 'Testaufgabe: Addition (nur Infrastruktur, kein Klausurinhalt)',
  punkte: 1,
  vorlage: 'kein Klausurbezug',
  waehleParameter(rng) {
    const a = zufallInt(rng, 10, 99);
    const b = zufallInt(rng, 10, 99);
    return { a, b };
  },
  baue(params) {
    const { a, b } = params;
    const summe = a + b;
    return {
      frage: { text: `Berechnen Sie ${a} + ${b}.` },
      eingaben: [
        { id: 'summe', label: 'Summe', typ: 'zahl', punkte: 1, loesung: summe, toleranz: 1e-9 },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: 'a + b' },
          { titel: 'Einsetzen', latex: `${a} + ${b}` },
          { titel: 'Ergebnis', latex: zahlZuLatex(summe, 0) },
        ],
        ergebnisse: [{ label: 'Summe', latex: zahlZuLatex(summe, 0) }],
      },
      params,
    };
  },
};
