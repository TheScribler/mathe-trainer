// Lineare Algebra — 2 Generatoren, 12 Punkte zusammen. Jeder Generator
// konstruiert rückwärts: erst die saubere Lösung, dann die Parameter (siehe
// PLAN.md, Katalog "4 Lineare Algebra").

import { zufallAus, zufallBool } from '../rng.js';
import { zahlZuLatex, matrixLatex, mehrzeiligeGleichung, mehrzeiligeKette } from '../latex.js';
import { KONFIG } from '../konfig.js';

// ---------------------------------------------------------------------------
// Gemeinsame Hilfsfunktionen: Matrizen erzeugen/multiplizieren, Prosa-/LaTeX-
// Anzeige. Eigene, kleine Kopien statt eines Imports aus einem anderen
// Generator-Modul — dieselbe Begründung wie überall sonst in diesem Projekt
// (echte Modul-Grenzen unter Node, keine stille Kopplung).
// ---------------------------------------------------------------------------

function zufallsMatrix(rng, zeilen, spalten, pool) {
  const m = [];
  for (let i = 0; i < zeilen; i++) {
    const zeile = [];
    for (let j = 0; j < spalten; j++) zeile.push(zufallAus(rng, pool));
    m.push(zeile);
  }
  return m;
}

// Anteil der Nullen über mehrere Matrizen hinweg (Katalog: "mindestens ein
// Drittel Nullen, wie in der Klausur").
function nullAnteil(matrizen) {
  let gesamt = 0;
  let nullen = 0;
  for (const m of matrizen) {
    for (const zeile of m) {
      for (const w of zeile) {
        gesamt += 1;
        if (w === 0) nullen += 1;
      }
    }
  }
  return nullen / gesamt;
}

// a: p×q, b: q×r -> p×r. Einfache Dreifachschleife — bewusst nicht
// "elegant", damit der unabhängige Test in test/alle.mjs eine WIRKLICH
// andere Implementierung danebenstellen kann (siehe PLAN.md Testkonzept).
function matrixMal(a, b) {
  const p = a.length;
  const q = a[0].length;
  const r = b[0].length;
  const ergebnis = [];
  for (let i = 0; i < p; i++) {
    const zeile = [];
    for (let k = 0; k < r; k++) {
      let summe = 0;
      for (let j = 0; j < q; j++) summe += a[i][j] * b[j][k];
      zeile.push(summe);
    }
    ergebnis.push(zeile);
  }
  return ergebnis;
}

function skalarprodukt(a, b) {
  return a.reduce((summe, w, i) => summe + w * b[i], 0);
}

// Einen Faktor in einem Skalarprodukt klammern, wenn er negativ ist — sonst
// entstehen zwei Vorzeichen direkt hintereinander ("+ -2" statt "+ (-2)").
function faktorLatex(w) {
  return w < 0 ? `(${zahlZuLatex(w, 0)})` : zahlZuLatex(w, 0);
}

// "a_1 \cdot b_1 + a_2 \cdot b_2 + ..." mit echten Zahlen — ein einzelner
// Summand eines Matrixprodukt-Eintrags. "\cdot" ist hier eine reine
// Zahl-mal-Zahl-Multiplikation, keine "Koeffizient mal Variable" — die
// Koeffizient-1-Weglassregel (KOEFFIZIENT_EINS in test/alle.mjs) kennt diesen
// Unterschied (lässt "1 \cdot <Zahl>" zu, flaggt nur "1 \cdot <Variable/
// Funktion>"), eine "1" als echter Matrixeintrag darf also stehen bleiben.
function skalarproduktLatex(a, b) {
  return a.map((w, i) => `${faktorLatex(w)} \\cdot ${faktorLatex(b[i])}`).join(' + ');
}

// Zeigt JEDEN Eintrag des Produkts a·b als eigene Zeile "c_{ij} = ... = Wert"
// (Katalog-Vorgabe: mindestens einen Eintrag vorrechnen — hier alle, damit
// nichts stillschweigend übersprungen wird).
function alleEintraegeLatex(a, b, ergebnis) {
  const zeilen = [];
  for (let i = 0; i < a.length; i++) {
    const spalte = b[0].length;
    for (let k = 0; k < spalte; k++) {
      const spaltenwerte = b.map((zeile) => zeile[k]);
      zeilen.push(`c_{${i + 1}${k + 1}} &= ${skalarproduktLatex(a[i], spaltenwerte)} = ${zahlZuLatex(ergebnis[i][k], 0)}`);
    }
  }
  return mehrzeiligeKette(zeilen);
}

const EINTRAG_POOL = [-3, -2, -1, 0, 0, 0, 1, 2, 3, 4];

// ---------------------------------------------------------------------------
// alg.matrixprodukt — MK 7 / Übung 22
// a) Zeilenvektor (1×2 oder 1×3) mal quadratische Matrix — mit 15 %
//    Wahrscheinlichkeit stattdessen ein nicht definiertes Produkt (Übung 22d).
// b) 3×3 mal 3×3, immer definiert (MK 7b).
// Rückwärts: Einträge aus EINTRAG_POOL (mind. 1/3 Nullen), Ergebniseinträge
// |·| ≤ 99 ("damit es im Kopf geht").
// ---------------------------------------------------------------------------
export const matrixprodukt = {
  id: 'alg.matrixprodukt',
  teil: 'algebra',
  name: 'Matrizenprodukte berechnen',
  punkte: 4,
  vorlage: 'Musterklausur 7 / Übung 22',
  waehleParameter(rng) {
    const aUndefiniert = zufallBool(rng, 0.15);
    let teilA;
    if (aUndefiniert) {
      // p×q mal r×s mit q garantiert ungleich r — kein Reject-Sampling nötig.
      const p = zufallAus(rng, [1, 2, 3]);
      const q = zufallAus(rng, [2, 3]);
      const r = q === 2 ? 3 : 2;
      const s = zufallAus(rng, [1, 2, 3]);
      const C = zufallsMatrix(rng, p, q, EINTRAG_POOL);
      const D = zufallsMatrix(rng, r, s, EINTRAG_POOL);
      teilA = { art: 'undefiniert', C, D };
    } else {
      teilA = null;
      for (let versuch = 0; versuch < 100; versuch++) {
        const n = zufallAus(rng, [2, 3]);
        const v = zufallsMatrix(rng, 1, n, EINTRAG_POOL)[0];
        const M = zufallsMatrix(rng, n, n, EINTRAG_POOL);
        const ergebnis = matrixMal([v], M)[0];
        if (ergebnis.some((w) => Math.abs(w) > 99)) continue;
        if (nullAnteil([[v], M]) < 1 / 3) continue;
        teilA = { art: 'definiert', v, M, ergebnis };
        break;
      }
      if (!teilA) teilA = { art: 'definiert', v: [3, 2], M: [[1, 2], [2, -2]], ergebnis: [7, 2] }; // Rückfall: MK7a
    }

    let teilB = null;
    for (let versuch = 0; versuch < 100; versuch++) {
      const X = zufallsMatrix(rng, 3, 3, EINTRAG_POOL);
      const Y = zufallsMatrix(rng, 3, 3, EINTRAG_POOL);
      const ergebnis = matrixMal(X, Y);
      if (ergebnis.some((zeile) => zeile.some((w) => Math.abs(w) > 99))) continue;
      if (nullAnteil([X, Y]) < 1 / 3) continue;
      teilB = { X, Y, ergebnis };
      break;
    }
    if (!teilB) {
      teilB = {
        X: [[1, 0, 1], [2, 0, 1], [0, 2, 1]], Y: [[4, 1, 1], [2, 2, 0], [0, 0, 3]],
        ergebnis: [[4, 1, 4], [8, 2, 5], [4, 4, 3]],
      }; // Rückfall: MK7b
    }

    return { teilA, teilB };
  },
  baue(params) {
    const { teilA, teilB } = params;

    const eingaben = [];
    const schritteA = [];
    let formelA;

    if (teilA.art === 'definiert') {
      const { v, M, ergebnis } = teilA;
      const n = v.length;
      formelA = `\\text{a)}\\quad ${matrixLatex([v])} \\cdot ${matrixLatex(M)}`;
      eingaben.push({
        id: 'a', label: `a) Ergebnis (1×${n})`, typ: 'matrix', zeilen: 1, spalten: n,
        punkte: 2, loesung: [ergebnis], toleranz: KONFIG.toleranz.exakt,
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `\\text{a) } (1\\times ${n}) \\cdot (${n}\\times ${n}) = (1\\times ${n})`,
          hinweis: 'Das Produkt hat so viele Zeilen wie der erste und so viele Spalten wie der zweite Faktor — die innere Dimension (hier beide Male ' + n + ') muss übereinstimmen.',
        },
        {
          titel: 'Einsetzen',
          latex: alleEintraegeLatex([v], M, [ergebnis]),
          hinweis: 'Jeder Eintrag ist die Zeile des ersten Faktors mal die jeweilige Spalte des zweiten.',
        },
        {
          titel: 'Ergebnis',
          latex: mehrzeiligeKette([`${matrixLatex([v])} \\cdot ${matrixLatex(M)}`, `= ${matrixLatex([ergebnis])}`]),
        },
      );
    } else {
      const { C, D } = teilA;
      const p = C.length; const q = C[0].length; const r = D.length; const s = D[0].length;
      formelA = `\\text{a)}\\quad ${matrixLatex(C)} \\cdot ${matrixLatex(D)}`;
      eingaben.push({
        id: 'a', label: 'a) Ist das Produkt definiert?', typ: 'auswahl',
        optionen: ['Definiert', 'Nicht definiert'], punkte: 2, loesung: 'Nicht definiert',
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `\\text{a) } (${p}\\times ${q}) \\cdot (${r}\\times ${s})`,
          hinweis: 'Für ein Produkt muss die Spaltenzahl des ersten Faktors gleich der Zeilenzahl des zweiten sein.',
        },
        {
          // Die Begründung ist ein langer, erklärender Satz — als reiner
          // Hinweis (Fließtext) bricht er normal um, statt als eine einzige,
          // zu breite KaTeX-Zeile über den Bildschirmrand zu laufen.
          titel: 'Ergebnis',
          latex: `\\text{nicht definiert}`,
          hinweis: `Nicht definiert, da ${q} ≠ ${r} (Spaltenzahl des ersten Faktors ≠ Zeilenzahl des zweiten Faktors).`,
        },
      );
    }

    const { X, Y, ergebnis: ergebnisB } = teilB;
    eingaben.push({
      id: 'b', label: 'b) Ergebnis (3×3)', typ: 'matrix', zeilen: 3, spalten: 3,
      punkte: 2, loesung: ergebnisB, toleranz: KONFIG.toleranz.exakt,
    });
    const formelB = `\\text{b)}\\quad ${matrixLatex(X)} \\cdot ${matrixLatex(Y)}`;

    return {
      frage: {
        text: 'Berechnen Sie die folgenden Matrizenprodukte, soweit definiert.',
        formel: mehrzeiligeKette([formelA, formelB]),
      },
      eingaben,
      loesung: {
        schritte: [
          ...schritteA,
          {
            titel: 'Formel',
            latex: `\\text{b) } (3\\times 3) \\cdot (3\\times 3) = (3\\times 3)`,
          },
          {
            titel: 'Einsetzen',
            latex: alleEintraegeLatex(X, Y, ergebnisB),
            hinweis: 'Jeder Eintrag ist eine Zeile des ersten Faktors mal eine Spalte des zweiten.',
          },
          {
            titel: 'Ergebnis',
            latex: mehrzeiligeKette([`${matrixLatex(X)} \\cdot ${matrixLatex(Y)}`, `= ${matrixLatex(ergebnisB)}`]),
          },
        ],
        ergebnisse: [
          teilA.art === 'definiert'
            ? { label: 'Ergebnis a)', latex: matrixLatex([teilA.ergebnis]) }
            : { label: 'Ergebnis a)', latex: '\\text{nicht definiert}' },
          { label: 'Ergebnis b)', latex: matrixLatex(ergebnisB) },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// alg.produktionsprozess — MK 8 / Übung 24 (zweistufig)
// A (3×3, Rohstoffe -> Zwischenprodukte), B (3×2, Zwischenprodukte ->
// Endprodukte), E (2×1, herzustellende Endproduktmengen). Rückwärts: A, B
// nicht-negativ ganz wählen, E runde Stückzahlen, daraus den Rohstoffbedarf
// R = A·B·E (muss > 0 sein) und die Kosten P_R·R berechnen, dann P_E so
// wählen, dass der Gewinn positiv und höchstens vierstellig ist.
// ---------------------------------------------------------------------------
const NICHTNEGATIV_POOL = [0, 0, 1, 1, 2, 3];
const PREIS_POOL = [1, 2, 3, 4, 5];
const STUECKZAHL_POOL = [10, 12, 14, 16, 18, 20, 24, 28, 30, 36, 40, 50];

export const produktionsprozess = {
  id: 'alg.produktionsprozess',
  teil: 'algebra',
  name: 'Zweistufiger Produktionsprozess',
  punkte: 8,
  vorlage: 'Musterklausur 8 / Übung 24',
  waehleParameter(rng) {
    for (let versuch = 0; versuch < 300; versuch++) {
      const A = zufallsMatrix(rng, 3, 3, NICHTNEGATIV_POOL);
      const B = zufallsMatrix(rng, 3, 2, NICHTNEGATIV_POOL);
      const e1 = zufallAus(rng, STUECKZAHL_POOL);
      const e2 = zufallAus(rng, STUECKZAHL_POOL);
      const E = [[e1], [e2]];
      const AB = matrixMal(A, B);
      const R = matrixMal(AB, E);
      if (R.some((zeile) => zeile[0] <= 0)) continue; // Rohstoffmengen müssen positiv sein
      const PR = zufallsMatrix(rng, 1, 3, PREIS_POOL)[0];
      const kosten = skalarprodukt(PR, R.map((zeile) => zeile[0]));

      let PE = null;
      for (let preisVersuch = 0; preisVersuch < 50; preisVersuch++) {
        const kandidat = zufallsMatrix(rng, 1, 2, PREIS_POOL)[0];
        const erloes = kandidat[0] * e1 + kandidat[1] * e2;
        const gewinn = erloes - kosten;
        if (gewinn > 0 && gewinn <= 9999) { PE = kandidat; break; }
      }
      if (!PE) continue;

      return { A, B, E, PR, PE };
    }
    // Rückfall: Musterklausur 8 (nur Zahlen, kein Aufgabentext).
    return { A: [[1, 0, 2], [2, 1, 3], [3, 1, 2]], B: [[1, 2], [2, 1], [0, 3]], E: [[10], [12]], PR: [2, 3, 2], PE: [80, 90] };
  },
  baue(params) {
    const { A, B, E, PR, PE } = params;
    const AB = matrixMal(A, B); // Gesamtbedarfsmatrix
    const R = matrixMal(AB, E); // Rohstoffbedarf
    const kosten = skalarprodukt(PR, R.map((zeile) => zeile[0]));
    const erloes = skalarprodukt(PE, E.map((zeile) => zeile[0]));
    const gewinn = erloes - kosten;

    // Dimensionen aus den tatsächlichen Daten lesen statt fest auf 3/2
    // Rohstoffe/Zwischenprodukte anzunehmen — baue() rechnet mit jeder
    // kompatiblen Form korrekt (siehe die Übung-24-Fixtures mit nur zwei
    // Rohstoffen), nur waehleParameter liefert immer 3×3/3×2/2×1.
    const anzahlRohstoffe = A.length;
    const anzahlZwischenprodukte = A[0].length;
    const anzahlEndprodukte = B[0].length;

    return {
      frage: {
        text: `In einem zweistufigen Produktionsprozess werden aus ${anzahlRohstoffe} Rohstoffen über die Produktionskoeffizienten in A ` +
          `${anzahlZwischenprodukte} Zwischenprodukte und aus diesen über B ${anzahlEndprodukte} Endprodukte hergestellt, die in den Mengen E ` +
          `hergestellt werden sollen. a) Wie viele Einheiten der ${anzahlRohstoffe} Rohstoffe werden dafür benötigt? ` +
          `b) Die Endprodukte kosten je Einheit PE, die Rohstoffe je Einheit PR. Wie hoch ist der Gewinn?`,
        formel: mehrzeiligeKette([
          `A = ${matrixLatex(A)}, \\quad B = ${matrixLatex(B)}, \\quad E = ${matrixLatex(E)}`,
          `P_E^T = ${matrixLatex([PE])}, \\quad P_R^T = ${matrixLatex([PR])}`,
        ]),
      },
      eingaben: [
        {
          id: 'R', label: `a) Rohstoffbedarf R (${anzahlRohstoffe}×1)`, typ: 'matrix', zeilen: anzahlRohstoffe, spalten: 1,
          punkte: 4, loesung: R, toleranz: KONFIG.toleranz.exakt,
        },
        { id: 'G', label: 'b) Gewinn G', typ: 'zahl', punkte: 4, loesung: gewinn, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `R = A \\cdot B \\cdot E`,
            hinweis: 'Erst A·B als Gesamtbedarfsmatrix bilden (wie viele Rohstoffe je Einheit jedes Endprodukts nötig sind), dann mit E multiplizieren — Reihenfolge wie in der Musterlösung.',
          },
          { titel: 'Einsetzen', latex: mehrzeiligeKette([`A \\cdot B = ${matrixLatex(A)} \\cdot ${matrixLatex(B)}`, `= ${matrixLatex(AB)}`]) },
          { titel: 'Einsetzen', latex: mehrzeiligeKette([`R = ${matrixLatex(AB)} \\cdot ${matrixLatex(E)}`, `= ${matrixLatex(R)}`]) },
          { titel: 'Ergebnis', latex: `R = ${matrixLatex(R)}` },
          {
            titel: 'Formel',
            latex: `G = P_E^T \\cdot E - P_R^T \\cdot R`,
            hinweis: 'Gewinn ist Erlös (Preise mal Endproduktmengen) minus Kosten (Rohstoffpreise mal benötigter Rohstoffmenge).',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('G', [
              `${matrixLatex([PE])} \\cdot ${matrixLatex(E)} - ${matrixLatex([PR])} \\cdot ${matrixLatex(R)}`,
              `${zahlZuLatex(erloes, 0)} - ${zahlZuLatex(kosten, 0)}`,
              zahlZuLatex(gewinn, 0),
            ]),
          },
        ],
        ergebnisse: [
          { label: 'Rohstoffbedarf', latex: `R = ${matrixLatex(R)}` },
          { label: 'Gewinn', latex: zahlZuLatex(gewinn, 2) },
        ],
      },
      params,
    };
  },
};

export const ALGEBRA_GENERATOREN = [matrixprodukt, produktionsprozess];
