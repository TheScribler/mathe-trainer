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
    prozent: 2,
    jahre: 2,
  },
};
