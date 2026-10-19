// Bausteine, um Zahlen und Strukturen in die LaTeX-Notation der Folien und
// der Musterlösung zu bringen (z. B. "7.782{,}55" statt "7,782.55").

import { formatDeZahl, minimaleNachkommastellen } from './zahl.js';

export function zahlZuLatex(zahl, nachkommastellen = 2) {
  const negativ = zahl < 0;
  const abs = Math.abs(zahl);
  const text = formatDeZahl(abs, nachkommastellen);
  const mitGeschuetztemKomma = text.replace(',', '{,}');
  return (negativ ? '-' : '') + mitGeschuetztemKomma;
}

export function bruch(zaehler, nenner) {
  return `\\dfrac{${zaehler}}{${nenner}}`;
}

export function potenz(basis, exponent) {
  return `{${basis}}^{${exponent}}`;
}

export function matrixLatex(werte) {
  const zeilen = werte.map((zeile) => zeile.join(' & ')).join(' \\\\ ');
  return `\\begin{pmatrix} ${zeilen} \\end{pmatrix}`;
}

// Anteil (als Dezimalbruch, z. B. 0,02 für 2 %) in ein LaTeX-Prozent umwandeln.
export function prozentLatex(anteil, nachkommastellen = 2) {
  return zahlZuLatex(anteil * 100, nachkommastellen) + '\\%';
}

// Polynom aus Koeffizienten + zugehörigen Exponenten als LaTeX, z. B.
// polynomLatex([-2.4, 36, -120], [2, 1, 0]) -> "-2{,}4x^{2} + 36x - 120".
// Nullkoeffizienten werden übersprungen, Koeffizient 1/-1 vor einer Potenz
// (≠ x^0) wird nicht ausgeschrieben, Vorzeichen korrekt zwischen den Termen
// gesetzt statt als Minus-vor-Betrag in jedem Summanden.
export function polynomLatex(koeffizienten, exponenten) {
  let ergebnis = '';
  koeffizienten.forEach((k, i) => {
    if (k === 0) return;
    const exp = exponenten[i];
    const potenz = exp === 0 ? '' : exp === 1 ? 'x' : `x^{${exp}}`;
    const abs = Math.abs(k);
    const koeffText = (abs === 1 && potenz !== '') ? '' : zahlZuLatex(abs, minimaleNachkommastellen(abs));
    const term = koeffText + potenz;
    if (ergebnis === '') {
      ergebnis = (k < 0 ? '-' : '') + term;
    } else {
      ergebnis += (k < 0 ? ' - ' : ' + ') + term;
    }
  });
  return ergebnis || '0';
}
