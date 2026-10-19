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

// Bewertet eine Koeffizientenzeile Box für Box statt als Ganzes — sonst würde
// z. B. bei E(x) = −2x² + 43x (Konstante 0, vom Nutzer nachvollziehbar leer
// gelassen statt "0" einzutippen) die ganze Zeile als unbeantwortet gelten,
// obwohl zwei von drei Boxen richtig ausgefüllt sind. Nur eine KOMPLETT leere
// Zeile gilt als leer; sobald mindestens eine Box gefüllt ist, zählt jede
// leere Box darin als eingegebene 0 (richtig, wenn die Lösung dort 0 ist).
// werteTexte: Rohtext je Box (wie im Eingabefeld), erwarteteFelder: Lösung
// je Box, in derselben Reihenfolge.
export function bewerteKoeffizientenZeile(werteTexte, erwarteteFelder, toleranz = 1e-9) {
  const alleLeer = werteTexte.every((w) => w.trim() === '');
  if (alleLeer) {
    return { leer: werteTexte.length, proBox: werteTexte.map(() => ({ bewertet: false, korrekt: false })) };
  }
  const proBox = werteTexte.map((text, i) => {
    const gefuellterText = text.trim() === '' ? '0' : text;
    const ergebnis = pruefeZahl(gefuellterText, erwarteteFelder[i], toleranz);
    return { bewertet: true, korrekt: ergebnis.korrekt };
  });
  return { leer: 0, proBox };
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
