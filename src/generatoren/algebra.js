// Lineare Algebra — Generatoren für MK 7/8 (Matrizenprodukt, Produktions-
// prozess) sowie die Zusatzthemen alg.lgs (Übung 25) und alg.matrixrechnung
// (Übung 21), zusammen mit weiteren Übung-22/23-Varianten der beiden
// Klausur-Generatoren. Jeder Generator konstruiert rückwärts: erst die
// saubere Lösung, dann die Parameter (siehe PLAN.md, Katalog
// "4 Lineare Algebra").

import { zufallAus, zufallBool } from '../rng.js';
import { minimaleNachkommastellen } from '../zahl.js';
import { zahlZuLatex, matrixLatex, mehrzeiligeGleichung, mehrzeiligeKette, bruchGekuerzt } from '../latex.js';
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

// m×n -> n×m, Eintrag (i,j) wird zu (j,i).
function transponiere(m) {
  return m[0].map((_, j) => m.map((zeile) => zeile[j]));
}

// n×n-Einheitsmatrix (Einsen auf der Diagonale, sonst Nullen).
function einheitsmatrix(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
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
// nichts stillschweigend übersprungen wird). praefix austauschbar (z. B. "r"
// für einen Rohstoffbedarfsvektor statt der generischen "c"); bei genau einer
// Ergebnisspalte (Spaltenvektor) heißt der Index nur "_i" statt "_{i1}" —
// "r_1" liest sich natürlicher als "r_11".
function alleEintraegeLatex(a, b, ergebnis, praefix = 'c') {
  const zeilen = [];
  const spaltenzahl = b[0].length;
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < spaltenzahl; k++) {
      const spaltenwerte = b.map((zeile) => zeile[k]);
      const index = spaltenzahl === 1 ? `${i + 1}` : `${i + 1}${k + 1}`;
      zeilen.push(`${praefix}_{${index}} &= ${skalarproduktLatex(a[i], spaltenwerte)} = ${zahlZuLatex(ergebnis[i][k], 0)}`);
    }
  }
  return mehrzeiligeKette(zeilen);
}

// Matrix mit deutsch formatierten Einträgen (Komma statt Punkt bei
// Dezimalzahlen) — matrixLatex selbst formatiert nicht, reicht Werte 1:1
// durch (siehe latex.js); ohne das würde z. B. ein Produktionskoeffizient
// von 0,2 als "0.2" erscheinen.
function matrixLatexFormatiert(werte) {
  return matrixLatex(werte.map((zeile) => zeile.map((w) => zahlZuLatex(w, minimaleNachkommastellen(w)))));
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
  waehleParameter(rng, { erlaubeZusatzvarianten = true } = {}) {
    // Übung-22-Zusatzvarianten (Transponierte, Skalar, Einheitsmatrix) nur
    // außerhalb der Probeklausur bzw. wenn KONFIG.zusatzthemenInKlausur das
    // ausdrücklich erlaubt — sonst bleibt Teil a) unverändert bei
    // definiert/undefiniert (MK7a / Übung 22d).
    const zusatzVariante = erlaubeZusatzvarianten
      ? zufallAus(rng, [
        null, null, null, 'transponiert', 'skalar', 'einheitsmatrix',
        'aussenprodukt', 'skalarprodukt1x1', 'transponierte-regel',
      ])
      : null;
    let teilA;
    if (zusatzVariante === 'aussenprodukt' || zusatzVariante === 'skalarprodukt1x1') {
      // Übung 22 h)/i): D, F je 3×1-Spaltenvektoren. h) D·Fᵗ ist das
      // Außenprodukt (3×1)·(1×3) = 3×3, i) Dᵗ·F ist das Skalarprodukt als
      // 1×1-"Matrix" (1×3)·(3×1) — derselbe Aufbau wie in Übung 22, aber als
      // zwei getrennte Varianten (wie transponiert/skalar/einheitsmatrix
      // auch je für sich gezogen werden).
      for (let versuch = 0; versuch < 100; versuch++) {
        const D = zufallsMatrix(rng, 3, 1, EINTRAG_POOL).map((z) => z[0]);
        const F = zufallsMatrix(rng, 3, 1, EINTRAG_POOL).map((z) => z[0]);
        if (nullAnteil([D.map((w) => [w]), F.map((w) => [w])]) < 1 / 3) continue;
        if (zusatzVariante === 'aussenprodukt') {
          const ergebnis = D.map((d) => F.map((f) => d * f));
          if (ergebnis.some((zeile) => zeile.some((w) => Math.abs(w) > 99))) continue;
          teilA = { art: 'aussenprodukt', D, F, ergebnis };
        } else {
          const wert = skalarprodukt(D, F);
          if (Math.abs(wert) > 99) continue;
          teilA = { art: 'skalarprodukt1x1', D, F, ergebnis: [[wert]] };
        }
        break;
      }
      if (!teilA) teilA = { art: 'aussenprodukt', D: [1, 2, 3], F: [1, 0, -1], ergebnis: [[1, 0, -1], [2, 0, -2], [3, 0, -3]] }; // Rückfall
    } else if (zusatzVariante === 'transponierte-regel') {
      // Übung 22 k): AᵗC − (CᵗA)ᵗ = 0, weil (CᵗA)ᵗ = Aᵗ(Cᵗ)ᵗ = AᵗC gilt
      // ((A·B)ᵗ = Bᵗ·Aᵗ, hier mit B=C). A, C gleich groß (2×2), damit sowohl
      // AᵗC als auch CᵗA definiert sind.
      for (let versuch = 0; versuch < 100; versuch++) {
        const A = zufallsMatrix(rng, 2, 2, EINTRAG_POOL);
        const C = zufallsMatrix(rng, 2, 2, EINTRAG_POOL);
        if (nullAnteil([A, C]) < 1 / 4) continue;
        teilA = { art: 'transponierte-regel', A, C, ergebnis: [[0, 0], [0, 0]] };
        break;
      }
      if (!teilA) teilA = { art: 'transponierte-regel', A: [[1, 2], [3, 4]], C: [[0, 1], [1, 0]], ergebnis: [[0, 0], [0, 0]] }; // Rückfall
    } else if (zusatzVariante) {
      for (let versuch = 0; versuch < 100; versuch++) {
        const m = zufallAus(rng, [2, 3]);
        const n = zufallAus(rng, [2, 3]);
        const A = zufallsMatrix(rng, m, n, EINTRAG_POOL);
        if (nullAnteil([A]) < 1 / 3) continue;

        if (zusatzVariante === 'transponiert') {
          teilA = { art: 'transponiert', A, ergebnis: transponiere(A) };
        } else if (zusatzVariante === 'skalar') {
          const a = zufallAus(rng, [-3, -2, 2, 3]);
          const ergebnis = A.map((zeile) => zeile.map((w) => a * w));
          if (ergebnis.some((zeile) => zeile.some((w) => Math.abs(w) > 99))) continue;
          teilA = { art: 'skalar', A, a, ergebnis };
        } else {
          teilA = { art: 'einheitsmatrix', A, E: einheitsmatrix(n), ergebnis: A };
        }
        break;
      }
      if (!teilA) teilA = { art: 'transponiert', A: [[1, 2], [3, 4]], ergebnis: [[1, 3], [2, 4]] }; // Rückfall
    }
    if (zusatzVariante) {
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
        };
      }
      return { teilA, teilB };
    }

    const aUndefiniert = zufallBool(rng, 0.15);
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
    let formelZeilenA;
    let teilAText;
    let titel;

    if (teilA.art === 'definiert') {
      const { v, M, ergebnis } = teilA;
      const n = v.length;
      // Faktoren auf getrennte Zeilen statt nebeneinander — zwei 3×3-
      // Matrizen (oder sogar nur eine, falls Einträge zweistellig sind)
      // liefen bei 375px sonst gelegentlich ab (iPhone-Rückmeldung).
      formelZeilenA = [`${matrixLatexFormatiert([v])}`, `\\cdot ${matrixLatexFormatiert(M)}`];
      eingaben.push({
        id: 'a', label: `Ergebnis (1×${n})`, typ: 'matrix', zeilen: 1, spalten: n,
        punkte: 2, loesung: [ergebnis], toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
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
          latex: mehrzeiligeKette([`${matrixLatexFormatiert([v])}`, `\\cdot ${matrixLatexFormatiert(M)}`, `= ${matrixLatexFormatiert([ergebnis])}`]),
        },
      );
    } else if (teilA.art === 'transponiert') {
      const { A: Amat, ergebnis } = teilA;
      const m = Amat.length; const n = Amat[0].length;
      titel = 'Matrizenprodukt und Transponierte';
      teilAText = 'Bilden Sie die Transponierte von A.';
      formelZeilenA = [`A = ${matrixLatexFormatiert(Amat)}`];
      eingaben.push({
        id: 'a', label: `Ergebnis Aᵗ (${n}×${m})`, typ: 'matrix', zeilen: n, spalten: m,
        punkte: 2, loesung: ergebnis, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `A^T`,
          hinweis: 'Transponieren vertauscht Zeilen und Spalten: Eintrag (i,j) von A wird zum Eintrag (j,i) von Aᵗ.',
        },
        { titel: 'Einsetzen', latex: `A = ${matrixLatexFormatiert(Amat)}` },
        { titel: 'Ergebnis', latex: `A^T = ${matrixLatexFormatiert(ergebnis)}` },
      );
    } else if (teilA.art === 'skalar') {
      const { A: Amat, a, ergebnis } = teilA;
      const m = Amat.length; const n = Amat[0].length;
      const aProse = a < 0 ? `−${Math.abs(a)}` : String(a);
      titel = 'Matrizenprodukt mit Skalar';
      teilAText = `Multiplizieren Sie A mit ${aProse}.`;
      formelZeilenA = [`A = ${matrixLatexFormatiert(Amat)}`];
      eingaben.push({
        id: 'a', label: `Ergebnis ${aProse}·A (${m}×${n})`, typ: 'matrix', zeilen: m, spalten: n,
        punkte: 2, loesung: ergebnis, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `${zahlZuLatex(a, 0)} \\cdot A`,
          hinweis: 'Bei der Multiplikation mit einem Skalar wird jeder Eintrag der Matrix mit dem Skalar multipliziert.',
        },
        { titel: 'Einsetzen', latex: `A = ${matrixLatexFormatiert(Amat)}` },
        { titel: 'Ergebnis', latex: `${zahlZuLatex(a, 0)} \\cdot ${matrixLatexFormatiert(Amat)} = ${matrixLatexFormatiert(ergebnis)}` },
      );
    } else if (teilA.art === 'einheitsmatrix') {
      const { A: Amat, E, ergebnis } = teilA;
      const m = Amat.length; const n = Amat[0].length;
      titel = 'Matrizenprodukt mit Einheitsmatrix';
      teilAText = 'Multiplizieren Sie A mit der Einheitsmatrix E.';
      formelZeilenA = [`A = ${matrixLatexFormatiert(Amat)}`];
      eingaben.push({
        id: 'a', label: `Ergebnis A·E (${m}×${n})`, typ: 'matrix', zeilen: m, spalten: n,
        punkte: 2, loesung: ergebnis, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `A \\cdot E`,
          hinweis: 'Die Einheitsmatrix E hat Einsen auf der Diagonale und sonst Nullen — jede Multiplikation mit E lässt eine Matrix unverändert (A·E = A).',
        },
        { titel: 'Einsetzen', latex: `A \\cdot E = ${matrixLatexFormatiert(Amat)} \\cdot ${matrixLatexFormatiert(E)}` },
        {
          titel: 'Ergebnis',
          latex: `${matrixLatexFormatiert(Amat)} \\cdot ${matrixLatexFormatiert(E)} = ${matrixLatexFormatiert(ergebnis)}`,
          hinweis: 'Das Ergebnis ist wieder A, wie von A·E = A erwartet.',
        },
      );
    } else if (teilA.art === 'aussenprodukt') {
      const { D, F, ergebnis } = teilA;
      titel = 'Außenprodukt zweier Vektoren';
      teilAText = 'Bilden Sie das Außenprodukt D·Fᵗ.';
      formelZeilenA = [`D = ${matrixLatexFormatiert(D.map((w) => [w]))}`, `F^T = ${matrixLatexFormatiert([F])}`];
      eingaben.push({
        id: 'a', label: 'Ergebnis D·Fᵗ (3×3)', typ: 'matrix', zeilen: 3, spalten: 3,
        punkte: 2, loesung: ergebnis, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `D \\cdot F^T`,
          hinweis: 'Das Außenprodukt eines Spaltenvektors D (3×1) mit der Transponierten eines Spaltenvektors F (1×3) ist eine 3×3-Matrix: jeder Eintrag ist ein einzelnes Produkt aus einem Eintrag von D und einem Eintrag von F — anders als beim gewöhnlichen Skalarprodukt wird hier nichts aufsummiert.',
        },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette(
            D.flatMap((d, i) => F.map((f, j) => `c_{${i + 1}${j + 1}} = ${faktorLatex(d)} \\cdot ${faktorLatex(f)} = ${zahlZuLatex(d * f, 0)}`))
          ),
        },
        { titel: 'Ergebnis', latex: `D \\cdot F^T = ${matrixLatexFormatiert(ergebnis)}` },
      );
    } else if (teilA.art === 'skalarprodukt1x1') {
      const { D, F, ergebnis } = teilA;
      const wert = ergebnis[0][0];
      titel = 'Skalarprodukt als 1×1-Matrix';
      teilAText = 'Bilden Sie das Produkt Dᵗ·F.';
      formelZeilenA = [`D^T = ${matrixLatexFormatiert([D])}`, `F = ${matrixLatexFormatiert(F.map((w) => [w]))}`];
      eingaben.push({
        id: 'a', label: 'Ergebnis Dᵗ·F (1×1)', typ: 'matrix', zeilen: 1, spalten: 1,
        punkte: 2, loesung: ergebnis, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `D^T \\cdot F`,
          hinweis: 'Dᵗ ist ein Zeilenvektor (1×3), F ein Spaltenvektor (3×1) — das Produkt (1×3)·(3×1) ist eine 1×1-"Matrix", also ein einzelner Wert: das gewöhnliche Skalarprodukt von D und F.',
        },
        { titel: 'Einsetzen', latex: `D^T \\cdot F = ${skalarproduktLatex(D, F)} = ${zahlZuLatex(wert, 0)}` },
        { titel: 'Ergebnis', latex: `D^T \\cdot F = ${matrixLatexFormatiert(ergebnis)}` },
      );
    } else if (teilA.art === 'transponierte-regel') {
      const { A: Amat, C } = teilA;
      const AtC = matrixMal(transponiere(Amat), C);
      const CtA = matrixMal(transponiere(C), Amat);
      const CtAt = transponiere(CtA);
      titel = 'Transponierten-Regel beim Matrizenprodukt';
      teilAText = 'Zeigen Sie AᵗC − (CᵗA)ᵗ = 0.';
      formelZeilenA = [`A = ${matrixLatexFormatiert(Amat)}`, `C = ${matrixLatexFormatiert(C)}`];
      eingaben.push({
        id: 'a', label: 'Ergebnis AᵗC − (CᵗA)ᵗ (2×2)', typ: 'matrix', zeilen: 2, spalten: 2,
        punkte: 2, loesung: [[0, 0], [0, 0]], toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
      });
      schritteA.push(
        {
          titel: 'Formel',
          latex: `A^TC - (C^TA)^T`,
          hinweis: 'Aus (A·B)ᵗ = Bᵗ·Aᵗ folgt mit B=C: (CᵗA)ᵗ = Aᵗ(Cᵗ)ᵗ = AᵗC — die Differenz ist deshalb immer die Nullmatrix, unabhängig von den konkreten Werten in A und C.',
        },
        {
          titel: 'Einsetzen',
          latex: mehrzeiligeKette([
            `A^TC = ${matrixLatexFormatiert(AtC)}`,
            `C^TA = ${matrixLatexFormatiert(CtA)}`,
            `(C^TA)^T = ${matrixLatexFormatiert(CtAt)}`,
          ]),
        },
        {
          // Drei 2×2-Matrizen nebeneinander liefen bei 375px ab dem
          // Bildschirmrand (dasselbe Muster wie bei alg.matrixrechnung) —
          // jede auf eine eigene Zeile.
          titel: 'Ergebnis',
          latex: mehrzeiligeKette([
            `A^TC - (C^TA)^T`,
            `= ${matrixLatexFormatiert(AtC)} - ${matrixLatexFormatiert(CtAt)}`,
            `= ${matrixLatexFormatiert([[0, 0], [0, 0]])}`,
          ]),
        },
      );
    } else {
      const { C, D } = teilA;
      const p = C.length; const q = C[0].length; const r = D.length; const s = D[0].length;
      formelZeilenA = [`${matrixLatexFormatiert(C)}`, `\\cdot ${matrixLatexFormatiert(D)}`];
      eingaben.push({
        id: 'a', label: 'Ist das Produkt definiert?', typ: 'auswahl',
        optionen: ['Definiert', 'Nicht definiert'], punkte: 2, loesung: 'Nicht definiert', teilLabel: 'a)',
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
      id: 'b', label: 'Ergebnis (3×3)', typ: 'matrix', zeilen: 3, spalten: 3,
      punkte: 2, loesung: ergebnisB, toleranz: KONFIG.toleranz.exakt, teilLabel: 'b)',
    });
    const formelZeilenB = [`${matrixLatexFormatiert(X)}`, `\\cdot ${matrixLatexFormatiert(Y)}`];

    return {
      titel,
      frage: {
        text: 'Berechnen Sie die folgenden Matrizenprodukte, soweit definiert.',
        teile: [
          { label: 'a)', text: teilAText, formel: mehrzeiligeKette(formelZeilenA) },
          { label: 'b)', formel: mehrzeiligeKette(formelZeilenB) },
        ],
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
            latex: mehrzeiligeKette([`${matrixLatexFormatiert(X)}`, `\\cdot ${matrixLatexFormatiert(Y)}`, `= ${matrixLatexFormatiert(ergebnisB)}`]),
          },
        ],
        ergebnisse: [
          {
            label: 'Ergebnis a)',
            latex: teilA.art === 'undefiniert'
              ? '\\text{nicht definiert}'
              : teilA.art === 'definiert'
                ? matrixLatexFormatiert([teilA.ergebnis])
                : matrixLatexFormatiert(teilA.ergebnis),
          },
          { label: 'Ergebnis b)', latex: matrixLatexFormatiert(ergebnisB) },
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
  waehleParameter(rng, { erlaubeZusatzvarianten = true } = {}) {
    // Übung 23 (Zusatzvariante): derselbe Prozess, aber nur EINE Stufe
    // (Rohstoffe direkt zu Endprodukten, kein Zwischenprodukt-Schritt über
    // B) — nur außerhalb der Probeklausur bzw. wenn KONFIG.zusatzthemenInKlausur
    // das ausdrücklich erlaubt; die Probeklausur bleibt sonst unverändert
    // bei der zweistufigen Musterklausur-8-Form.
    if (erlaubeZusatzvarianten && zufallBool(rng, 0.3)) {
      for (let versuch = 0; versuch < 300; versuch++) {
        const anzahlRohstoffe = zufallAus(rng, [2, 3]);
        const anzahlEndprodukte = zufallAus(rng, [2, 3]);
        const A = zufallsMatrix(rng, anzahlRohstoffe, anzahlEndprodukte, NICHTNEGATIV_POOL);
        const E = Array.from({ length: anzahlEndprodukte }, () => [zufallAus(rng, STUECKZAHL_POOL)]);
        const R = matrixMal(A, E);
        if (R.some((zeile) => zeile[0] <= 0)) continue;
        const PR = zufallsMatrix(rng, 1, anzahlRohstoffe, PREIS_POOL)[0];
        const kosten = skalarprodukt(PR, R.map((zeile) => zeile[0]));

        let PE = null;
        for (let preisVersuch = 0; preisVersuch < 50; preisVersuch++) {
          const kandidat = zufallsMatrix(rng, 1, anzahlEndprodukte, PREIS_POOL)[0];
          const erloes = skalarprodukt(kandidat, E.map((zeile) => zeile[0]));
          const gewinn = erloes - kosten;
          if (gewinn > 0 && gewinn >= 0.1 * erloes && gewinn <= 9999) { PE = kandidat; break; }
        }
        if (!PE) continue;

        return { stufen: 1, A, B: null, E, PR, PE };
      }
      return { stufen: 1, A: [[1, 2], [2, 1], [0, 3]], B: null, E: [[10], [12]], PR: [2, 3, 2], PE: [80, 90] }; // Rückfall: Übung 23
    }

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
        // Gewinn nicht nur positiv, sondern plausibel: mindestens 10 % des
        // Erlöses, sonst wirkt ein Gewinn von z. B. 2 bei einem Erlös von
        // mehreren Hundert wie ein Rechenfehler statt ein echtes Ergebnis.
        if (gewinn > 0 && gewinn >= 0.1 * erloes && gewinn <= 9999) { PE = kandidat; break; }
      }
      if (!PE) continue;

      return { stufen: 2, A, B, E, PR, PE };
    }
    // Rückfall: Musterklausur 8 (nur Zahlen, kein Aufgabentext).
    return { stufen: 2, A: [[1, 0, 2], [2, 1, 3], [3, 1, 2]], B: [[1, 2], [2, 1], [0, 3]], E: [[10], [12]], PR: [2, 3, 2], PE: [80, 90] };
  },
  baue(params) {
    const { A, B, E, PR, PE } = params;
    const einstufig = params.stufen === 1;
    const AB = einstufig ? A : matrixMal(A, B); // bei Übung 23 ist A selbst schon die Gesamtbedarfsmatrix
    const R = matrixMal(AB, E); // Rohstoffbedarf
    const kosten = skalarprodukt(PR, R.map((zeile) => zeile[0]));
    const erloes = skalarprodukt(PE, E.map((zeile) => zeile[0]));
    const gewinn = erloes - kosten;

    // Dimensionen aus den tatsächlichen Daten lesen statt fest auf 3/2
    // Rohstoffe/Zwischenprodukte anzunehmen — baue() rechnet mit jeder
    // kompatiblen Form korrekt (siehe die Übung-24-Fixtures mit nur zwei
    // Rohstoffen), nur waehleParameter liefert immer 3×3/3×2/2×1ff.
    const anzahlRohstoffe = A.length;
    const anzahlZwischenprodukte = einstufig ? null : A[0].length;
    const anzahlEndprodukte = einstufig ? A[0].length : B[0].length;

    // P_E, P_R sind laut Musterlösung als Spaltenvektoren definiert (die
    // Formel braucht darum "P_E^T", die Transponierte, für das Skalar-
    // produkt mit E bzw. R) — in der Aufgabenstellung darum als Spalte
    // gezeigt, nicht als die schon transponierte Zeile.
    const peSpalte = PE.map((w) => [w]);
    const prSpalte = PR.map((w) => [w]);

    // Jeden Summanden des Skalarprodukts einzeln ausrechnen, bevor sie
    // zusammengezählt werden ("80·10 + 90·12 = 800 + 1.080 = 1.880").
    const erloesTerme = PE.map((w, i) => `${faktorLatex(w)} \\cdot ${faktorLatex(E[i][0])}`).join(' + ');
    const erloesTeilprodukte = PE.map((w, i) => w * E[i][0]);
    const kostenTerme = PR.map((w, i) => `${faktorLatex(w)} \\cdot ${faktorLatex(R[i][0])}`).join(' + ');
    const kostenTeilprodukte = PR.map((w, i) => w * R[i][0]);

    const abSchritte = einstufig
      ? []
      : [
        { titel: 'Einsetzen', latex: mehrzeiligeKette([`A \\cdot B = ${matrixLatexFormatiert(A)} \\cdot ${matrixLatexFormatiert(B)}`, `= ${matrixLatexFormatiert(AB)}`]) },
        {
          titel: 'Einsetzen',
          latex: alleEintraegeLatex(A, B, AB),
          hinweis: 'Jeder Eintrag von A·B ist eine Zeile von A mal eine Spalte von B.',
        },
      ];

    return {
      titel: einstufig ? 'Einstufiger Produktionsprozess' : undefined,
      frage: {
        text: einstufig
          ? `In einem einstufigen Produktionsprozess werden aus ${anzahlRohstoffe} Rohstoffen über die Produktionskoeffizienten in A direkt ` +
            `${anzahlEndprodukte} Endprodukte hergestellt, die in den Mengen E hergestellt werden sollen.`
          : `In einem zweistufigen Produktionsprozess werden aus ${anzahlRohstoffe} Rohstoffen über die Produktionskoeffizienten in A ` +
            `${anzahlZwischenprodukte} Zwischenprodukte und aus diesen über B ${anzahlEndprodukte} Endprodukte hergestellt, die in den Mengen E ` +
            `hergestellt werden sollen.`,
        teile: [
          { label: 'a)', text: `Wie viele Einheiten der ${anzahlRohstoffe} Rohstoffe werden dafür benötigt?` },
          { label: 'b)', text: 'Die Endprodukte werden zu Verkaufspreisen je Einheit PE verkauft, die Rohstoffe kosten je Einheit PR. Wie hoch ist der Gewinn?' },
        ],
        // Jede Vorgabe auf einer eigenen Zeile statt mehrere pro Zeile
        // gebündelt — zwei oder mehr Matrizen nebeneinander liefen bei
        // 375px ab dem Bildschirmrand (iPhone-Rückmeldung: E und P_R
        // waren abgeschnitten), eine einzelne Matrix passt dagegen immer.
        formel: mehrzeiligeKette([
          `A = ${matrixLatexFormatiert(A)}`,
          ...(einstufig ? [] : [`B = ${matrixLatexFormatiert(B)}`]),
          `E = ${matrixLatexFormatiert(E)}`,
          `P_E = ${matrixLatexFormatiert(peSpalte)}`,
          `P_R = ${matrixLatexFormatiert(prSpalte)}`,
        ]),
      },
      eingaben: [
        {
          id: 'R', label: `Rohstoffbedarf R (${anzahlRohstoffe}×1)`, typ: 'matrix', zeilen: anzahlRohstoffe, spalten: 1,
          punkte: 4, loesung: R, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)',
        },
        { id: 'G', label: 'Gewinn G', typ: 'zahl', punkte: 4, loesung: gewinn, toleranz: KONFIG.toleranz.geld, teilLabel: 'b)' },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: einstufig ? `R = A \\cdot E` : `R = A \\cdot B \\cdot E`,
            hinweis: einstufig
              ? 'Der Rohstoffbedarf R ergibt sich direkt aus A (Rohstoffe je Einheit jedes Endprodukts) mal E (herzustellende Mengen).'
              : 'Erst A·B als Gesamtbedarfsmatrix bilden (wie viele Rohstoffe je Einheit jedes Endprodukts nötig sind), dann mit E multiplizieren.',
          },
          ...abSchritte,
          { titel: 'Einsetzen', latex: mehrzeiligeKette([`R = ${matrixLatexFormatiert(AB)} \\cdot ${matrixLatexFormatiert(E)}`, `= ${matrixLatexFormatiert(R)}`]) },
          {
            titel: 'Einsetzen',
            latex: alleEintraegeLatex(AB, E, R, 'r'),
            hinweis: einstufig ? 'Jeder Eintrag von R ist eine Zeile von A mal die (einzige) Spalte von E.' : 'Jeder Eintrag von R ist eine Zeile von A·B mal die (einzige) Spalte von E.',
          },
          { titel: 'Ergebnis', latex: `R = ${matrixLatexFormatiert(R)}` },
          {
            titel: 'Formel',
            latex: `G = P_E^T \\cdot E - P_R^T \\cdot R`,
            hinweis: 'Gewinn ist Erlös (Verkaufspreise mal Endproduktmengen) minus Kosten (Rohstoffpreise mal benötigter Rohstoffmenge).',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('G', [
              `${matrixLatexFormatiert([PE])} \\cdot ${matrixLatexFormatiert(E)} - ${matrixLatexFormatiert([PR])} \\cdot ${matrixLatexFormatiert(R)}`,
              `\\left(${erloesTerme}\\right) - \\left(${kostenTerme}\\right)`,
              `\\left(${erloesTeilprodukte.map((p) => zahlZuLatex(p, minimaleNachkommastellen(p))).join(' + ')}\\right) - \\left(${kostenTeilprodukte.map((p) => zahlZuLatex(p, minimaleNachkommastellen(p))).join(' + ')}\\right)`,
              `${zahlZuLatex(erloes, minimaleNachkommastellen(erloes))} - ${zahlZuLatex(kosten, minimaleNachkommastellen(kosten))}`,
              zahlZuLatex(gewinn, minimaleNachkommastellen(gewinn)),
            ]),
          },
        ],
        ergebnisse: [
          { label: 'Rohstoffbedarf', latex: `R = ${matrixLatexFormatiert(R)}` },
          { label: 'Gewinn', latex: zahlZuLatex(gewinn, minimaleNachkommastellen(gewinn)) },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// alg.matrixrechnung — Übung 21 (Zusatzthema)
// Addition/Subtraktion, Vielfache und Linearkombinationen von 2×2-Matrizen,
// dazu die Transponierten-Regel (rA+sB−rC)ᵗ = rAᵗ+sBᵗ−rCᵗ und den Kurzweg
// rA+sA = (r+s)A. Rückwärts: A, B, C klein ganzzahlig, r, s klein ganzzahlig
// (auch r+s=0 zulässig — das macht c) gerade lehrreich, siehe Übung 21c, wo
// r=−2, s=2 die Nullmatrix ergibt).
// Zusatzthema (Phase 6) — in der Probeklausur standardmäßig aus.
// ---------------------------------------------------------------------------
const RS_POOL = [-3, -2, -1, 1, 2, 3];

export const matrixrechnung = {
  id: 'alg.matrixrechnung',
  teil: 'algebra',
  name: 'Rechnen mit Matrizen: Summen, Vielfache, Transponierte',
  punkte: 8,
  vorlage: 'Übung 21',
  zusatz: true,
  waehleParameter(rng) {
    for (let versuch = 0; versuch < 200; versuch++) {
      const A = zufallsMatrix(rng, 2, 2, EINTRAG_POOL);
      const B = zufallsMatrix(rng, 2, 2, EINTRAG_POOL);
      const C = zufallsMatrix(rng, 2, 2, EINTRAG_POOL);
      const r = zufallAus(rng, RS_POOL);
      const s = zufallAus(rng, RS_POOL);
      if (nullAnteil([A, B, C]) < 1 / 4) continue;
      return { A, B, C, r, s };
    }
    return { A: [[-1, 2], [-2, 3]], B: [[3, -1], [-5, 2]], C: [[2, 0], [0, 1]], r: -2, s: 2 }; // Rückfall: Übung 21
  },
  baue(params) {
    const { A, B, C, r, s } = params;
    const diffAC = A.map((zeile, i) => zeile.map((w, j) => w - C[i][j]));
    const ergA = diffAC.map((zeile) => zeile.map((w) => r * w));
    const rA = A.map((zeile) => zeile.map((w) => r * w));
    const sB = B.map((zeile) => zeile.map((w) => s * w));
    const rC = C.map((zeile) => zeile.map((w) => r * w));
    const ergB = A.map((zeile, i) => zeile.map((w, j) => rA[i][j] + sB[i][j] - rC[i][j]));
    const ergC = A.map((zeile) => zeile.map((w) => (r + s) * w));
    const ergD = transponiere(ergB);

    const indizes = [[0, 0], [0, 1], [1, 0], [1, 1]];
    // Klammert eine bereits ausgerechnete Zahl, wenn sie negativ ist — nötig,
    // sobald sie direkt hinter einem eigenen "+"/"-" eingesetzt wird (sonst
    // entstehen zwei Vorzeichen direkt hintereinander, "+ -6" statt "+ (-6)").
    const klammerWennNeg = (w) => (w < 0 ? `(${zahlZuLatex(w, 0)})` : zahlZuLatex(w, 0));
    // "skalar \cdot Matrix", mit Vorzeichen und ohne den Skalar bei |·|=1
    // auszuschreiben ("A" statt "1 \cdot A", "-A" statt "-1 \cdot A") — r/s
    // dürfen laut Pool auch ±1 sein.
    const skalarMalMatrix = (skalar, matrixAusdruck) => {
      const abs = Math.abs(skalar);
      const vz = skalar < 0 ? '-' : '';
      return abs === 1 ? `${vz}${matrixAusdruck}` : `${vz}${zahlZuLatex(abs, 0)} \\cdot ${matrixAusdruck}`;
    };

    return {
      frage: {
        text: 'Gegeben seien die folgenden Matrizen A, B, C und die Skalare r, s.',
        // Jede Matrix auf einer eigenen Zeile statt mehrere nebeneinander —
        // drei 2×2-Matrizen in einer Zeile liefen bei 375px ab dem
        // Bildschirmrand (iPhone-Rückmeldung, dasselbe Muster wie bei
        // alg.produktionsprozess).
        formel: mehrzeiligeKette([
          `A = ${matrixLatexFormatiert(A)}`,
          `B = ${matrixLatexFormatiert(B)}`,
          `C = ${matrixLatexFormatiert(C)}`,
          `r = ${zahlZuLatex(r, 0)}, \\quad s = ${zahlZuLatex(s, 0)}`,
        ]),
        teile: [
          { label: 'a)', text: 'Bilden Sie r·(A−C).' },
          { label: 'b)', text: 'Bilden Sie r·A + s·B − r·C.' },
          { label: 'c)', text: 'Bilden Sie r·A + s·A und vergleichen Sie mit (r+s)·A.' },
          { label: 'd)', text: 'Bilden Sie die Transponierte von r·A + s·B − r·C.' },
        ],
      },
      eingaben: [
        { id: 'a', label: 'r·(A−C)', typ: 'matrix', zeilen: 2, spalten: 2, punkte: 2, loesung: ergA, toleranz: KONFIG.toleranz.exakt, teilLabel: 'a)' },
        { id: 'b', label: 'r·A + s·B − r·C', typ: 'matrix', zeilen: 2, spalten: 2, punkte: 2, loesung: ergB, toleranz: KONFIG.toleranz.exakt, teilLabel: 'b)' },
        { id: 'c', label: 'r·A + s·A', typ: 'matrix', zeilen: 2, spalten: 2, punkte: 2, loesung: ergC, toleranz: KONFIG.toleranz.exakt, teilLabel: 'c)' },
        { id: 'd', label: '(r·A + s·B − r·C)ᵗ', typ: 'matrix', zeilen: 2, spalten: 2, punkte: 2, loesung: ergD, toleranz: KONFIG.toleranz.exakt, teilLabel: 'd)' },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `r \\cdot (A - C)`,
            hinweis: 'Erst die Matrizen entrywise subtrahieren, dann jeden Eintrag mit r multiplizieren.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette(indizes.map(([i, j]) =>
              `a_{${i + 1}${j + 1}} = ${zahlZuLatex(r, 0)} \\cdot (${zahlZuLatex(A[i][j], 0)} - ${faktorLatex(C[i][j])}) = ${zahlZuLatex(r, 0)} \\cdot ${klammerWennNeg(diffAC[i][j])} = ${zahlZuLatex(ergA[i][j], 0)}`)),
          },
          { titel: 'Ergebnis', latex: `r(A-C) = ${matrixLatexFormatiert(ergA)}` },
          {
            titel: 'Formel',
            latex: `rA + sB - rC`,
            hinweis: 'Jede Matrix zuerst mit ihrem Skalar multiplizieren, dann entrywise addieren/subtrahieren.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `rA = ${skalarMalMatrix(r, matrixLatexFormatiert(A))} = ${matrixLatexFormatiert(rA)}`,
              `sB = ${skalarMalMatrix(s, matrixLatexFormatiert(B))} = ${matrixLatexFormatiert(sB)}`,
              `rC = ${skalarMalMatrix(r, matrixLatexFormatiert(C))} = ${matrixLatexFormatiert(rC)}`,
            ]),
            hinweis: 'Jede der drei Matrizen zuerst für sich mit ihrem Skalar multiplizieren.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette(indizes.map(([i, j]) =>
              `b_{${i + 1}${j + 1}} = ${zahlZuLatex(rA[i][j], 0)} + ${klammerWennNeg(sB[i][j])} - ${klammerWennNeg(rC[i][j])} = ${zahlZuLatex(ergB[i][j], 0)}`)),
            hinweis: 'Die drei bereits skalierten Matrizen entrywise addieren/subtrahieren.',
          },
          { titel: 'Ergebnis', latex: `rA + sB - rC = ${matrixLatexFormatiert(ergB)}` },
          {
            titel: 'Formel',
            latex: `rA + sA = (r+s) \\cdot A`,
            hinweis: 'Zwei Vielfache derselben Matrix lassen sich zusammenfassen, bevor man überhaupt multipliziert — spart Rechenarbeit, besonders wenn r+s=0 ist.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `r + s = ${zahlZuLatex(r, 0)} ${s < 0 ? '-' : '+'} ${zahlZuLatex(Math.abs(s), 0)} = ${zahlZuLatex(r + s, 0)}`,
              ...indizes.map(([i, j]) => `c_{${i + 1}${j + 1}} = ${zahlZuLatex(r + s, 0)} \\cdot ${faktorLatex(A[i][j])} = ${zahlZuLatex(ergC[i][j], 0)}`),
            ]),
          },
          { titel: 'Ergebnis', latex: `rA + sA = (r+s)A = ${matrixLatexFormatiert(ergC)}` },
          {
            titel: 'Formel',
            latex: `(rA+sB-rC)^T = rA^T + sB^T - rC^T`,
            hinweis: 'Transponieren einer Summe/Differenz ist dieselbe Summe/Differenz der Transponierten, und ein Skalar bleibt beim Transponieren unverändert davor stehen.',
          },
          {
            titel: 'Einsetzen',
            latex: `(rA+sB-rC)^T = \\left(${matrixLatexFormatiert(ergB)}\\right)^T = ${matrixLatexFormatiert(ergD)}`,
            hinweis: 'Zeilen und Spalten des bereits berechneten Ergebnisses aus b) vertauschen.',
          },
          { titel: 'Ergebnis', latex: `(rA+sB-rC)^T = ${matrixLatexFormatiert(ergD)}` },
        ],
        ergebnisse: [
          { label: 'r·(A−C)', latex: matrixLatexFormatiert(ergA) },
          { label: 'r·A + s·B − r·C', latex: matrixLatexFormatiert(ergB) },
          { label: 'r·A + s·A = (r+s)·A', latex: matrixLatexFormatiert(ergC) },
          { label: '(r·A + s·B − r·C)ᵗ', latex: matrixLatexFormatiert(ergD) },
        ],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// alg.lgs — Übung 25 (Zusatzthema)
// 3×3-LGS mit eindeutiger ganzzahliger Lösung, zwei Lösungswege: Gauß-
// Algorithmus (Zeilenumformungen ohne Pivotsuche) und Cramersche Regel
// (Determinanten über die Regel von Sarrus, jedes Produkt einzeln gezeigt).
// Rückwärts konstruiert über A = L·U: U obere Dreiecksmatrix (ganzzahlige,
// von 0 verschiedene Diagonale — damit ist jeder Pivot automatisch ungleich
// null, keine Pivotsuche nötig), L unit-untere Dreiecksmatrix (Einsen auf
// der Diagonale, ganzzahlige Einträge darunter). Für A=L·U liefert die
// Gauß-Elimination GARANTIERT ganzzahlige Multiplikatoren (Beweis: Zeile 2
// von A ist l21·Zeile1(U)+Zeile2(U), also m21 = A[1][0]/A[0][0] = l21 exakt;
// nach dem Abzug bleibt Zeile2(U) übrig, analog für Zeile 3 und den zweiten
// Eliminationsschritt). b = A·x für eine gewählte ganzzahlige Lösung x.
// ---------------------------------------------------------------------------
function matrixMalVektor(A, x) {
  return A.map((zeile) => skalarprodukt(zeile, x));
}

// Zwei Dreiecksfaktoren (unit-untere L, obere U) zu A multiplizieren.
function lgsAusLU(L, U) {
  return matrixMal(L, U);
}

// Determinante einer 3×3-Matrix über die Regel von Sarrus: drei Produkte der
// "Hauptdiagonalen" (und ihrer beiden Parallelen, zyklisch von rechts
// nachgerückt) minus drei Produkte der "Gegendiagonalen". Liefert die sechs
// Tripel getrennt nach Vorzeichen, damit die Lösung jedes Produkt einzeln
// zeigen kann (Katalog-Vorgabe).
function sarrusTripel(m) {
  const [[a11, a12, a13], [a21, a22, a23], [a31, a32, a33]] = m;
  return {
    positiv: [[a11, a22, a33], [a12, a23, a31], [a13, a21, a32]],
    negativ: [[a13, a22, a31], [a11, a23, a32], [a12, a21, a33]],
  };
}
function determinante3x3(m) {
  const { positiv, negativ } = sarrusTripel(m);
  const summe = (ts) => ts.reduce((s, [x, y, z]) => s + x * y * z, 0);
  return summe(positiv) - summe(negativ);
}
// A, aber Spalte "spalte" (0-indiziert) durch b ersetzt — für D1/D2/D3.
function cramerMatrix(A, b, spalte) {
  return A.map((zeile, i) => zeile.map((w, j) => (j === spalte ? b[i] : w)));
}
// Zeigt "D = (±a·b·c) (±a·b·c) ... = (±Wert) (±Wert) ... = Ergebnis" als
// zweizeilige Einsetzen-Kette: erst die eingesetzten Faktoren, dann die
// einzeln ausgerechneten Produkte — jedes der sechs Produkte einzeln
// sichtbar, nicht nur die Summe.
function sarrusSchritt(name, m) {
  const { positiv, negativ } = sarrusTripel(m);
  const alle = [...positiv.map((t) => [1, t]), ...negativ.map((t) => [-1, t])];
  const eingesetzt = alle.map(([vz, [x, y, z]], i) => {
    const praefix = i === 0 ? (vz < 0 ? '-' : '') : (vz < 0 ? '- ' : '+ ');
    return `${praefix}${faktorLatex(x)} \\cdot ${faktorLatex(y)} \\cdot ${faktorLatex(z)}`;
  }).join(' ');
  const werte = alle.map(([vz, [x, y, z]], i) => {
    const wert = vz * x * y * z;
    const praefix = i === 0 ? (wert < 0 ? '-' : '') : (wert < 0 ? '- ' : '+ ');
    return `${praefix}${zahlZuLatex(Math.abs(wert), 0)}`;
  }).join(' ');
  const ergebnis = determinante3x3(m);
  return mehrzeiligeGleichung(name, [eingesetzt, werte, zahlZuLatex(ergebnis, 0)]);
}

// Exakte Bruch-Arithmetik [Zähler, Nenner] (Nenner immer positiv, über
// bruchGekuerzt sofort gekürzt) — nötig, weil bei rund 40 % der alg.lgs-
// Instanzen die Gauß-Multiplikatoren bewusst echte (nicht ganzzahlige)
// Brüche sind (Vorlesungsbeispiel Übung 25a: "II − ¼·I" liefert −½, ¼, 7/2)
// und dabei exakt, nicht als gerundete Dezimalzahl, gerechnet werden müssen
// — sonst würde die Lösung x am Ende nicht mehr exakt ganzzahlig herauskommen.
function bruchAus(zaehler, nenner = 1) {
  const { zaehler: z, nenner: n } = bruchGekuerzt(zaehler, nenner);
  return [z, n];
}
function bSub([a, b], [c, d]) { return bruchAus(a * d - c * b, b * d); }
function bMul([a, b], [c, d]) { return bruchAus(a * c, b * d); }
function bDiv([a, b], [c, d]) { return bruchAus(a * d, b * c); }
function bruchZuZahl([n, d]) { return n / d; }
function bruchIstGanz([, d]) { return d === 1; }
// Ganzzahl (Nenner 1) oder echter, bereits gekürzter Bruch "\dfrac{Z}{N}"
// mit dem Vorzeichen im Zähler.
function bruchLatex([n, d]) {
  if (d === 1) return zahlZuLatex(n, 0);
  return `${n < 0 ? '-' : ''}\\dfrac{${Math.abs(n)}}{${d}}`;
}
// Wie bruchLatex, aber geklammert, wenn negativ — für Brüche, die direkt
// hinter einem eigenen "+"/"-" eingesetzt werden.
function bruchFaktorLatex(w) {
  return w[0] < 0 ? `(${bruchLatex(w)})` : bruchLatex(w);
}

// Gauß-Elimination ohne Pivotsuche (Pivots sind laut Konstruktion immer
// ungleich null). Rechnet durchgehend mit exakten Brüchen (siehe oben), auch
// wenn bei rund 60 % der Instanzen (A=L·U-Konstruktion) alle Zwischenwerte
// ganzzahlig bleiben — bruchLatex zeigt einen Bruch mit Nenner 1 ohnehin als
// gewöhnliche ganze Zahl. Liefert für jeden der drei Schritte die
// Bezeichnung ("II - ¼·I"), die betroffene neue Zeile (inkl. rechter Seite)
// sowie am Ende die obere Dreiecksform und die Lösung per Rückwärtseinsetzen.
function zeilenOperationLabel(ziel, quelle, multiplikator) {
  const [n, d] = multiplikator;
  const vz = n < 0 ? '+' : '-';
  const abs = Math.abs(n);
  if (d === 1) {
    const faktor = abs === 1 ? '' : `${zahlZuLatex(abs, 0)}\\cdot `;
    return `\\text{${ziel} ${vz} ${faktor}${quelle}:}`;
  }
  // Echter Bruch als Multiplikator: "\dfrac" ist in KaTeX im Textmodus
  // ("\text{...}") nicht erlaubt — der Bruch selbst bleibt deshalb im
  // Mathe-Modus, die umgebenden Wörter stehen in eigenen \text{}-Stücken.
  return `\\text{${ziel} ${vz} }\\dfrac{${abs}}{${d}}\\text{\\,\\cdot ${quelle}:}`;
}
function gaussSchritte(A, b) {
  const M = A.map((zeile) => zeile.map((w) => bruchAus(w)));
  const rhs = b.map((w) => bruchAus(w));
  const schritte = [];

  const m21 = bDiv(M[1][0], M[0][0]);
  M[1] = M[1].map((w, j) => bSub(w, bMul(m21, M[0][j])));
  rhs[1] = bSub(rhs[1], bMul(m21, rhs[0]));
  schritte.push({ label: zeilenOperationLabel('II', 'I', m21), zeile: M[1].slice(), rhsWert: rhs[1], multiplikator: m21 });

  const m31 = bDiv(M[2][0], M[0][0]);
  M[2] = M[2].map((w, j) => bSub(w, bMul(m31, M[0][j])));
  rhs[2] = bSub(rhs[2], bMul(m31, rhs[0]));
  schritte.push({ label: zeilenOperationLabel('III', 'I', m31), zeile: M[2].slice(), rhsWert: rhs[2], multiplikator: m31 });

  const m32 = bDiv(M[2][1], M[1][1]);
  M[2] = M[2].map((w, j) => bSub(w, bMul(m32, M[1][j])));
  rhs[2] = bSub(rhs[2], bMul(m32, rhs[1]));
  schritte.push({ label: zeilenOperationLabel('III', 'II', m32), zeile: M[2].slice(), rhsWert: rhs[2], multiplikator: m32 });

  const x3b = bDiv(rhs[2], M[2][2]);
  const zaehler2 = bSub(rhs[1], bMul(M[1][2], x3b));
  const x2b = bDiv(zaehler2, M[1][1]);
  const zaehler1 = bSub(bSub(rhs[0], bMul(M[0][1], x2b)), bMul(M[0][2], x3b));
  const x1b = bDiv(zaehler1, M[0][0]);

  return {
    M, rhs, schritte,
    x: [x1b, x2b, x3b].map(bruchZuZahl),
    rueckeinsetzen: { zaehler2, zaehler1 },
  };
}

// "(a b c | d)" als Zeile einer augmentierten Matrix in LaTeX — A/b dürfen
// entweder plain-ganzzahlig sein (pristine Ausgangsmatrix) oder bereits als
// Bruch-Paare [n, d] vorliegen (Zwischenschritte der Elimination); bruchAus
// ist für ganze Zahlen die Identität (Nenner 1), darum reicht ein Mapping.
function augmentierteMatrixLatex(A, b) {
  const Ab = A.map((zeile) => zeile.map((w) => (Array.isArray(w) ? w : bruchAus(w))));
  const bb = b.map((w) => (Array.isArray(w) ? w : bruchAus(w)));
  const zeilen = Ab.map((zeile, i) => `${zeile.map(bruchLatex).join(' & ')} & ${bruchLatex(bb[i])}`).join(' \\\\ ');
  return `\\left(\\begin{array}{ccc|c} ${zeilen} \\end{array}\\right)`;
}

const LGS_DIAG_POOL = [-3, -2, -1, 1, 2, 3];
const LGS_UPPER_POOL = [-3, -2, -1, 0, 0, 1, 2, 3];
const LGS_L_POOL = [-3, -2, -1, 1, 2, 3];
const LGS_X_POOL = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const LGS_MAX_ZWISCHENWERT = 50;
// Nenner, die beim Gauß-Schritt auftreten dürfen, bevor eine Instanz als "zu
// unschön" verworfen wird — ¼, ½, ⅓ usw. sind laut Vorlesungsbeispiel
// (Übung 25a) gewollt, ein Nenner wie 1/97 wäre es nicht.
const LGS_MAX_NENNER = 8;

// erfordereBruch=true (die ~40 %-"gebrochen"-Variante): mindestens einer der
// drei Gauß-Multiplikatoren muss ein echter (nicht ganzzahliger) Bruch sein.
// erfordereBruch=false (die L·U-Konstruktion, ~60 %): bleibt wie bewiesen
// garantiert ganzzahlig — die Prüfung hier ist nur ein zusätzliches Netz.
function lgsZwischenwerteKlein(A, b, { erfordereBruch = false } = {}) {
  const { schritte, x } = gaussSchritte(A, b);
  let hatBruch = false;
  for (const s of schritte) {
    if (s.multiplikator[1] > LGS_MAX_NENNER) return false;
    if (Math.abs(bruchZuZahl(s.rhsWert)) > LGS_MAX_ZWISCHENWERT) return false;
    if (s.zeile.some((w) => Math.abs(bruchZuZahl(w)) > LGS_MAX_ZWISCHENWERT)) return false;
    if (s.zeile.some((w) => w[1] > LGS_MAX_NENNER) || s.rhsWert[1] > LGS_MAX_NENNER) return false;
    if (s.multiplikator[1] > 1) hatBruch = true;
  }
  if (erfordereBruch !== hatBruch) return false;
  if (!x.every((w) => Number.isInteger(w))) return false;
  for (const M of [A, cramerMatrix(A, b, 0), cramerMatrix(A, b, 1), cramerMatrix(A, b, 2)]) {
    const { positiv, negativ } = sarrusTripel(M);
    for (const [a1, a2, a3] of [...positiv, ...negativ]) {
      if (Math.abs(a1 * a2 * a3) > LGS_MAX_ZWISCHENWERT) return false;
    }
  }
  if (A.flat().some((w) => Math.abs(w) > 30)) return false;
  if (b.some((w) => Math.abs(w) > 80 || w === 0)) return false;
  if (A.flat().filter((w) => w === 0).length > 3) return false;
  return true;
}
// Zeigt "x_i = Zähler(-Ausdruck) / Nenner = Ergebnis": ganzzahlige Division
// (beide Seiten Nenner 1) als schlichten Schrägstrich (wie bisher — das
// Ergebnis ist ohnehin ganzzahlig, ein "\dfrac" wäre ein ungekürzter
// Bruch-Anschein), eine echte Bruch-Division als "\dfrac".
function bruchTeilungLatex(zaehlerAusdruck, zaehlerWert, nennerWert, ergebnis) {
  if (bruchIstGanz(zaehlerWert) && bruchIstGanz(nennerWert)) {
    const nennerText = nennerWert[0] < 0 ? `(${bruchLatex(nennerWert)})` : bruchLatex(nennerWert);
    return `${zaehlerAusdruck} / ${nennerText} = ${zahlZuLatex(ergebnis, 0)}`;
  }
  return `\\dfrac{${zaehlerAusdruck}}{${bruchLatex(nennerWert)}} = ${zahlZuLatex(ergebnis, 0)}`;
}

export const lgs = {
  id: 'alg.lgs',
  teil: 'algebra',
  name: 'Lineares Gleichungssystem: Gauß und Cramer',
  punkte: 6,
  vorlage: 'Übung 25',
  zusatz: true,
  waehleParameter(rng) {
    // Rund 40 % der Instanzen sollen beim Gauß-Algorithmus einen echten
    // (nicht ganzzahligen) Multiplikator durchlaufen ("II − ¼·I" wie in
    // Übung 25a) — dafür reicht die A=L·U-Konstruktion unten nicht (die
    // liefert beweisbar IMMER ganzzahlige Multiplikatoren), also wird A für
    // diesen Fall direkt (nicht über L·U) aus EINTRAG_POOL gezogen.
    if (zufallBool(rng, 0.4)) {
      for (let versuch = 0; versuch < 3000; versuch++) {
        const A = zufallsMatrix(rng, 3, 3, EINTRAG_POOL);
        if (A[0][0] === 0) continue; // erster Pivot muss ungleich null sein (keine Pivotsuche)
        const x = [zufallAus(rng, LGS_X_POOL), zufallAus(rng, LGS_X_POOL), zufallAus(rng, LGS_X_POOL)];
        if (x.every((w) => w === 0)) continue;

        const b = matrixMalVektor(A, x);
        if (!lgsZwischenwerteKlein(A, b, { erfordereBruch: true })) continue;
        return { A, b };
      }
      // Rückfall: Übung 25a (Zahlen aus der gerenderten Musterlösung, nur
      // Zahlen — siehe CLAUDE.md Abschnitt 2). det A = 2, D₁=24, D₂=−22,
      // D₃=−16, x=(12,−11,−8); der erste Gauß-Schritt ist dort "II−¼·I".
      return { A: [[4, 2, 3], [1, 0, 1], [2, 2, 0]], b: [2, 4, 2] };
    }

    for (let versuch = 0; versuch < 3000; versuch++) {
      const U = [
        [zufallAus(rng, LGS_DIAG_POOL), zufallAus(rng, LGS_UPPER_POOL), zufallAus(rng, LGS_UPPER_POOL)],
        [0, zufallAus(rng, LGS_DIAG_POOL), zufallAus(rng, LGS_UPPER_POOL)],
        [0, 0, zufallAus(rng, LGS_DIAG_POOL)],
      ];
      const l21 = zufallAus(rng, LGS_L_POOL);
      const l31 = zufallAus(rng, LGS_L_POOL);
      const l32 = zufallAus(rng, LGS_L_POOL);
      const L = [[1, 0, 0], [l21, 1, 0], [l31, l32, 1]];
      const x = [zufallAus(rng, LGS_X_POOL), zufallAus(rng, LGS_X_POOL), zufallAus(rng, LGS_X_POOL)];
      if (x.every((w) => w === 0)) continue;

      const A = lgsAusLU(L, U);
      const b = matrixMalVektor(A, x);
      if (!lgsZwischenwerteKlein(A, b)) continue;
      return { A, b };
    }
    // Rückfall: nach derselben L·U-Konstruktion von Hand nachgerechnet (nur
    // Zahlen), damit garantiert ganzzahlige Gauß-Multiplikatoren entstehen.
    const Lf = [[1, 0, 0], [2, 1, 0], [1, 2, 1]];
    const Uf = [[1, 1, 1], [0, -1, -3], [0, 0, 7]];
    const Af = lgsAusLU(Lf, Uf);
    const xf = [1, 2, 3];
    return { A: Af, b: matrixMalVektor(Af, xf) };
  },
  baue(params) {
    const { A, b } = params;
    const { M, rhs, schritte, x, rueckeinsetzen } = gaussSchritte(A, b);
    const { zaehler2, zaehler1 } = rueckeinsetzen;
    const D = determinante3x3(A);
    const D1 = determinante3x3(cramerMatrix(A, b, 0));
    const D2 = determinante3x3(cramerMatrix(A, b, 1));
    const D3 = determinante3x3(cramerMatrix(A, b, 2));

    return {
      frage: {
        text: 'Lösen Sie das folgende lineare Gleichungssystem mit drei Unbekannten.',
        formel: augmentierteMatrixLatex(A, b),
        teile: [
          { label: 'a)', text: 'Lösen Sie mit dem Gauß-Algorithmus.' },
          { label: 'b)', text: 'Lösen Sie mit der Cramerschen Regel.' },
        ],
      },
      eingaben: [
        {
          id: 'x', label: 'Lösung', typ: 'koeffizienten', punkte: 6, loesung: x, toleranz: KONFIG.toleranz.exakt,
          beschriftungen: ['x₁', 'x₂', 'x₃'], trenner: ',',
        },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: augmentierteMatrixLatex(A, b),
            hinweis: 'Gauß-Algorithmus: Zeilen so umformen (Zielzeile minus Vielfaches einer anderen Zeile), dass unterhalb der Diagonale nur Nullen stehen, dann rückwärts einsetzen.',
          },
          {
            titel: 'Einsetzen',
            latex: `${schritte[0].label} \\quad ${augmentierteMatrixLatex([M[0], schritte[0].zeile, A[2]], [b[0], schritte[0].rhsWert, b[2]])}`,
            hinweis: 'Ersten Eintrag der zweiten Zeile auf null bringen.',
          },
          {
            titel: 'Einsetzen',
            latex: `${schritte[1].label} \\quad ${augmentierteMatrixLatex([M[0], schritte[0].zeile, schritte[1].zeile], [b[0], schritte[0].rhsWert, schritte[1].rhsWert])}`,
            hinweis: 'Ersten Eintrag der dritten Zeile auf null bringen.',
          },
          {
            titel: 'Einsetzen',
            latex: `${schritte[2].label} \\quad ${augmentierteMatrixLatex(M, rhs)}`,
            hinweis: 'Zweiten Eintrag der dritten Zeile auf null bringen — jetzt steht eine obere Dreiecksform da.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `x_3 = ${bruchTeilungLatex(bruchLatex(rhs[2]), rhs[2], M[2][2], x[2])}`,
              `x_2 = ${bruchTeilungLatex(`${bruchLatex(rhs[1])} - ${bruchFaktorLatex(M[1][2])} \\cdot ${faktorLatex(x[2])}`, zaehler2, M[1][1], x[1])}`,
              `x_1 = ${bruchTeilungLatex(`${bruchLatex(rhs[0])} - ${bruchFaktorLatex(M[0][1])} \\cdot ${faktorLatex(x[1])} - ${bruchFaktorLatex(M[0][2])} \\cdot ${faktorLatex(x[2])}`, zaehler1, M[0][0], x[0])}`,
            ]),
            hinweis: 'Von unten nach oben rückwärts einsetzen (dritte Zeile hat nur noch x₃, zweite nur noch x₂ und x₃, usw.).',
          },
          { titel: 'Ergebnis', latex: `x_1 = ${zahlZuLatex(x[0], 0)}, \\quad x_2 = ${zahlZuLatex(x[1], 0)}, \\quad x_3 = ${zahlZuLatex(x[2], 0)}` },
          {
            titel: 'Formel',
            latex: `x_i = \\dfrac{D_i}{D}, \\quad D = \\begin{vmatrix} a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33} \\end{vmatrix}`,
            hinweis: 'Cramersche Regel zur Kontrolle: D ist die Determinante der Koeffizientenmatrix, Dᵢ dieselbe Determinante, aber mit Spalte i durch die rechte Seite b ersetzt. Jede Determinante über die Regel von Sarrus: Summe der drei "Hauptdiagonalen"-Produkte minus Summe der drei "Gegendiagonalen"-Produkte.',
          },
          { titel: 'Einsetzen', latex: sarrusSchritt('D', A) },
          { titel: 'Einsetzen', latex: sarrusSchritt('D_1', cramerMatrix(A, b, 0)) },
          { titel: 'Einsetzen', latex: sarrusSchritt('D_2', cramerMatrix(A, b, 1)) },
          { titel: 'Einsetzen', latex: sarrusSchritt('D_3', cramerMatrix(A, b, 2)) },
          {
            titel: 'Ergebnis',
            latex: mehrzeiligeKette([
              `x_1 = \\dfrac{D_1}{D} = ${zahlZuLatex(D1, 0)} / ${faktorLatex(D)} = ${zahlZuLatex(x[0], 0)}`,
              `x_2 = \\dfrac{D_2}{D} = ${zahlZuLatex(D2, 0)} / ${faktorLatex(D)} = ${zahlZuLatex(x[1], 0)}`,
              `x_3 = \\dfrac{D_3}{D} = ${zahlZuLatex(D3, 0)} / ${faktorLatex(D)} = ${zahlZuLatex(x[2], 0)}`,
            ]),
          },
        ],
        ergebnisse: [
          { label: 'Lösung', latex: `x_1 = ${zahlZuLatex(x[0], 0)}, \\quad x_2 = ${zahlZuLatex(x[1], 0)}, \\quad x_3 = ${zahlZuLatex(x[2], 0)}` },
        ],
      },
      params,
    };
  },
};

export const ALGEBRA_GENERATOREN = [matrixprodukt, produktionsprozess];
export const ALGEBRA_ZUSATZ_GENERATOREN = [matrixrechnung, lgs];
