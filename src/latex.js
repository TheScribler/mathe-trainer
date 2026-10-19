// Bausteine, um Zahlen und Strukturen in die LaTeX-Notation der Folien und
// der Musterlösung zu bringen (z. B. "7.782{,}55" statt "7,782.55").

import { formatDeZahl, minimaleNachkommastellen, ggT } from './zahl.js';

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

// Kürzt einen Bruch (Vorzeichen wandert immer in den Zähler, Nenner bleibt
// positiv) — Grundlage für die Integralrechnung, wo Koeffizienten als exakte
// Brüche entstehen (z. B. a_k/(k+1)), nicht nur als Dezimalzahlen.
export function bruchGekuerzt(zaehler, nenner) {
  if (nenner < 0) { zaehler = -zaehler; nenner = -nenner; }
  const g = ggT(zaehler, nenner);
  return { zaehler: zaehler / g, nenner: nenner / g };
}

// Zeigt einen Bruch als exakten, gekürzten Bruch PLUS die Dezimalzahl, z. B.
// "\dfrac{2}{3} \approx 0{,}6667" — oder nur die ganze Zahl, wenn der Bruch
// sich zu einer ganzen Zahl kürzt (Nenner 1, kein Dezimal-Zusatz nötig, da
// identisch).
export function bruchMitDezimal(zaehler, nenner, nachkommastellen) {
  const { zaehler: z, nenner: n } = bruchGekuerzt(zaehler, nenner);
  if (n === 1) return zahlZuLatex(z, 0);
  const negativ = z < 0;
  const dezimalwert = z / n;
  const stellen = nachkommastellen ?? minimaleNachkommastellen(dezimalwert);
  const bruchText = `${negativ ? '-' : ''}${bruch(Math.abs(z), n)}`;
  return `${bruchText} \\approx ${zahlZuLatex(dezimalwert, stellen)}`;
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

// Baut eine KaTeX-`aligned`-Umgebung aus bereits fertigen Zeilen — jede Zeile
// bricht die Gleichung an der Stelle ihres eigenen "&"-Ankers um. Gemeinsame
// Grundlage für mehrzeiligeGleichung (Anker vor "=") und gleichungsKette
// (Anker vor "⇒"); wer eine andere Umbruchstelle braucht, baut die Zeilen
// selbst und übergibt sie hier direkt.
export function mehrzeiligeKette(zeilen) {
  return `\\begin{aligned} ${zeilen.join(' \\\\ ')} \\end{aligned}`;
}

// Mehrzeilige Gleichung statt einer langen Zeile mit mehreren "=" — bricht
// bei jedem "=" um, rechtsbündig am Gleichheitszeichen ausgerichtet. lhs ist
// die linke Seite (z. B. "G(x)"), rhsListe die aufeinanderfolgenden rechten
// Seiten (erste ist meist die Einsetzung, die letzte das vereinfachte
// Ergebnis — ein abschließendes "= 0" gehört an das Ende des letzten
// rhsListe-Eintrags, nicht als eigene Zeile danach angehängt).
export function mehrzeiligeGleichung(lhs, rhsListe) {
  const zeilen = [`${lhs} &= ${rhsListe[0]}`, ...rhsListe.slice(1).map((r) => `&= ${r}`)];
  return mehrzeiligeKette(zeilen);
}

// Lösungskette mit "⇒" zwischen den Schritten (z. B. "2y + 8 = 0 ⇒ 2y = −8
// ⇒ y = −4") — bricht bei jedem "⇒" um, analog zu mehrzeiligeGleichung bei
// "=". teile[0] ist die Ausgangsgleichung, jeder weitere Eintrag ein
// Umformungsschritt.
export function gleichungsKette(teile) {
  const zeilen = [`&${teile[0]}`, ...teile.slice(1).map((t) => `&\\Rightarrow ${t}`)];
  return mehrzeiligeKette(zeilen);
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
