// Differentialrechnung — 5 Generatoren, 24 Punkte im Standard-Split (36 im
// Musterklausur-Original). Jeder Generator konstruiert rückwärts: erst die
// saubere Lösung, dann die Parameter (siehe PLAN.md, Katalog
// "2 Differentialrechnung").

import { zufallInt, zufallAus, zufallBool } from '../rng.js';
import { runde, formatDeZahl, minimaleNachkommastellen } from '../zahl.js';
import { zahlZuLatex, bruch, bruchGekuerzt, polynomLatex, polynomEingesetztLatex, mehrzeiligeGleichung, mehrzeiligeKette, gleichungsKette, ohneDuplikatZeile } from '../latex.js';
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

// "basis^{exponent}" in LaTeX, aber ohne den Exponenten zu zeigen, wenn er
// genau 1 ist ("x" statt "x^{1}") — dieselbe Weglassregel wie bei einem
// Koeffizienten von 1, nur für Hochzahlen. Negative Exponenten bleiben
// stehen (z. B. "x^{-2}"), nur der Exponent 1 ist der Sonderfall.
function hochLatex(basis, exponent) {
  return exponent === 1 ? basis : `${basis}^{${exponent}}`;
}

// "zahl \cdot ausdruck" mit Vorzeichen und Koeffizient-1-Weglassregel in
// einem Schritt — anders als cdotWennNicht1 (das laut eigener Konvention
// nur den Betrag zeigt und das Vorzeichen dem Aufrufer überlässt) übernimmt
// diese Variante das Vorzeichen selbst. Für Stellen, an denen bereits
// ausgerechnete Zahlen (nicht mehr Variablen-Koeffizienten) als Vorfaktor
// stehen, z. B. nach dem Einsetzen konkreter Werte.
function vorfaktorMalLatex(zahl, ausdruck) {
  const abs = Math.abs(zahl);
  const vz = zahl < 0 ? '-' : '';
  return abs === 1 ? `${vz}${ausdruck}` : `${vz}${zahlZuLatex(abs, 0)} \\cdot ${ausdruck}`;
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

// Bricht einen von bauePolynomAusdruck gebauten Ausdruck mit vielen Termen
// (z. B. 6 bei Übung 15: Ax²+Bx+Cy²+Dy+Exy+F) vor dem mittleren Term auf
// zwei Zeilen um — eine einzelne KaTeX-Zeile mit sechs zweistelligen
// Koeffizienten lief sonst bei 375px über den Bildschirmrand (iPhone-
// Rückmeldung). Gibt bei höchstens 3 Termen den Ausdruck unverändert als
// einzeiliges Array zurück (reicht erfahrungsgemäß immer auf eine Zeile).
function teileLangenPolynomAusdruck(ausdruck) {
  const terme = ausdruck.split(/ (?=[+-] )/);
  if (terme.length <= 3) return [ausdruck];
  const mitte = Math.ceil(terme.length / 2);
  return [terme.slice(0, mitte).join(' '), terme.slice(mitte).join(' ')];
}

// ---------------------------------------------------------------------------
// diff.gewinn-breakeven — MK 3 / Übung 13
// p(x) = a - bx, K(x) = cx² + dx + e
// E(x) = p(x)x = ax - bx²
// G(x) = E(x) - K(x) = -(b+c)x² + (a-d)x - e =: -A x² + A(x1+x2) x - A x1 x2
// ---------------------------------------------------------------------------
// Zwei gleich wahrscheinliche Formulierungen für den Einleitungssatz — die
// Funktionen selbst stehen NICHT mehr hier (reiner Fließtext hätte z. B.
// "0,2x²" zeigen müssen, das mitten im Ausdruck umbrechen kann), sondern als
// echtes KaTeX in frage.formel (siehe baue() unten).
const VORLAGEN_GEWINN_TEXT = [
  'Gegeben seien die folgende Preisabsatzfunktion p(x) und die zugehörige Kostenfunktion K(x).',
  'Eine Preisabsatzfunktion p(x) und die zugehörige Kostenfunktion K(x) lauten wie folgt.',
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
    // Rückwärts konstruiert: K'(x) = 2c·x + d ist wegen c > 0 auf [0, x2]
    // streng steigend, ihr Minimum liegt also bei x=0 — K'(x) ist auf ganz
    // [0, x2] genau dann positiv (ökonomisch sinnvolle, nie negative
    // Grenzkosten), wenn d > 0 ist. d deshalb direkt positiv wählen, dann a
    // daraus ableiten (nicht umgekehrt) — vorher konnte a unabhängig von d
    // zu klein geraten, d wurde dadurch negativ (z. B. K'(6) = −5 bei
    // "x² − 17x + 120", iPhone-Rückmeldung).
    const d = zufallInt(rng, 5, 30);
    const a = runde((b + c) * (x1 + x2) + d, 4);
    const x0 = zufallInt(rng, x1, 3 * x2);
    const vorlageIndex = zufallInt(rng, 0, VORLAGEN_GEWINN_TEXT.length - 1);
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
    // Mitternachtsformel statt p-q-Formel (Vorlesungsnotizen): a, b, c
    // direkt aus G(x) = ax² + bx + c = 0 ablesen, ohne vorher durch den
    // Koeffizienten von x² zu teilen.
    const mfA = gKoeff[0];
    const mfB = gKoeff[1];
    const mfC = gKoeff[2];
    const diskriminante = runde(mfB * mfB - 4 * mfA * mfC, 4);
    const wurzelDiskriminante = runde(Math.sqrt(diskriminante), 4);
    const zweiMfA = 2 * mfA;
    // Für die mit Zahlen vorgerechneten K'(x0)/p(xMax)/G(xMax)-Schritte unten
    // (statt der "|_{x=...}"-Kurzschreibweise, iPhone-Rückmeldung).
    const kStrichEingesetzt = polynomEingesetztLatex([2 * c, d], [1, 0], x0);
    const pBeiXMax = polynomEingesetztLatex([a, -b], [0, 1], xMax);
    const gBeiXMax = polynomEingesetztLatex(gKoeff, [2, 1, 0], xMax);

    return {
      frage: {
        text: VORLAGEN_GEWINN_TEXT[vorlageIndex],
        formel: mehrzeiligeKette([
          `p(x) = ${polynomLatex([a, -b], [0, 1])}`,
          `K(x) = ${polynomLatex([c, d, e], [2, 1, 0])}`,
        ]),
        teile: [
          { label: 'a)', text: 'Bestimmen Sie die Erlös- und Gewinnfunktion (soweit wie möglich vereinfacht).' },
          { label: 'b)', text: `Wie lauten die Grenzkosten für x = ${x0}?` },
          { label: 'c)', text: 'Bestimmen Sie die Gewinnschwelle (Break-Even) und die Gewinngrenze (beide Nullstellen des Gewinns).' },
          { label: 'd)', text: 'Bestimmen Sie die gewinnmaximale Menge, den gewinnmaximalen Preis und den maximalen Gewinn.' },
        ],
      },
      eingaben: [
        { id: 'E', label: 'Erlösfunktion E(x)', typ: 'koeffizienten', punkte: 1, exponenten: [2, 1, 0], loesung: eKoeff, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)' },
        { id: 'G', label: 'Gewinnfunktion G(x)', typ: 'koeffizienten', punkte: 1, exponenten: [2, 1, 0], loesung: gKoeff, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)' },
        { id: 'Kstrich', label: `Grenzkosten K'(${x0})`, typ: 'zahl', punkte: 2, loesung: grenzkosten, toleranz: KONFIG.toleranz.geld, teilLabel: 'b)' },
        { id: 'x1', label: 'Gewinnschwelle (Break-Even) x₁', typ: 'zahl', punkte: 2, loesung: x1, toleranz: KONFIG.toleranz.exakt, teilLabel: 'c)' },
        { id: 'x2', label: 'Gewinngrenze x₂', typ: 'zahl', punkte: 2, loesung: x2, toleranz: KONFIG.toleranz.exakt, teilLabel: 'c)' },
        { id: 'xmax', label: 'Gewinnmaximale Menge x*', typ: 'zahl', punkte: 2, loesung: xMax, toleranz: KONFIG.toleranz.jahre, teilLabel: 'd)' },
        { id: 'pmax', label: 'Gewinnmaximaler Preis p(x*)', typ: 'zahl', punkte: 1, loesung: pMax, toleranz: KONFIG.toleranz.geld, teilLabel: 'd)' },
        { id: 'gmax', label: 'Maximaler Gewinn G(x*)', typ: 'zahl', punkte: 1, loesung: gMax, toleranz: KONFIG.toleranz.geld, teilLabel: 'd)' },
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
            // Mit eingesetzten Zahlen vollständig vorgerechnet statt nur die
            // unausgewertete Summe zu zeigen ("K'(8) = 3·8 + 25 = 24 + 25 =
            // 49" statt nur "K'(8) = 3·8 + 25", iPhone-Rückmeldung).
            titel: 'Einsetzen',
            latex: gleichungsKette([
              `K'(x) = ${polynomLatex([2 * c, d], [1, 0])}`,
              `K'(${x0}) = ${ohneDuplikatZeile(kStrichEingesetzt.eingesetzt, kStrichEingesetzt.werte, zahlZuLatex(grenzkosten, minimaleNachkommastellen(grenzkosten))).join(' = ')}`,
            ]),
          },
          { titel: 'Ergebnis', latex: `K'(${x0}) = ${zahlZuLatex(grenzkosten, minimaleNachkommastellen(grenzkosten))}` },
          {
            titel: 'Formel',
            latex: `x_{1,2} = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`,
            hinweis: 'Mitternachtsformel: a, b, c direkt aus G(x) = ax² + bx + c = 0 ablesen, nicht vorher durch a teilen.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `${polynomLatex(gKoeff, [2, 1, 0])} = 0`,
              `a = ${zahlZuLatex(mfA, minimaleNachkommastellen(mfA))}, \\quad b = ${zahlZuLatex(mfB, minimaleNachkommastellen(mfB))}, \\quad c = ${zahlZuLatex(mfC, minimaleNachkommastellen(mfC))}`,
            ]),
          },
          {
            // Jede Umformung in eine eigene Zeile statt alles in eine lange
            // Zeile mit mehreren "=" zu packen — sonst lief die Zeile bei
            // größeren Zahlen bei 375px rechts ab (iPhone-Rückmeldung).
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `b^2 - 4ac &= ${klammerWennNegativ(mfB, minimaleNachkommastellen(mfB))}^2 - 4 \\cdot ${klammerWennNegativ(mfA, minimaleNachkommastellen(mfA))} \\cdot ${klammerWennNegativ(mfC, minimaleNachkommastellen(mfC))}`,
              `&= ${zahlZuLatex(mfB * mfB, minimaleNachkommastellen(mfB * mfB))} - ${zahlZuLatex(4 * mfA * mfC, minimaleNachkommastellen(4 * mfA * mfC))}`,
              `&= ${zahlZuLatex(diskriminante, minimaleNachkommastellen(diskriminante))}`,
              `\\sqrt{${zahlZuLatex(diskriminante, minimaleNachkommastellen(diskriminante))}} &= ${zahlZuLatex(wurzelDiskriminante, minimaleNachkommastellen(wurzelDiskriminante))}`,
            ]),
            hinweis: 'Diskriminante berechnen, dann die Wurzel ziehen.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `x_1 = \\dfrac{-(${zahlZuLatex(mfB, minimaleNachkommastellen(mfB))}) + ${zahlZuLatex(wurzelDiskriminante, minimaleNachkommastellen(wurzelDiskriminante))}}{${zahlZuLatex(zweiMfA, minimaleNachkommastellen(zweiMfA))}} = ${zahlZuLatex(x1, 0)}`,
              `x_2 = \\dfrac{-(${zahlZuLatex(mfB, minimaleNachkommastellen(mfB))}) - ${zahlZuLatex(wurzelDiskriminante, minimaleNachkommastellen(wurzelDiskriminante))}}{${zahlZuLatex(zweiMfA, minimaleNachkommastellen(zweiMfA))}} = ${zahlZuLatex(x2, 0)}`,
            ]),
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
            hinweis: `Hinreichende Bedingung: G''(x) = ${prosaZahlDezimal(2 * gKoeff[0], minimaleNachkommastellen(2 * gKoeff[0]))} < 0, also Maximum.`,
          },
          {
            // Mit eingesetzten Zahlen vorgerechnet statt der "|_{x=...}"-
            // Kurzschreibweise ("p(7) = 25 − 2·7 = 25 − 14 = 11" statt
            // "p(7) = 25 − 2x|_{x=7} = 11", iPhone-Rückmeldung).
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung(`p(${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))})`,
              ohneDuplikatZeile(pBeiXMax.eingesetzt, pBeiXMax.werte, zahlZuLatex(pMax, minimaleNachkommastellen(pMax)))),
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung(`G(${zahlZuLatex(xMax, minimaleNachkommastellen(xMax))})`,
              ohneDuplikatZeile(gBeiXMax.eingesetzt, gBeiXMax.werte, zahlZuLatex(gMax, minimaleNachkommastellen(gMax)))),
          },
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

    // Als echtes KaTeX statt reinem Fließtext (siehe frage.formel unten) —
    // "x²"/"y²" in Fließtext kann mitten im Exponenten umbrechen ("x" am
    // Zeilenende, "²" allein auf der nächsten, iPhone-Rückmeldung).
    const fLatex = `f(x,y) = x^3 ${termMitVorzeichen(a, 'xy', zahlZuLatex, '-')} ${termMitVorzeichen(b, 'x^2', zahlZuLatex, '-')} ${termMitVorzeichen(c, 'y^2', zahlZuLatex, '-')}`;
    const yKoeff = -a / (2 * c); // aus f_y=0 umgestellt: y = -(a/2c)x

    return {
      frage: {
        text: 'Bestimmen Sie alle Extremwerte und Sattelpunkte der folgenden Funktion.',
        formel: fLatex,
        teile: [{ label: 'Punkt 1' }, { label: 'Punkt 2' }],
      },
      eingaben: [
        { id: 'p1x', label: 'x', typ: 'zahl', punkte: 1, loesung: 0, toleranz: KONFIG.toleranz.exakt, teilLabel: 'Punkt 1' },
        { id: 'p1y', label: 'y', typ: 'zahl', punkte: 1, loesung: 0, toleranz: KONFIG.toleranz.exakt, teilLabel: 'Punkt 1' },
        { id: 'p1typ', label: 'Art', typ: 'auswahl', punkte: 2, optionen: ['Maximum', 'Minimum', 'Sattelpunkt'], loesung: typ1, teilLabel: 'Punkt 1' },
        { id: 'p1wert', label: 'Funktionswert f(x,y)', typ: 'zahl', punkte: 2, loesung: wert1, toleranz: KONFIG.toleranz.exakt, teilLabel: 'Punkt 1' },
        { id: 'p2x', label: 'x', typ: 'zahl', punkte: 1, loesung: x2, toleranz: KONFIG.toleranz.exakt, teilLabel: 'Punkt 2' },
        { id: 'p2y', label: 'y', typ: 'zahl', punkte: 1, loesung: y2, toleranz: KONFIG.toleranz.exakt, teilLabel: 'Punkt 2' },
        { id: 'p2typ', label: 'Art', typ: 'auswahl', punkte: 2, optionen: ['Maximum', 'Minimum', 'Sattelpunkt'], loesung: typ2, teilLabel: 'Punkt 2' },
        { id: 'p2wert', label: 'Funktionswert f(x,y)', typ: 'zahl', punkte: 2, loesung: wert2, toleranz: KONFIG.toleranz.geld, teilLabel: 'Punkt 2' },
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
            // H und det(H) auf getrennten Zeilen statt in einer Zeile mit
            // Komma dazwischen — bei zweistelligen Hesse-Einträgen lief das
            // bei 375px rechts ab (iPhone-Rückmeldung).
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `\\text{Punkt }(0|0)\\text{: } H = \\begin{pmatrix} ${zahlZuLatex(fxx1, 0)} & ${zahlZuLatex(fxy, 0)} \\\\ ${zahlZuLatex(fxy, 0)} & ${zahlZuLatex(fyy, 0)} \\end{pmatrix}`,
              `\\det(H) = ${zahlZuLatex(det1, 0)}`,
            ]),
          },
          { titel: 'Ergebnis', latex: `(0|0)\\text{ ist ein } \\textbf{${typ1}}, \\; f(0,0) = ${zahlZuLatex(wert1, 0)}` },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `\\text{Punkt }${punktPaarLatex(x2, y2)}\\text{: } H = \\begin{pmatrix} ${zahlZuLatex(fxx2, 0)} & ${zahlZuLatex(fxy, 0)} \\\\ ${zahlZuLatex(fxy, 0)} & ${zahlZuLatex(fyy, 0)} \\end{pmatrix}`,
              `\\det(H) = ${zahlZuLatex(det2, 0)}`,
            ]),
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

    // Als echtes KaTeX statt reinem Fließtext (siehe frage.formel unten) —
    // "x²"/"y²" in Fließtext kann mitten im Exponenten umbrechen (iPhone-
    // Rückmeldung). Bis zu sechs Terme mit zweistelligen Koeffizienten
    // liefen in einer einzigen Zeile bei 375px über den Bildschirmrand —
    // teileLangenPolynomAusdruck bricht ab vier Termen auf zwei Zeilen um.
    const fAusdruck = bauePolynomAusdruck([[A, 'x^2'], [B, 'x'], [C, 'y^2'], [D, 'y'], [E, 'xy'], [F, '']], zahlZuLatex, '-');
    const fZeilen = teileLangenPolynomAusdruck(fAusdruck);
    const fLatexFormel = fZeilen.length > 1
      ? mehrzeiligeKette([`f(x,y) = ${fZeilen[0]}`, fZeilen[1]])
      : `f(x,y) = ${fZeilen[0]}`;

    // Einsetzungsmethode mit echten Zahlen (keine Platzhalterbuchstaben):
    // x = k1 + k2·y aus f_x=0, dann in f_y=0 eingesetzt und nach y aufgelöst.
    const k1 = runde(-B / (2 * A), 4);
    const k2 = runde(-E / (2 * A), 4);
    const xVonY = bauePolynomAusdruck([[k1, ''], [k2, 'y']], zahlZuLatex, '-');
    const m1 = runde(2 * C + E * k2, 4);
    const n1 = runde(D + E * k1, 4);
    const m1Term = `${m1 < 0 ? '-' : ''}${koeffVariable(Math.abs(m1), 'y')}`;

    return {
      frage: { text: 'Bestimmen Sie alle Extremwerte der folgenden Funktion.', formel: fLatexFormel },
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

    const uLatex = bauePolynomAusdruck([[alpha, 'x_1'], [beta, 'x_2'], [gamma, 'x_1x_2'], [delta, '']], zahlZuLatex, '-');

    // Für den Ausmultiplizieren-Zwischenschritt (siehe loesung.schritte
    // unten): x₂ = (Y - P1x1)/P2 eingesetzt, aber noch nicht ausmultipliziert
    // — Klammer bei P2=1 (keine Division), sonst echter Bruch. Die vier
    // Teilwerte summieren sich exakt zu a1/b1/c1 (beta*Y/P2 + delta = c1,
    // -gamma*P1/P2 = a1, alpha - beta*P1/P2 + gamma*Y/P2 = b1) — empirisch
    // über 20.000 Seeds geprüft, dass sie bei jeder zulässigen Instanz
    // (a1/b1/c1 bereits auf höchstens 2 Nachkommastellen geprüft) selbst
    // ebenfalls höchstens 2 Nachkommastellen brauchen, kein hässlicher
    // Dezimalbruch (iPhone-Rückmeldung: Zwischenschritt beim Ausmultipli-
    // zieren fehlte ganz, U(x₁) sprang direkt zur fertigen Normalform).
    const x2Klammer = P2 === 1
      ? `\\left(${zahlZuLatex(Y, 0)} - ${koeffVariable(P1, 'x_1')}\\right)`
      : bruch(`${zahlZuLatex(Y, 0)} - ${koeffVariable(P1, 'x_1')}`, zahlZuLatex(P2, 0));
    const uSubstituiert = `U(x_1) = ${koeffVariable(alpha, 'x_1')} + ${koeffVariable(beta, x2Klammer)} + ${koeffVariable(gamma, 'x_1')}${x2Klammer} + ${zahlZuLatex(delta, 0)}`;
    const betaY = runde((beta * Y) / P2, 4);
    const betaP1 = runde((beta * P1) / P2, 4);
    const gammaY = runde((gamma * Y) / P2, 4);
    const gammaP1 = runde((gamma * P1) / P2, 4);
    const uAusmultipliziertAusdruck = bauePolynomAusdruck([
      [alpha, 'x_1'], [betaY, ''], [-betaP1, 'x_1'], [gammaY, 'x_1'], [-gammaP1, 'x_1^2'], [delta, ''],
    ], zahlZuLatex, '-');

    return {
      frage: {
        text: 'Gegeben sei die folgende Nutzenfunktion, die von den Mengen zweier Güter abhängt, ' +
          'unter der angegebenen Budget-Nebenbedingung. Berechnen Sie das nutzenmaximale Güterbündel.',
        formel: mehrzeiligeKette([
          `U(x_1,x_2) = ${uLatex}`,
          `${koeffVariable(P1, 'x_1')} + ${koeffVariable(P2, 'x_2')} = ${zahlZuLatex(Y, 0)} \\quad \\text{(Budget)}`,
        ]),
      },
      eingaben: [
        { id: 'x1', label: 'Nutzenmaximale Menge x₁', typ: 'zahl', punkte: 4, loesung: x1Stern, toleranz: KONFIG.toleranz.exakt },
        { id: 'x2', label: 'Nutzenmaximale Menge x₂', typ: 'zahl', punkte: 4, loesung: x2Stern, toleranz: KONFIG.toleranz.exakt },
      ],
      loesung: {
        schritte: [
          {
            // Zielfunktion und Nebenbedingung auf getrennten Zeilen statt in
            // einer Zeile mit "u.d.N." dazwischen — lief bei 375px rechts ab
            // (iPhone-Rückmeldung, in jeder Instanz, da U(x₁,x₂) allein schon
            // bis zu vier Terme hat).
            titel: 'Formel',
            latex: mehrzeiligeKette([
              `\\max\\ U(x_1,x_2) = ${uLatex}`,
              `\\text{u.d.N.} \\quad ${koeffVariable(P1, 'x_1')} + ${koeffVariable(P2, 'x_2')} = ${zahlZuLatex(Y, 0)}`,
            ]),
          },
          {
            titel: 'Umstellen',
            latex: `x_2 = ${bruch(`${zahlZuLatex(Y, 0)} - ${koeffVariable(P1, 'x_1')}`, zahlZuLatex(P2, 0))}`,
            hinweis: 'Nebenbedingung nach x₂ umstellen, dann in U einsetzen (Einsetzungsmethode).',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              uSubstituiert,
              `= ${uAusmultipliziertAusdruck}`,
              `= ${bauePolynomAusdruck([[a1, 'x_1^2'], [b1, 'x_1'], [c1, '']], zahlZuLatex, '-')}`,
            ]),
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
            // Zähler erst eingesetzt (noch nicht ausgerechnet), dann
            // ausgerechnet, dann das Ergebnis — nicht direkt von der
            // Substitution zum fertigen x₂ springen (iPhone-Rückmeldung).
            titel: 'Einsetzen',
            latex: `x_2 = \\dfrac{${zahlZuLatex(Y, 0)} - ${cdotWennNicht1(P1, zahlZuLatex(x1Stern, 0))}}{${zahlZuLatex(P2, 0)}} = ${zahlZuLatex(Y - P1 * x1Stern, 0)} / ${zahlZuLatex(P2, 0)} = ${zahlZuLatex(x2Stern, 0)}`,
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
// Vier gleich wahrscheinliche Varianten, damit diff.ableitungen nicht nur
// MK6s eigenen Stil übt, sondern auch Quotientenregel, e-/ln-/a^x-/log_a-
// Funktionen und die zweite Ableitung (Audit gegen Übung 9-11: diese fünf
// fehlten vorher komplett, nur Potenzregel und Produkt-/Kettenregel mit
// Wurzel waren abgedeckt). Variante 0 ist bytegleich der bisherige MK6-Stil
// (auch ohne variante-Feld erreichbar — die Fixture ruft baue() genau so
// auf) und bleibt unverändert, damit nichts an der geprüften Musterklausur-
// Aufgabe reißt.
const ABLEITUNGEN_LOG_BASEN = [2, 3, 10];

export const ableitungen = {
  id: 'diff.ableitungen',
  teil: 'diff',
  name: 'Ableitungen bilden',
  punkte: 4,
  vorlage: 'Musterklausur 6 / Übung 9-11',
  waehleParameter(rng) {
    const variante = zufallAus(rng, [0, 0, 1, 2, 3]); // 0 doppelt gewichtet: bleibt der primäre Klausurstil

    if (variante === 1) {
      // a) Quotientenregel: f(x) = (mx+n)/(px+q).
      let m, n, p, q, x0a;
      for (let versuch = 0; versuch < 50; versuch++) {
        m = zufallAus(rng, [1, 2, 3]);
        n = zufallAus(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
        p = zufallAus(rng, [1, 2]);
        q = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
        x0a = zufallAus(rng, [-2, -1, 1, 2]);
        if (p * x0a + q !== 0) break;
      }
      // b) e-Funktion: f(x) = k·e^(c·x+d).
      const k = zufallAus(rng, [1, 2, 3]);
      const c = zufallAus(rng, [-2, -1, 1, 2]);
      const d = zufallAus(rng, [-2, -1, 0, 1, 2]);
      const x0b = zufallAus(rng, [-1, 0, 1, 2]);
      return { variante, m, n, p, q, x0a, k, c, d, x0b };
    }

    if (variante === 2) {
      // a) ln-Funktion: f(x) = k·ln(c·x+d), Definitionsbereich c·x+d > 0.
      let k, c, d, x0a;
      for (let versuch = 0; versuch < 50; versuch++) {
        k = zufallAus(rng, [1, 2, 3, 4]);
        c = zufallAus(rng, [1, 2, 3]);
        d = zufallInt(rng, -2, 4);
        x0a = zufallInt(rng, 1, 5);
        if (c * x0a + d > 0) break;
      }
      // b) log_a-Funktion (a ≠ e): f(x) = k·log_a(x), x0b > 0.
      const kB = zufallAus(rng, [1, 2, 3, 4]);
      const basis = zufallAus(rng, ABLEITUNGEN_LOG_BASEN);
      const x0b = zufallInt(rng, 1, 10);
      return { variante, k, c, d, x0a, kB, basis, x0b };
    }

    if (variante === 3) {
      // a) a^x-Funktion (a ≠ e): f(x) = k·b^x.
      const k = zufallAus(rng, [1, 2, 3]);
      const basis = zufallAus(rng, ABLEITUNGEN_LOG_BASEN);
      const x0a = zufallAus(rng, [-2, -1, 0, 1, 2]);
      // b) 2. Ableitung von f(x) = p·x³ + q·x².
      const p = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
      const q = zufallAus(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
      const x0b = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
      return { variante, k, basis, x0a, p, q, x0b };
    }

    const a = zufallAus(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    const x0a = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
    const b = zufallAus(rng, [1, 2, 3]);
    const c = zufallAus(rng, [1, 2, 3, 4]);
    const x0b = zufallAus(rng, [b + c + 1, b + c + 2, b + c + 3, -(b + c + 1), -(b + c + 2)]);
    return { variante: 0, a, x0a, b, c, x0b };
  },
  baue(params) {
    if (params.variante === 1) return baueAbleitungenQuotientExp(params);
    if (params.variante === 2) return baueAbleitungenLnLogA(params);
    if (params.variante === 3) return baueAbleitungenAHochXZweiteAbleitung(params);

    const { a, x0a, b, c, x0b } = params;

    // a) f(x) = a x² + 1/x  =>  f'(x) = 2a x - 1/x²  (MK6a: a=-3)
    const faLatex = `${bauePolynomAusdruck([[a, 'x^2']], zahlZuLatex, '-')} + \\dfrac{1}{x}`;
    const faStrich = `${bauePolynomAusdruck([[2 * a, 'x']], zahlZuLatex, '-')} - \\dfrac{1}{x^2}`;
    const faStrichWert = runde(2 * a * x0a - 1 / (x0a * x0a), 2);
    const faAusgewertet = polynomEingesetztLatex([2 * a, -1], [1, -2], x0a);

    // b) f(x) = (x - b)√(x² - c)  =>  f'(x) = √(x²-c) + (x-b)x/√(x²-c)  (MK6b: b=1,c=1)
    const vorzeichenLatex = (k) => (k < 0 ? '+' : '-');
    const fbLatex = `(x ${vorzeichenLatex(b)} ${zahlZuLatex(Math.abs(b), 0)})\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}`;
    const fbStrich = `\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}} + \\dfrac{(x ${vorzeichenLatex(b)} ${zahlZuLatex(Math.abs(b), 0)})x}{\\sqrt{x^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}}`;
    const wurzelB = Math.sqrt(x0b * x0b - c);
    const fbStrichWert = runde(wurzelB + ((x0b - b) * x0b) / wurzelB, 2);
    // Für die Einsetzen-Zeile x0b klammern, falls negativ — sonst würde x0b²
    // bei negativem x0b als z. B. "-3^2" erscheinen (mathematisch -9, nicht
    // (-3)²=9) statt korrekt "(-3)^2" (gleiches Muster wie polynomEingesetztLatex).
    const x0bKlar = x0b < 0 ? `(${zahlZuLatex(x0b, 0)})` : zahlZuLatex(x0b, 0);
    const nWert = x0b * x0b - c; // immer positiv, siehe Parameterherleitung oben
    const mWert = (x0b - b) * x0b; // immer positiv, siehe Parameterherleitung oben
    // Führender Summand der Differenz (x0b − b) OHNE x0bKlars eigene Klammern:
    // die runde Klammer um die ganze Differenz kommt hier schon fest aus dem
    // Template — mit x0bKlar davor entstünden zwei öffnende Klammern direkt
    // hintereinander ("((−8) − 2)" statt "(−8 − 2)", iPhone-Rückmeldung).
    const fbEingesetzt = `\\sqrt{${x0bKlar}^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}} + ` +
      `\\dfrac{(${zahlZuLatex(x0b, 0)} ${vorzeichenLatex(b)} ${zahlZuLatex(Math.abs(b), 0)})${x0bKlar}}{\\sqrt{${x0bKlar}^2 ${vorzeichenLatex(c)} ${zahlZuLatex(Math.abs(c), 0)}}}`;
    const fbVereinfacht = `\\sqrt{${zahlZuLatex(nWert, 0)}} + \\dfrac{${zahlZuLatex(mWert, 0)}}{\\sqrt{${zahlZuLatex(nWert, 0)}}}`;

    return {
      frage: {
        text: 'Bilden Sie die Ableitung der folgenden Funktionen.',
        teile: [
          { label: 'a)', formel: `f(x) = ${faLatex}` },
          { label: 'b)', formel: `f(x) = ${fbLatex}` },
        ],
      },
      eingaben: [
        { id: 'a_term', label: 'a) f\'(x)', typ: 'term', punkte: 1 },
        {
          id: 'a_check', label: `f'(${prosaLabelZahl(x0a)})`, typ: 'zahl', punkte: 1, loesung: faStrichWert, toleranz: KONFIG.toleranz.geld,
          teilLabel: 'a)', teilHinweis: 'f\'(x) schriftlich bilden, dann Zahlencheck:',
        },
        { id: 'b_term', label: 'b) f\'(x)', typ: 'term', punkte: 1 },
        {
          id: 'b_check', label: `f'(${prosaLabelZahl(x0b)})`, typ: 'zahl', punkte: 1, loesung: fbStrichWert, toleranz: KONFIG.toleranz.geld,
          teilLabel: 'b)', teilHinweis: 'f\'(x) schriftlich bilden, dann Zahlencheck:',
        },
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
              `f'(${zahlZuLatex(x0b, 0)}) &= ${fbEingesetzt}`,
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

// Ganze Zahl für ein Eingabefeld-Label mit echtem Unicode-Minus "−" statt
// des ASCII-Bindestrichs, den eine einfache Template-Interpolation oder
// formatDeZahl liefern würde ("f'(-1)" statt "f'(−1)", iPhone-Rückmeldung).
function prosaLabelZahl(n) {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

// Wie prosaLabelZahl, aber für bereits gerundete Dezimalzahlen (über
// formatDeZahl statt der rohen JS-Zahl) — toLocaleString('de-DE') liefert
// bei einer negativen Zahl den ASCII-Bindestrich, nicht den echten Unicode-
// Minus (iPhone-Rückmeldung: "G''(x) = -5 < 0" in einem Fließtext-Hinweis).
function prosaZahlDezimal(n, nachkommastellen) {
  const text = formatDeZahl(Math.abs(n), nachkommastellen);
  return n < 0 ? `−${text}` : text;
}

// koeffVariable (diff.js, oben) lässt den Koeffizienten nur bei genau +1
// weg, nicht bei -1 ("-1x" statt "-x" wäre die Folge, iPhone-Rückmeldung).
// Eigene Variante, die beide Vorzeichen abdeckt.
function koeffVariableVorzeichen(koeff, variable) {
  const abs = Math.abs(koeff);
  const zahl = abs === 1 ? '' : zahlZuLatex(abs, minimaleNachkommastellen(abs));
  return (koeff < 0 ? '-' : '') + zahl + variable;
}

// Variante 1a: Quotientenregel f(x) = (mx+n)/(px+q).
// f'(x) = (u'v - uv')/v² mit u=mx+n,u'=m,v=px+q,v'=p — der Zähler kürzt sich
// zu einer Konstante K=mq-np, der Nenner bleibt v² (siehe baue unten).
// Variante 1b: e-Funktion f(x) = k·e^(c·x) (Kettenregel).
function baueAbleitungenQuotientExp(params) {
  const { m, n, p, q, x0a, k, c, x0b } = params;

  const zaehlerLatex = `${koeffVariable(m, 'x')} ${n < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(n), 0)}`;
  const nennerLatex = `${koeffVariable(p, 'x')} ${q < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(q), 0)}`;
  const faLatex = bruch(zaehlerLatex, nennerLatex);

  const K = m * q - n * p;
  const faStrich = bruch(zahlZuLatex(K, 0), `(${nennerLatex})^2`);
  // Bei p=1 ist x0a der führende Summand selbst — dort reicht der nackte
  // Wert (die Klammer dafür kommt gleich beim Quadrieren als äußere Klammer
  // um die ganze Summe, siehe unten; eine eigene Klammer um x0a hätte sonst
  // zwei öffnende Klammern direkt hintereinander ergeben, "((−1) + 3)²"
  // statt "(−1 + 3)²", iPhone-Rückmeldung). Bei p≠1 wird x0a dagegen mit p
  // multipliziert (Juxtaposition p·x0a) — dort IMMER in Klammern, auch wenn
  // x0a positiv ist: ohne sie verschmelzen zwei direkt aneinandergereihte
  // Ziffern zu einer falschen Zahl ("22 − 2" statt "2 · 2 − 2" bei p=2,
  // x0a=2 — real aufgetreten).
  const x0aAlsSummand = p === 1 ? zahlZuLatex(x0a, 0) : koeffVariable(p, `(${zahlZuLatex(x0a, 0)})`);
  const nennerBeiX0a = `${x0aAlsSummand} ${q < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(q), 0)}`;
  const nennerWertA = p * x0a + q;
  const faStrichWert = runde(K / (nennerWertA * nennerWertA), 2);

  const innenLatex = koeffVariableVorzeichen(c, 'x');
  // Für den Hinweis-Satz (reiner Fließtext): echtes Unicode-Minus statt des
  // ASCII-Bindestrichs, den koeffVariableVorzeichen/zahlZuLatex liefern
  // ("innere Funktion -2x" statt "innere Funktion −2x", iPhone-Rückmeldung).
  const innenProse = `${c < 0 ? '−' : ''}${Math.abs(c) === 1 ? '' : Math.abs(c)}x`;
  const fbLatex = cdotWennNicht1(k, `e^{${innenLatex}}`);
  const fbStrichFaktor = k * c;
  const fbStrichVorzeichen = fbStrichFaktor < 0 ? '-' : '';
  const fbStrich = `${fbStrichVorzeichen}${cdotWennNicht1(fbStrichFaktor, `e^{${innenLatex}}`)}`;
  const x0bKlar = x0b < 0 ? `(${zahlZuLatex(x0b, 0)})` : zahlZuLatex(x0b, 0);
  const innenBeiX0b = c < 0 ? `-${cdotWennNicht1(Math.abs(c), x0bKlar)}` : cdotWennNicht1(c, x0bKlar);
  const expWertB = c * x0b;
  const fbStrichWert = runde(fbStrichFaktor * Math.exp(expWertB), 2);

  return {
    titel: 'Quotientenregel und e-Funktion',
    frage: {
      text: 'Bilden Sie die Ableitung der folgenden Funktionen.',
      teile: [
        { label: 'a)', formel: `f(x) = ${faLatex}` },
        { label: 'b)', formel: `f(x) = ${fbLatex}` },
      ],
    },
    eingaben: [
      { id: 'a_term', label: 'a) f\'(x)', typ: 'term', punkte: 1 },
      {
        id: 'a_check', label: `f'(${prosaLabelZahl(x0a)})`, typ: 'zahl', punkte: 1, loesung: faStrichWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'a)', teilHinweis: 'f\'(x) schriftlich bilden, dann Zahlencheck:',
      },
      { id: 'b_term', label: 'b) f\'(x)', typ: 'term', punkte: 1 },
      {
        id: 'b_check', label: `f'(${prosaLabelZahl(x0b)})`, typ: 'zahl', punkte: 1, loesung: fbStrichWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'b)', teilHinweis: 'f\'(x) schriftlich bilden, dann Zahlencheck:',
      },
    ],
    loesung: {
      schritte: [
        {
          titel: 'Formel',
          latex: `f(x) = ${faLatex}`,
          hinweis: `Quotientenregel (u/v)' = (u'v − uv')/v² mit u = ${zaehlerLatex.replace(/\\/g, '')}, u' = ${zahlZuLatex(m, 0)}, v = ${nennerLatex.replace(/\\/g, '')}, v' = ${zahlZuLatex(p, 0)}.`,
        },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `u'v - uv' = ${cdotWennNicht1(m, `(${nennerLatex})`)} - ${cdotWennNicht1(p, `(${zaehlerLatex})`)}`,
            `= ${zahlZuLatex(K, 0)} \\quad (\\text{die } x\\text{-Terme heben sich auf})`,
          ]),
          hinweis: 'Zähler ausmultiplizieren — die x-Terme kürzen sich immer heraus, übrig bleibt eine Konstante.',
        },
        { titel: 'Ergebnis', latex: `f'(x) = ${faStrich}` },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `f'(${zahlZuLatex(x0a, 0)}) &= \\dfrac{${zahlZuLatex(K, 0)}}{(${nennerBeiX0a})^2}`,
            `&= \\dfrac{${zahlZuLatex(K, 0)}}{${klammerWennNegativ(nennerWertA, 0)}^2} = ${zahlZuLatex(faStrichWert, minimaleNachkommastellen(faStrichWert))}`,
          ]),
        },
        {
          titel: 'Formel',
          latex: `f(x) = ${fbLatex}`,
          hinweis: `Kettenregel: äußere Funktion ist e hoch (etwas), innere Funktion ${innenProse}, innere Ableitung ${prosaLabelZahl(c)}.`,
        },
        { titel: 'Ergebnis', latex: `f'(x) = ${fbStrich}` },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `f'(${zahlZuLatex(x0b, 0)}) &= ${fbStrichVorzeichen}${cdotWennNicht1(fbStrichFaktor, `e^{${innenBeiX0b}}`)}`,
            `&= ${fbStrichVorzeichen}${cdotWennNicht1(fbStrichFaktor, `e^{${zahlZuLatex(expWertB, 0)}}`)} \\approx ${zahlZuLatex(fbStrichWert, minimaleNachkommastellen(fbStrichWert))}`,
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
}

// "hauptteil ± |d|", aber OHNE den Term, wenn d genau 0 ist ("3x" statt
// "3x + 0") — d darf laut Pool in Variante 2a (ln-Funktion) auch 0 sein,
// "ln(3x + 0)" tatsächlich so aufgetreten (iPhone-Rückmeldung).
function baueLinearterm(hauptteil, d) {
  if (d === 0) return hauptteil;
  return `${hauptteil} ${d < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(d), 0)}`;
}

// Variante 2a: ln-Funktion f(x) = k·ln(c·x+d) (Kettenregel: (ln u)' = u'/u).
// Variante 2b: log_a-Funktion f(x) = k·log_b(x) mit Basis b≠e
// ((log_b x)' = 1/(x·ln b)).
function baueAbleitungenLnLogA(params) {
  const { k, c, d, x0a, kB, basis, x0b } = params;

  const innenLatex = baueLinearterm(koeffVariable(c, 'x'), d);
  const faLatex = cdotWennNicht1(k, `\\ln(${innenLatex})`);
  const innenWertA = c * x0a + d;
  const faStrich = cdotWennNicht1(k * c, bruch('1', innenLatex));
  const faStrichWert = runde((k * c) / innenWertA, 2);

  const fbLatex = cdotWennNicht1(kB, `\\log_{${zahlZuLatex(basis, 0)}}(x)`);
  const lnBasis = Math.log(basis);
  const fbStrich = `\\dfrac{${zahlZuLatex(kB, 0)}}{x \\cdot \\ln(${zahlZuLatex(basis, 0)})}`;
  const fbStrichWert = runde(kB / (x0b * lnBasis), 2);

  return {
    titel: 'ln-Funktion und Logarithmus zur Basis a',
    frage: {
      text: 'Bilden Sie die Ableitung der folgenden Funktionen.',
      teile: [
        { label: 'a)', formel: `f(x) = ${faLatex}` },
        { label: 'b)', formel: `f(x) = ${fbLatex}` },
      ],
    },
    eingaben: [
      { id: 'a_term', label: 'a) f\'(x)', typ: 'term', punkte: 1 },
      {
        id: 'a_check', label: `f'(${prosaLabelZahl(x0a)})`, typ: 'zahl', punkte: 1, loesung: faStrichWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'a)', teilHinweis: 'f\'(x) schriftlich bilden, dann Zahlencheck:',
      },
      { id: 'b_term', label: 'b) f\'(x)', typ: 'term', punkte: 1 },
      {
        id: 'b_check', label: `f'(${prosaLabelZahl(x0b)})`, typ: 'zahl', punkte: 1, loesung: fbStrichWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'b)', teilHinweis: 'f\'(x) schriftlich bilden, dann Zahlencheck:',
      },
    ],
    loesung: {
      schritte: [
        {
          titel: 'Formel',
          latex: `f(x) = ${faLatex}`,
          hinweis: `Kettenregel: die Ableitung von ln(u) ist u'/u, mit innerer Funktion u = ${innenLatex} und innerer Ableitung u' = ${zahlZuLatex(c, 0)}.`,
        },
        { titel: 'Ergebnis', latex: `f'(x) = ${faStrich}` },
        {
          titel: 'Einsetzen',
          // Bei c=1 steht x0a als nackter Summand da; bei c≠1 wird x0a mit c
          // multipliziert (Juxtaposition c·x0a) und braucht darum IMMER
          // Klammern — x0a ist hier stets positiv, ohne Klammer verschmelzen
          // sonst zwei Ziffern zu einer falschen Zahl ("25 + 4" statt
          // "2 · 5 + 4" bei c=2, x0a=5 — real aufgetreten).
          latex: mehrzeiligeGleichung(`f'(${zahlZuLatex(x0a, 0)})`, [
            // Bei c=1 UND d=0 ist der Nenner-Text selbst schon eine nackte
            // Zahl ("2") — "\dfrac{2}{2}" sähe dann wie ein ungekürzter
            // Bruch aus (DFRAC_NUMERISCH in test/alle.mjs erwartet, dass
            // jeder für sich stehende "\dfrac" bereits gekürzt ist), ist
            // hier aber nur die noch nicht ausgerechnete Division — deshalb
            // in diesem Fall ein schlichter Schrägstrich wie in der Zeile
            // danach, sonst (echter Summe im Nenner) weiter "\dfrac".
            (c === 1 && d === 0)
              ? `${zahlZuLatex(k * c, 0)} / ${zahlZuLatex(x0a, 0)}`
              : bruch(zahlZuLatex(k * c, 0), baueLinearterm(c === 1 ? zahlZuLatex(x0a, 0) : koeffVariable(c, `(${zahlZuLatex(x0a, 0)})`), d)),
            `${zahlZuLatex(k * c, 0)} / ${zahlZuLatex(innenWertA, 0)} = ${zahlZuLatex(faStrichWert, minimaleNachkommastellen(faStrichWert))}`,
          ]),
        },
        {
          titel: 'Formel',
          latex: `f(x) = ${fbLatex}`,
          hinweis: `Umrechnung auf den natürlichen Logarithmus: der Logarithmus zur Basis a lässt sich als ln(x)/ln(a) schreiben, seine Ableitung ist darum 1/(x·ln a).`,
        },
        { titel: 'Ergebnis', latex: `f'(x) = ${fbStrich}` },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `f'(${zahlZuLatex(x0b, 0)}) &= \\dfrac{${zahlZuLatex(kB, 0)}}{${zahlZuLatex(x0b, 0)} \\cdot \\ln(${zahlZuLatex(basis, 0)})}`,
            `&= \\dfrac{${zahlZuLatex(kB, 0)}}{${zahlZuLatex(x0b, 0)} \\cdot ${zahlZuLatex(runde(lnBasis, 4), minimaleNachkommastellen(runde(lnBasis, 4)))}} \\approx ${zahlZuLatex(fbStrichWert, minimaleNachkommastellen(fbStrichWert))}`,
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
}

// Variante 3a: a^x-Funktion f(x) = k·b^x, b≠e ((b^x)' = b^x·ln b).
// Variante 3b: zweite Ableitung von f(x) = p·x³ + q·x².
function baueAbleitungenAHochXZweiteAbleitung(params) {
  const { k, basis, x0a, p, q, x0b } = params;

  const faLatex = cdotWennNicht1(k, `${zahlZuLatex(basis, 0)}^x`);
  const lnBasis = Math.log(basis);
  const faStrich = `${cdotWennNicht1(k, `${zahlZuLatex(basis, 0)}^x`)} \\cdot \\ln(${zahlZuLatex(basis, 0)})`;
  const faStrichWert = runde(k * Math.pow(basis, x0a) * lnBasis, 2);
  const x0aKlar = x0a < 0 ? `(${zahlZuLatex(x0a, 0)})` : zahlZuLatex(x0a, 0);
  const basisHochX0a = Math.pow(basis, x0a);

  const fbLatex = bauePolynomAusdruck([[p, 'x^3'], [q, 'x^2']], zahlZuLatex, '-');
  const fbStrich = bauePolynomAusdruck([[3 * p, 'x^2'], [2 * q, 'x']], zahlZuLatex, '-');
  const fbZweiteStrich = bauePolynomAusdruck([[6 * p, 'x'], [2 * q, '']], zahlZuLatex, '-');
  const fbZweiteStrichWert = runde(6 * p * x0b + 2 * q, 2);

  return {
    titel: 'aˣ-Funktion und zweite Ableitung',
    frage: {
      text: 'Bilden Sie die Ableitung der folgenden Funktion a) und die zweite Ableitung der Funktion b).',
      teile: [
        { label: 'a)', formel: `f(x) = ${faLatex}` },
        { label: 'b)', formel: `f(x) = ${fbLatex}` },
      ],
    },
    eingaben: [
      { id: 'a_term', label: 'a) f\'(x)', typ: 'term', punkte: 1 },
      {
        id: 'a_check', label: `f'(${prosaLabelZahl(x0a)})`, typ: 'zahl', punkte: 1, loesung: faStrichWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'a)', teilHinweis: 'f\'(x) schriftlich bilden, dann Zahlencheck:',
      },
      { id: 'b_term', label: 'b) f\'\'(x)', typ: 'term', punkte: 1 },
      {
        id: 'b_check', label: `f''(${prosaLabelZahl(x0b)})`, typ: 'zahl', punkte: 1, loesung: fbZweiteStrichWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'b)', teilHinweis: 'f\'\'(x) schriftlich bilden, dann Zahlencheck:',
      },
    ],
    loesung: {
      schritte: [
        {
          titel: 'Formel',
          latex: `f(x) = ${faLatex}`,
          hinweis: `Ableitungsregel für eine Exponentialfunktion mit fester Basis b (hier b = ${formatDeZahl(basis, 0)}): (bˣ)' = bˣ · ln(b).`,
        },
        { titel: 'Ergebnis', latex: `f'(x) = ${faStrich}` },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `f'(${zahlZuLatex(x0a, 0)}) &= ${cdotWennNicht1(k, `${zahlZuLatex(basis, 0)}^{${x0aKlar}}`)} \\cdot \\ln(${zahlZuLatex(basis, 0)})`,
            `&= ${cdotWennNicht1(k, zahlZuLatex(runde(basisHochX0a, 4), minimaleNachkommastellen(runde(basisHochX0a, 4))))} \\cdot ${zahlZuLatex(runde(lnBasis, 4), minimaleNachkommastellen(runde(lnBasis, 4)))} \\approx ${zahlZuLatex(faStrichWert, minimaleNachkommastellen(faStrichWert))}`,
          ]),
        },
        {
          titel: 'Formel',
          latex: `f(x) = ${fbLatex}`,
          hinweis: 'Für die zweite Ableitung die erste Ableitung noch einmal ableiten (Potenzregel erneut anwenden).',
        },
        { titel: 'Ergebnis', latex: `f'(x) = ${fbStrich}` },
        { titel: 'Ergebnis', latex: `f''(x) = ${fbZweiteStrich}` },
        {
          titel: 'Einsetzen',
          // 6p ist nie ±1 (p-Pool schließt 0 aus), koeffVariable multipliziert
          // also immer per Juxtaposition — x0b braucht darum IMMER Klammern,
          // auch wenn positiv, sonst verschmelzen zwei Ziffern zu einer
          // falschen Zahl ("121 + 6" statt "12 · 1 + 6" bei 6p=12, x0b=1 —
          // real aufgetreten).
          latex: mehrzeiligeGleichung(`f''(${zahlZuLatex(x0b, 0)})`, [
            `${koeffVariable(6 * p, `(${zahlZuLatex(x0b, 0)})`)} ${2 * q < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(2 * q), 0)}`,
            zahlZuLatex(fbZweiteStrichWert, minimaleNachkommastellen(fbZweiteStrichWert)),
          ]),
        },
      ],
      ergebnisse: [
        { label: 'a) f\'(x)', latex: faStrich },
        { label: 'b) f\'\'(x)', latex: fbZweiteStrich },
      ],
    },
    params,
  };
}

// ---------------------------------------------------------------------------
// diff.elastizitaet — Übung 17
// Preiselastizität der NACHFRAGE ε_{x,p}: wie stark ändert sich die
// nachgefragte MENGE x relativ, wenn sich der PREIS p relativ ändert.
// Variante 0 (Übung 17a-c): die Preis-Absatz-Funktion f(x) = a - b·x ist
// gegeben (Preis in Abhängigkeit von der Menge, nicht Menge in Abhängigkeit
// vom Preis) — x als Funktion von p ist dann die UMKEHRFUNKTION von f, und
// ε_{x,p} ist deshalb der KEHRWERT von f'(x)·x/f(x), also
// ε_{x,p}(x) = f(x) / (f'(x)·x), NICHT f'(x)·x/f(x) (das wäre ε_{p,x}, die
// Elastizität von p nach x) — ein echter Richtungsfehler in einer früheren
// Fassung, der nur durch den Sonderfall Übung 17a (ε=−1, selbst-reziprok)
// unentdeckt blieb; durch Hand-Nachrechnung von Übung 17b/c aufgefallen.
// Variante 1 (Übung 17d/e): die Nachfragefunktion x(p) = c - d·p ist direkt
// in Abhängigkeit vom Preis gegeben — dort gilt ganz regulär (keine
// Umkehrung nötig) ε_{x,p}(p) = x'(p)·p / x(p).
// Rückwärts: Zielelastizität ε direkt wählen, b/x0 bzw. d/p0 dann a bzw. c
// so ableiten, dass ε exakt herauskommt.
// Zusatzthema (Phase 6) — in der Probeklausur standardmäßig aus.
// ---------------------------------------------------------------------------
const ELASTIZITAET_EPS_POOL_F_GEGEBEN = [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10];
const ELASTIZITAET_EPS_POOL_X_GEGEBEN = [-1, -2, -3, -4, -5, -0.25, -0.5, -0.75, -1.5, -2.5];

export const elastizitaet = {
  id: 'diff.elastizitaet',
  teil: 'diff',
  name: 'Preiselastizität der Nachfrage',
  punkte: 3,
  vorlage: 'Übung 17',
  zusatz: true,
  waehleParameter(rng) {
    const variante = zufallBool(rng, 0.5) ? 1 : 0;
    if (variante === 1) {
      // x(p) = c - d·p direkt gegeben: ε = x'(p)·p/x(p) = -d·p0/x0 (regulär,
      // keine Umkehrung). x0 ist die nachgefragte MENGE bei p0 — die muss
      // eine plausible Stückzahl sein (ganzzahlig, ≥ 1, wie Übung 17d:
      // x=20 bei p=8.000), nicht ein winziger Dezimalwert wie 0,08 (iPhone-
      // Rückmeldung). x0 deshalb direkt als ganze Zahl wählen, d daraus
      // ableiten (muss selbst noch "clean" sein, sonst neu ziehen).
      for (let versuch = 0; versuch < 500; versuch++) {
        const x0 = zufallAus(rng, [5, 8, 10, 15, 20, 25, 30, 40, 50, 100]);
        const p0 = zufallAus(rng, [5, 8, 10, 20, 50, 100, 1000, 8000]);
        const epsZiel = zufallAus(rng, ELASTIZITAET_EPS_POOL_X_GEGEBEN);
        const d = runde((-epsZiel * x0) / p0, 4);
        if (!(d > 0) || minimaleNachkommastellen(d) > 2) continue;
        const c = runde(x0 + d * p0, 4);
        if (minimaleNachkommastellen(c) > 2 || c <= x0) continue;
        return { variante, c, d, p0 };
      }
      return { variante: 1, c: 100, d: 0.01, p0: 8000 }; // Rückfall: Übung 17d
    }
    // f(x) = a - b·x gegeben: ε = f(x0)/(f'(x)·x0) = (a-b·x0)/(-b·x0).
    // a aus der Zielelastizität ableiten: a = b·x0·(1-ε).
    for (let versuch = 0; versuch < 500; versuch++) {
      const b = zufallAus(rng, [1, 2, 3, 4, 5]);
      const x0 = zufallInt(rng, 2, 20);
      const epsZiel = zufallAus(rng, ELASTIZITAET_EPS_POOL_F_GEGEBEN);
      const a = b * x0 * (1 - epsZiel);
      if (!Number.isInteger(a) || a < 10 || a > 2000) continue;
      return { variante, a, b, x0 };
    }
    return { variante: 0, a: 10, b: 0.1, x0: 50 }; // Rückfall: Übung 17a (nur Zahlen, kein Aufgabentext)
  },
  baue(params) {
    if (params.variante === 1) return baueElastizitaetMengeGegeben(params);
    return baueElastizitaetPreisGegeben(params);
  },
};

function baueElastizitaetPreisGegeben(params) {
  const { a, b, x0 } = params;
  const f0 = runde(a - b * x0, 4);
  const fStrich = -b;
  const nennerWert = runde(fStrich * x0, 4);
  const epsExakt = runde(f0 / nennerWert, 4);
  const aLatex = zahlZuLatex(a, minimaleNachkommastellen(a));
  const bLatex = zahlZuLatex(b, minimaleNachkommastellen(b));
  const x0Latex = zahlZuLatex(x0, minimaleNachkommastellen(x0));
  const aProse = formatDeZahl(a, minimaleNachkommastellen(a));
  const bProse = Math.abs(b) === 1 ? '' : formatDeZahl(Math.abs(b), minimaleNachkommastellen(b));

  return {
    frage: {
      text: `Eine Preis-Absatz-Funktion lautet f(x) = ${aProse} ${b < 0 ? '+' : '−'} ${bProse}x. ` +
        `Bestimmen Sie die Punktelastizität der Nachfrage ε an der Stelle x₀ = ${x0}.`,
    },
    eingaben: [
      { id: 'eps', label: 'Punktelastizität ε(x₀)', typ: 'zahl', punkte: 3, loesung: epsExakt, toleranz: KONFIG.toleranz.exakt },
    ],
    loesung: {
      schritte: [
        {
          titel: 'Formel',
          latex: `\\varepsilon_{x,p}(x) = \\dfrac{f(x)}{f'(x) \\cdot x}`,
          hinweis: 'Elastizität der nachgefragten Menge x nach dem Preis p: x ist hier nur implizit über die ' +
            'Preis-Absatz-Funktion f (Preis in Abhängigkeit von der Menge) gegeben — deshalb der Kehrwert von f\'(x)·x/f(x).',
        },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `f'(x) = ${b < 0 ? '' : '-'}${bLatex} \\quad (\\text{konstant})`,
            `f(${x0Latex}) = ${aLatex} ${b < 0 ? '+' : '-'} ${bLatex} \\cdot ${x0Latex} = ${zahlZuLatex(f0, minimaleNachkommastellen(f0))}`,
          ]),
          hinweis: 'f\' ist bei einer linearen Funktion immer konstant — erst f\'(x), dann den Funktionswert f(x₀) getrennt berechnen.',
        },
        {
          // Erst mit f'(x) und x0 noch unausgerechnet im Nenner (f'(x)
          // geklammert, da immer negativ), dann der ausgerechnete Nenner,
          // zuletzt das Ergebnis — "jeder Rechenschritt wird gezeigt", auch
          // für die Substitution selbst (iPhone-Rückmeldung). Immer als
          // "\dfrac", nie als bloßer Schrägstrich am Ende.
          titel: 'Einsetzen',
          latex: mehrzeiligeGleichung(`\\varepsilon(${x0Latex})`, [
            `\\dfrac{${zahlZuLatex(f0, minimaleNachkommastellen(f0))}}{(${zahlZuLatex(fStrich, minimaleNachkommastellen(fStrich))}) \\cdot ${x0Latex}}`,
            `\\dfrac{${zahlZuLatex(f0, minimaleNachkommastellen(f0))}}{${zahlZuLatex(nennerWert, minimaleNachkommastellen(nennerWert))}}`,
            zahlZuLatex(epsExakt, minimaleNachkommastellen(epsExakt)),
          ]),
        },
      ],
      ergebnisse: [{ label: 'Punktelastizität ε(x₀)', latex: zahlZuLatex(epsExakt, minimaleNachkommastellen(epsExakt)) }],
    },
    params,
  };
}

function baueElastizitaetMengeGegeben(params) {
  const { c, d, p0 } = params;
  const x0 = runde(c - d * p0, 4);
  const xStrich = -d;
  const zaehlerWert = runde(xStrich * p0, 4);
  const epsExakt = runde(zaehlerWert / x0, 4);
  const cLatex = zahlZuLatex(c, minimaleNachkommastellen(c));
  const dLatex = zahlZuLatex(d, minimaleNachkommastellen(d));
  const p0Latex = zahlZuLatex(p0, minimaleNachkommastellen(p0));
  const cProse = formatDeZahl(c, minimaleNachkommastellen(c));
  const dProse = Math.abs(d) === 1 ? '' : formatDeZahl(Math.abs(d), minimaleNachkommastellen(d));

  return {
    frage: {
      text: `Eine Nachfragefunktion lautet x(p) = ${cProse} ${d < 0 ? '+' : '−'} ${dProse}p. ` +
        `Bestimmen Sie die Punktelastizität der Nachfrage ε an der Stelle p₀ = ${p0}.`,
    },
    eingaben: [
      { id: 'eps', label: 'Punktelastizität ε(p₀)', typ: 'zahl', punkte: 3, loesung: epsExakt, toleranz: KONFIG.toleranz.exakt },
    ],
    loesung: {
      schritte: [
        {
          titel: 'Formel',
          latex: `\\varepsilon_{x,p}(p) = \\dfrac{x'(p) \\cdot p}{x(p)}`,
          hinweis: 'x ist hier direkt als Funktion des Preises p gegeben — keine Umkehrung nötig, die Formel gilt direkt.',
        },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `x'(p) = ${d < 0 ? '' : '-'}${dLatex} \\quad (\\text{konstant})`,
            `x(${p0Latex}) = ${cLatex} ${d < 0 ? '+' : '-'} ${dLatex} \\cdot ${p0Latex} = ${zahlZuLatex(x0, minimaleNachkommastellen(x0))}`,
          ]),
          hinweis: 'x\' ist bei einer linearen Funktion immer konstant — erst x\'(p), dann den Funktionswert x(p₀) getrennt berechnen.',
        },
        {
          // Dieselbe dreistufige Substitution wie bei der anderen Variante:
          // erst x'(p) und p0 noch unausgerechnet im Zähler (x'(p)
          // geklammert, da immer negativ), dann der ausgerechnete Zähler,
          // zuletzt das Ergebnis.
          titel: 'Einsetzen',
          latex: mehrzeiligeGleichung(`\\varepsilon(${p0Latex})`, [
            `\\dfrac{(${zahlZuLatex(xStrich, minimaleNachkommastellen(xStrich))}) \\cdot ${p0Latex}}{${zahlZuLatex(x0, minimaleNachkommastellen(x0))}}`,
            `\\dfrac{${zahlZuLatex(zaehlerWert, minimaleNachkommastellen(zaehlerWert))}}{${zahlZuLatex(x0, minimaleNachkommastellen(x0))}}`,
            zahlZuLatex(epsExakt, minimaleNachkommastellen(epsExakt)),
          ]),
        },
      ],
      ergebnisse: [{ label: 'Punktelastizität ε(p₀)', latex: zahlZuLatex(epsExakt, minimaleNachkommastellen(epsExakt)) }],
    },
    params,
  };
}

// ---------------------------------------------------------------------------
// diff.partielle-ableitungen — Übung 14
// Partielle Ableitungen f_x, f_y einer Funktion zweier Variablen — anders
// als diff.extremwerte-2var(-quadratisch), wo f_x/f_y nur ein Zwischen-
// schritt auf dem Weg zu den stationären Punkten sind, wird hier die
// partielle Ableitung selbst abgefragt. Drei Funktionsfamilien nach Übung
// 14a-d: Potenzsumme, Produkt zweier Potenzen (auch negativer Exponent),
// Exponentialfunktion e^(k·x²y) — Letztere exakt der in Übung 14d belegte
// Fall. Zusatzthema (Phase 6) — in der Probeklausur standardmäßig aus.
// ---------------------------------------------------------------------------
function baueFx(fxLatex, fxWert, fyLatex, fyWert, fFormelLatex, x0, y0, titel, einsetzenSchritte, params) {
  return {
    titel,
    frage: {
      text: 'Bilden Sie die partiellen Ableitungen der folgenden Funktion nach x und nach y.',
      formel: `f(x,y) = ${fFormelLatex}`,
    },
    eingaben: [
      { id: 'fx_term', label: 'a) ∂f/∂x', typ: 'term', punkte: 1 },
      {
        id: 'fx_check', label: `∂f/∂x bei (${prosaLabelZahl(x0)},${prosaLabelZahl(y0)})`, typ: 'zahl', punkte: 1, loesung: fxWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'a)', teilHinweis: '∂f/∂x schriftlich bilden, dann Zahlencheck:',
      },
      { id: 'fy_term', label: 'b) ∂f/∂y', typ: 'term', punkte: 1 },
      {
        id: 'fy_check', label: `∂f/∂y bei (${prosaLabelZahl(x0)},${prosaLabelZahl(y0)})`, typ: 'zahl', punkte: 1, loesung: fyWert, toleranz: KONFIG.toleranz.geld,
        teilLabel: 'b)', teilHinweis: '∂f/∂y schriftlich bilden, dann Zahlencheck:',
      },
    ],
    loesung: {
      schritte: einsetzenSchritte,
      ergebnisse: [
        { label: '∂f/∂x', latex: fxLatex },
        { label: '∂f/∂y', latex: fyLatex },
      ],
    },
    params,
  };
}

export const partielleAbleitungen = {
  id: 'diff.partielle-ableitungen',
  teil: 'diff',
  name: 'Partielle Ableitungen',
  punkte: 4,
  vorlage: 'Übung 14',
  zusatz: true,
  waehleParameter(rng) {
    const familie = zufallAus(rng, [0, 1, 2]);

    if (familie === 1) {
      // f(x,y) = C·x^m·y^n (Übung 14c-Stil, m darf negativ sein). m=1 bzw.
      // n=1 blieben außen vor: sie würden f_x bzw. f_y auf einen Term ohne
      // x bzw. ohne y zurückfallen lassen (x^0=1) — ein Sonderfall, der eine
      // eigene Fallunterscheidung bräuchte und hier nicht nötig ist.
      const C = zufallAus(rng, [1, 2, 3]);
      const m = zufallAus(rng, [-2, -1, 2, 3]);
      const n = zufallAus(rng, [2, 3]);
      const x0 = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
      const y0 = zufallAus(rng, [-2, -1, 1, 2]);
      return { familie, C, m, n, x0, y0 };
    }
    if (familie === 2) {
      // f(x,y) = e^(k·x²y) (Übung 14d).
      const k = zufallAus(rng, [-1, 1]);
      const x0 = zufallAus(rng, [-2, -1, 1, 2]);
      const y0 = zufallAus(rng, [-1, 1]);
      return { familie, k, x0, y0 };
    }
    // f(x,y) = A·x^p + B·y^q (Übung 14a/b-Stil).
    const A = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
    const B = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
    const p = zufallAus(rng, [2, 3, 4]);
    const q = zufallAus(rng, [2, 3, 4]);
    const x0 = zufallAus(rng, [-2, -1, 1, 2]);
    const y0 = zufallAus(rng, [-2, -1, 1, 2]);
    return { familie: 0, A, B, p, q, x0, y0 };
  },
  baue(params) {
    const { familie, x0, y0 } = params;
    const x0Latex = zahlZuLatex(x0, 0);
    const y0Latex = zahlZuLatex(y0, 0);
    const x0Klar = x0 < 0 ? `(${x0Latex})` : x0Latex;
    const y0Klar = y0 < 0 ? `(${y0Latex})` : y0Latex;

    if (familie === 1) {
      // f(x,y) = C·x^m·y^n. C,n sind immer positiv (Pool oben), m darf
      // negativ sein — nur der x-Faktor C·m braucht darum ein separates
      // Vorzeichen (cdotWennNicht1 zeigt laut eigener Konvention nur den
      // Betrag, siehe Kommentar an der Funktion).
      const { C, m, n } = params;
      const basisLatex = cdotWennNicht1(C, `${hochLatex('x', m)}${hochLatex('y', n)}`);
      const fxFaktor = C * m;
      const fxVZ = fxFaktor < 0 ? '-' : '';
      const fxLatex = `${fxVZ}${cdotWennNicht1(fxFaktor, `${hochLatex('x', m - 1)}${hochLatex('y', n)}`)}`;
      const fyFaktor = C * n;
      const fyLatex = cdotWennNicht1(fyFaktor, `${hochLatex('x', m)}${hochLatex('y', n - 1)}`);
      const fxWert = runde(fxFaktor * Math.pow(x0, m - 1) * Math.pow(y0, n), 2);
      const fyWert = runde(fyFaktor * Math.pow(x0, m) * Math.pow(y0, n - 1), 2);

      return baueFx(fxLatex, fxWert, fyLatex, fyWert, basisLatex, x0, y0, 'Produkt zweier Potenzen', [
        {
          titel: 'Formel',
          latex: `f(x,y) = ${basisLatex}`,
          hinweis: 'Potenzregel je Variable: beim Ableiten nach x wird y (und umgekehrt) wie eine Konstante behandelt.',
        },
        { titel: 'Ergebnis', latex: `f_x = ${fxLatex}` },
        { titel: 'Ergebnis', latex: `f_y = ${fyLatex}` },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `f_x(${x0Latex},${y0Latex}) = ${fxVZ}${cdotWennNicht1(fxFaktor, `${hochLatex(x0Klar, m - 1)}${hochLatex(y0Klar, n)}`)} = ${zahlZuLatex(fxWert, minimaleNachkommastellen(fxWert))}`,
            `f_y(${x0Latex},${y0Latex}) = ${cdotWennNicht1(fyFaktor, `${hochLatex(x0Klar, m)}${hochLatex(y0Klar, n - 1)}`)} = ${zahlZuLatex(fyWert, minimaleNachkommastellen(fyWert))}`,
          ]),
        },
      ], params);
    }

    if (familie === 2) {
      // f(x,y) = e^(k·x²y), k = ±1 — beide abgeleiteten Vorfaktoren (2k
      // bzw. k) haben darum einen festen, nie-1-mehrdeutigen Betrag (2 bzw.
      // 1), ein eigenes Vorzeichen reicht, cdotWennNicht1 wird hier nicht
      // gebraucht.
      const { k } = params;
      const vz = k < 0 ? '-' : '';
      const innenLatex = `${vz}x^{2}y`;
      const fLatex = `e^{${innenLatex}}`;
      const fxLatex = `${2 * k < 0 ? '-' : ''}2xy \\cdot e^{${innenLatex}}`;
      const fyLatex = `${vz}x^{2} \\cdot e^{${innenLatex}}`;
      const innenWert = k * x0 * x0 * y0;
      const fxWert = runde(2 * k * x0 * y0 * Math.exp(innenWert), 2);
      const fyWert = runde(k * x0 * x0 * Math.exp(innenWert), 2);
      const innenBeiPunkt = `${vz}${hochLatex(x0Klar, 2)} \\cdot ${y0Klar}`;

      return baueFx(fxLatex, fxWert, fyLatex, fyWert, fLatex, x0, y0, 'Exponentialfunktion mit quadratischer innerer Funktion', [
        {
          titel: 'Formel',
          latex: `f(x,y) = ${fLatex}`,
          hinweis: 'Kettenregel: äußere Funktion eᵘ, innere Funktion u(x,y) — nach x bzw. y partiell ableiten.',
        },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `\\text{innere Ableitung nach } x: \\quad ${2 * k < 0 ? '-' : ''}2xy`,
            `\\text{innere Ableitung nach } y: \\quad ${vz}x^{2}`,
          ]),
          hinweis: 'Die innere Funktion partiell nach x abgeleitet (y konstant) ergibt den Faktor 2xy; partiell nach y abgeleitet (x konstant) ergibt den Faktor x hoch 2.',
        },
        { titel: 'Ergebnis', latex: `f_x = ${fxLatex}` },
        { titel: 'Ergebnis', latex: `f_y = ${fyLatex}` },
        {
          // Jede der beiden Zeilen (f_x, f_y) hat drei Rechenschritte
          // ("eingesetzt = ausgewertet ≈ Ergebnis") — alle drei in einer
          // einzigen Zeile liefen bei 375px rechts ab (iPhone-Rückmeldung),
          // darum je eine eigene Zeile pro Zwischenschritt.
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `f_x(${x0Latex},${y0Latex}) = ${vorfaktorMalLatex(2 * k * x0 * y0, `e^{${innenBeiPunkt}}`)}`,
            `= ${vorfaktorMalLatex(2 * k * x0 * y0, `e^{${zahlZuLatex(innenWert, 0)}}`)} \\approx ${zahlZuLatex(fxWert, minimaleNachkommastellen(fxWert))}`,
            `f_y(${x0Latex},${y0Latex}) = ${vz}${hochLatex(x0Klar, 2)} \\cdot e^{${innenBeiPunkt}}`,
            `= ${vorfaktorMalLatex(k * x0 * x0, `e^{${zahlZuLatex(innenWert, 0)}}`)} \\approx ${zahlZuLatex(fyWert, minimaleNachkommastellen(fyWert))}`,
          ]),
        },
      ], params);
    }

    // f(x,y) = A·x^p + B·y^q — A, B können negativ sein, p, q sind immer
    // positiv (Pool oben), also tragen fxFaktor=A·p bzw. fyFaktor=B·q genau
    // das Vorzeichen von A bzw. B.
    const { A, B, p, q } = params;
    const fLatex = bauePolynomAusdruck([[A, `x^{${p}}`], [B, `y^{${q}}`]], zahlZuLatex, '-');
    const fxFaktor = A * p;
    const fyFaktor = B * q;
    const fxVZ = fxFaktor < 0 ? '-' : '';
    const fyVZ = fyFaktor < 0 ? '-' : '';
    const fxLatex = `${fxVZ}${cdotWennNicht1(fxFaktor, hochLatex('x', p - 1))}`;
    const fyLatex = `${fyVZ}${cdotWennNicht1(fyFaktor, hochLatex('y', q - 1))}`;
    const fxWert = runde(fxFaktor * Math.pow(x0, p - 1), 2);
    const fyWert = runde(fyFaktor * Math.pow(y0, q - 1), 2);

    return baueFx(fxLatex, fxWert, fyLatex, fyWert, fLatex, x0, y0, 'Potenzsumme', [
      {
        titel: 'Formel',
        latex: `f(x,y) = ${fLatex}`,
        hinweis: 'Potenzregel je Variable: beim Ableiten nach x ist der y-Term eine Konstante (fällt weg) und umgekehrt.',
      },
      { titel: 'Ergebnis', latex: `f_x = ${fxLatex}` },
      { titel: 'Ergebnis', latex: `f_y = ${fyLatex}` },
      {
        titel: 'Einsetzen',
        latex: mehrzeiligeKette([
          `f_x(${x0Latex},${y0Latex}) = ${fxVZ}${cdotWennNicht1(fxFaktor, hochLatex(x0Klar, p - 1))} = ${zahlZuLatex(fxWert, minimaleNachkommastellen(fxWert))}`,
          `f_y(${x0Latex},${y0Latex}) = ${fyVZ}${cdotWennNicht1(fyFaktor, hochLatex(y0Klar, q - 1))} = ${zahlZuLatex(fyWert, minimaleNachkommastellen(fyWert))}`,
        ]),
      },
    ], params);
  },
};

export const DIFF_GENERATOREN = [
  gewinnBreakeven,
  extremwerteZweiVariablenKubisch,
  extremwerteZweiVariablenQuadratisch,
  nutzenmaximum,
  ableitungen,
];
export const DIFF_ZUSATZ_GENERATOREN = [elastizitaet, partielleAbleitungen];
