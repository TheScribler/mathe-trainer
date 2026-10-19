// Zentrale Konfiguration: Punkte-Split, Dauer, Rundungs- und Toleranzregeln.
// Rundung/Toleranz gehört hierher, nicht in einzelne Generatoren
// (siehe CLAUDE.md Abschnitt 6).

export const KONFIG = {
  dauer: 60 * 60,
  punkte: { finanz: 12, diff: 24, integral: 12, algebra: 12 },
  presets: {
    standard: { finanz: 12, diff: 24, integral: 12, algebra: 12 },
    original: { finanz: 12, diff: 36, integral: 0, algebra: 12 },
  },
  zusatzthemenInKlausur: false,
  toleranz: {
    geld: 0.05,
    prozentpunkte: 0.01,
    jahre: 0.01,
    exakt: 1e-9,
  },
  nachkommastellen: {
    geld: 2,
    jahre: 2,
    // Zinssatz-ERGEBNISSE (finale Antworten, die ein Zinssatz sind) werden
    // als Dezimalzahl auf 4 Nachkommastellen angegeben — Vorlesungsregel,
    // siehe CLAUDE.md Abschnitt 6 ("Rundungsregel für Zinssätze"). Das ist
    // zahlenmäßig dasselbe wie 2 Nachkommastellen in Prozent (0,0304 = 3,04 %),
    // weil Prozent = Dezimalzahl × 100 den Dezimalpunkt um genau 2 Stellen
    // verschiebt. Gilt NICHT für gegebene Werte in einer Aufgabenstellung,
    // nur für das, was als Ergebnis hingeschrieben wird.
    zinssatzDezimal: 4,
  },
};
