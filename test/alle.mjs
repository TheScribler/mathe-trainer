#!/usr/bin/env node
// test/alle.mjs — Zahlenparser-Einheitstests plus 1.000 Instanzen je Generator,
// jede unabhängig nachgerechnet (siehe PLAN.md, Testkonzept).

import { mulberry32 } from '../src/rng.js';
import { parseDeZahl, nahBei } from '../src/zahl.js';
import { pruefeZahl } from '../src/pruefung.js';
import { GENERATOREN } from '../src/generatoren/index.js';
import { effektivzins } from '../src/generatoren/finanz.js';
import { testeFixtures } from './fixtures.mjs';

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
  // Regel (2026-10-19): Komma ist immer der Dezimaltrenner. Ohne Komma ist ein
  // einzelner Punkt der Dezimalpunkt — "1.234" und "1,234" ergeben deshalb
  // beide 1,234, nicht 1234. Siehe Kommentar in src/zahl.js.
  const faelle = [
    ['7782,55', 7782.55],          // ohne Tausenderpunkt (iPhone-Test, 2026-10-19)
    ['7.782,55', 7782.55],         // mit Tausenderpunkt + Komma als Dezimaltrenner
    ['7782.55', 7782.55],          // kein Komma: Punkt ist der Dezimalpunkt
    ['1.234', 1.234],              // kein Komma: Punkt ist der Dezimalpunkt, NICHT 1234
    ['1,234', 1.234],              // Komma ist der Dezimaltrenner — dieselbe Zahl wie oben
    ['100.000,00', 100000],        // Komma vorhanden: Punkt davor ist Tausendertrenner
    ['-5,25', -5.25],              // negativ
    ['-1.234,56', -1234.56],       // negativ, Komma vorhanden: Punkt ist Tausendertrenner
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
  // Mehrere Punkte ohne Komma sind absichtlich nicht auflösbar (siehe Regel oben).
  pruefe(
    Number.isNaN(parseDeZahl('1.234.567')),
    'parseDeZahl("1.234.567") sollte NaN ergeben (mehrdeutig ohne Komma)'
  );
  console.log(`Zahlenparser: ${faelle.length} Fälle geprüft`);
}

// ---------------------------------------------------------------------------
// Generatoren: 1.000 Instanzen je Generator, unabhängig nachgerechnet.
// ---------------------------------------------------------------------------
const INSTANZEN = 1000;
const ERLAUBTE_TITEL = ['Formel', 'Umstellen', 'Einsetzen', 'Ergebnis'];

// Nur in echten Formelfeldern (schritt.latex, ergebnis.latex) darf LaTeX-Syntax
// stehen. Alles andere ist reiner Fließtext und wird als {feld, text} eingesammelt,
// damit ein einziger Scan jedes Textfeld einer Aufgabe erfasst — auch neue Felder,
// die künftige Generatoren hinzufügen.
function sammlePlainTextFelder(aufgabe) {
  const felder = [{ feld: 'frage.text', text: aufgabe.frage.text }];

  for (const eingabe of aufgabe.eingaben) {
    felder.push({ feld: `eingaben[${eingabe.id}].label`, text: eingabe.label });
  }

  for (const schritt of aufgabe.loesung.schritte) {
    if (schritt.hinweis) felder.push({ feld: `loesung.schritte[${schritt.titel}].hinweis`, text: schritt.hinweis });
  }

  for (const ergebnis of aufgabe.loesung.ergebnisse ?? []) {
    felder.push({ feld: `loesung.ergebnisse[${ergebnis.label}].label`, text: ergebnis.label });
  }

  if (aufgabe.frage.tabelle) {
    const { kopf, zeilen } = aufgabe.frage.tabelle;
    kopf.forEach((titel, i) => felder.push({ feld: `frage.tabelle.kopf[${i}]`, text: String(titel) }));
    zeilen.forEach((zeile, i) => {
      zeile.forEach((wert, j) => felder.push({ feld: `frage.tabelle.zeilen[${i}][${j}]`, text: String(wert) }));
    });
  }

  return felder;
}

// "{,}" (KaTeX-Komma-Escape), "_" (LaTeX-Subscript), "^{" (LaTeX-Superscript)
// und "\;" (LaTeX-Spacing) haben in reinem Fließtext nichts zu suchen — dort
// gelten Unicode-Zeichen (rₜ, q²⁵) oder ganz ausgeschriebene Wörter.
const LATEX_RESTE = /\{,\}|_|\^\{|\\;/;

function wertVon(aufgabe, id) {
  const eingabe = aufgabe.eingaben.find((e) => e.id === id);
  if (!eingabe) throw new Error(`Eingabe "${id}" nicht gefunden`);
  return eingabe.loesung;
}

function pruefeInstanzUnabhaengig(generator, params, aufgabe, seed) {
  // aufgabe.params kann gegenüber params zusätzliche, abgeleitete Felder tragen
  // (z. B. Kn, iEffGegeben) — für die unabhängige Prüfung ist das die Quelle.
  const p = aufgabe.params;
  const kennzeichnung = `${generator.id} seed=${seed}`;

  if (generator.id === 'fin.rente-aus-kapital') {
    // Unabhängig: die n Zahlungen r einzeln abzinsen und aufsummieren muss R0 ergeben
    // (der Generator selbst nutzt die geschlossene Rentenbarwertformel, nicht die Summe).
    const r = wertVon(aufgabe, 'r');
    const i = p.iProzent / 100;
    let summe = 0;
    for (let t = 1; t <= p.n; t++) summe += r / Math.pow(1 + i, t);
    pruefe(
      nahBei(summe, p.R0, 0.15),
      `${kennzeichnung}: ${p.n}x ${r} abgezinst ergibt ${summe.toFixed(2)}, erwartet R0=${p.R0}`
    );
    return;
  }

  if (generator.id === 'fin.rente-veraenderlich') {
    // Unabhängig: Summe in umgekehrter Reihenfolge und mit Math.pow(.., -t) statt
    // Division nachrechnen — anderer Rechenweg als im Generator.
    const R0 = wertVon(aufgabe, 'R0');
    const i = p.iProzent / 100;
    const zahlungen = Array.from({ length: p.n }, (_, k) => p.r1 + k * p.d);
    let summe = 0;
    for (let t = p.n; t >= 1; t--) summe += zahlungen[t - 1] * Math.pow(1 + i, -t);
    pruefe(
      nahBei(summe, R0, 0.01),
      `${kennzeichnung}: Summe rückwärts ergibt ${summe.toFixed(4)}, erwartet R0=${R0}`
    );
    return;
  }

  if (generator.id === 'fin.verdopplungszeit') {
    const n = wertVon(aufgabe, 'n');
    const q = 1 + p.iProzent / 100;
    if (p.variante === 'A') {
      const probe = Math.pow(q, n);
      pruefe(
        nahBei(probe, p.faktor, 0.01),
        `${kennzeichnung}: q^n mit n=${n} ergibt ${probe.toFixed(4)}, erwartet Faktor ${p.faktor}`
      );
    } else {
      const probe = p.K0 * Math.pow(q, n);
      pruefe(
        nahBei(probe, p.Kn, 0.05),
        `${kennzeichnung}: K0*q^n mit n=${n} ergibt ${probe.toFixed(2)}, erwartet Kn=${p.Kn}`
      );
    }
    return;
  }

  if (generator.id === 'fin.effektivzins') {
    // Unabhängig: m-fache Aufzinsung per Schleife statt Math.pow, wie in PLAN.md
    // Testkonzept beschrieben ("m-fache Aufzinsung mit j=i_nom/m numerisch").
    if (p.richtung === 'vorwaerts') {
      // iEff ist jetzt laut Vorlesungsregel auf 4 Nachkommastellen (als
      // Dezimalzahl) gerundet, daher eine gröbere Toleranz als bei einem
      // exakten Wert: der Rundungsschritt selbst ist bis zu 0,00005 groß.
      const iEffLoesung = wertVon(aufgabe, 'iEff') / 100;
      const j = p.iNomProzent / 100 / p.m;
      let acc = 1;
      for (let k = 0; k < p.m; k++) acc *= 1 + j;
      pruefe(
        nahBei(acc - 1, iEffLoesung, 1e-4),
        `${kennzeichnung}: m-fache Aufzinsung ergibt ${(acc - 1)}, erwartet i_eff=${iEffLoesung}`
      );
    } else {
      const iNomLoesung = wertVon(aufgabe, 'iNom');
      const j = iNomLoesung / 100 / p.m;
      let acc = 1;
      for (let k = 0; k < p.m; k++) acc *= 1 + j;
      const iEffProbe = (acc - 1) * 100;
      pruefe(
        nahBei(iEffProbe, p.iEffGegeben, 0.01),
        `${kennzeichnung}: i_nom=${iNomLoesung} ergibt i_eff=${iEffProbe.toFixed(4)}, erwartet ${p.iEffGegeben}`
      );
    }
    return;
  }

  throw new Error(`Kein unabhängiger Prüfweg für Generator "${generator.id}" hinterlegt.`);
}

function testeGenerator(generator) {
  let textfelderGescannt = 0;
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

    // Jedes Textfeld (Fragetext, Labels, Hinweise, Tabellenzellen, Ergebnis-
    // Labels) ist reine Prosa — keine LaTeX-Reste wie "{,}", "_", "^{" oder "\;".
    const plainTextFelder = sammlePlainTextFelder(aufgabe);
    textfelderGescannt += plainTextFelder.length;
    for (const { feld, text } of plainTextFelder) {
      pruefe(
        !LATEX_RESTE.test(text),
        `${generator.id} seed=${seed}: ${feld} enthält LaTeX-Reste: "${text}"`
      );
    }

    // Unabhängige Nachrechnung auf einem anderen Weg als der Generator selbst.
    pruefeInstanzUnabhaengig(generator, params, aufgabe, seed);
  }
  console.log(`${generator.id}: ${INSTANZEN} Instanzen geprüft, ${textfelderGescannt} Textfelder auf LaTeX-Reste gescannt`);
}

// ---------------------------------------------------------------------------
// Toleranzgrenze bei Zinssatz-Antworten: MK2b (i_nom=3 %, m=12) -> i_eff=3,04 %.
// Die Antwort selbst ist jetzt gerundet (3,04), die Toleranz muss den
// ungerundeten Wert (3,0416) noch akzeptieren, aber die nächste 2-Dezimal-
// stellen-Rundungsstufe (3,05) bereits ablehnen (siehe CLAUDE.md Abschnitt 6).
// -----------------------------------------------------------------------------
function testeEffektivzinsToleranz() {
  const aufgabe = effektivzins.baue({ richtung: 'vorwaerts', m: 12, iNomProzent: 3 });
  const erwartet = aufgabe.eingaben[0].loesung;
  const toleranz = aufgabe.eingaben[0].toleranz;
  const faelle = [
    ['3,04', true], // exakt die gerundete Antwort
    ['3,0416', true], // ungerundeter Wert laut Hinweis
    ['3,05', false], // schon die nächste Rundungsstufe — darf nicht akzeptiert werden
  ];
  for (const [eingabe, sollRichtigSein] of faelle) {
    const ergebnis = pruefeZahl(eingabe, erwartet, toleranz);
    pruefe(
      ergebnis.korrekt === sollRichtigSein,
      `Effektivzins-Toleranz: "${eingabe}" korrekt=${ergebnis.korrekt}, erwartet ${sollRichtigSein} (Antwort=${erwartet}, Toleranz=${toleranz})`
    );
  }
  console.log(`Effektivzins-Toleranz: ${faelle.length} Fälle geprüft`);
}

testeZahlenparser();
testeEffektivzinsToleranz();
fehler += testeFixtures();
for (const generator of GENERATOREN) {
  testeGenerator(generator);
}

if (fehler > 0) {
  console.error(`\n${fehler} Fehler gefunden.`);
  process.exit(1);
} else {
  console.log('\nAlle Tests bestanden.');
}
