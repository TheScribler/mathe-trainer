// test/fixtures.mjs — ruft baue(params) mit den Originalzahlen aus der
// Musterklausur bzw. den WS22-Übungen auf und vergleicht gegen das bekannte
// Ergebnis. Nur Zahlen, kein Aufgabentext aus den PDFs (siehe CLAUDE.md
// Abschnitt 2). Exportiert testeFixtures(), das die Fehlerzahl zurückgibt.

import { nahBei } from '../src/zahl.js';
import {
  renteAusKapital,
  renteVeraenderlich,
  verdopplungszeit,
  effektivzins,
} from '../src/generatoren/finanz.js';
import {
  gewinnBreakeven,
  extremwerteZweiVariablenKubisch,
  extremwerteZweiVariablenQuadratisch,
  nutzenmaximum,
  ableitungen,
} from '../src/generatoren/diff.js';
import {
  integralUnbestimmt,
  integralBestimmt,
  integralKonsumentenrente,
} from '../src/generatoren/integral.js';
import { matrixprodukt, produktionsprozess } from '../src/generatoren/algebra.js';

export function testeFixtures() {
  let fehler = 0;
  const faelle = [];

  function pruefe(bedingung, beschreibung) {
    if (!bedingung) {
      fehler += 1;
      console.error('FIXTURE-FEHLER:', beschreibung);
    }
  }

  // Musterklausur 1 I: R0=100.000, i=2 %, n=15 Jahre -> r=7.782,55 €
  // (identisch mit Übung 5c laut Mathematik Musterklausur.md).
  {
    const a = renteAusKapital.baue({ R0: 100000, iProzent: 2, n: 15, name: 'Platzhalter', vorlageIndex: 0 });
    const r = a.eingaben[0].loesung;
    pruefe(nahBei(r, 7782.55, 0.01), `MK1 I: r=${r}, erwartet 7782.55`);
    faelle.push('MK1 I');
  }

  // Musterklausur 1 II: Zahlungen 50/55/60/65 bei i=10 % -> R0=180,38.
  {
    const a = renteVeraenderlich.baue({ n: 4, r1: 50, d: 5, iProzent: 10, vorlageIndex: 0 });
    const R0 = a.eingaben[0].loesung;
    pruefe(nahBei(R0, 180.38, 0.01), `MK1 II: R0=${R0}, erwartet 180.38`);
    faelle.push('MK1 II');
  }

  // Musterklausur 2a: Verdopplung bei i=4 % -> t=17,67 Jahre.
  {
    const a = verdopplungszeit.baue({ variante: 'A', iProzent: 4, faktor: 2 });
    const n = a.eingaben[0].loesung;
    pruefe(nahBei(n, 17.67, 0.01), `MK2a: n=${n}, erwartet 17.67`);
    faelle.push('MK2a');
  }

  // Musterklausur 2b: i_nom=3 %, m=12 (monatlich) -> i_eff=0,0304=3,04 %
  // (Vorlesungsregel: Zinssätze als Dezimalzahl auf 4 Nachkommastellen,
  // exakter Wert vor der Rundung 0,030416 = 3,0416 %).
  {
    const a = effektivzins.baue({ richtung: 'vorwaerts', m: 12, iNomProzent: 3 });
    const iEffAntwort = a.eingaben[0].loesung;
    pruefe(
      nahBei(iEffAntwort, 3.04, 1e-9),
      `MK2b: Antwort i_eff=${iEffAntwort}, erwartet 3.04 (gerundet laut Vorlesungsregel)`
    );
    const iEffExakt = (Math.pow(1 + 0.03 / 12, 12) - 1) * 100;
    pruefe(nahBei(iEffExakt, 3.0416, 0.0001), `MK2b: exakter Wert ${iEffExakt}, erwartet ≈3,0416`);
    faelle.push('MK2b');
  }

  // Übung 1d (WS22): K0=1.500 €, i=4 %, Kn=2.921,85 € -> n=17 Jahre.
  {
    const a = verdopplungszeit.baue({ variante: 'B', iProzent: 4, n: 17, K0: 1500 });
    const n = a.eingaben[0].loesung;
    const Kn = a.params.Kn;
    pruefe(n === 17, `Übung 1d: n=${n}, erwartet 17`);
    pruefe(nahBei(Kn, 2921.85, 0.01), `Übung 1d: Kn=${Kn}, erwartet 2921.85`);
    faelle.push('Übung 1d');
  }

  // MK 3: p(x)=25-2x, K(x)=0,4x²-11x+120 -> E=25x-2x², G=-2,4x²+36x-120,
  // K'(50)=29, x1=5, x2=10, xmax=7,5, pmax=10, gmax=15.
  {
    const a = gewinnBreakeven.baue({ x1: 5, x2: 10, b: 2, c: 0.4, a: 25, x0: 50, vorlageIndex: 0 });
    const werte = Object.fromEntries(a.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(JSON.stringify(werte.E) === JSON.stringify([-2, 25, 0]), `MK3: E=${JSON.stringify(werte.E)}, erwartet [-2,25,0]`);
    pruefe(JSON.stringify(werte.G) === JSON.stringify([-2.4, 36, -120]), `MK3: G=${JSON.stringify(werte.G)}, erwartet [-2.4,36,-120]`);
    pruefe(nahBei(werte.Kstrich, 29, 1e-9), `MK3: K'(50)=${werte.Kstrich}, erwartet 29`);
    pruefe(werte.x1 === 5 && werte.x2 === 10, `MK3: x1=${werte.x1}, x2=${werte.x2}, erwartet 5 und 10`);
    pruefe(nahBei(werte.xmax, 7.5, 1e-9), `MK3: xmax=${werte.xmax}, erwartet 7,5`);
    pruefe(nahBei(werte.pmax, 10, 1e-9), `MK3: pmax=${werte.pmax}, erwartet 10`);
    pruefe(nahBei(werte.gmax, 15, 1e-9), `MK3: gmax=${werte.gmax}, erwartet 15`);
    faelle.push('MK3');
  }

  // MK 4: f(x,y)=x³+4xy-x²-y² -> Sattelpunkt (0|0|0), Maximum (-2|-4|4).
  {
    const a = extremwerteZweiVariablenKubisch.baue({ a: 4, b: -1, c: -1, x2: -2, y2: -4 });
    const werte = Object.fromEntries(a.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(werte.p1x === 0 && werte.p1y === 0 && werte.p1typ === 'Sattelpunkt' && werte.p1wert === 0,
      `MK4 Punkt 1: ${JSON.stringify(werte)}, erwartet (0,0,Sattelpunkt,0)`);
    pruefe(werte.p2x === -2 && werte.p2y === -4 && werte.p2typ === 'Maximum' && nahBei(werte.p2wert, 4, 1e-9),
      `MK4 Punkt 2: (${werte.p2x},${werte.p2y},${werte.p2typ},${werte.p2wert}), erwartet (-2,-4,Maximum,4)`);
    faelle.push('MK4');
  }

  // MK 5: U=8x1+4x2+2x1x2+8, Y=60, P1=2, P2=4 -> (x1;x2)=(18;6), λ=-10.
  {
    const a = nutzenmaximum.baue({ x1Stern: 18, x2Stern: 6, P1: 2, P2: 4, gamma: 2, alpha: 8, beta: 4, delta: 8 });
    const werte = Object.fromEntries(a.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(werte.x1 === 18 && werte.x2 === 6, `MK5: (x1;x2)=(${werte.x1};${werte.x2}), erwartet (18;6)`);
    const lambdaZeile = a.loesung.ergebnisse.find((e) => e.label === 'Lagrange-Multiplikator');
    pruefe(lambdaZeile.latex.includes('-10'), `MK5: λ-Zeile "${lambdaZeile.latex}", erwartet -10`);
    faelle.push('MK5');
  }

  // MK 6a: f(x)=-3x²+1/x -> f'(x)=-6x-1/x² (Zahlencheck bei x=2: -6*2-1/4=-12,25).
  // MK 6b: f(x)=(x-1)√(x²-1) -> f'(x)=√(x²-1)+(x-1)x/√(x²-1) (bei x=3: 4,9497).
  {
    const a = ableitungen.baue({ a: -3, x0a: 2, b: 1, c: 1, x0b: 3 });
    const werte = Object.fromEntries(a.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(nahBei(werte.a_check, -12.25, 1e-9), `MK6a: f'(2)=${werte.a_check}, erwartet -12,25`);
    // 0,01 statt einer engen Toleranz: f'(3) wird wie jedes Klausur-Ergebnis
    // auf 2 Nachkommastellen gerundet (CLAUDE.md Abschnitt 6), der exakte
    // Wert 4,9497 ist also nicht mehr das, was baue() liefert (4,95).
    pruefe(nahBei(werte.b_check, Math.sqrt(8) + 2 * 3 / Math.sqrt(8), 0.01), `MK6b: f'(3)=${werte.b_check}, erwartet ≈4,95`);
    const faStrich = a.loesung.ergebnisse.find((e) => e.label === "a) f'(x)");
    pruefe(faStrich.latex.includes('6x') && faStrich.latex.includes('x^2'), `MK6a: f'(x)-Term "${faStrich.latex}" unerwartet`);
    faelle.push('MK6');
  }

  // Übung 13c (identisch mit MK3, andere Reihenfolge der WS22-Nummerierung):
  // p(x)=25-2x, K(x)=0,4x²-11x+120 -> Break-Even 5, Gewinngrenze 10, Gmax=15 bei x=7,5.
  {
    const a = gewinnBreakeven.baue({ x1: 5, x2: 10, b: 2, c: 0.4, a: 25, x0: 7.5, vorlageIndex: 0 });
    const werte = Object.fromEntries(a.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(werte.x1 === 5 && werte.x2 === 10 && nahBei(werte.gmax, 15, 1e-9),
      `Übung 13c: x1=${werte.x1}, x2=${werte.x2}, gmax=${werte.gmax}, erwartet 5, 10, 15`);
    faelle.push('Übung 13c');
  }

  // Übung 15a: f=-x²+24x-2y²+40y-2xy-3 -> Maximum (4|8).
  // Übung 15b: f=2x²-24x+2y²-18y+2xy+3 -> Minimum (5|2).
  // Übung 15c: f=2x²-10x-2y²+2xy-2 -> Sattelpunkt (2|1).
  {
    const a15a = extremwerteZweiVariablenQuadratisch.baue({ A: -1, B: 24, C: -2, D: 40, E: -2, F: -3, xStern: 4, yStern: 8 });
    const w15a = Object.fromEntries(a15a.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(w15a.x === 4 && w15a.y === 8 && w15a.typ === 'Maximum', `Übung 15a: ${JSON.stringify(w15a)}, erwartet (4,8,Maximum)`);

    const a15b = extremwerteZweiVariablenQuadratisch.baue({ A: 2, B: -24, C: 2, D: -18, E: 2, F: 3, xStern: 5, yStern: 2 });
    const w15b = Object.fromEntries(a15b.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(w15b.x === 5 && w15b.y === 2 && w15b.typ === 'Minimum', `Übung 15b: ${JSON.stringify(w15b)}, erwartet (5,2,Minimum)`);

    const a15c = extremwerteZweiVariablenQuadratisch.baue({ A: 2, B: -10, C: -2, D: 0, E: 2, F: -2, xStern: 2, yStern: 1 });
    const w15c = Object.fromEntries(a15c.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(w15c.x === 2 && w15c.y === 1 && w15c.typ === 'Sattelpunkt', `Übung 15c: ${JSON.stringify(w15c)}, erwartet (2,1,Sattelpunkt)`);
    faelle.push('Übung 15a-c');
  }

  // Übung 16a: U=2x1+6x2+2x1x2+3, 2x1+4x2=70 -> (17;9).
  // Übung 16c: U=3x1+2x2+x1x2+6, 3x1+x2=501 -> (83;252).
  {
    const a16a = nutzenmaximum.baue({ x1Stern: 17, x2Stern: 9, P1: 2, P2: 4, gamma: 2, alpha: 2, beta: 6, delta: 3 });
    const w16a = Object.fromEntries(a16a.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(w16a.x1 === 17 && w16a.x2 === 9, `Übung 16a: (${w16a.x1};${w16a.x2}), erwartet (17;9)`);

    const a16c = nutzenmaximum.baue({ x1Stern: 83, x2Stern: 252, P1: 3, P2: 1, gamma: 1, alpha: 3, beta: 2, delta: 6 });
    const w16c = Object.fromEntries(a16c.eingaben.map((e) => [e.id, e.loesung]));
    pruefe(w16c.x1 === 83 && w16c.x2 === 252, `Übung 16c: (${w16c.x1};${w16c.x2}), erwartet (83;252)`);
    faelle.push('Übung 16a, 16c');
  }

  // Übung 18a: ∫2x²dx = ⅔x³ + c.
  // Übung 18b: ∫(4x³-3x²+2x-1)dx = x⁴-x³+x²-x + c.
  {
    const a18a = integralUnbestimmt.baue({ exponenten: [2], koeffizienten: [2] });
    const w18a = a18a.eingaben[0].loesung;
    pruefe(w18a.length === 1 && nahBei(w18a[0], 2 / 3, 1e-9), `Übung 18a: F-Koeffizient ${w18a}, erwartet 2/3`);

    const a18b = integralUnbestimmt.baue({ exponenten: [3, 2, 1, 0], koeffizienten: [4, -3, 2, -1] });
    const w18b = a18b.eingaben[0].loesung;
    const erw18b = [1, -1, 1, -1];
    pruefe(w18b.every((w, i) => nahBei(w, erw18b[i], 1e-9)), `Übung 18b: F-Koeffizienten ${w18b}, erwartet ${erw18b}`);
    faelle.push('Übung 18a/b');
  }

  // Übung 19a: ∫[0,1] ½x⁴dx = 1/10. 19b: ∫[-3,0] x³dx = -20,25.
  // 19c: ∫[1,3] (3x²-2x⁻³)dx = 25 1/9. 19d: ∫[1,2] (-64x⁻⁵-16x⁻³)dx = -21.
  {
    const a19a = integralBestimmt.baue({ termeF: [{ zaehler: 1, nenner: 10, exponent: 5 }], a: 0, b: 1 });
    const w19a = a19a.eingaben[0].loesung;
    pruefe(nahBei(w19a, 0.1, 1e-9), `Übung 19a: ${w19a}, erwartet 0,1`);

    const a19b = integralBestimmt.baue({ termeF: [{ zaehler: 1, nenner: 4, exponent: 4 }], a: -3, b: 0 });
    const w19b = a19b.eingaben[0].loesung;
    pruefe(nahBei(w19b, -20.25, 1e-9), `Übung 19b: ${w19b}, erwartet -20,25`);

    const a19c = integralBestimmt.baue({
      termeF: [{ zaehler: 1, nenner: 1, exponent: 3 }, { zaehler: 1, nenner: 1, exponent: -2 }], a: 1, b: 3,
    });
    const w19c = a19c.eingaben[0].loesung;
    // loesung ist auf 4 Nachkommastellen gerundet (siehe baue()), daher eine
    // gröbere Toleranz als bei den anderen (ganzzahligen) Übung-19-Fällen.
    // 0,01 statt einer engen Toleranz: das Ergebnis wird wie jedes Klausur-
    // Ergebnis auf 2 Nachkommastellen gerundet (CLAUDE.md Abschnitt 6, 25
    // 1/9 = 25,1111… wird zu 25,11), nicht mehr der exakte Bruchwert.
    pruefe(nahBei(w19c, 25 + 1 / 9, 0.01), `Übung 19c: ${w19c}, erwartet ≈25 1/9 (25,11)`);

    const a19d = integralBestimmt.baue({
      termeF: [{ zaehler: 16, nenner: 1, exponent: -4 }, { zaehler: 8, nenner: 1, exponent: -2 }], a: 1, b: 2,
    });
    const w19d = a19d.eingaben[0].loesung;
    pruefe(nahBei(w19d, -21, 1e-9), `Übung 19d: ${w19d}, erwartet -21`);
    faelle.push('Übung 19a-d');
  }

  // Übung 20a-e: je x0, p0, KR, PR (Folie 160).
  {
    const faelle20 = [
      { params: { x0: 4, b: 2, c: 3, a: 20, p0: 12 }, erwartet: { x0: 4, p0: 12, KR: 16, PR: 24 }, name: '20a' },
      { params: { x0: 8, b: 1, c: 5, a: 48, p0: 40 }, erwartet: { x0: 8, p0: 40, KR: 32, PR: 160 }, name: '20b' },
      { params: { x0: 20, b: 0.5, c: 0.1, a: 12, p0: 2 }, erwartet: { x0: 20, p0: 2, KR: 100, PR: 20 }, name: '20c' },
      { params: { x0: 15, b: 4, c: 0.2, a: 63, p0: 3 }, erwartet: { x0: 15, p0: 3, KR: 450, PR: 22.5 }, name: '20d' },
      { params: { x0: 10, b: 1.5, c: 0.5, a: 20, p0: 5 }, erwartet: { x0: 10, p0: 5, KR: 75, PR: 25 }, name: '20e' },
    ];
    for (const { params, erwartet, name } of faelle20) {
      const aufgabe = integralKonsumentenrente.baue(params);
      const werte = Object.fromEntries(aufgabe.eingaben.map((e) => [e.id, e.loesung]));
      for (const schluessel of ['x0', 'p0', 'KR', 'PR']) {
        pruefe(nahBei(werte[schluessel], erwartet[schluessel], 1e-6),
          `Übung ${name}: ${schluessel}=${werte[schluessel]}, erwartet ${erwartet[schluessel]}`);
      }
    }
    faelle.push('Übung 20a-e');
  }

  // MK 7a: (3 2)·((1,2)(2,-2)) = (7 2). MK 7b: 3×3-Produkt, Ergebnis
  // ((4,1,4)(8,2,5)(4,4,3)) — beide direkt aus der Musterlösung (nur Zahlen).
  {
    const teilA = { art: 'definiert', v: [3, 2], M: [[1, 2], [2, -2]], ergebnis: [7, 2] };
    const teilB = {
      X: [[1, 0, 1], [2, 0, 1], [0, 2, 1]], Y: [[4, 1, 1], [2, 2, 0], [0, 0, 3]],
      ergebnis: [[4, 1, 4], [8, 2, 5], [4, 4, 3]],
    };
    const a7 = matrixprodukt.baue({ teilA, teilB });
    const wA = a7.eingaben.find((e) => e.id === 'a').loesung;
    const wB = a7.eingaben.find((e) => e.id === 'b').loesung;
    pruefe(JSON.stringify(wA) === JSON.stringify([[7, 2]]), `MK7a: ${JSON.stringify(wA)}, erwartet [[7,2]]`);
    pruefe(JSON.stringify(wB) === JSON.stringify([[4, 1, 4], [8, 2, 5], [4, 4, 3]]), `MK7b: ${JSON.stringify(wB)}`);
    faelle.push('MK7a/b');
  }

  // MK 8: A=((1,0,2)(2,1,3)(3,1,2)), B=((1,2)(2,1)(0,3)), E=(10;12) ->
  // R=(106;208;206), PE=(80;90), PR=(2;3;2) -> G=632.
  {
    const a8 = produktionsprozess.baue({
      A: [[1, 0, 2], [2, 1, 3], [3, 1, 2]], B: [[1, 2], [2, 1], [0, 3]],
      E: [[10], [12]], PR: [2, 3, 2], PE: [80, 90],
    });
    const wR = a8.eingaben.find((e) => e.id === 'R').loesung;
    const wG = a8.eingaben.find((e) => e.id === 'G').loesung;
    pruefe(JSON.stringify(wR) === JSON.stringify([[106], [208], [206]]), `MK8a: R=${JSON.stringify(wR)}, erwartet [[106],[208],[206]]`);
    pruefe(nahBei(wG, 632, 1e-9), `MK8b: G=${wG}, erwartet 632`);
    faelle.push('MK8a/b');
  }

  // Übung 24a/b: zweistufiger Prozess mit Dezimal-Koeffizienten in A/B —
  // derselbe Rechenweg wie MK 8, nur mit anderen (teils nicht-ganzen) Zahlen,
  // reproduziert hier direkt als baue()-Aufruf (nur Zahlen, kein Aufgabentext).
  {
    const a24a = produktionsprozess.baue({
      A: [[0.2, 0.5, 0.1], [0.4, 0.3, 0.2]], B: [[0.5, 0.5], [1, 0], [0, 1]],
      E: [[30], [40]], PR: [1, 3], PE: [2, 2],
    });
    const wG24a = a24a.eingaben.find((e) => e.id === 'G').loesung;
    pruefe(nahBei(wG24a, 21, 1e-9), `Übung 24a: G=${wG24a}, erwartet 21`);

    const a24b = produktionsprozess.baue({
      A: [[3, 1, 2], [4, 2, 5]], B: [[2, 3], [2, 1], [1, 2]],
      E: [[30], [40]], PR: [1, 2], PE: [50, 60],
    });
    const wG24b = a24b.eingaben.find((e) => e.id === 'G').loesung;
    pruefe(nahBei(wG24b, 100, 1e-9), `Übung 24b: G=${wG24b}, erwartet 100`);
    faelle.push('Übung 24a/b');
  }

  console.log(`Fixtures: ${faelle.length} geprüft (${faelle.join(', ')})`);
  return fehler;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fehler = testeFixtures();
  process.exit(fehler > 0 ? 1 : 0);
}
