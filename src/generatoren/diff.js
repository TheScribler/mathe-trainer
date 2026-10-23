// Differentialrechnung — 5 Generatoren, 24 Punkte im Standard-Split (36 im
// Musterklausur-Original). Jeder Generator konstruiert rückwärts: erst die
// saubere Lösung, dann die Parameter (siehe PLAN.md, Katalog
// "2 Differentialrechnung").

import { zufallInt, zufallAus } from '../rng.js';
import { runde, formatDeZahl, minimaleNachkommastellen } from '../zahl.js';
import { zahlZuLatex, bruch, bruchGekuerzt, polynomLatex, polynomEingesetztLatex, mehrzeiligeGleichung, mehrzeiligeKette, gleichungsKette } from '../latex.js';
import { KONFIG } from '../konfig.js';

// Term mit Vorzeichen, Koeffizient 1/-1 wird nicht ausgeschrieben (gleiche
// Regel wie in polynomLatex, latex.js) — gemeinsam genutzt von mehreren
// Generatoren für Terme, die polynomLatex selbst nicht abdeckt (gemischte
// Terme wie "xy", "y²"). minus ist "−" (Unicode) für reinen Fließtext,
// explizit "-" (ASCII) für LaTeX-Felder übergeben.
function termMitVorzeichen(koeff, einheit, formatFn, minus = '−') {
  const abs = Math.abs(koeff);
  // Koeffizient 1 wird nur vor einer Variable weggelassen ("x" statt "1x") —
  // bei einem reinen Zahlenterm (einheit === '', z. B. die Konstante eines
  // Polynoms) wäre "" statt "1" keine Vereinfachung, sondern ein verschwun-
  // dener Term: nur noch das nackte Vorzeichen bliebe übrig ("- " statt "-1").
  const zahl = (abs === 1 && einheit !== '') ? '' : formatFn(abs, minimaleNachkommastellen(abs));
  return `${koeff < 0 ? minus : '+'} ${zahl}${einheit}`;
}

// Baut einen mehrteiligen Ausdruck aus [Koeffizient, Einheit]-Paaren:
// Nullkoeffizienten werden übersprungen, führendes "+" entfällt. paare[].0
// kann auch '' als Einheit haben (reine Konstante).
// "koeffizient \cdot ausdruck", aber ohne den Faktor auszuschreiben, wenn
// |koeffizient| = 1 ist (z. B. "x0" statt "1 \cdot x0"). koeffizient hier
// ist bereits mit Vorzeichen — der Aufrufer setzt das Vorzeichen davor selbst.
function cdotWennNicht1(koeffizient, ausdruck) {
  const betrag = Math.abs(koeffizient);
  return betrag === 1 ? ausdruck : `${zahlZuLatex(betrag, minimaleNachkommastellen(betrag))} \\cdot ${ausdruck}`;
}

// "koeffizient" direkt vor einer Variable (z. B. "2x_1"), ohne den Faktor zu
// zeigen, wenn er genau 1 ist ("x_1" statt "1x_1"). Nur für positive, schon
// vorzeichenlose Koeffizienten (P1, P2, γ sind hier immer positiv).
function koeffVariable(koeff, variable) {
  return koeff === 1 ? variable : `${zahlZuLatex(koeff, minimaleNachkommastellen(koeff))}${variable}`;
}

// "-\dfrac{zaehler}{nenner}", aber ohne doppeltes Minuszeichen, wenn zaehler
// selbst negativ ist — sonst kürzen sich die beiden Minus zu einem optisch
// verwirrenden "−(−…)" statt als vereinfachter positiver Bruch zu erscheinen.
// variable: optional, wenn minusBruch direkt einen Koeffizienten vor einer
// Variable darstellt (z. B. "y = -\dfrac{a}{2c}x") — dann gilt für das
// gekürzte Ergebnis dieselbe Koeffizient-1-Weglassregel wie überall sonst
// ("x" statt "1x"). Ohne variable bleibt der nackte Bruchwert stehen (z. B.
// die p-q-Formel, wo "-\dfrac{p}{2}" für sich steht).
function minusBruch(zaehler, nenner, variable = '') {
  // nenner kommt teils als Zahl, teils als Text eines reinen Zahlenwerts
  // (zweiMalKoeffizient gibt bei |c|=1 die Zeichenkette "2"/"-2" zurück,
  // nicht die Zahl) — Number(...) liest beides gleich; nur ein wirklich
  // symbolischer Nenner wie "2 \cdot (-2)" (eine noch nicht ausgewertete
  // Einsetzung) bleibt NaN und damit unkürzbar.
  const nennerZahl = Number(nenner);
  if (!Number.isFinite(nennerZahl)) {
    const negativ = zaehler < 0;
    return `${negativ ? '' : '-'}\\dfrac{${zahlZuLatex(Math.abs(zaehler), minimaleNachkommastellen(Math.abs(zaehler)))}}{${nenner}}${variable}`;
  }
  // Zähler/Nenner zuerst kürzen (sonst z. B. "-\dfrac{6}{2}" statt "-3"),
  // erst danach das führende Minus mit dem Vorzeichen des gekürzten Zählers
  // zusammenführen (negativ/negativ kürzt sich zu einem positiven Ergebnis).
  const { zaehler: z, nenner: n } = bruchGekuerzt(zaehler, nennerZahl);
  const wert = -z;
  if (n === 1) {
    if (variable && Math.abs(wert) === 1) return `${wert < 0 ? '-' : ''}${variable}`;
    return `${zahlZuLatex(wert, 0)}${variable}`;
  }
  const negativ = z < 0;
  return `${negativ ? '' : '-'}\\dfrac{${zahlZuLatex(Math.abs(z), 0)}}{${n}}${variable}`;
}

// Bruch kürzen und anzeigen — ganze Zahl, wenn er sich dazu kürzt, sonst
// Vorzeichen außerhalb des Bruchs (wie minusBruch/bruchOderZahl in
// integral.js, hier aber ohne die zusätzliche Negation).
function bruchAnzeige(zaehler, nenner) {
  const { zaehler: z, nenner: n } = bruchGekuerzt(zaehler, nenner);
  if (n === 1) return zahlZuLatex(z, 0);
  const negativ = z < 0;
  return `${negativ ? '-' : ''}${bruch(Math.abs(z), n)}`;
}

// "2 \cdot (c)" als Nenner, vereinfacht wenn |c| = 1 ("2" bzw. "-2" statt
// "2 \cdot (1)" bzw. "2 \cdot (-1)").
function zweiMalKoeffizient(c) {
  if (c === 1) return '2';
  if (c === -1) return '-2';
  return `2 \\cdot (${zahlZuLatex(c, 0)})`;
}

// Klammert eine Zahl ein, wenn sie negativ ist — nötig, sobald sie direkt
// hinter einem eigenen Vorzeichen/Operator eingesetzt wird (sonst entstehen
// zwei Vorzeichen direkt hintereinander, z. B. "+ -3" statt "+ (-3)").
function klammerWennNegativ(zahl, nachkommastellen = 0) {
  const text = zahlZuLatex(zahl, nachkommastellen);
  return zahl < 0 ? `(${text})` : text;
}

// Punktepaar "(x \mid y)" statt eines rohen "|" als Trenner — ein bloßes "|"
// lässt KaTeX ein direkt folgendes Minus manchmal mit Operator- statt
// Vorzeichen-Abstand setzen ("(2|-2)" sah aus wie eine Subtraktion statt ein
// unäres Vorzeichen, iPhone-Rückmeldung). "\mid" ist die korrekte Relation
// dafür und sorgt für das richtige Spacing um ein folgendes unäres Minus.
function punktPaarLatex(x, y) {
  return `(${zahlZuLatex(x, 0)} \\mid ${zahlZuLatex(y, 0)})`;
}

function bauePolynomAusdruck(paare, formatFn, minus) {
  const nichtNull = paare.filter(([k]) => k !== 0);
  if (nichtNull.length === 0) return formatFn(0, 0);
  let erster = termMitVorzeichen(nichtNull[0][0], nichtNull[0][1], formatFn, minus).replace(/^\+ /, '');
  // Ein führendes Minus ist ein unäres Vorzeichen ("−3x²"), kein Operator
  // zwischen zwei Termen — ohne diese Korrektur blieb hier das Leerzeichen
  // von termMitVorzeichen stehen ("− 3x²", iPhone-Rückmeldung).
  if (erster.startsWith(minus + ' ')) erster = minus + erster.slice(minus.length + 1);
  const rest = nichtNull.slice(1).map(([k, einheit]) => termMitVorzeichen(k, einheit, formatFn, minus));
  return [erster, ...rest].join(' ');
}

// ---------------------------------------------------------------------------
// diff.gewinn-breakeven — MK 3 / Übung 13
// p(x) = a - bx, K(x) = cx² + dx + e
// E(x) = p(x)x = ax - bx²
// G(x) = E(x) - K(x) = -(b+c)x² + (a-d)x - e =: -A x² + A(x1+x2) x - A x1 x2
// ---------------------------------------------------------------------------
// Koeffizient vor einer Variable in reinem Fließtext, Koeffizient 1 wird
// weggelassen ("x" statt "1x"); b, c sind hier immer positiv (b∈{1,2,3},
// c>0), kein Vorzeichen-Handling nötig.
function proseKoeffVariable(koeff, variable) {
  return koeff === 1 ? variable : `${formatDeZahl(koeff, minimaleNachkommastellen(koeff))}${variable}`;
}

const VORLAGEN_GEWINN = [
  (a, b, c, d, e) => `Gegeben sei die Preisabsatzfunktion p(x) = ${formatDeZahl(a, 0)} − ${proseKoeffVariable(b, 'x')} ` +
    `sowie die Kostenfunktion K(x) = ${proseKoeffVariable(c, 'x²')} ${d < 0 ? '−' : '+'} ${proseKoeffVariable(Math.abs(d), 'x')} ` +
    `${e < 0 ? '−' : '+'} ${formatDeZahl(Math.abs(e), 0)}.`,
  (a, b, c, d, e) => `Eine Preisabsatzfunktion lautet p(x) = ${formatDeZahl(a, 0)} − ${proseKoeffVariable(b, 'x')}, ` +
    `die zugehörige Kostenfunktion K(x) = ${proseKoeffVariable(c, 'x²')} ${d < 0 ? '−' : '+'} ${proseKoeffVariable(Math.abs(d), 'x')} ` +
    `${e < 0 ? '−' : '+'} ${formatDeZahl(Math.abs(e), 0)}.`,
];

export const gewinnBreakeven = {
  id: 'diff.gewinn-breakeven',
  teil: 'diff',
  name: 'Erlös, Gewinn, Grenzkosten, Gewinnschwelle, Gewinnmaximum',
  punkte: 12,
  vorlage: 'Musterklausur 3 / Übung 13',
  waehleParameter(rng) {
    const x1 = zufallInt(rng, 1, 8);
    const gap = zufallInt(rng, 2, 10);
    const x2 = x1 + gap;
    const b = zufallAus(rng, [1, 2, 3]);
    const c = zufallAus(rng, [0.2, 0.4, 0.5, 1, 1.5, 2]);
    const a = b * x2 + zufallInt(rng, 5, 30);
    const x0 = zufallInt(rng, x1, 3 * x2);
    const vorlageIndex = zufallInt(rng, 0, VORLAGEN_GEWINN.length - 1);
    return { x1, x2, b, c, a, x0, vorlageIndex };
  },
  baue(params) {
    const { x1, x2, b, c, a, x0, vorlageIndex } = params;
    const A = runde(b + c, 4);
    const d = runde(a - A * (x1 + x2), 4);
    const e = runde(A * x1 * x2, 4);

    const xMax = (x1 + x2) / 2;
    const pMax = runde(a - b * xMax, 2);
    const gMax = runde(-A * xMax * xMax + A * (x1 + x2) * xMax - e, 2);
    const grenzkosten = runde(2 * c * x0 + d, 2);

    // E(x) = ax - bx²  (Koeffizienten absteigend: x², x, x⁰)
    const eKoeff = [-b, a, 0];
    // G(x) = -A x² + A(x1+x2) x - e
    const gKoeff = [-A, A * (x1 + x2), -e];

    return {
      frage: {
        text: VORLAGEN_GEWINN[vorlageIndex](a, b, c, d, e) +
          ` a) Bestimmen Sie die Erlös- und Gewinnfunktion (soweit wie möglich vereinfacht). ` +
          `b) Wie lauten die Grenzkosten für x = ${x0}? ` +
          `c) Bestimmen Sie die Gewinnschwelle (Break-Even) und die Gewinngrenze (beide Nullstellen des Gewinns). ` +
          `d) Bestimmen Sie die gewinnmaximale Menge, den gewinnmaximalen Preis und den maximalen Gewinn.`,
      },
      eingaben: [
        { id: 'E', label: 'Erlösfunktion E(x)', typ: 'koeffizienten', punkte: 1, exponenten: [2, 1, 0], loesung: eKoeff, toleranz: KONFIG.toleranz.exakt },
        { id: 'G', label: 'Gewinnfunktion G(x)', typ: 'koeffizienten', punkte: 1, exponenten: [2, 1, 0], loesung: gKoeff, toleranz: KONFIG.toleranz.exakt },
        { id: 'Kstrich', label: `Grenzkosten K'(${x0})`, typ: 'zahl', punkte: 2, loesung: grenzkosten, toleranz: KONFIG.toleranz.geld },
        { id: 'x1', label: 'Gewinnschwelle (Break-Even) x₁', typ: 'zahl', punkte: 2, loesung: x1, toleranz: KONFIG.toleranz.exakt },
        { id: 'x2', label: 'Gewinngrenze x₂', typ: 'zahl', punkte: 2, loesung: x2, toleranz: KONFIG.toleranz.exakt },
        { id: 'xmax', label: 'Gewinnmaximale Menge x', typ: 'zahl', punkte: 2, loesung: xMax, toleranz: KONFIG.toleranz.jahre },
        { id: 'pmax', label: 'Gewinnmaximaler Preis p(x)', typ: 'zahl', punkte: 1, loesung: pMax, toleranz: KONFIG.toleranz.geld },
        { id: 'gmax', label: 'Maximaler Gewinn G(x)', typ: 'zahl', punkte: 1, loesung: gMax, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `E(x) = p(x) \\cdot x`,
            hinweis: 'Erlös ist Preis mal Menge.',
          },
          {
            titel: 'Einsetzen',
            latex: `E(x) = (${polynomLatex([a, -b], [0, 1])}) \\cdot x = ${polynomLatex(eKoeff, [2, 1, 0])}`,
          },
          {
            titel: 'Formel',
            latex: `G(x) = E(x) - K(x)`,
            hinweis: 'Gewinn ist Erlös minus Kosten — Klammer setzen, weil alle Kosten abgezogen werden, dann Vorzeichen beim Auflösen umdrehen.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('G(x)', [
              `${polynomLatex(eKoeff, [2, 1, 0])} - \\left(${polynomLatex([c, d, e], [2, 1, 0])}\\right)`,
              polynomLatex(gKoeff, [2, 1, 0]),
            ]),
          },
          {
            titel: 'Formel',
            latex: `${bruch('dK', 'dx')} = K'(x)`,
            hinweis: 'Grenzkosten sind die erste Ableitung der Kostenfunktion.',
          },
          {
            titel: 'Einsetzen',
            latex: gleichungsKette([
              `K'(x) = ${polynomLatex([2 * c, d], [1, 0])}`,
              `K'(${x0}) = ${cdotWennNicht1(2 * c, String(x0))} ${d < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(d), minimaleNachkommastellen(Math.abs(d)))}`,
            ]),
          },
          { titel: 'Ergebnis', latex: `K'(${x0}) = ${zahlZuLatex(grenzkosten, minimaleNachkommastellen(grenzkosten))}` },
          {
            titel: 'Umstellen',
            latex: mehrzeiligeKette([
              `${polynomLatex(gKoeff, [2, 1, 0])} &= 0 \\quad \\Big/ \\div (${zahlZuLatex(-A, minimaleNachkommastellen(A))})`,
              `\\Rightarrow\\; ${polynomLatex([1, -(x1 + x2), x1 * x2], [2, 1, 0])} &= 0`,
            ]),
            hinweis: 'Durch den Koeffizienten von x² teilen, damit vor x² eine 1 steht.',
          },
          {
            titel: 'Ergebnis',
            latex: `p = ${zahlZuLatex(-(x1 + x2), 0)}, \\quad q = ${zahlZuLatex(x1 * x2, 0)}`,
            hinweis: 'Koeffizienten der normierten Gleichung x² + px + q = 0 ablesen.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('x_{1,2}', [
              `-\\dfrac{p}{2} \\pm \\sqrt{\\left(\\dfrac{p}{2}\\right)^2 - q}`,
              `${minusBruch(-(x1 + x2), 2)} \\pm \\sqrt{\\left(${bruchAnzeige(-(x1 + x2), 2)}\\right)^2 - ${zahlZuLatex(x1 * x2, 0)}}`,
              `${zahlZuLatex((x1 + x2) / 2, minimaleNachkommastellen((x1 + x2) / 2))} \\pm \\sqrt{${zahlZuLatex(Math.pow((x1 + x2) / 2, 2), minimaleNachkommastellen(Math.pow((x1 + x2) / 2, 2)))} - ${zahlZuLatex(x1 * x2, 0)}}`,
              `${zahlZuLatex((x1 + x2) / 2, minimaleNachkommastellen((x1 + x2) / 2))} \\pm ${zahlZuLatex((x2 - x1) / 2, minimaleNachkommastellen((x2 - x1) / 2))}`,
            ]),
            hinweis: 'p-q-Formel.',
          },
          { titel: 'Ergebnis', latex: `x_1 = ${x1}\\ \\text{(Break-Even)}, \\quad x_2 = ${x2}\\ \\text{(Gewinngrenze)}` },
          {
            titel: 'Umstellen',
            latex: `G'(x) = 0`,
            hinweis: 'Notwendige Bedingung für ein Maximum: erste Ableitung null setzen.',
          },
          {
            titel: 'Einsetzen',
            latex: `G'(x) = ${polynomLatex([2 * gKoeff[0], gKoeff[1]], [1, 0])} = 0 \\;\\Rightarrow\\; x = ${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))}`,
            hinweis: `Hinreichende Bedingung: G''(x) = ${formatDeZahl(2 * gKoeff[0], minimaleNachkommastellen(2 * gKoeff[0]))} < 0, also Maximum.`,
          },
          { titel: 'Einsetzen', latex: `p(${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))}) = ${polynomLatex([a, -b], [0, 1])}\\big|_{x=${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))}} = ${zahlZuLatex(pMax, minimaleNachkommastellen(pMax))}` },
          { titel: 'Einsetzen', latex: `G(${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))}) = ${polynomLatex(gKoeff, [2, 1, 0])}\\big|_{x=${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))}} = ${zahlZuLatex(gMax, minimaleNachkommastellen(gMax))}` },
          {
            titel: 'Ergebnis',
            latex: `x_{max} = ${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))}, \\quad p_{max} = ${zahlZuLatex(pMax, minimaleNachkommastellen(pMax))}, \\quad G_{max} = ${zahlZuLatex(gMax, minimaleNachkommastellen(gMax))}`,
          },
        ],
        ergebnisse: [
          { label: 'Erlösfunktion', latex: `E(x) = ${polynomLatex(eKoeff, [2, 1, 0])}` },
          { label: 'Gewinnfunktion', latex: `G(x) = ${polynomLatex(gKoeff, [2, 1, 0])}` },
          { label: `Grenzkosten K'(${x0})`, latex: zahlZuLatex(grenzkosten, minimaleNachkommastellen(grenzkosten)) },
          { label: 'Break-Even / Gewinngrenze', latex: `x_1=${x1},\\ x_2=${x2}` },
          { label: 'Gewinnmaximum', latex: `x=${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))},\\ p=${zahlZuLatex(pMax, minimaleNachkommastellen(pMax))},\\ G=${zahlZuLatex(gMax, minimaleNachkommastellen(gMax))}` },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// diff.extremwerte-2var — MK 4 (kubische Form)
// f(x,y) = x³ + axy + bx² + cy²
// f_x = 3x² + ay + 2bx,  f_y = ax + 2cy = 0  =>  y = -(a/2c) x
// eingesetzt: 3x² + (2b - a²/2c) x = 0  =>  x1=0, x2 = (a²/2c - 2b) / 3
// Rückwärts: c, m, x2 wählen; a = 2mc, b = (2m²c - 3x2)/2, y2 = -m x2
// (a/2c = m und a²/2c = 2m²c sind dadurch automatisch ganzzahlig).
// ---------------------------------------------------------------------------
function klassifiziereKritischenPunkt(det, fxx) {
  if (det < 0) return 'Sattelpunkt';
  return fxx < 0 ? 'Maximum' : 'Minimum';
}

export const extremwerteZweiVariablenKubisch = {
  id: 'diff.extremwerte-2var',
  teil: 'diff',
  name: 'Extremwerte und Sattelpunkte (zwei Variablen)',
  punkte: 12,
  vorlage: 'Musterklausur 4',
  waehleParameter(rng) {
    for (let versuch = 0; versuch < 50; versuch++) {
      const c = zufallAus(rng, [-2, -1, 1, 2]);
      const m = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
      const x2 = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
      const a = 2 * m * c;
      const b = (2 * m * m * c - 3 * x2) / 2;
      const y2 = -m * x2;

      const det1 = (2 * b) * (2 * c) - a * a; // bei (0,0): fxx=2b, fyy=2c, fxy=a
      const det2 = (6 * x2 + 2 * b) * (2 * c) - a * a; // bei (x2,y2)
      if (Math.abs(det1) < 1e-9 || Math.abs(det2) < 1e-9) continue;

      const typ1 = klassifiziereKritischenPunkt(det1, 2 * b);
      const typ2 = klassifiziereKritischenPunkt(det2, 6 * x2 + 2 * b);
      // Wie in MK4: genau ein Sattelpunkt und ein Extremum, nicht zwei vom
      // selben Typ — sonst wäre die Aufgabe weniger lehrreich.
      const istSattel1 = typ1 === 'Sattelpunkt';
      const istSattel2 = typ2 === 'Sattelpunkt';
      if (istSattel1 === istSattel2) continue;
      if (x2 === 0 || y2 === 0) continue; // zweiter Punkt soll sich klar von (0,0) unterscheiden

      return { a, b, c, x2, y2 };
    }
    // Rückfall: exakt MK4, falls 50 Versuche erfolglos blieben (statistisch sehr unwahrscheinlich).
    return { a: 4, b: -1, c: -1, x2: -2, y2: -4 };
  },
  baue(params) {
    const { a, b, c, x2, y2 } = params;

    const fxx1 = 2 * b;
    const fyy = 2 * c;
    const fxy = a;
    const det1 = fxx1 * fyy - fxy * fxy;
    const typ1 = klassifiziereKritischenPunkt(det1, fxx1);
    const wert1 = 0; // f(0,0) = 0 immer, da jeder Term von x oder y abhängt

    const fxx2 = 6 * x2 + 2 * b;
    const det2 = fxx2 * fyy - fxy * fxy;
    const typ2 = klassifiziereKritischenPunkt(det2, fxx2);
    const wert2 = runde(x2 * x2 * x2 + a * x2 * y2 + b * x2 * x2 + c * y2 * y2, 4);

    const text = `f(x,y) = x³ ${termMitVorzeichen(a, 'xy', formatDeZahl)} ${termMitVorzeichen(b, 'x²', formatDeZahl)} ${termMitVorzeichen(c, 'y²', formatDeZahl)}`;
    const yKoeff = -a / (2 * c); // aus f_y=0 umgestellt: y = -(a/2c)x

    return {
      frage: { text: `Bestimmen Sie alle Extremwerte und Sattelpunkte der Funktion ${text}.` },
      eingaben: [
        { id: 'p1x', label: 'Stationärer Punkt 1: x', typ: 'zahl', punkte: 1, loesung: 0, toleranz: KONFIG.toleranz.exakt },
        { id: 'p1y', label: 'Stationärer Punkt 1: y', typ: 'zahl', punkte: 1, loesung: 0, toleranz: KONFIG.toleranz.exakt },
        { id: 'p1typ', label: 'Punkt 1: Art', typ: 'auswahl', punkte: 2, optionen: ['Maximum', 'Minimum', 'Sattelpunkt'], loesung: typ1 },
        { id: 'p1wert', label: 'Punkt 1: Funktionswert f(x,y)', typ: 'zahl', punkte: 2, loesung: wert1, toleranz: KONFIG.toleranz.exakt },
        { id: 'p2x', label: 'Stationärer Punkt 2: x', typ: 'zahl', punkte: 1, loesung: x2, toleranz: KONFIG.toleranz.exakt },
        { id: 'p2y', label: 'Stationärer Punkt 2: y', typ: 'zahl', punkte: 1, loesung: y2, toleranz: KONFIG.toleranz.exakt },
        { id: 'p2typ', label: 'Punkt 2: Art', typ: 'auswahl', punkte: 2, optionen: ['Maximum', 'Minimum', 'Sattelpunkt'], loesung: typ2 },
        { id: 'p2wert', label: 'Punkt 2: Funktionswert f(x,y)', typ: 'zahl', punkte: 2, loesung: wert2, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `f_x = 3x^2 ${a < 0 ? '-' : '+'} ${koeffVariable(Math.abs(a), 'y')} ${2 * b < 0 ? '-' : '+'} ${koeffVariable(Math.abs(2 * b), 'x')}, \\quad ` +
              `f_y = ${a < 0 ? '-' : ''}${koeffVariable(Math.abs(a), 'x')} ${2 * c < 0 ? '-' : '+'} ${koeffVariable(Math.abs(2 * c), 'y')}`,
            hinweis: 'Partielle Ableitungen: beim Ableiten nach x wird y wie eine Zahl behandelt und umgekehrt.',
          },
          {
            titel: 'Umstellen',
            // Der zweite Ausdruck ("= yKoeff·x") wird nur angehängt, wenn er
            // sich vom ersten unterscheidet: minusBruch kürzt bei |c|=1 (dann
            // ist zweiMalKoeffizient(c) eine reine Zahl, kein symbolisches
            // "2·(c)") den Bruch a/(2c) bereits numerisch, und a=2mc mit
            // c=±1 kürzt sich dabei IMMER exakt auf den ganzzahligen
            // Koeffizienten m — derselbe Wert wie yKoeff. Ohne diese
            // Bedingung stand hier zweimal dasselbe ("y = -x = -x",
            // iPhone-Rückmeldung).
            latex: `f_y = 0 \\;\\Rightarrow\\; y = ${minusBruch(a, zweiMalKoeffizient(c), 'x')}` +
              (Math.abs(c) === 1 ? '' : ` = ${yKoeff < 0 ? '-' : ''}${koeffVariable(Math.abs(yKoeff), 'x')}`),
            hinweis: 'Nach y umstellen, dann in die Ableitung nach x einsetzen.',
          },
          {
            titel: 'Einsetzen',
            latex: `f_x = 3x^2 ${a < 0 ? '-' : '+'} ${cdotWennNicht1(Math.abs(a), `(${yKoeff < 0 ? '-' : ''}${koeffVariable(Math.abs(yKoeff), 'x')})`)} ${2 * b < 0 ? '-' : '+'} ${koeffVariable(Math.abs(2 * b), 'x')} = 0`,
          },
          {
            titel: 'Ergebnis',
            latex: `x \\cdot (3x ${(2 * b - a * a / (2 * c)) < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(2 * b - a * a / (2 * c)), minimaleNachkommastellen(Math.abs(2 * b - a * a / (2 * c))))}) = 0 \\;\\Rightarrow\\; x_1 = 0, \\; x_2 = ${zahlZuLatex(x2, 0)}`,
            hinweis: 'Ein Produkt ist null, wenn ein Faktor null ist.',
          },
          { titel: 'Ergebnis', latex: `y_1 = 0, \\quad y_2 = ${zahlZuLatex(y2, 0)}` },
          {
            titel: 'Formel',
            latex: mehrzeiligeKette([
              `H = \\begin{pmatrix} f_{xx} & f_{xy} \\\\ f_{yx} & f_{yy} \\end{pmatrix}`,
              `f_{xx}=6x ${2 * b < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(2 * b), minimaleNachkommastellen(Math.abs(2 * b)))}`,
              `f_{yy}=${zahlZuLatex(2 * c, 0)}, \\; f_{xy}=${zahlZuLatex(a, 0)}`,
            ]),
            hinweis: 'Det(H)>0 und die zweite Ableitung nach x negativ: Maximum. Det(H)>0 und positiv: Minimum. Det(H)<0: Sattelpunkt.',
          },
          {
            titel: 'Einsetzen',
            latex: `\\text{Punkt }(0|0)\\text{: } H = \\begin{pmatrix} ${zahlZuLatex(fxx1, 0)} & ${zahlZuLatex(fxy, 0)} \\\\ ${zahlZuLatex(fxy, 0)} & ${zahlZuLatex(fyy, 0)} \\end{pmatrix}, \\; \\det(H) = ${zahlZuLatex(det1, 0)}`,
          },
          { titel: 'Ergebnis', latex: `(0|0)\\text{ ist ein } \\textbf{${typ1}}, \\; f(0,0) = ${zahlZuLatex(wert1, 0)}` },
          {
            titel: 'Einsetzen',
            latex: `\\text{Punkt }${punktPaarLatex(x2, y2)}\\text{: } H = \\begin{pmatrix} ${zahlZuLatex(fxx2, 0)} & ${zahlZuLatex(fxy, 0)} \\\\ ${zahlZuLatex(fxy, 0)} & ${zahlZuLatex(fyy, 0)} \\end{pmatrix}, \\; \\det(H) = ${zahlZuLatex(det2, 0)}`,
          },
          { titel: 'Ergebnis', latex: `${punktPaarLatex(x2, y2)}\\text{ ist ein } \\textbf{${typ2}}, \\; f(${zahlZuLatex(x2, 0)},${zahlZuLatex(y2, 0)}) = ${zahlZuLatex(wert2, minimaleNachkommastellen(wert2))}` },
        ],
        ergebnisse: [
          { label: 'Punkt 1', latex: `(0 \\mid 0 \\mid ${zahlZuLatex(wert1, 0)}),\\ ${typ1}` },
          { label: 'Punkt 2', latex: `(${zahlZuLatex(x2, 0)} \\mid ${zahlZuLatex(y2, 0)} \\mid ${zahlZuLatex(wert2, minimaleNachkommastellen(wert2))}),\\ ${typ2}` },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// diff.extremwerte-2var-quadratisch — Übung 15
// f(x,y) = Ax² + Bx + Cy² + Dy + Exy + F
// f_x = 2Ax + B + Ey = 0,  f_y = 2Cy + D + Ex = 0
// Rückwärts: stationären Punkt (x*,y*) wählen, A,C,E ganz mit Det(H)≠0,
// dann B = -(2Ax* + Ey*), D = -(2Cy* + Ex*). F frei (ändert weder
// Stationaritätspunkt noch Hesse-Matrix).
// ---------------------------------------------------------------------------
export const extremwerteZweiVariablenQuadratisch = {
  id: 'diff.extremwerte-2var-quadratisch',
  teil: 'diff',
  name: 'Extremwerte, zwei Variablen (quadratische Form)',
  punkte: 12,
  vorlage: 'Übung 15',
  waehleParameter(rng) {
    for (let versuch = 0; versuch < 50; versuch++) {
      const xStern = zufallInt(rng, -6, 6);
      const yStern = zufallInt(rng, -6, 6);
      const A = zufallAus(rng, [-2, -1, 1, 2]);
      const C = zufallAus(rng, [-2, -1, 1, 2]);
      const E = zufallAus(rng, [-3, -2, -1, 0, 1, 2, 3]);
      const det = 4 * A * C - E * E;
      if (Math.abs(det) < 1e-9) continue;
      if (xStern === 0 && yStern === 0) continue; // (0|0) ist weniger lehrreich als Übungsbeispiel
      const B = -(2 * A * xStern + E * yStern);
      const D = -(2 * C * yStern + E * xStern);
      const F = zufallInt(rng, -5, 5);

      // Die Einsetzungsmethode (siehe baue()) braucht vier abgeleitete
      // Zwischenwerte k1,k2,m1,n1 — die müssen "sauber" bleiben (höchstens
      // 2 Nachkommastellen), sonst ist die gezeigte Rechnung unleserlich.
      const k1 = -B / (2 * A);
      const k2 = -E / (2 * A);
      const m1 = 2 * C + E * k2;
      const n1 = D + E * k1;
      if ([k1, k2, m1, n1].some((w) => minimaleNachkommastellen(w) > 2)) continue;

      return { A, B, C, D, E, F, xStern, yStern };
    }
    return { A: -1, B: 24, C: -2, D: 40, E: -2, F: -3, xStern: 4, yStern: 8 }; // Rückfall: Übung 15a
  },
  baue(params) {
    const { A, B, C, D, E, F, xStern, yStern } = params;
    const fxx = 2 * A;
    const fyy = 2 * C;
    const fxy = E;
    const det = fxx * fyy - fxy * fxy;
    const typ = klassifiziereKritischenPunkt(det, fxx);
    const wert = runde(A * xStern * xStern + B * xStern + C * yStern * yStern + D * yStern + E * xStern * yStern + F, 4);

    const fText = `f(x,y) = ${bauePolynomAusdruck([[A, 'x²'], [B, 'x'], [C, 'y²'], [D, 'y'], [E, 'xy'], [F, '']], formatDeZahl, '−')}`;

    // Einsetzungsmethode mit echten Zahlen (keine Platzhalterbuchstaben):
    // x = k1 + k2·y aus f_x=0, dann in f_y=0 eingesetzt und nach y aufgelöst.
    const k1 = runde(-B / (2 * A), 4);
    const k2 = runde(-E / (2 * A), 4);
    const xVonY = bauePolynomAusdruck([[k1, ''], [k2, 'y']], zahlZuLatex, '-');
    const m1 = runde(2 * C + E * k2, 4);
    const n1 = runde(D + E * k1, 4);
    const m1Term = `${m1 < 0 ? '-' : ''}${koeffVariable(Math.abs(m1), 'y')}`;

    return {
      frage: { text: `Bestimmen Sie alle Extremwerte der Funktion ${fText}.` },
      eingaben: [
        { id: 'x', label: 'Stationärer Punkt: x', typ: 'zahl', punkte: 3, loesung: xStern, toleranz: KONFIG.toleranz.exakt },
        { id: 'y', label: 'Stationärer Punkt: y', typ: 'zahl', punkte: 3, loesung: yStern, toleranz: KONFIG.toleranz.exakt },
        { id: 'typ', label: 'Art des Punktes', typ: 'auswahl', punkte: 3, optionen: ['Maximum', 'Minimum', 'Sattelpunkt'], loesung: typ },
        { id: 'wert', label: 'Funktionswert f(x,y)', typ: 'zahl', punkte: 3, loesung: wert, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `f_x = ${bauePolynomAusdruck([[2 * A, 'x'], [B, ''], [E, 'y']], zahlZuLatex, '-')}, \\quad ` +
              `f_y = ${bauePolynomAusdruck([[2 * C, 'y'], [D, ''], [E, 'x']], zahlZuLatex, '-')}`,
            hinweis: 'Beide ersten Ableitungen null setzen (notwendige Bedingung).',
          },
          {
            titel: 'Umstellen',
            latex: `f_x = 0 \\;\\Rightarrow\\; x = ${xVonY}`,
            hinweis: 'Nach x umstellen (Einsetzungsmethode).',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('f_y', [
              `${koeffVariable(2 * C, 'y')}${D === 0 ? '' : ` ${D < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(D), 0)}`}${E === 0 ? '' : ` ${E < 0 ? '-' : '+'} ${cdotWennNicht1(Math.abs(E), `(${xVonY})`)}`}`,
              `${m1Term} ${n1 < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(n1), minimaleNachkommastellen(Math.abs(n1)))} = 0`,
            ]),
            hinweis: 'x ersetzen und ausmultiplizieren.',
          },
          {
            titel: 'Umstellen',
            latex: gleichungsKette([
              `${m1Term} ${n1 < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(n1), minimaleNachkommastellen(Math.abs(n1)))} = 0`,
              `${m1Term} = ${zahlZuLatex(-n1, minimaleNachkommastellen(Math.abs(n1)))}`,
              `y = ${zahlZuLatex(yStern, 0)}`,
            ]),
            hinweis: 'Nach y auflösen.',
          },
          { titel: 'Ergebnis', latex: `y = ${zahlZuLatex(yStern, 0)}` },
          {
            titel: 'Einsetzen',
            latex: `x = ${zahlZuLatex(k1, minimaleNachkommastellen(k1))} ${k2 < 0 ? '-' : '+'} ${cdotWennNicht1(k2, klammerWennNegativ(yStern))} = ${zahlZuLatex(xStern, 0)}`,
          },
          {
            titel: 'Formel',
            latex: `H = \\begin{pmatrix} f_{xx} & f_{xy} \\\\ f_{yx} & f_{yy} \\end{pmatrix}`,
            hinweis: 'Det(H)>0 und die zweite Ableitung nach x negativ: Maximum. Det(H)>0 und positiv: Minimum. Det(H)<0: Sattelpunkt.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('\\det(H)', [
              `\\begin{vmatrix} ${zahlZuLatex(fxx, 0)} & ${zahlZuLatex(fxy, 0)} \\\\ ${zahlZuLatex(fxy, 0)} & ${zahlZuLatex(fyy, 0)} \\end{vmatrix}`,
              `(${zahlZuLatex(fxx, 0)}) \\cdot (${zahlZuLatex(fyy, 0)}) - (${zahlZuLatex(fxy, 0)})^2`,
              zahlZuLatex(det, 0),
            ]),
          },
          {
            titel: 'Ergebnis',
            latex: `(${zahlZuLatex(xStern, 0)}|${zahlZuLatex(yStern, 0)})\\text{ ist ein } \\textbf{${typ}}, \\; f(${zahlZuLatex(xStern, 0)},${zahlZuLatex(yStern, 0)}) = ${zahlZuLatex(wert, minimaleNachkommastellen(wert))}`,
          },
        ],
        ergebnisse: [
          { label: 'Stationärer Punkt', latex: `(${zahlZuLatex(xStern, 0)}|${zahlZuLatex(yStern, 0)})` },
          { label: 'Art', latex: `\\text{${typ}}` },
          { label: 'Funktionswert', latex: zahlZuLatex(wert, minimaleNachkommastellen(wert)) },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// diff.nutzenmaximum — MK 5 / Übung 16
// U(x1,x2) = αx1 + βx2 + γx1x2 + δ  u.d.N.  P1x1 + P2x2 = Y
// Einsetzungsmethode: x2 = (Y - P1x1)/P2, U(x1) wird quadratisch in x1 mit
// Maximum bei x1* — Lagrange liefert dieselbe Optimalitätsbedingung:
// P2(α + γx2*) = P1(β + γx1*).
// Rückwärts: x1*, x2*, P1, P2, γ, α wählen, β daraus bestimmen (muss ganz
// sein, sonst neu ziehen).
// ---------------------------------------------------------------------------
export const nutzenmaximum = {
  id: 'diff.nutzenmaximum',
  teil: 'diff',
  name: 'Nutzenmaximum unter einer Budget-Nebenbedingung',
  punkte: 8,
  vorlage: 'Musterklausur 5 / Übung 16',
  waehleParameter(rng) {
    for (let versuch = 0; versuch < 60; versuch++) {
      const x1Stern = zufallInt(rng, 2, 25);
      const x2Stern = zufallInt(rng, 2, 25);
      const P1 = zufallInt(rng, 1, 5);
      const P2 = zufallInt(rng, 1, 5);
      const gamma = zufallAus(rng, [1, 2]);
      const alpha = zufallInt(rng, 2, 10);
      const betaZaehler = P2 * (alpha + gamma * x2Stern) - gamma * x1Stern * P1;
      if (betaZaehler % P1 !== 0) continue;
      const beta = betaZaehler / P1;
      if (beta <= 0 || beta > 20) continue;
      const delta = zufallInt(rng, 3, 10);

      // U(x1) nach Einsetzen der Nebenbedingung ist quadratisch in x1 —
      // die drei Koeffizienten müssen "sauber" sein (höchstens 2 Nachkomma-
      // stellen), sonst sieht die Einsetzen-Zeile unleserlich aus.
      const Y = P1 * x1Stern + P2 * x2Stern;
      const a1 = -gamma * P1 / P2;
      const b1 = alpha - beta * P1 / P2 + gamma * Y / P2;
      const c1 = beta * Y / P2 + delta;
      if ([a1, b1, c1].some((w) => minimaleNachkommastellen(w) > 2)) continue;

      return { x1Stern, x2Stern, P1, P2, gamma, alpha, beta, delta };
    }
    return { x1Stern: 18, x2Stern: 6, P1: 2, P2: 4, gamma: 2, alpha: 8, beta: 4, delta: 8 }; // Rückfall: MK5
  },
  baue(params) {
    const { x1Stern, x2Stern, P1, P2, gamma, alpha, beta, delta } = params;
    const Y = P1 * x1Stern + P2 * x2Stern;
    const lambda = runde(-(alpha + gamma * x2Stern) / P1, 4);
    const uOptimum = runde(alpha * x1Stern + beta * x2Stern + gamma * x1Stern * x2Stern + delta, 2);

    // U(x1) = A1 x1² + B1 x1 + C1 nach Einsetzen von x2=(Y-P1x1)/P2 und
    // Ausmultiplizieren (siehe waehleParameter für die Herleitung).
    const a1 = runde(-gamma * P1 / P2, 4);
    const b1 = runde(alpha - beta * P1 / P2 + gamma * Y / P2, 4);
    const c1 = runde(beta * Y / P2 + delta, 4);

    const uText = `U(x₁,x₂) = ${bauePolynomAusdruck([[alpha, 'x₁'], [beta, 'x₂'], [gamma, 'x₁x₂'], [delta, '']], formatDeZahl, '−')}`;
    const uLatex = bauePolynomAusdruck([[alpha, 'x_1'], [beta, 'x_2'], [gamma, 'x_1x_2'], [delta, '']], zahlZuLatex, '-');

    return {
      frage: {
        text: `Gegeben sei die Nutzenfunktion ${uText}, die von den Mengen x₁ und x₂ zweier Güter ` +
          `abhängt, bei einem Haushaltseinkommen von Y = ${formatDeZahl(Y, 0)} und Preisen ` +
          `P₁ = ${formatDeZahl(P1, 0)} und P₂ = ${formatDeZahl(P2, 0)}. ` +
          `Berechnen Sie das nutzenmaximale Güterbündel.`,
      },
      eingaben: [
        { id: 'x1', label: 'Nutzenmaximale Menge x₁', typ: 'zahl', punkte: 4, loesung: x1Stern, toleranz: KONFIG.toleranz.exakt },
        { id: 'x2', label: 'Nutzenmaximale Menge x₂', typ: 'zahl', punkte: 4, loesung: x2Stern, toleranz: KONFIG.toleranz.exakt },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `\\max\\ U(x_1,x_2) = ${uLatex} \\quad \\text{u.d.N.} \\quad ${koeffVariable(P1, 'x_1')} + ${koeffVariable(P2, 'x_2')} = ${zahlZuLatex(Y, 0)}`,
          },
          {
            titel: 'Umstellen',
            latex: `x_2 = ${bruch(`${zahlZuLatex(Y, 0)} - ${koeffVariable(P1, 'x_1')}`, zahlZuLatex(P2, 0))}`,
            hinweis: 'Nebenbedingung nach x₂ umstellen, dann in U einsetzen (Einsetzungsmethode).',
          },
          {
            titel: 'Einsetzen',
            latex: `U(x_1) = ${bauePolynomAusdruck([[a1, 'x_1^2'], [b1, 'x_1'], [c1, '']], zahlZuLatex, '-')}`,
            hinweis: `x₂ ersetzen und ausmultiplizieren; U wird dadurch eine quadratische Funktion von x₁ allein.`,
          },
          {
            titel: 'Umstellen',
            latex: `U'(x_1) = ${bauePolynomAusdruck([[2 * a1, 'x_1'], [b1, '']], zahlZuLatex, '-')} = 0`,
            hinweis: 'Notwendige Bedingung: erste Ableitung null setzen.',
          },
          {
            titel: 'Ergebnis',
            latex: `x_1 = ${zahlZuLatex(x1Stern, 0)}, \\quad \\text{da } U''(x_1) = ${zahlZuLatex(2 * a1, minimaleNachkommastellen(2 * a1))} < 0 \\text{ (Maximum)}`,
          },
          {
            titel: 'Einsetzen',
            latex: `x_2 = ${bruch(`${zahlZuLatex(Y, 0)} - ${cdotWennNicht1(P1, zahlZuLatex(x1Stern, 0))}`, zahlZuLatex(P2, 0))} = ${zahlZuLatex(x2Stern, 0)}`,
          },
          { titel: 'Ergebnis', latex: `(x_1;x_2) = (${zahlZuLatex(x1Stern, 0)};${zahlZuLatex(x2Stern, 0)})` },
          {
            titel: 'Formel',
            latex: `L(x_1,x_2,\\lambda) = U(x_1,x_2) + \\lambda(${koeffVariable(P1, 'x_1')} + ${koeffVariable(P2, 'x_2')} - ${zahlZuLatex(Y, 0)})`,
            hinweis: 'Kontrolle mit der Lagrange-Methode: L nach x₁, x₂ und λ ableiten und null setzen.',
          },
          {
            titel: 'Einsetzen',
            latex: `L_{x_1} = ${zahlZuLatex(alpha, 0)} + ${koeffVariable(gamma, 'x_2')} + ${koeffVariable(P1, '\\lambda')} = 0, \\quad ` +
              `L_{x_2} = ${zahlZuLatex(beta, 0)} + ${koeffVariable(gamma, 'x_1')} + ${koeffVariable(P2, '\\lambda')} = 0`,
          },
          { titel: 'Ergebnis', latex: `\\lambda = ${zahlZuLatex(lambda, minimaleNachkommastellen(lambda))}\\text{ (aus beiden Gleichungen identisch)}` },
        ],
        ergebnisse: [
          { label: 'Nutzenmaximales Güterbündel', latex: `(x_1;x_2) = (${zahlZuLatex(x1Stern, 0)};${zahlZuLatex(x2Stern, 0)})` },
          { label: 'Nutzen im Optimum', latex: `U = ${zahlZuLatex(uOptimum, minimaleNachkommastellen(uOptimum))}` },
          { label: 'Lagrange-Multiplikator', latex: `\\lambda = ${zahlZuLatex(lambda, minimaleNachkommastellen(lambda))}` },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// diff.ableitungen — MK 6 / Übung 9-11
// Zwei Teilaufgaben à 2 Punkte: a) Potenzregel-Summe, b) Produkt-/Kettenregel.
// Symbolterm wird aufgedeckt und selbst bewertet (typ: 'term'), dazu ein
// automatisch geprüfter Zahlencheck f'(x0) (siehe PLAN.md, Antworttypen).
// Zwei feste Funktionsfamilien (wie MK6a/b), nur die Koeffizienten variieren.
// ---------------------------------------------------------------------------
export const ableitungen = {
  id: 'diff.ableitungen',
  teil: 'diff',
  name: 'Ableitungen bilden',
  punkte: 4,
  vorlage: 'Musterklausur 6',
  waehleParameter(rng) {
    const a = zufallAus(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    const x0a = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
    const b = zufallAus(rng, [1, 2, 3]);
    const c = zufallAus(rng, [1, 2, 3, 4]);
    const x0b = zufallAus(rng, [b + c + 1, b + c + 2, b + c + 3, -(b + c + 1), -(b + c + 2)]);
    return { a, x0a, b, c, x0b };
  },
  baue(params) {
    const { a, x0a, b, c, x0b } = params;

    // a) f(x) = a x² + 1/x  =>  f'(x) = 2a x - 1/x²  (MK6a: a=-3)
    const faLatex = `${bauePolynomAusdruck([[a, 'x^2']], zahlZuLatex, '-')} + \\dfrac{1}{x}`;
    const faProse = `${bauePolynomAusdruck([[a, 'x²']], formatDeZahl, '−')} + 1/x`;
    const faStrich = `${bauePolynomAusdruck([[2 * a, 'x']], zahlZuLatex, '-')} - \\dfrac{1}{x^2}`;
    const faStrichWert = runde(2 * a * x0a - 1 / (x0a * x0a), 2);
    const faAusgewertet = polynomEingesetztLatex([2 * a, -1], [1, -2], x0a);

    // b) f(x) = (x - b)√(x² - c)  =>  f'(x) = √(x²-c) + (x-b)x/√(x²-c)  (MK6b: b=1,c=1)
    const vorzeichenLatex = (k) => (k < 0 ? '+' : '-');
    const vorzeichenProse = (k) => (k < 0 ? '+' : '−');
    const fbLatex = `(x ${vorzeichenLatex(b)} ${zahlZuLatex(Math.abs(b), 0)})\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}`;
    const fbProse = `(x ${vorzeichenProse(b)} ${formatDeZahl(Math.abs(b), 0)})√(x² ${vorzeichenProse(c)} ${formatDeZahl(Math.abs(c), 0)})`;
    const fbStrich = `\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}} + \\dfrac{(x ${vorzeichenLatex(b)} ${zahlZuLatex(Math.abs(b), 0)})x}{\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}}`;
    const wurzelB = Math.sqrt(x0b * x0b - c);
    const fbStrichWert = runde(wurzelB + ((x0b - b) * x0b) / wurzelB, 2);
    // Für die Einsetzen-Zeile x0b klammern, falls negativ — sonst würde x0b²
    // bei negativem x0b als z. B. "-3^2" erscheinen (mathematisch -9, nicht
    // (-3)²=9) statt korrekt "(-3)^2" (gleiches Muster wie polynomEingesetztLatex).
    const x0bKlar = x0b < 0 ? `(${zahlZuLatex(x0b, 0)})` : zahlZuLatex(x0b, 0);
    const nWert = x0b * x0b - c; // immer positiv, siehe Parameterherleitung oben
    const mWert = (x0b - b) * x0b; // immer positiv, siehe Parameterherleitung oben
    const fbEingesetzt = `\\sqrt{${x0bKlar}^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}} + ` +
      `\\dfrac{(${x0bKlar} ${vorzeichenLatex(b)} ${zahlZuLatex(Math.abs(b), 0)})${x0bKlar}}{\\sqrt{${x0bKlar}^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}}`;
    const fbVereinfacht = `\\sqrt{${zahlZuLatex(nWert, 0)}} + \\dfrac{${zahlZuLatex(mWert, 0)}}{\\sqrt{${zahlZuLatex(nWert, 0)}}}`;

    return {
      frage: {
        text: `Bilden Sie die Ableitung der folgenden Funktionen. a) f(x) = ${faProse}. b) f(x) = ${fbProse}.`,
      },
      eingaben: [
        { id: 'a_term', label: 'Teilaufgabe a): f\'(x)', typ: 'term', punkte: 1 },
        { id: 'a_check', label: `Zahlencheck a): f'(${x0a})`, typ: 'zahl', punkte: 1, loesung: faStrichWert, toleranz: KONFIG.toleranz.geld },
        { id: 'b_term', label: 'Teilaufgabe b): f\'(x)', typ: 'term', punkte: 1 },
        { id: 'b_check', label: `Zahlencheck b): f'(${x0b})`, typ: 'zahl', punkte: 1, loesung: fbStrichWert, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `f(x) = ${faLatex}`,
            hinweis: 'Umschreiben: 1/x = x⁻¹, dann Potenzregel (xⁿ)\' = n·xⁿ⁻¹ auf jeden Summanden anwenden.',
          },
          { titel: 'Ergebnis', latex: `f'(x) = ${faStrich}` },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung(`f'(${zahlZuLatex(x0a, 0)})`, [
              faAusgewertet.eingesetzt,
              faAusgewertet.werte,
              zahlZuLatex(faStrichWert, minimaleNachkommastellen(faStrichWert)),
            ]),
          },
          {
            titel: 'Formel',
            latex: `f(x) = ${fbLatex}`,
            hinweis: `Produktregel (u·v)' = u'v + uv' mit u = x − ${formatDeZahl(b, 0)}, v = √(x² − ${formatDeZahl(c, 0)}); für v' die Kettenregel.`,
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `u = x ${vorzeichenLatex(b)} ${zahlZuLatex(Math.abs(b), 0)}, \\quad u' = 1`,
              `v = \\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}`,
              `v' = \\dfrac{1}{2\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}} \\cdot 2x = \\dfrac{x}{\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}}`,
            ]),
            hinweis: 'v\' über die Kettenregel: äußere Ableitung (√u)\' = 1/(2√u) mal innere Ableitung (x² ± c)\' = 2x.',
          },
          { titel: 'Ergebnis', latex: `f'(x) = u'v + uv' = ${fbStrich}` },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `f'(${x0bKlar}) &= ${fbEingesetzt}`,
              `&= ${fbVereinfacht} \\approx ${zahlZuLatex(fbStrichWert, minimaleNachkommastellen(fbStrichWert))}`,
            ]),
          },
        ],
        ergebnisse: [
          { label: 'a) f\'(x)', latex: faStrich },
          { label: 'b) f\'(x)', latex: fbStrich },
        ],
      },
      params,
    };
  },
};

export const DIFF_GENERATOREN = [
  gewinnBreakeven,
  extremwerteZweiVariablenKubisch,
  extremwerteZweiVariablenQuadratisch,
  nutzenmaximum,
  ableitungen,
];
