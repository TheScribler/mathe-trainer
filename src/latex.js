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

// Ob zaehler/nenner als Dezimalbruch abbricht (endlich viele Nachkomma-
// stellen hat) — das ist genau dann der Fall, wenn der gekürzte Nenner außer
// den Primfaktoren 2 und 5 nichts weiter enthält (z. B. 6/5=1,2 bricht ab,
// 2/3=0,6666… nicht).
export function istAbbrechenderDezimalbruch(nenner) {
  let n = Math.abs(nenner);
  while (n % 2 === 0) n /= 2;
  while (n % 5 === 0) n /= 5;
  return n === 1;
}

// Zeigt einen Bruch als exakten, gekürzten Bruch PLUS seine Dezimaldarstellung
// — "=" mit dem exakten Wert, wenn der Bruch als Dezimalzahl abbricht (z. B.
// "\dfrac{6}{5} = 1{,}2"), sonst "≈" mit einer echten Rundung auf
// nachkommastellenApprox Stellen (Standard: 2, die normale Rundungsregel —
// siehe CLAUDE.md Abschnitt 6, die 4-Stellen-Regel gilt nur für Zinssätze).
// Nenner 1 heißt schon eine ganze Zahl, kein Bruch-Zusatz nötig.
export function bruchMitDezimal(zaehler, nenner, nachkommastellenApprox = 2) {
  const { zaehler: z, nenner: n } = bruchGekuerzt(zaehler, nenner);
  if (n === 1) return zahlZuLatex(z, 0);
  const negativ = z < 0;
  const dezimalwert = z / n;
  const bruchText = `${negativ ? '-' : ''}${bruch(Math.abs(z), n)}`;
  if (istAbbrechenderDezimalbruch(n)) {
    return `${bruchText} = ${zahlZuLatex(dezimalwert, minimaleNachkommastellen(dezimalwert))}`;
  }
  return `${bruchText} \\approx ${zahlZuLatex(dezimalwert, nachkommastellenApprox)}`;
}

// Auswertungsklammer für ein bestimmtes Integral: "[ausdruck]_{untere}^{obere}"
// (deutsche Schreibweise mit eckigen Klammern statt des Strichs auf den
// Folien — Folie 155 nutzt "F(x)|_a^b", auf dem Papier wird üblicher die
// eckige Klammer verwendet).
export function auswertungsklammer(ausdruck, untereGrenze, obereGrenze) {
  return `\\big[${ausdruck}\\big]_{${untereGrenze}}^{${obereGrenze}}`;
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

// Für eine mehrzeilige Gleichung aus polynomEingesetztLatex (eingesetzt,
// werte, Ergebnis): lässt die "werte"-Zeile weg, wenn sie textuell identisch
// mit "eingesetzt" ist — das passiert, wenn jeder einzelne Summand schon ohne
// Multiplikation dasteht (Koeffizient 1/−1 vor der Variable, oder ein reiner
// Konstantenterm), das "Ausrechnen" liefert dann wortgleich denselben Text
// noch einmal (iPhone-Rückmeldung: "p(x*) = a − x* = a − x* = Ergebnis" bei
// b=1 in diff.gewinn-breakeven zeigte "= 80 − 11" zweimal in Folge).
export function ohneDuplikatZeile(eingesetzt, werte, ergebnisLatex) {
  return eingesetzt === werte ? [eingesetzt, ergebnisLatex] : [eingesetzt, werte, ergebnisLatex];
}

// Lösungskette mit "⇒" zwischen den Schritten (z. B. "2y + 8 = 0 ⇒ 2y = −8
// ⇒ y = −4") — bricht bei jedem "⇒" um, analog zu mehrzeiligeGleichung bei
// "=". teile[0] ist die Ausgangsgleichung, jeder weitere Eintrag ein
// Umformungsschritt.
export function gleichungsKette(teile) {
  const zeilen = [`&${teile[0]}`, ...teile.slice(1).map((t) => `&\\Rightarrow ${t}`)];
  return mehrzeiligeKette(zeilen);
}

// Wertet ein Polynom an der Stelle x aus und zeigt dabei JEDEN Rechenschritt:
// erst die Formel mit x als Zahl eingesetzt (z. B. "3{,}5 \cdot 10^{2} + 3
// \cdot 10 + 290"), dann die einzeln berechneten Werte der Summanden
// ("350 + 30 + 290") — Grundlage für "jeder Rechenschritt wird gezeigt"
// (iPhone-Rückmeldung: ein Sprung von K(x) direkt auf den Endwert ließ die
// Zwischenschritte fehlen). Koeffizient 1/-1 wird vor einer x-Potenz wie bei
// polynomLatex weggelassen (dieselbe Konvention, nicht nur vor einer
// Variable). Ein negatives x wird geklammert eingesetzt — sonst würde
// "x^2" bei x=-1 zu "-1^{2}" (mathematisch -1, nicht (-1)²=1) statt zum
// korrekten "(-1)^{2}".
export function polynomEingesetztLatex(koeffizienten, exponenten, x) {
  const xKlar = x < 0 ? `(${zahlZuLatex(x, minimaleNachkommastellen(x))})` : zahlZuLatex(x, minimaleNachkommastellen(x));
  let eingesetzt = '';
  let werte = '';
  let summe = 0;
  koeffizienten.forEach((k, i) => {
    if (k === 0) return;
    const exp = exponenten[i];
    const wert = k * Math.pow(x, exp);
    summe += wert;
    const basis = exp === 0 ? null : exp === 1 ? xKlar : potenz(xKlar, exp);
    const abs = Math.abs(k);
    const koeffText = (abs === 1 && basis) ? '' : zahlZuLatex(abs, minimaleNachkommastellen(abs));
    const term = koeffText === '' ? basis : (basis ? `${koeffText} \\cdot ${basis}` : koeffText);
    eingesetzt = eingesetzt === '' ? (k < 0 ? '-' : '') + term : eingesetzt + (k < 0 ? ' - ' : ' + ') + term;
    const wertAbsText = zahlZuLatex(Math.abs(wert), minimaleNachkommastellen(wert));
    werte = werte === '' ? (wert < 0 ? '-' : '') + wertAbsText : werte + (wert < 0 ? ' - ' : ' + ') + wertAbsText;
  });
  return { eingesetzt: eingesetzt || '0', werte: werte || '0', summe };
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
