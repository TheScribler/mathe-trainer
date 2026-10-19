// Integralrechnung — 4 Generatoren, 12 Punkte zusammen. Kein Musterklausur-
// Vorbild (die Musterklausur selbst hat 0 Punkte Integralrechnung), modelliert
// auf den WS22-Übungen 18/19/20 und den Folien 146-160 (siehe PLAN.md,
// Katalog "3 Integralrechnung"). Jeder Generator konstruiert rückwärts: erst
// die saubere Lösung, dann die Parameter.

import { zufallInt, zufallAus, zufallBool } from '../rng.js';
import { runde, formatDeZahl, minimaleNachkommastellen } from '../zahl.js';
import { zahlZuLatex, bruch, bruchGekuerzt, bruchMitDezimal, polynomLatex, mehrzeiligeGleichung, mehrzeiligeKette, gleichungsKette } from '../latex.js';
import { KONFIG } from '../konfig.js';

// ---------------------------------------------------------------------------
// Gemeinsame Hilfsfunktionen (Prosa- und Bruch-Polynomanzeige). Eigene,
// kleine Kopien statt eines Imports aus diff.js — dieselbe Begründung wie in
// app.js (siehe dortiger Kommentar): echte Modul-Grenzen unter Node, keine
// stille Kopplung an private Hilfsfunktionen einer anderen Datei.
// ---------------------------------------------------------------------------

const HOCH_ZIFFERN = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function hochgestelltesExponent(n) {
  const text = String(Math.abs(n)).split('').map((z) => HOCH_ZIFFERN[Number(z)]).join('');
  return (n < 0 ? '⁻' : '') + text;
}
function potenzEinheitProse(exponent) {
  if (exponent === 0) return '';
  if (exponent === 1) return 'x';
  return `x${hochgestelltesExponent(exponent)}`;
}

// Term mit Vorzeichen für reinen Fließtext. Koeffizient 1/-1 wird nur vor
// einer Variable weggelassen ("x³" statt "1x³") — bei einem reinen Zahlenterm
// (exponent===0) wäre das Weglassen keine Vereinfachung, sondern ein
// verschwundener Term (nur das nackte Vorzeichen bliebe übrig). Das war ein
// echter Bug in diff.js (termMitVorzeichen) und ist hier von Anfang an
// richtig gemacht.
function termProse(koeff, exponent) {
  const abs = Math.abs(koeff);
  const einheit = potenzEinheitProse(exponent);
  const zahl = (abs === 1 && einheit !== '') ? '' : formatDeZahl(abs, minimaleNachkommastellen(abs));
  return `${koeff < 0 ? '−' : '+'} ${zahl}${einheit}`;
}

function polynomProse(koeffizienten, exponenten) {
  const paare = koeffizienten.map((k, i) => [k, exponenten[i]]).filter(([k]) => k !== 0);
  if (paare.length === 0) return '0';
  const erster = termProse(paare[0][0], paare[0][1]).replace(/^\+ /, '');
  const rest = paare.slice(1).map(([k, e]) => termProse(k, e));
  return [erster, ...rest].join(' ');
}

// "koeffizient \cdot ausdruck", ohne den Faktor zu zeigen, wenn |koeffizient|=1.
function cdotWennNicht1(koeffizient, ausdruck) {
  const betrag = Math.abs(koeffizient);
  return betrag === 1 ? ausdruck : `${zahlZuLatex(betrag, minimaleNachkommastellen(betrag))} \\cdot ${ausdruck}`;
}

// Ein Summand "a_k \int x^k\,dx" mit Vorzeichen, Koeffizient 1 weggelassen.
function integralTermMitVorzeichen(koeff, exponent) {
  const potenz = exponent === 0 ? '1' : exponent === 1 ? 'x' : `x^{${exponent}}`;
  const ausdruck = `\\int ${potenz}\\,dx`;
  return `${koeff < 0 ? '-' : '+'} ${cdotWennNicht1(koeff, ausdruck)}`;
}

function summenregelZeile(koeffizienten, exponenten) {
  const teile = koeffizienten.map((a, i) => integralTermMitVorzeichen(a, exponenten[i]));
  return teile.join(' ').replace(/^\+ /, '');
}

// Ein Term "z/n \cdot x^exponent" als LaTeX, exakter (gekürzter) Bruch statt
// Dezimalzahl — Koeffizient 1 nur weggelassen, wenn der Bruch sich zu genau 1
// kürzt UND eine Variable danebensteht (sonst, wie oben, verschwände ein
// reiner Zahlenterm komplett).
function bruchPolynomTermText(zaehler, nenner, exponent) {
  const potenz = exponent === 0 ? '' : exponent === 1 ? 'x' : `x^{${exponent}}`;
  const abs = Math.abs(zaehler);
  if (nenner === 1) {
    return (abs === 1 && potenz !== '') ? potenz : `${zahlZuLatex(abs, 0)}${potenz}`;
  }
  return `${bruch(abs, nenner)}${potenz}`;
}

function bruchPolynomAusdruck(terme) {
  let ergebnis = '';
  for (const { zaehler, nenner, exponent } of terme) {
    if (zaehler === 0) continue;
    const text = bruchPolynomTermText(zaehler, nenner, exponent);
    ergebnis = ergebnis === ''
      ? (zaehler < 0 ? '-' : '') + text
      : ergebnis + (zaehler < 0 ? ' - ' : ' + ') + text;
  }
  return ergebnis || '0';
}

// Liest eine Bruch-Polynom-Termliste als Dezimalkoeffizienten (für die
// Dezimalnäherung in der Lösung — reicht polynomLatex direkt weiter, das
// Vorzeichen/Koeffizient-1/Null-Terme bereits korrekt behandelt).
function bruchPolynomDezimalLatex(terme) {
  return polynomLatex(terme.map((t) => t.zaehler / t.nenner), terme.map((t) => t.exponent));
}

function bruchPolynomProse(terme) {
  return polynomProse(terme.map((t) => t.zaehler / t.nenner), terme.map((t) => t.exponent));
}

// Eine Bruch-Polynom-Termliste an einer ganzzahligen Stelle x exakt (als
// gekürzter Bruch) auswerten — Grundlage für F(a), F(b) in int.bestimmt.
// Rationale Arithmetik statt Gleitkomma, damit die Kürzung am Ende exakt ist.
function wertAlsBruch(terme, x) {
  let summeZ = 0;
  let summeN = 1;
  for (const { zaehler, nenner, exponent } of terme) {
    let termZ;
    let termN;
    if (exponent >= 0) {
      termZ = zaehler * Math.pow(x, exponent);
      termN = nenner;
    } else {
      termZ = zaehler;
      termN = nenner * Math.pow(x, -exponent);
    }
    summeZ = summeZ * termN + termZ * summeN;
    summeN = summeN * termN;
  }
  return bruchGekuerzt(summeZ, summeN);
}

function bruchOderZahl({ zaehler, nenner }) {
  if (nenner === 1) return zahlZuLatex(zaehler, 0);
  const negativ = zaehler < 0;
  return `${negativ ? '-' : ''}${bruch(Math.abs(zaehler), nenner)}`;
}

// ---------------------------------------------------------------------------
// int.unbestimmt — Übung 18 / Folie 152
// Stammfunktion eines Polynoms f(x) = Σ a_k x^k (k ≥ 0) bestimmen.
// Rückwärts: a_k so wählen, dass a_k/(k+1) gekürzt einen Nenner aus
// {1,2,3,4,5} hat (siehe PLAN.md Katalog).
// ---------------------------------------------------------------------------
const EXPONENTEN_POOL_UNBESTIMMT = [3, 2, 1, 0];

export const integralUnbestimmt = {
  id: 'int.unbestimmt',
  teil: 'integral',
  name: 'Stammfunktion bestimmen',
  punkte: 3,
  vorlage: 'Übung 18 / Folie 152',
  waehleParameter(rng) {
    const anzahlTerme = zufallInt(rng, 2, 4);
    const pool = [...EXPONENTEN_POOL_UNBESTIMMT];
    const exponenten = [];
    for (let i = 0; i < anzahlTerme; i++) {
      const idx = zufallInt(rng, 0, pool.length - 1);
      exponenten.push(pool.splice(idx, 1)[0]);
    }
    exponenten.sort((a, b) => b - a);

    const koeffizienten = exponenten.map((k) => {
      for (let versuch = 0; versuch < 30; versuch++) {
        const a = zufallAus(rng, [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
        const { nenner } = bruchGekuerzt(a, k + 1);
        if (nenner <= 5) return a;
      }
      return k + 1; // Rückfall: a_k = k+1 ergibt c_k = 1 (Nenner 1)
    });

    return { exponenten, koeffizienten };
  },
  baue(params) {
    const { exponenten, koeffizienten } = params;
    const fLatex = polynomLatex(koeffizienten, exponenten);
    const fProse = polynomProse(koeffizienten, exponenten);

    const terme = koeffizienten
      .map((a, i) => {
        const { zaehler, nenner } = bruchGekuerzt(a, exponenten[i] + 1);
        return { zaehler, nenner, exponent: exponenten[i] + 1 };
      })
      .sort((x, y) => y.exponent - x.exponent);

    const fExakt = bruchPolynomAusdruck(terme);
    const hatBruch = terme.some((t) => t.nenner !== 1);
    const fExponenten = terme.map((t) => t.exponent);
    const fDezimalWerte = terme.map((t) => t.zaehler / t.nenner);

    const schritte = [
      {
        titel: 'Formel',
        latex: `\\int x^n\\,dx = ${bruch('x^{n+1}', 'n+1')} + c \\quad (n \\neq -1)`,
        hinweis: 'Potenzregel der Integration: Potenz um 1 erhöhen, dann durch die neue Potenz teilen.',
      },
      {
        titel: 'Einsetzen',
        latex: mehrzeiligeGleichung('\\int f(x)\\,dx', [
          `\\int (${fLatex})\\,dx`,
          summenregelZeile(koeffizienten, exponenten),
          `${fExakt} + c`,
        ]),
        hinweis: 'Summenregel: jeder Summand wird einzeln integriert, konstante Faktoren bleiben stehen.',
      },
      { titel: 'Ergebnis', latex: `F(x) = ${fExakt} + C` },
    ];
    if (hatBruch) {
      schritte.push({
        titel: 'Ergebnis',
        latex: `F(x) \\approx ${bruchPolynomDezimalLatex(terme)} + C`,
        hinweis: 'Dezimalnäherung der Bruchkoeffizienten.',
      });
    }
    schritte.push({
      titel: 'Ergebnis',
      latex: `F'(x) = ${fLatex} = f(x)\\ \\checkmark`,
      hinweis: 'Probe: Die Ableitung der gefundenen Stammfunktion muss wieder die Ausgangsfunktion ergeben.',
    });

    return {
      frage: { text: `Bestimmen Sie die Stammfunktion von f(x) = ${fProse}.` },
      eingaben: [
        {
          id: 'F', label: 'Stammfunktion F(x)', typ: 'koeffizienten', punkte: 3,
          exponenten: fExponenten, loesung: fDezimalWerte, toleranz: KONFIG.toleranz.bruch4,
        },
      ],
      loesung: {
        schritte,
        ergebnisse: [{ label: 'Stammfunktion', latex: `F(x) = ${fExakt} + C` }],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// int.bestimmt — Übung 19 / Folien 155-157
// Bestimmtes Integral einer Potenzsumme (auch negative Exponenten).
// Rückwärts: F(x) zuerst wählen (glatte Koeffizienten, auch als Brüche),
// f = F' per Potenzregel. Zwei Varianten:
//   "positiv": EIN Term mit echtem Bruch-Koeffizienten, Exponent ≥ 2, Grenzen
//              frei aus {-3..3} (wie Übung 19a/b: 1/10 bzw. -20,25).
//   "negativ": ZWEI Terme (ein nicht-negativer, ein negativer Exponent),
//              untere Grenze immer 1 (dort ist jeder Term automatisch ganz,
//              x¹=1 für jeden Exponenten — Übung 19c/d nutzen genau das),
//              obere Grenze 2 oder 3, Exponenten-Betrag so begrenzt, dass der
//              Nenner klein bleibt (kein Reject-Sampling nötig).
// ---------------------------------------------------------------------------
export const integralBestimmt = {
  id: 'int.bestimmt',
  teil: 'integral',
  name: 'Bestimmtes Integral berechnen',
  punkte: 4,
  vorlage: 'Übung 19 / Folien 155-157',
  waehleParameter(rng) {
    for (let versuch = 0; versuch < 50; versuch++) {
      const negativ = zufallBool(rng, 0.5);
      let termeF;
      let a;
      let b;
      if (negativ) {
        a = 1;
        b = zufallAus(rng, [2, 3]);
        const negExponentPool = b === 2 ? [-2, -3] : [-2];
        const negExponent = zufallAus(rng, negExponentPool);
        const posExponent = zufallAus(rng, [1, 2, 3]);
        const zPos = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
        const zNeg = zufallAus(rng, [-3, -2, -1, 1, 2, 3]);
        termeF = [
          { zaehler: zPos, nenner: 1, exponent: posExponent },
          { zaehler: zNeg, nenner: 1, exponent: negExponent },
        ];
      } else {
        const exponent = zufallAus(rng, [2, 3, 4, 5]);
        const nenner = zufallAus(rng, [2, 3, 4, 5, 8, 10]);
        const zaehler = zufallAus(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
        termeF = [{ zaehler, nenner, exponent }];
        a = zufallInt(rng, -3, 2);
        b = zufallInt(rng, a + 1, 3);
      }

      const Fa = wertAlsBruch(termeF, a);
      const Fb = wertAlsBruch(termeF, b);
      const delta = bruchGekuerzt(Fb.zaehler * Fa.nenner - Fa.zaehler * Fb.nenner, Fb.nenner * Fa.nenner);
      if (delta.zaehler === 0) continue;

      return { termeF, a, b };
    }
    // Rückfall: Übung 19c (nur Zahlen, kein Aufgabentext — F(x)=x³+x⁻², Grenzen 1 bis 3).
    return { termeF: [{ zaehler: 1, nenner: 1, exponent: 3 }, { zaehler: 1, nenner: 1, exponent: -2 }], a: 1, b: 3 };
  },
  baue(params) {
    const { termeF, a, b } = params;
    const termeFSortiert = [...termeF].sort((x, y) => y.exponent - x.exponent);

    // f = F' per Potenzregel: a_k = c_k * exponent, neuer Exponent exponent-1.
    const termeF_abgeleitet = termeFSortiert.map(({ zaehler, nenner, exponent }) => {
      const { zaehler: z, nenner: n } = bruchGekuerzt(zaehler * exponent, nenner);
      return { zaehler: z, nenner: n, exponent: exponent - 1 };
    });
    const fExakt = bruchPolynomAusdruck(termeF_abgeleitet);
    const fProse = bruchPolynomProse(termeF_abgeleitet);

    const FExakt = bruchPolynomAusdruck(termeFSortiert);

    const Fa = wertAlsBruch(termeFSortiert, a);
    const Fb = wertAlsBruch(termeFSortiert, b);
    const delta = bruchGekuerzt(Fb.zaehler * Fa.nenner - Fa.zaehler * Fb.nenner, Fb.nenner * Fa.nenner);
    const deltaDezimal = runde(delta.zaehler / delta.nenner, 4);

    return {
      frage: { text: `Berechnen Sie das bestimmte Integral von f(x) = ${fProse} in den Grenzen ${a} bis ${b}.` },
      eingaben: [
        { id: 'wert', label: 'Wert des Integrals', typ: 'zahl', punkte: 4, loesung: deltaDezimal, toleranz: KONFIG.toleranz.bruch4 },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: `\\int_{a}^{b} f(x)\\,dx = F(x)\\Big|_{a}^{b} = F(b) - F(a)` },
          {
            titel: 'Einsetzen',
            latex: `\\int_{${a}}^{${b}} (${fExakt})\\,dx = ${FExakt}\\Big|_{${a}}^{${b}}`,
            hinweis: 'Potenzregel anwenden — die Integrationskonstante entfällt beim bestimmten Integral.',
          },
          {
            titel: 'Einsetzen',
            latex: gleichungsKette([
              `F(${b}) - F(${a})`,
              `${bruchOderZahl(Fb)} - \\left(${bruchOderZahl(Fa)}\\right)`,
              bruchMitDezimal(delta.zaehler, delta.nenner, 4),
            ]),
          },
        ],
        ergebnisse: [
          { label: 'Wert des Integrals', latex: bruchMitDezimal(delta.zaehler, delta.nenner, 4) },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// int.konsumentenrente — Übung 20 / Folien 158/159
// p_N(x) = a - bx (Nachfrage), p_A(x) = cx (Angebot). Gleichgewicht, Konsum-
// enten- und Produzentenrente. Rückwärts: x0, b, c wählen, a = p0 + b·x0 mit
// p0 = c·x0 — KR = (b/2)x0², PR = (c/2)x0² müssen höchstens halbzahlig sein.
// ---------------------------------------------------------------------------
export const integralKonsumentenrente = {
  id: 'int.konsumentenrente',
  teil: 'integral',
  name: 'Gleichgewicht, Konsumenten- und Produzentenrente',
  punkte: 5,
  vorlage: 'Übung 20 / Folien 158/159',
  waehleParameter(rng) {
    for (let versuch = 0; versuch < 200; versuch++) {
      const x0 = zufallInt(rng, 4, 20);
      const c = zufallAus(rng, [0.1, 0.2, 0.5, 1, 2, 3, 5]);
      const b = zufallAus(rng, [0.5, 1, 1.5, 2, 4]);
      const KR = (b / 2) * x0 * x0;
      const PR = (c / 2) * x0 * x0;
      const halbzahlig = (w) => Math.abs(Math.round(w * 2) - w * 2) < 1e-9;
      if (!halbzahlig(KR) || !halbzahlig(PR)) continue;
      const p0 = runde(c * x0, 4);
      const a = runde(p0 + b * x0, 4);
      return { x0, b, c, a, p0 };
    }
    return { x0: 4, b: 2, c: 3, a: 20, p0: 12 }; // Rückfall: Folie 160, Aufgabe 20a (nur Zahlen)
  },
  baue(params) {
    const { x0, b, c, a, p0 } = params;
    const KR = runde((b / 2) * x0 * x0, 2);
    const PR = runde((c / 2) * x0 * x0, 2);
    const bc = runde(b + c, 4);
    const x0p0 = runde(x0 * p0, minimaleNachkommastellen(x0 * p0));
    const halbKR = runde(b / 2, minimaleNachkommastellen(b / 2));
    const halbPR = runde(c / 2, minimaleNachkommastellen(c / 2));
    const FKRx0 = runde(halbKR * x0 * x0 * -1 + a * x0, minimaleNachkommastellen(halbKR * x0 * x0 * -1 + a * x0));
    const FPRx0 = runde(halbPR * x0 * x0, minimaleNachkommastellen(halbPR * x0 * x0));

    return {
      frage: {
        text: `Für eine Marktsituation gelten die Nachfragefunktion pₙ(x) = ${polynomProse([a, -b], [0, 1])} und ` +
          `die Angebotsfunktion pₐ(x) = ${polynomProse([c], [1])}. ` +
          `Bestimmen Sie Gleichgewichtspreis und -menge sowie Konsumenten- und Produzentenrente.`,
      },
      eingaben: [
        { id: 'x0', label: 'Gleichgewichtsmenge x₀', typ: 'zahl', punkte: 1, loesung: x0, toleranz: KONFIG.toleranz.exakt },
        { id: 'p0', label: 'Gleichgewichtspreis p₀', typ: 'zahl', punkte: 1, loesung: p0, toleranz: KONFIG.toleranz.geld },
        { id: 'KR', label: 'Konsumentenrente KR', typ: 'zahl', punkte: 2, loesung: KR, toleranz: KONFIG.toleranz.geld },
        { id: 'PR', label: 'Produzentenrente PR', typ: 'zahl', punkte: 1, loesung: PR, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: `p_N(x) = p_A(x)`, hinweis: 'Im Marktgleichgewicht sind Nachfrage- und Angebotspreis gleich.' },
          {
            titel: 'Umstellen',
            latex: gleichungsKette([
              `${zahlZuLatex(a, minimaleNachkommastellen(a))} - ${cdotWennNicht1(b, 'x')} = ${cdotWennNicht1(c, 'x')}`,
              `${zahlZuLatex(a, minimaleNachkommastellen(a))} = ${cdotWennNicht1(bc, 'x')}`,
              `x_0 = ${bruch(zahlZuLatex(a, minimaleNachkommastellen(a)), zahlZuLatex(bc, minimaleNachkommastellen(bc)))} = ${zahlZuLatex(x0, 0)}`,
            ]),
            hinweis: 'bx auf die rechte Seite bringen, dann durch den kombinierten Koeffizienten teilen.',
          },
          { titel: 'Ergebnis', latex: `x_0 = ${zahlZuLatex(x0, 0)}, \\quad p_0 = ${cdotWennNicht1(c, zahlZuLatex(x0, 0))} = ${zahlZuLatex(p0, minimaleNachkommastellen(p0))}` },
          {
            titel: 'Formel',
            latex: mehrzeiligeKette([
              `KR = \\int_0^{x_0} p_N(x)\\,dx - x_0 \\cdot p_0`,
              `PR = x_0 \\cdot p_0 - \\int_0^{x_0} p_A(x)\\,dx`,
            ]),
            hinweis: 'Konsumentenrente: Fläche unter der Nachfragefunktion bis zum Gleichgewichtspreis. Produzentenrente: Fläche über der Angebotsfunktion.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('KR', [
              `\\int_0^{${zahlZuLatex(x0, 0)}} (${polynomLatex([-b, a], [1, 0])})\\,dx - ${zahlZuLatex(x0, 0)} \\cdot ${zahlZuLatex(p0, minimaleNachkommastellen(p0))}`,
              `${polynomLatex([-halbKR, a], [2, 1])}\\Big|_0^{${zahlZuLatex(x0, 0)}} - ${zahlZuLatex(x0p0, minimaleNachkommastellen(x0p0))}`,
              `${zahlZuLatex(FKRx0, minimaleNachkommastellen(FKRx0))} - ${zahlZuLatex(x0p0, minimaleNachkommastellen(x0p0))}`,
              zahlZuLatex(KR, 2),
            ]),
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('PR', [
              `${zahlZuLatex(x0, 0)} \\cdot ${zahlZuLatex(p0, minimaleNachkommastellen(p0))} - \\int_0^{${zahlZuLatex(x0, 0)}} ${cdotWennNicht1(c, 'x')}\\,dx`,
              `${zahlZuLatex(x0p0, minimaleNachkommastellen(x0p0))} - ${polynomLatex([halbPR], [2])}\\Big|_0^{${zahlZuLatex(x0, 0)}}`,
              `${zahlZuLatex(x0p0, minimaleNachkommastellen(x0p0))} - ${zahlZuLatex(FPRx0, minimaleNachkommastellen(FPRx0))}`,
              zahlZuLatex(PR, 2),
            ]),
          },
        ],
        ergebnisse: [
          { label: 'Gleichgewicht', latex: `x_0=${zahlZuLatex(x0, 0)},\\ p_0=${zahlZuLatex(p0, minimaleNachkommastellen(p0))}` },
          { label: 'Konsumentenrente KR', latex: zahlZuLatex(KR, 2) },
          { label: 'Produzentenrente PR', latex: zahlZuLatex(PR, 2) },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// int.kosten-aus-grenzkosten — Folien 153/154
// K'(x) = mx + n (Grenzkosten), Fixkosten K_f gegeben. K(x) = (m/2)x² + nx +
// K_f — die Integrationskonstante entspricht den Fixkosten und ist ohne deren
// bekannten Wert nicht bestimmbar. Optional: Rückfrage K(x0) mit ganzem
// Ergebnis (x0 gerade gewählt, wenn m ungerade ist).
// ---------------------------------------------------------------------------
export const integralKostenAusGrenzkosten = {
  id: 'int.kosten-aus-grenzkosten',
  teil: 'integral',
  name: 'Kostenfunktion aus der Grenzkostenfunktion',
  punkte: 3,
  vorlage: 'Folien 153/154',
  waehleParameter(rng) {
    let m = zufallInt(rng, -8, 8);
    if (m === 0) m = 2;
    const n = zufallInt(rng, -10, 10);
    const Kf = zufallInt(rng, 2, 30) * 10;
    const mUngerade = Math.abs(m % 2) === 1;
    let x0 = zufallInt(rng, 1, 10);
    if (mUngerade && x0 % 2 !== 0) x0 += 1;
    return { m, n, Kf, x0 };
  },
  baue(params) {
    const { m, n, Kf, x0 } = params;
    const mHalb = m / 2;
    const Kx0 = runde(mHalb * x0 * x0 + n * x0 + Kf, 2);

    return {
      frage: {
        text: `Die Grenzkostenfunktion eines Betriebs lautet K'(x) = ${polynomProse([m, n], [1, 0])}. ` +
          `Die Fixkosten betragen ${formatDeZahl(Kf, 0)}. ` +
          `a) Bestimmen Sie die Kostenfunktion K(x). b) Berechnen Sie K(${x0}).`,
      },
      eingaben: [
        {
          id: 'K', label: 'Kostenfunktion K(x)', typ: 'koeffizienten', punkte: 2,
          exponenten: [2, 1, 0], loesung: [mHalb, n, Kf], toleranz: KONFIG.toleranz.exakt,
        },
        { id: 'Kx0', label: `K(${x0})`, typ: 'zahl', punkte: 1, loesung: Kx0, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `K(x) = \\int K'(x)\\,dx`,
            hinweis: 'Die Integrationskonstante entspricht den Fixkosten — ohne deren bekannten Wert ist K(x) aus K\'(x) allein nicht bestimmbar.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('K(x)', [
              `\\int (${polynomLatex([m, n], [1, 0])})\\,dx`,
              `${polynomLatex([mHalb, n], [2, 1])} + C`,
            ]),
          },
          {
            titel: 'Ergebnis',
            latex: `K(x) = ${polynomLatex([mHalb, n, Kf], [2, 1, 0])}`,
            hinweis: `Die Integrationskonstante C entspricht den gegebenen Fixkosten, ${formatDeZahl(Kf, 0)}.`,
          },
          {
            titel: 'Einsetzen',
            latex: `K(${zahlZuLatex(x0, 0)}) = ${polynomLatex([mHalb, n, Kf], [2, 1, 0])}\\Big|_{x=${zahlZuLatex(x0, 0)}} = ${zahlZuLatex(Kx0, 2)}`,
          },
        ],
        ergebnisse: [
          { label: 'Kostenfunktion', latex: `K(x) = ${polynomLatex([mHalb, n, Kf], [2, 1, 0])}` },
          { label: `K(${x0})`, latex: zahlZuLatex(Kx0, 2) },
        ],
      },
      params,
    };
  },
};

export const INTEGRAL_GENERATOREN = [
  integralUnbestimmt,
  integralBestimmt,
  integralKonsumentenrente,
  integralKostenAusGrenzkosten,
];
