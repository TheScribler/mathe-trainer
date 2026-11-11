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

// Zinssatz-Ergebnis: die Vorlesung schreibt Zinssätze als Dezimalzahl mit 4
// Nachkommastellen (0,1236 = 12,36 %), das Eingabefeld erwartet die
// Prozentzahl. Beide Schreibweisen gelten als richtig — die Dezimalform wird
// dafür mit 100 multipliziert und mit derselben Prozentpunkt-Toleranz
// verglichen. Alle Zinssatz-Ergebnisse im Trainer liegen bei mindestens 1 %,
// eine Verwechslung der beiden Lesarten ist dadurch ausgeschlossen.
export function pruefeZinssatz(eingabeText, erwartetProzent, toleranzProzentpunkte) {
  const wert = parseDeZahl(eingabeText);
  if (!isFinite(wert)) return { korrekt: false, wert: NaN };
  const korrekt = nahBei(wert, erwartetProzent, toleranzProzentpunkte) ||
    nahBei(wert * 100, erwartetProzent, toleranzProzentpunkte);
  return { korrekt, wert };
}

// Eine 'zahl'-Eingabe gegen ihre Lösung prüfen — mit der Sonderregel für
// Zinssätze (eingabe.zinssatz, siehe pruefeZinssatz).
export function pruefeZahlEingabe(eingabe, eingabeText) {
  if (eingabe.zinssatz) return pruefeZinssatz(eingabeText, eingabe.loesung, eingabe.toleranz);
  return pruefeZahl(eingabeText, eingabe.loesung, eingabe.toleranz);
}

// Aufgaben mit zwei gleichwertigen Ergebnisgruppen (z. B. zwei stationäre
// Punkte, aufgabe.vertauschbar = [[ids Punkt 1], [ids Punkt 2]]): die
// Reihenfolge, in der die Punkte eingetragen werden, ist beliebig. Liefert
// die Eingaben so, wie sie bewertet werden sollen — unverändert oder mit den
// Lösungen der beiden Gruppen vertauscht, je nachdem, welche Zuordnung mehr
// ausgefüllte Felder trifft. werte: Rohtext je Eingabe-ID ('zahl'/'auswahl').
export function eingabenMitZuordnung(aufgabe, werte) {
  if (!aufgabe.vertauschbar) return aufgabe.eingaben;
  const [gruppe1, gruppe2] = aufgabe.vertauschbar;
  const nachId = Object.fromEntries(aufgabe.eingaben.map((e) => [e.id, e]));
  const trifft = (eingabe, wert) => {
    if (wert === undefined || wert === null || String(wert).trim() === '') return 0;
    if (eingabe.typ === 'auswahl') return wert === eingabe.loesung ? 1 : 0;
    return pruefeZahlEingabe(eingabe, wert).korrekt ? 1 : 0;
  };
  let gerade = 0;
  let getauscht = 0;
  const tausch = {};
  gruppe1.forEach((id1, k) => {
    const id2 = gruppe2[k];
    gerade += trifft(nachId[id1], werte[id1]) + trifft(nachId[id2], werte[id2]);
    getauscht += trifft(nachId[id2], werte[id1]) + trifft(nachId[id1], werte[id2]);
    tausch[id1] = id2;
    tausch[id2] = id1;
  });
  if (getauscht <= gerade) return aufgabe.eingaben;
  return aufgabe.eingaben.map((e) => (tausch[e.id]
    ? { ...e, loesung: nachId[tausch[e.id]].loesung, toleranz: nachId[tausch[e.id]].toleranz }
    : e));
}

// Matrix-Eingabe, bei der "leer lassen" die richtige Antwort ist (z. B. die
// Inverse einer singulären Matrix): richtig genau dann, wenn keine Zelle
// ausgefüllt ist. So verrät das Formular nicht schon vorab, ob eine Inverse
// existiert.
export function bewerteLeerErwartet(werteZeilen) {
  return { korrekt: werteZeilen.every((zeile) => zeile.every((text) => text.trim() === '')) };
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

// Bewertet eine Matrix Zelle für Zelle statt als Ganzes — dieselbe Regel wie
// bewerteKoeffizientenZeile (siehe dort), auf zwei Dimensionen erweitert: nur
// eine KOMPLETT leere Matrix gilt als leer; sobald mindestens eine Zelle
// gefüllt ist, zählt jede leere Zelle darin als eingegebene 0.
// Anders als bei Koeffizientenzeilen zählt hier JEDE leere Zelle für sich als
// leer (nicht als eingegebene 0) — ein Matrixeintrag hat keinen impliziten
// "Nullterm, den man weglässt" wie ein Polynom-Summand ohne Konstante; eine
// leere Zelle bei einer Lösung von 0 soll also nicht automatisch grün werden.
// alternativen: weitere, ebenso richtige Lösungsmatrizen (z. B. der
// Tilgungsplan einmal zeilenweise auf Cent gerundet, einmal ungerundet wie
// in der Vorlesung) — eine Zelle ist richtig, wenn sie zu einer davon passt.
export function bewerteMatrix(werteZeilen, erwarteteZeilen, toleranz = 1e-9, alternativen = []) {
  let leer = 0;
  const loesungen = [erwarteteZeilen, ...alternativen];
  const proZelle = werteZeilen.map((zeile, i) => zeile.map((text, j) => {
    if (text.trim() === '') {
      leer += 1;
      return { bewertet: false, korrekt: false };
    }
    const korrekt = loesungen.some((l) => pruefeZahl(text, l[i][j], toleranz).korrekt);
    return { bewertet: true, korrekt };
  }));
  return { leer, proZelle };
}

export function pruefeAuswahl(eingabe, erwartet) {
  return { korrekt: eingabe === erwartet };
}

// Teilpunkte (z. B. bei koeffizienten/matrix: Anteil richtiger Boxen/Zellen
// mal die Punktzahl der Teilaufgabe) werden auf das nächste halbe Raster
// ABgerundet, nie aufgerundet und nie als krummer Dezimalbruch angezeigt —
// eine echte Klausurkorrektur vergibt nur ganze oder halbe Punkte. Beispiel
// (iPhone-Rückmeldung): 1 von 9 Matrixeinträgen bei 2 Punkten ergibt
// 1/9·2 ≈ 0,22, abgerundet 0 P; 5 von 9 ergibt 5/9·2 ≈ 1,11, abgerundet 1 P.
export function rundePunkteAbwaerts(punkte) {
  return Math.floor(punkte * 2) / 2;
}

// 'term': keine automatische Prüfung — Selbstbewertung nach Lösung aufdecken.
export function punkteFuerSelbstbewertung(stufe, maxPunkte) {
  if (stufe === 'richtig') return maxPunkte;
  if (stufe === 'halb') return maxPunkte / 2;
  return 0;
}
