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
    pruefe(nahBei(werte.b_check, Math.sqrt(8) + 2 * 3 / Math.sqrt(8), 1e-4), `MK6b: f'(3)=${werte.b_check}, erwartet ≈4,9497`);
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

  console.log(`Fixtures: ${faelle.length} geprüft (${faelle.join(', ')})`);
  return fehler;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fehler = testeFixtures();
  process.exit(fehler > 0 ? 1 : 0);
}
