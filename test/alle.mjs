#!/usr/bin/env node
// test/alle.mjs — Zahlenparser-Einheitstests plus 1.000 Instanzen je Generator,
// jede unabhängig nachgerechnet (siehe PLAN.md, Testkonzept).

import { mulberry32 } from '../src/rng.js';
import { parseDeZahl, nahBei } from '../src/zahl.js';
import { GENERATOREN } from '../src/generatoren/index.js';

let fehler = 0;

function pruefe(bedingung, beschreibung) {
  if (!bedingung) {
    fehler += 1;
    console.error('FEHLER:', beschreibung);
  }
}

// ---------------------------------------------------------------------------
// Zahlenparser: deutsche Schreibweisen, mit und ohne Tausenderpunkt.
// ---------------------------------------------------------------------------
function testeZahlenparser() {
  const faelle = [
    ['7782,55', 7782.55],          // ohne Tausenderpunkt (iPhone-Test, 2026-10-19)
    ['7.782,55', 7782.55],         // mit Tausenderpunkt
    ['7782.55', 7782.55],          // Punkt als Dezimalzeichen
    ['1.234.567', 1234567],        // reine Tausendergruppen ohne Dezimalteil
    ['1.234', 1234],               // eine Tausendergruppe
    ['100.000', 100000],
    ['100.000,00', 100000],
    ['-5,25', -5.25],              // negativ
    ['-1.234,56', -1234.56],       // negativ mit Tausenderpunkt
    ['0,00', 0],
    ['0', 0],
    ['  3,10 €  ', 3.10],          // Leerzeichen und Einheit
    ['10%', 10],
    ['17,67', 17.67],
    ['3,0416', 3.0416],
  ];
  for (const [eingabe, erwartet] of faelle) {
    const wert = parseDeZahl(eingabe);
    pruefe(
      nahBei(wert, erwartet, 1e-9),
      `parseDeZahl(${JSON.stringify(eingabe)}) = ${wert}, erwartet ${erwartet}`
    );
  }
  pruefe(Number.isNaN(parseDeZahl('')), 'parseDeZahl("") sollte NaN ergeben');
  pruefe(Number.isNaN(parseDeZahl('abc')), 'parseDeZahl("abc") sollte NaN ergeben');
  console.log(`Zahlenparser: ${faelle.length} Fälle geprüft`);
}

// ---------------------------------------------------------------------------
// Generatoren: 1.000 Instanzen je Generator, unabhängig nachgerechnet.
// ---------------------------------------------------------------------------
const INSTANZEN = 1000;
const ERLAUBTE_TITEL = ['Formel', 'Umstellen', 'Einsetzen', 'Ergebnis'];

function pruefeInstanzUnabhaengig(generator, params, aufgabe, seed) {
  if (generator.id === 'dummy.addition') {
    const erwarteteSumme = params.a + params.b;
    for (const eingabe of aufgabe.eingaben) {
      pruefe(
        nahBei(eingabe.loesung, erwarteteSumme, 1e-9),
        `${generator.id} seed=${seed}: ${params.a}+${params.b} ergibt ${eingabe.loesung}, erwartet ${erwarteteSumme}`
      );
    }
    return;
  }
  throw new Error(`Kein unabhängiger Prüfweg für Generator "${generator.id}" hinterlegt.`);
}

function testeGenerator(generator) {
  for (let seed = 0; seed < INSTANZEN; seed++) {
    const rng = mulberry32(seed);
    const params = generator.waehleParameter(rng);
    const aufgabe = generator.baue(params);

    // Determinismus: gleicher Seed ergibt dieselben Parameter.
    const params2 = generator.waehleParameter(mulberry32(seed));
    pruefe(
      JSON.stringify(params) === JSON.stringify(params2),
      `${generator.id} seed=${seed}: waehleParameter ist nicht deterministisch`
    );

    // Teilpunkte müssen auf generator.punkte summieren.
    const summeTeilpunkte = aufgabe.eingaben.reduce((s, e) => s + e.punkte, 0);
    pruefe(
      summeTeilpunkte === generator.punkte,
      `${generator.id} seed=${seed}: Teilpunkte summieren auf ${summeTeilpunkte}, erwartet ${generator.punkte}`
    );

    // Jeder Lösungsschritt hat einen gültigen Titel und nicht-leeres LaTeX.
    for (const schritt of aufgabe.loesung.schritte) {
      pruefe(
        ERLAUBTE_TITEL.includes(schritt.titel),
        `${generator.id} seed=${seed}: unbekannter Schritt-Titel "${schritt.titel}"`
      );
      pruefe(
        typeof schritt.latex === 'string' && schritt.latex.length > 0 && !schritt.latex.includes('undefined'),
        `${generator.id} seed=${seed}: leerer oder kaputter LaTeX-Schritt ("${schritt.latex}")`
      );
    }

    // Unabhängige Nachrechnung auf einem anderen Weg als der Generator selbst.
    pruefeInstanzUnabhaengig(generator, params, aufgabe, seed);
  }
  console.log(`${generator.id}: ${INSTANZEN} Instanzen geprüft`);
}

testeZahlenparser();
for (const generator of GENERATOREN) {
  testeGenerator(generator);
}

if (fehler > 0) {
  console.error(`\n${fehler} Fehler gefunden.`);
  process.exit(1);
} else {
  console.log('\nAlle Tests bestanden.');
}
