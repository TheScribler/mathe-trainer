// Antworttypen und Punktevergabe. Toleranzen kommen aus KONFIG (konfig.js),
// nicht aus den Generatoren (siehe CLAUDE.md Abschnitt 6).

import { parseDeZahl, nahBei } from './zahl.js';

export function pruefeZahl(eingabeText, erwartet, toleranz = 1e-9) {
  const wert = parseDeZahl(eingabeText);
  if (!isFinite(wert)) return { korrekt: false, wert: NaN };
  return { korrekt: nahBei(wert, erwartet, toleranz), wert };
}

function geparst(wert) {
  return typeof wert === 'number' ? wert : parseDeZahl(wert);
}

export function pruefeKoeffizienten(eingabeFelder, erwarteteFelder, toleranz = 1e-9) {
  if (eingabeFelder.length !== erwarteteFelder.length) return { korrekt: false };
  for (let i = 0; i < eingabeFelder.length; i++) {
    const wert = geparst(eingabeFelder[i]);
    if (!isFinite(wert) || !nahBei(wert, erwarteteFelder[i], toleranz)) return { korrekt: false };
  }
  return { korrekt: true };
}

export function pruefeMatrix(eingabeMatrix, erwarteteMatrix, toleranz = 1e-9) {
  if (eingabeMatrix.length !== erwarteteMatrix.length) return { korrekt: false };
  for (let i = 0; i < eingabeMatrix.length; i++) {
    const zeileEin = eingabeMatrix[i];
    const zeileErw = erwarteteMatrix[i];
    if (zeileEin.length !== zeileErw.length) return { korrekt: false };
    for (let j = 0; j < zeileEin.length; j++) {
      const wert = geparst(zeileEin[j]);
      if (!isFinite(wert) || !nahBei(wert, zeileErw[j], toleranz)) return { korrekt: false };
    }
  }
  return { korrekt: true };
}

export function pruefeAuswahl(eingabe, erwartet) {
  return { korrekt: eingabe === erwartet };
}

// 'term': keine automatische Prüfung — Selbstbewertung nach Lösung aufdecken.
export function punkteFuerSelbstbewertung(stufe, maxPunkte) {
  if (stufe === 'richtig') return maxPunkte;
  if (stufe === 'halb') return maxPunkte / 2;
  return 0;
}
