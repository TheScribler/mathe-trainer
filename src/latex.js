// Bausteine, um Zahlen und Strukturen in die LaTeX-Notation der Folien und
// der Musterlösung zu bringen (z. B. "7.782{,}55" statt "7,782.55").

import { formatDeZahl } from './zahl.js';

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
