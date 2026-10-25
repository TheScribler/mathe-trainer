#!/usr/bin/env node
// test/alle.mjs — Zahlenparser-Einheitstests plus 1.000 Instanzen je Generator,
// jede unabhängig nachgerechnet (siehe PLAN.md, Testkonzept).

import { mulberry32 } from '../src/rng.js';
import { parseDeZahl, nahBei, ggT, minimaleNachkommastellen } from '../src/zahl.js';
import { pruefeZahl, bewerteKoeffizientenZeile, bewerteMatrix, rundePunkteAbwaerts } from '../src/pruefung.js';
import { GENERATOREN, GENERATOREN_NACH_TEIL } from '../src/generatoren/index.js';
import { effektivzins } from '../src/generatoren/finanz.js';
import { komponiereKlausur } from '../src/komposer.js';
import { testeFixtures } from './fixtures.mjs';
import { KONFIG } from '../src/konfig.js';

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
    // Brüche (Integralrechnung-Antwortfelder, siehe Phase-3-Nachbesserung):
    // "Zähler/Nenner", beide Seiten selbst wieder über denselben Parser.
    ['2/3', 2 / 3],
    ['-1/4', -0.25],
    ['6/-4', -1.5],
    ['-2/3', -2 / 3],
    ['10/4', 2.5],
    ['1,5/2', 0.75],
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
  pruefe(Number.isNaN(parseDeZahl('2/0')), 'parseDeZahl("2/0") sollte NaN ergeben (Division durch 0)');
  pruefe(Number.isNaN(parseDeZahl('2/3/4')), 'parseDeZahl("2/3/4") sollte NaN ergeben (mehr als ein "/")');
  console.log(`Zahlenparser: ${faelle.length} Fälle geprüft`);
}

// ---------------------------------------------------------------------------
// Generatoren: 1.000 Instanzen je Generator, unabhängig nachgerechnet.
// ---------------------------------------------------------------------------
const INSTANZEN = 1000;
const ERLAUBTE_TITEL = ['Formel', 'Umstellen', 'Einsetzen', 'Ergebnis'];

// Hilfsfunktionen für unabhängige numerische Prüfwege (siehe PLAN.md,
// Testkonzept: "Ableitung per Differenzenquotient" usw.).
function wertePolynom(koeffAbsteigend, exponenten, x) {
  return koeffAbsteigend.reduce((summe, k, i) => summe + k * Math.pow(x, exponenten[i]), 0);
}

function ableitungNumerisch(f, x, h = 1e-4) {
  return (f(x + h) - f(x - h)) / (2 * h);
}

// Simpson-Quadratur — ein von der symbolischen Stammfunktion des Generators
// unabhängiger Rechenweg für die Integralrechnung (int.bestimmt,
// int.konsumentenrente, siehe PLAN.md Testkonzept).
function simpson(f, a, b, n = 2000) {
  if (n % 2 !== 0) n += 1;
  const h = (b - a) / n;
  let summe = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    summe += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  }
  return (h / 3) * summe;
}

// Separat geschriebene Dreifachschleife für die Lineare Algebra (PLAN.md
// Testkonzept) — unabhängig von der gleichnamigen Funktion in algebra.js.
function matrixMalUnabhaengig(a, b) {
  const ergebnis = [];
  for (let i = 0; i < a.length; i++) {
    const zeile = [];
    for (let k = 0; k < b[0].length; k++) {
      let summe = 0;
      for (let j = 0; j < b.length; j++) summe += a[i][j] * b[j][k];
      zeile.push(summe);
    }
    ergebnis.push(zeile);
  }
  return ergebnis;
}

function partielleAbleitungNumerisch(f, x, y, nachX, h = 1e-4) {
  return nachX
    ? (f(x + h, y) - f(x - h, y)) / (2 * h)
    : (f(x, y + h) - f(x, y - h)) / (2 * h);
}

// Numerische Hesse-Matrix per finiter Differenzen — ein anderer Rechenweg als
// die symbolischen zweiten Ableitungen des Generators. Klassifikation über
// Det(H) und fxx ist für eine quadratische Form exakt (keine Kreis-Abtastung
// nötig, die bei schmalem Sattel-Kegel und wenigen Abtastwinkeln unzuverlässig
// werden kann — genau das ist beim ersten Testentwurf hier aufgetreten).
function klassifiziereNumerisch(f, x, y, h = 1e-3) {
  const fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h);
  const fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h);
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h);
  const det = fxx * fyy - fxy * fxy;
  if (det < -1e-2) return 'Sattelpunkt';
  return fxx < 0 ? 'Maximum' : 'Minimum';
}

// Nur in echten Formelfeldern (schritt.latex, ergebnis.latex) darf LaTeX-Syntax
// stehen. Alles andere ist reiner Fließtext und wird als {feld, text} eingesammelt,
// damit ein einziger Scan jedes Textfeld einer Aufgabe erfasst — auch neue Felder,
// die künftige Generatoren hinzufügen.
function sammlePlainTextFelder(aufgabe) {
  const felder = [];
  if (aufgabe.frage.text) felder.push({ feld: 'frage.text', text: aufgabe.frage.text });
  if (aufgabe.titel) felder.push({ feld: 'titel', text: aufgabe.titel });

  for (const teil of aufgabe.frage.teile ?? []) {
    if (teil.label) felder.push({ feld: `frage.teile[${teil.label}].label`, text: teil.label });
    if (teil.text) felder.push({ feld: `frage.teile[${teil.label}].text`, text: teil.text });
  }

  for (const eingabe of aufgabe.eingaben) {
    felder.push({ feld: `eingaben[${eingabe.id}].label`, text: eingabe.label });
    if (eingabe.teilLabel) felder.push({ feld: `eingaben[${eingabe.id}].teilLabel`, text: eingabe.teilLabel });
    if (eingabe.teilHinweis) felder.push({ feld: `eingaben[${eingabe.id}].teilHinweis`, text: eingabe.teilHinweis });
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

// "{,}" (KaTeX-Komma-Escape), "_" (LaTeX-Subscript), "^" (LaTeX-Superscript,
// auch ohne Klammern wie "x^2" — genau dieser Fall ist in diff.ableitungen
// tatsächlich aufgetreten und wurde deshalb hier mit aufgenommen) und jeder
// Backslash-Befehl ("\dfrac", "\sqrt", "\;" usw.) haben in reinem Fließtext
// nichts zu suchen — dort gelten Unicode-Zeichen (rₜ, q²⁵, √) oder ganz
// ausgeschriebene Wörter.
const LATEX_RESTE = /\{,\}|_|\^|\\(?:[a-zA-Z]|;)/;

// In reinem Fließtext (Labels, Fragetext, Hinweise — anders als in echten
// LaTeX-Feldern, wo "-" das korrekte Minuszeichen ist) muss eine negative
// Zahl immer den echten Unicode-Minus "−" zeigen, nicht den ASCII-
// Bindestrich — tatsächlich mehrfach aufgetreten: "f'(-1)" statt "f'(−1)"
// (Zahlencheck-Labels), "Grenzen -1 bis 3" (int.bestimmt, Integralgrenze),
// "G''(x) = -5 < 0" (ein Hinweis-Satz). Ursprünglich nur direkt nach einer
// öffnenden Klammer geprüft ("\(-\d"), jetzt JEDES "-" direkt vor einer
// Ziffer, das nicht bereits Teil einer größeren Zahl ist (kein Buchstabe,
// keine Ziffer, kein Punkt direkt davor — sonst würde z. B. eine Dezimalzahl
// oder ein zusammengesetztes Bezeichner-Suffix fälschlich mitgezählt).
const ASCII_MINUS_VOR_ZIFFER = /(?<![\w.])-\d/;

// "x²", "x⁻³" usw. — ein Exponent direkt nach der Polynom-Variable x/y in
// reinem Fließtext kann mitten im Exponenten umbrechen ("x" am Zeilenende,
// "²" allein auf der nächsten Zeile, iPhone-Rückmeldung). Solche Funktions-
// terme gehören als echtes KaTeX in frage.formel, nicht in frage.text/-teile/
// Labels. Andere Unicode-Hochzahlen in reiner Prosa bleiben erlaubt (z. B.
// "q²⁵" für den Aufzinsungsfaktor in der Finanzmathematik, siehe LATEX_RESTE-
// Kommentar oben) — hier geht es ausschließlich um x/y als Funktionsvariable.
const PLAINTEXT_VARIABLEN_EXPONENT = /[xy][⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/;

// "x₁x₂" (zwei tiefgestellte Indexvariablen OHNE Operator dazwischen, die
// formelübliche Juxtaposition für eine Multiplikation) ist ein starkes
// Signal für eine ganze, seedabhängige Formel in reinem Fließtext statt
// echtem KaTeX (diff.nutzenmaximum zeigte "U(x₁,x₂) = αx₁ + βx₂ + γx₁x₂ + δ",
// iPhone-Rückmeldung) — anders als eine einzelne, kurze Erwähnung wie
// "an der Stelle x₀ = 4" (diff.elastizitaet), die nie mitten im Index
// umbricht und darum nicht gemeint ist. NUR für echte Fließtext-Sätze
// (frage.text, frage.teile[].text), nicht für Eingabefeld-Labels.
const PLAINTEXT_INDEXVARIABLE = /[a-zA-Z][₀₁₂₃₄₅₆₇₈₉]+[a-zA-Z][₀₁₂₃₄₅₆₇₈₉]/;
function istFliesstextFormelFeld(feld) {
  return feld === 'frage.text' || /^frage\.teile\[.*\]\.text$/.test(feld);
}

// "\cdotI" statt "\cdot I" — ein LaTeX-Steuerwort wie "\cdot" verschluckt
// beim Parsen ein einzelnes Leerzeichen danach, direkt gefolgt von einem
// Buchstaben wird daraus im Textmodus ein unbekannter Befehl (roter KaTeX-
// Fehler) — tatsächlich bei den Gauß-Zeilenlabels in alg.lgs aufgetreten
// ("\cdot I" im Quelltext wurde zu "\cdotI" ohne sichtbares Leerzeichen,
// iPhone-Rückmeldung). "\cdot" muss darum IMMER von einem Nicht-Buchstaben
// gefolgt sein (Ziffer, Klammer, Backslash, Leerzeichen vor einer Zahl usw.).
const CDOT_OHNE_LEERZEICHEN = /\\cdot[a-zA-Z]/;

// Koeffizient 1 bzw. -1 muss weggelassen werden ("x" statt "1x", "x0" statt
// "1 \cdot x0") — tatsächlich mehrfach in diff.js aufgetreten (P1=1, 2c=1,
// E=±1 je nach Zufallszug). "1x"/"1\cdot" zählt nur, wenn die "1" davor nicht
// Teil einer größeren Zahl ist (Start, Leerzeichen, +, -, "(" davor). "y" und
// "\lambda" zusätzlich zu "x", weil beide als Variable in diff.js vorkommen
// (2-Variablen-Extremwerte, Lagrange). "\cdot (1)"/"(1) \cdot" (auch mit
// Mediopunkt "·" statt "\cdot") zusätzlich, weil ein nicht-vereinfachter
// Nenner wie "2 \cdot (1)" von der ursprünglichen Regel nicht erfasst wurde
// (die "1" steht dort in Klammern, nicht direkt vor der Variable).
//
// "1 \cdot"/"1·" wird NUR geflaggt, wenn danach keine (optional geklammerte,
// optional negative) Zahl folgt — (?!\s*\(?-?\d) schließt genau das aus.
// Grund: in algebra.js steht "1 \cdot (-2)" als echter Skalarprodukt-Summand
// (zwei Matrixeinträge, von denen einer zufällig 1 ist) — dort ist die "1"
// kein weglassbarer Koeffizient vor einer Variable, sondern ein Operand wie
// jeder andere, und MUSS stehen bleiben.
const KOEFFIZIENT_EINS = /(^|[\s+\-(])1(x\b|y\b|\\lambda\b|\s*\\cdot(?!\s*\(?-?\d)|·(?!\s*\(?-?\d))|\\cdot\s*\(1\)|\(1\)\s*\\cdot|·\s*\(1\)|\(1\)\s*·/;

// "+ -3" oder "- -3" (zwei Vorzeichen direkt hintereinander, mit oder ohne
// Leerzeichen, ASCII "-" oder Unicode "−" in jeder Mischung) lesen sich
// falsch — eine negative Zahl nach einem Operator braucht entweder eine
// Klammer ("2 + (−4)") oder ein zusammengeführtes Vorzeichen ("2 − 4"), nie
// "2 + −4". Ein "(" zwischen den beiden Zeichen (bereits korrekt geklammert)
// matcht nicht, weil dort kein zweites Vorzeichen direkt folgt.
const DOPPELVORZEICHEN = /[+\-−]\s*[-−]/;

// Zwei öffnende Klammern direkt hintereinander ("((") entstehen typischerweise,
// wenn ein bereits geklammerter eingesetzter Wert (z. B. "(-1)" für ein
// negatives x₀) noch einmal in eine äußere Klammer gesetzt wird — etwa als
// Argument einer Funktion, die ihre eigenen Klammern schon mitbringt
// ("f'((-1))" statt "f'(-1)"), oder als führender Summand, der gleich danach
// fürs Quadrieren noch einmal umklammert wird ("((-1) + 3)²" statt
// "(-1 + 3)²"). Tatsächlich in diff.ableitungen und diff.partielle-
// ableitungen aufgetreten (Audit gegen Übung 9-11, iPhone-Rückmeldung).
const DOPPELKLAMMER = /\(\(/;

// "f(x)|_{x=7} = 11" (Auswertungsstrich-Kurzschreibweise) zeigt nicht, WIE
// eingesetzt und ausgerechnet wurde — jeder Zwischenschritt mit Zahlen muss
// ausgeschrieben sein ("p(7) = 25 − 2·7 = 25 − 14 = 11" statt "p(7) = 25 −
// 2x|_{x=7} = 11", iPhone-Rückmeldung: diff.gewinn-breakeven nutzte das für
// p(x*)/G(x*)).
const AUSWERTUNGSSTRICH_KURZSCHREIBWEISE = /\|_\{?x\s*=/;

// Jeder "\dfrac{zaehler}{nenner}" mit rein numerischem Zähler/Nenner (keine
// Variable, kein Dezimalkomma — das wäre kein echter Bruch, sondern eine
// Division wie "a/2,5") muss bereits gekürzt sein, z. B. "2/5" statt "4/10"
// (siehe Phase-3-Nachbesserung, int.bestimmt hatte das real aufgetreten).
const DFRAC_NUMERISCH = /\\dfrac\{(-?\d+)\}\{(\d+)\}/g;
function pruefeGekuerzteBrueche(text, feld, kennzeichnung) {
  for (const treffer of text.matchAll(DFRAC_NUMERISCH)) {
    const zaehler = Number(treffer[1]);
    const nenner = Number(treffer[2]);
    if (nenner === 0) continue;
    const g = ggT(zaehler, nenner);
    pruefe(g === 1, `${kennzeichnung}: ${feld} zeigt einen ungekürzten Bruch "${treffer[0]}" (ggT=${g}): "${text}"`);
  }
}

// Jeder Euro-Betrag braucht entweder 0 Nachkommastellen (glatter Betrag,
// "68.000 €") oder genau 2 ("48.733,20 €") — nie 1 ("48.733,2 €", das hätte
// minimaleNachkommastellen liefern können) und nie mehr als 2 (Geld wird
// immer auf den Cent gerundet, siehe CLAUDE.md Abschnitt 6). Matcht sowohl
// die LaTeX-Form ("48.733{,}20\ \text{€}") als auch reinen Fließtext
// ("48.733,20 €") — iPhone-Rückmeldung.
const GELD_BETRAG = /(\d{1,3}(?:\.\d{3})*)(?:(?:\{,\}|,)(\d+))?\s*(?:€|\\text\{€\})/g;
function pruefeGeldFormat(text, feld, kennzeichnung) {
  for (const treffer of text.matchAll(GELD_BETRAG)) {
    const nachkommastellen = treffer[2] ? treffer[2].length : 0;
    pruefe(
      nachkommastellen === 0 || nachkommastellen === 2,
      `${kennzeichnung}: ${feld} zeigt einen Euro-Betrag mit ${nachkommastellen} Nachkommastellen statt 0 oder 2 ("${treffer[0]}"): "${text}"`
    );
  }
}

function sammleAlleTextfelder(aufgabe) {
  // Für den Koeffizient-1-Scan zählen auch echte Formelfelder (im Gegensatz
  // zu sammlePlainTextFelder, das genau die NICHT prüft) — die Regel gilt
  // überall, nicht nur in reiner Prosa.
  const felder = sammlePlainTextFelder(aufgabe);
  if (aufgabe.frage.formel) felder.push({ feld: 'frage.formel', text: aufgabe.frage.formel });
  for (const teil of aufgabe.frage.teile ?? []) {
    if (teil.formel) felder.push({ feld: `frage.teile[${teil.label}].formel`, text: teil.formel });
  }
  for (const schritt of aufgabe.loesung.schritte) {
    felder.push({ feld: `loesung.schritte[${schritt.titel}].latex`, text: schritt.latex });
  }
  for (const ergebnis of aufgabe.loesung.ergebnisse ?? []) {
    felder.push({ feld: `loesung.ergebnisse[${ergebnis.label}].latex`, text: ergebnis.latex });
  }
  return felder;
}

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

  if (generator.id === 'fin.verzinsung-grundformen') {
    const Kn = wertVon(aufgabe, 'Kn');
    const i = p.iProzent / 100;
    if (p.art === 'einfach') {
      // Unabhängig: Jahr für Jahr denselben Zins auf K0 aufaddieren (Schleife)
      // statt der geschlossenen Form K0*(1+i*n).
      let K = p.K0;
      for (let jahr = 0; jahr < p.n; jahr++) K += p.K0 * i;
      pruefe(nahBei(K, Kn, 0.01), `${kennzeichnung}: einfache Verzinsung schrittweise ${K.toFixed(2)}, erwartet Kn=${Kn}`);
    } else if (p.art === 'unterjaehrig') {
      // Unabhängig: s Einzelperioden per Schleife aufzinsen statt Math.pow.
      const j = i / p.m;
      let K = p.K0;
      for (let periode = 0; periode < p.n * p.m; periode++) K *= 1 + j;
      pruefe(nahBei(K, Kn, 0.01), `${kennzeichnung}: unterjährige Verzinsung schrittweise ${K.toFixed(2)}, erwartet Kn=${Kn}`);
    } else {
      // Unabhängig: stetige Verzinsung als Grenzwert sehr vieler, sehr kleiner
      // Zinsperioden (statt e^(i·n) direkt) — Schrittzahl so hoch, dass die
      // Näherung an e^(i·n) auf 2 Nachkommastellen sicher trägt.
      const schritte = 200000;
      const j = (i * p.n) / schritte;
      let K = p.K0;
      for (let schritt = 0; schritt < schritte; schritt++) K *= 1 + j;
      pruefe(nahBei(K, Kn, 0.2), `${kennzeichnung}: stetige Verzinsung als Grenzwert ${K.toFixed(2)}, erwartet Kn=${Kn}`);
    }
    // "Jeder Rechenschritt wird gezeigt" (CLAUDE.md): das Einsetzen darf
    // nicht direkt von der Formel zum Endwert springen, sondern muss den
    // Zwischenfaktor (1+i·n bzw. (1+j)^s bzw. e^(i·n)) als eigene Zeile
    // zeigen — erkennbar an der mehrzeiligen aligned-Kette statt einer
    // einzelnen Zeile (iPhone-Rückmeldung).
    const einsetzenVG = aufgabe.loesung.schritte.find((s) => s.titel === 'Einsetzen');
    pruefe(einsetzenVG.latex.includes('\\begin{aligned}'),
      `${kennzeichnung}: Einsetzen-Schritt zeigt keinen Zwischenschritt (springt direkt zum Ergebnis): "${einsetzenVG.latex}"`);
    return;
  }

  if (generator.id === 'fin.endwert-rente') {
    // Unabhängig: Jahr für Jahr die Zahlung verbuchen und den Kontostand
    // aufzinsen (Schleife) statt der geschlossenen Rentenendwertformel.
    const Rn = wertVon(aufgabe, 'Rn');
    const q = 1 + p.iProzent / 100;
    let bestand = 0;
    for (let jahr = 0; jahr < p.n; jahr++) {
      bestand = p.variante === 'vorschuessig' ? (bestand + p.r) * q : bestand * q + p.r;
    }
    pruefe(nahBei(bestand, Rn, 0.01), `${kennzeichnung}: Kontostand schrittweise ${bestand.toFixed(2)}, erwartet Rn=${Rn}`);
    // "Jeder Rechenschritt wird gezeigt": q^n und der Bruch daraus müssen als
    // eigene Zeilen erscheinen, nicht nur das Endergebnis (iPhone-Rückmeldung).
    const einsetzenER = aufgabe.loesung.schritte.find((s) => s.titel === 'Einsetzen');
    pruefe(einsetzenER.latex.includes('q^n') && einsetzenER.latex.includes('\\begin{aligned}'),
      `${kennzeichnung}: Einsetzen-Schritt zeigt q^n/Bruch nicht als eigene Zwischenschritte: "${einsetzenER.latex}"`);
    return;
  }

  if (generator.id === 'fin.ewige-rente') {
    // Unabhängig: endliche Summe über sehr viele Perioden (Grenzwert n → ∞)
    // statt der geschlossenen Formel r/i bzw. r'+r'/i.
    const R0 = wertVon(aufgabe, 'R0');
    const q = 1 + p.iProzent / 100;
    const N = 4000;
    let summe = 0;
    for (let t = p.variante === 'vorschuessig' ? 0 : 1; t <= (p.variante === 'vorschuessig' ? N - 1 : N); t++) {
      summe += p.r / Math.pow(q, t);
    }
    pruefe(nahBei(summe, R0, 0.5), `${kennzeichnung}: endliche Summe (N=${N}) ${summe.toFixed(2)}, erwartet R0=${R0}`);
    // "Jeder Rechenschritt wird gezeigt": vorschüssig darf r'/i nicht direkt
    // in derselben Zeile wie die Addition verschwinden, sondern muss selbst
    // als Zwischenwert erscheinen (iPhone-Rückmeldung). Nachschüssig ist eine
    // einzelne Division — dort ist eine Zeile bereits der vollständige Weg.
    if (p.variante === 'vorschuessig') {
      const einsetzenEwR = aufgabe.loesung.schritte.find((s) => s.titel === 'Einsetzen');
      pruefe(einsetzenEwR.latex.includes('\\begin{aligned}'),
        `${kennzeichnung}: vorschüssige ewige Rente zeigt r'/i nicht als eigenen Zwischenschritt: "${einsetzenEwR.latex}"`);
    }
    return;
  }

  if (generator.id === 'fin.tilgungsplan') {
    // Unabhängig: die Tabelle frisch nachrechnen (eigene Schleife, nicht die
    // baueTilgungstabelle-Hilfsfunktion des Generators selbst).
    const plan = wertVon(aufgabe, 'plan');
    const i = p.iProzent / 100;
    const q = 1 + i;
    const annuitaet = p.art === 'annuitaet' ? (p.K0 * Math.pow(q, p.n) * i) / (Math.pow(q, p.n) - 1) : null;
    const tilgungKonstant = p.art === 'raten' ? p.K0 / p.n : null;
    let restschuld = p.K0;
    for (let jahr = 1; jahr <= p.n; jahr++) {
      const zinsen = restschuld * i;
      const tilgung = p.art === 'raten' ? tilgungKonstant : annuitaet - zinsen;
      const jahresAnnuitaet = p.art === 'raten' ? zinsen + tilgung : annuitaet;
      restschuld -= tilgung;
      const zeile = plan[jahr - 1];
      pruefe(nahBei(zeile[0], restschuld, 0.5), `${kennzeichnung}: Jahr ${jahr} Restschuld nachgerechnet ${restschuld.toFixed(2)}, erwartet ${zeile[0]}`);
      pruefe(nahBei(zeile[1], zinsen, 0.5), `${kennzeichnung}: Jahr ${jahr} Zinsen nachgerechnet ${zinsen.toFixed(2)}, erwartet ${zeile[1]}`);
      pruefe(nahBei(zeile[2], tilgung, 0.5), `${kennzeichnung}: Jahr ${jahr} Tilgung nachgerechnet ${tilgung.toFixed(2)}, erwartet ${zeile[2]}`);
      pruefe(nahBei(zeile[3], jahresAnnuitaet, 0.5), `${kennzeichnung}: Jahr ${jahr} Annuität nachgerechnet ${jahresAnnuitaet.toFixed(2)}, erwartet ${zeile[3]}`);
    }
    // "Jeder Rechenschritt wird gezeigt": JEDES Jahr braucht seinen eigenen
    // Schritt, nicht nur Jahr 1 (iPhone-Rückmeldung) — also mindestens n
    // "Einsetzen"-Schritte mit eigenem Jahres-Hinweis, plus der einen Schritt
    // für die Konstante (T bzw. A) davor.
    const einsetzenSchritteTP = aufgabe.loesung.schritte.filter((s) => s.titel === 'Einsetzen');
    pruefe(einsetzenSchritteTP.length === p.n + 1,
      `${kennzeichnung}: ${einsetzenSchritteTP.length} Einsetzen-Schritte, erwartet ${p.n + 1} (1 Konstante + ${p.n} Jahre)`);
    return;
  }

  if (generator.id === 'diff.gewinn-breakeven') {
    const eKoeff = wertVon(aufgabe, 'E');
    const gKoeff = wertVon(aufgabe, 'G');
    const kKoeff = [eKoeff[0] - gKoeff[0], eKoeff[1] - gKoeff[1], eKoeff[2] - gKoeff[2]]; // K = E - G
    const exp = [2, 1, 0];

    // E(x) muss an mehreren Stellen mit p(x)·x übereinstimmen.
    for (const x of [0, 1, 3, p.x0]) {
      const eErwartet = (p.a - p.b * x) * x;
      pruefe(nahBei(wertePolynom(eKoeff, exp, x), eErwartet, 1e-6),
        `${kennzeichnung}: E(${x}) laut Koeffizienten ${wertePolynom(eKoeff, exp, x)}, erwartet ${eErwartet}`);
    }
    // G muss an x1 und x2 Nullstellen haben.
    for (const x of [p.x1, p.x2]) {
      pruefe(nahBei(wertePolynom(gKoeff, exp, x), 0, 1e-4),
        `${kennzeichnung}: G(${x}) = ${wertePolynom(gKoeff, exp, x)}, erwartet 0`);
    }
    // K'(x0) numerisch aus K = E - G (eigener Rechenweg, nicht die analytische Ableitung).
    const kVonX = (x) => wertePolynom(kKoeff, exp, x);
    pruefe(nahBei(ableitungNumerisch(kVonX, p.x0), wertVon(aufgabe, 'Kstrich'), 1e-3),
      `${kennzeichnung}: K'(${p.x0}) numerisch ${ableitungNumerisch(kVonX, p.x0)}, erwartet ${wertVon(aufgabe, 'Kstrich')}`);
    // Grenzkosten müssen auf dem gesamten ökonomisch relevanten Bereich
    // [0, x2] positiv sein — negative Grenzkosten wären ökonomisch sinnlos
    // (iPhone-Rückmeldung: "x² − 17x + 120" lieferte K'(6) = −5).
    for (const x of [0, p.x2 / 4, p.x2 / 2, (3 * p.x2) / 4, p.x2]) {
      const kStrich = ableitungNumerisch(kVonX, x);
      pruefe(kStrich > 0, `${kennzeichnung}: K'(${x}) = ${kStrich} ist nicht positiv (Grenzkosten müssen auf [0, x2] positiv sein)`);
    }
    // xmax: G'(xmax)=0 numerisch; pmax, gmax direkt an der Stelle xmax.
    const gVonX = (x) => wertePolynom(gKoeff, exp, x);
    const xmax = wertVon(aufgabe, 'xmax');
    pruefe(nahBei(ableitungNumerisch(gVonX, xmax), 0, 1e-2),
      `${kennzeichnung}: G'(${xmax}) numerisch ${ableitungNumerisch(gVonX, xmax)}, erwartet 0`);
    pruefe(nahBei(gVonX(xmax), wertVon(aufgabe, 'gmax'), 1e-2),
      `${kennzeichnung}: G(xmax)=${gVonX(xmax)}, erwartet gmax=${wertVon(aufgabe, 'gmax')}`);
    pruefe(nahBei(p.a - p.b * xmax, wertVon(aufgabe, 'pmax'), 1e-2),
      `${kennzeichnung}: p(xmax)=${p.a - p.b * xmax}, erwartet pmax=${wertVon(aufgabe, 'pmax')}`);
    return;
  }

  if (generator.id === 'diff.extremwerte-2var') {
    const fVon = (x, y) => Math.pow(x, 3) + p.a * x * y + p.b * x * x + p.c * y * y;
    for (const [x, y, typErwartet, wertId] of [
      [wertVon(aufgabe, 'p1x'), wertVon(aufgabe, 'p1y'), wertVon(aufgabe, 'p1typ'), 'p1wert'],
      [wertVon(aufgabe, 'p2x'), wertVon(aufgabe, 'p2y'), wertVon(aufgabe, 'p2typ'), 'p2wert'],
    ]) {
      pruefe(Math.abs(partielleAbleitungNumerisch(fVon, x, y, true)) < 1e-2,
        `${kennzeichnung}: f_x(${x},${y}) numerisch ungleich 0`);
      pruefe(Math.abs(partielleAbleitungNumerisch(fVon, x, y, false)) < 1e-2,
        `${kennzeichnung}: f_y(${x},${y}) numerisch ungleich 0`);
      pruefe(nahBei(fVon(x, y), wertVon(aufgabe, wertId), 1e-2),
        `${kennzeichnung}: f(${x},${y})=${fVon(x, y)}, erwartet ${wertVon(aufgabe, wertId)}`);
      const klassifikation = klassifiziereNumerisch(fVon, x, y);
      pruefe(klassifikation === typErwartet,
        `${kennzeichnung}: numerische Hesse-Matrix an (${x},${y}) ergibt ${klassifikation}, erwartet ${typErwartet}`);
    }
    return;
  }

  if (generator.id === 'diff.extremwerte-2var-quadratisch') {
    const fVon = (x, y) => p.A * x * x + p.B * x + p.C * y * y + p.D * y + p.E * x * y + p.F;
    const x = wertVon(aufgabe, 'x');
    const y = wertVon(aufgabe, 'y');
    pruefe(Math.abs(partielleAbleitungNumerisch(fVon, x, y, true)) < 1e-2,
      `${kennzeichnung}: f_x(${x},${y}) numerisch ungleich 0`);
    pruefe(Math.abs(partielleAbleitungNumerisch(fVon, x, y, false)) < 1e-2,
      `${kennzeichnung}: f_y(${x},${y}) numerisch ungleich 0`);
    pruefe(nahBei(fVon(x, y), wertVon(aufgabe, 'wert'), 1e-2),
      `${kennzeichnung}: f(${x},${y})=${fVon(x, y)}, erwartet ${wertVon(aufgabe, 'wert')}`);
    const klassifikation = klassifiziereNumerisch(fVon, x, y);
    pruefe(klassifikation === wertVon(aufgabe, 'typ'),
      `${kennzeichnung}: numerische Hesse-Matrix an (${x},${y}) ergibt ${klassifikation}, erwartet ${wertVon(aufgabe, 'typ')}`);
    return;
  }

  if (generator.id === 'diff.nutzenmaximum') {
    const x1 = wertVon(aufgabe, 'x1');
    const x2 = wertVon(aufgabe, 'x2');
    // Budget muss exakt eingehalten werden.
    pruefe(nahBei(p.P1 * x1 + p.P2 * x2, p.P1 * p.x1Stern + p.P2 * p.x2Stern, 1e-6),
      `${kennzeichnung}: Budget P1·x1+P2·x2=${p.P1 * x1 + p.P2 * x2} weicht vom Einkommen ab`);
    const uVon = (x1_, x2_) => p.alpha * x1_ + p.beta * x2_ + p.gamma * x1_ * x2_ + p.delta;
    const uOptimum = uVon(x1, x2);
    // U im Optimum muss größer sein als an zulässigen Nachbarpunkten auf
    // der Budgetgeraden (x1 leicht verschoben, x2 passt sich an).
    for (const dx of [-1, 1]) {
      const x1Nachbar = x1 + dx;
      const x2Nachbar = (p.P1 * p.x1Stern + p.P2 * p.x2Stern - p.P1 * x1Nachbar) / p.P2;
      pruefe(uOptimum >= uVon(x1Nachbar, x2Nachbar) - 1e-6,
        `${kennzeichnung}: U(${x1Nachbar},${x2Nachbar})=${uVon(x1Nachbar, x2Nachbar)} > U im Optimum ${uOptimum}`);
    }
    return;
  }

  if (generator.id === 'diff.ableitungen') {
    const faWert = wertVon(aufgabe, 'a_check');
    const fbWert = wertVon(aufgabe, 'b_check');
    // 0,01 statt 1e-3: faWert/fbWert sind auf 2 Nachkommastellen gerundete
    // Klausur-Ergebnisse (CLAUDE.md Abschnitt 6), nicht mehr der exakte Wert
    // — die Toleranz muss die Rundung (bis 0,005) plus die eigene kleine
    // Ungenauigkeit des Differenzenquotienten decken.
    const variante = p.variante ?? 0;
    if (variante === 1) {
      const faVon = (x) => (p.m * x + p.n) / (p.p * x + p.q);
      const fbVon = (x) => p.k * Math.exp(p.c * x);
      pruefe(nahBei(ableitungNumerisch(faVon, p.x0a), faWert, 0.01),
        `${kennzeichnung}: f'(${p.x0a}) numerisch (a, Quotientenregel) = ${ableitungNumerisch(faVon, p.x0a)}, erwartet ${faWert}`);
      pruefe(nahBei(ableitungNumerisch(fbVon, p.x0b), fbWert, 0.01),
        `${kennzeichnung}: f'(${p.x0b}) numerisch (b, e-Funktion) = ${ableitungNumerisch(fbVon, p.x0b)}, erwartet ${fbWert}`);
    } else if (variante === 2) {
      const faVon = (x) => p.k * Math.log(p.c * x + p.d);
      const fbVon = (x) => p.kB * (Math.log(x) / Math.log(p.basis));
      pruefe(nahBei(ableitungNumerisch(faVon, p.x0a), faWert, 0.01),
        `${kennzeichnung}: f'(${p.x0a}) numerisch (a, ln) = ${ableitungNumerisch(faVon, p.x0a)}, erwartet ${faWert}`);
      pruefe(nahBei(ableitungNumerisch(fbVon, p.x0b), fbWert, 0.01),
        `${kennzeichnung}: f'(${p.x0b}) numerisch (b, log_a) = ${ableitungNumerisch(fbVon, p.x0b)}, erwartet ${fbWert}`);
    } else if (variante === 3) {
      const faVon = (x) => p.k * Math.pow(p.basis, x);
      const fbVon = (x) => p.p * x * x * x + p.q * x * x;
      // Zweite Ableitung: Differenzenquotient zweiter Ordnung, nicht zweimal
      // der erste (eigener, getrennter Rechenweg statt verschachtelter
      // numerischer Differentiation mit sich aufschaukelndem Fehler).
      const h = 1e-3;
      const fbZweiteNumerisch = (fbVon(p.x0b + h) - 2 * fbVon(p.x0b) + fbVon(p.x0b - h)) / (h * h);
      pruefe(nahBei(ableitungNumerisch(faVon, p.x0a), faWert, 0.01),
        `${kennzeichnung}: f'(${p.x0a}) numerisch (a, a^x) = ${ableitungNumerisch(faVon, p.x0a)}, erwartet ${faWert}`);
      pruefe(nahBei(fbZweiteNumerisch, fbWert, 0.5),
        `${kennzeichnung}: f''(${p.x0b}) numerisch (b, 2. Ableitung) = ${fbZweiteNumerisch}, erwartet ${fbWert}`);
    } else {
      const faVon = (x) => p.a * x * x + 1 / x;
      const fbVon = (x) => (x - p.b) * Math.sqrt(x * x - p.c);
      pruefe(nahBei(ableitungNumerisch(faVon, p.x0a), faWert, 0.01),
        `${kennzeichnung}: f'(${p.x0a}) numerisch (a) = ${ableitungNumerisch(faVon, p.x0a)}, erwartet ${faWert}`);
      pruefe(nahBei(ableitungNumerisch(fbVon, p.x0b), fbWert, 0.01),
        `${kennzeichnung}: f'(${p.x0b}) numerisch (b) = ${ableitungNumerisch(fbVon, p.x0b)}, erwartet ${fbWert}`);
    }
    return;
  }

  if (generator.id === 'diff.elastizitaet') {
    const epsWert = wertVon(aufgabe, 'eps');
    const fVon = (x) => p.a - p.b * x;
    const f0 = fVon(p.x0);
    const fStrichNumerisch = ableitungNumerisch(fVon, p.x0);
    const epsNumerisch = (fStrichNumerisch * p.x0) / f0;
    pruefe(nahBei(epsNumerisch, epsWert, 0.05),
      `${kennzeichnung}: ε(${p.x0}) numerisch = ${epsNumerisch}, erwartet ${epsWert}`);
    return;
  }

  if (generator.id === 'diff.partielle-ableitungen') {
    const fxWert = wertVon(aufgabe, 'fx_check');
    const fyWert = wertVon(aufgabe, 'fy_check');
    const familie = p.familie ?? 0;
    let fVon;
    if (familie === 1) {
      fVon = (x, y) => p.C * Math.pow(x, p.m) * Math.pow(y, p.n);
    } else if (familie === 2) {
      fVon = (x, y) => Math.exp(p.k * x * x * y);
    } else {
      fVon = (x, y) => p.A * Math.pow(x, p.p) + p.B * Math.pow(y, p.q);
    }
    const h = 1e-4;
    const fxNumerisch = (fVon(p.x0 + h, p.y0) - fVon(p.x0 - h, p.y0)) / (2 * h);
    const fyNumerisch = (fVon(p.x0, p.y0 + h) - fVon(p.x0, p.y0 - h)) / (2 * h);
    pruefe(nahBei(fxNumerisch, fxWert, 0.05),
      `${kennzeichnung}: ∂f/∂x(${p.x0},${p.y0}) numerisch = ${fxNumerisch}, erwartet ${fxWert}`);
    pruefe(nahBei(fyNumerisch, fyWert, 0.05),
      `${kennzeichnung}: ∂f/∂y(${p.x0},${p.y0}) numerisch = ${fyNumerisch}, erwartet ${fyWert}`);
    return;
  }

  if (generator.id === 'int.unbestimmt') {
    // Unabhängig: F'(x) per Differenzenquotient muss wieder f(x) ergeben
    // (der Generator selbst leitet F symbolisch aus f her, nicht umgekehrt).
    // Ein optionaler Sonderterm (1/x -> ln|x|, bzw. e^x) wird separat über
    // das 'sonder'-Eingabefeld dazugerechnet, da er kein Potenz-Term ist.
    const eingabe = aufgabe.eingaben.find((e) => e.id === 'F');
    const sonderKoeff = p.sonderterm ? wertVon(aufgabe, 'sonder') : 0;
    const sonderIstLn = p.sonderterm?.typ === 'ln';
    const FVon = (x) => wertePolynom(eingabe.loesung, eingabe.exponenten, x) +
      (p.sonderterm ? (sonderIstLn ? sonderKoeff * Math.log(Math.abs(x)) : sonderKoeff * Math.exp(x)) : 0);
    const fVon = (x) => wertePolynom(p.koeffizienten, p.exponenten, x) +
      (p.sonderterm ? (sonderIstLn ? sonderKoeff / x : sonderKoeff * Math.exp(x)) : 0);
    for (const x of [-2, -0.5, 0.5, 1, 2.5]) {
      pruefe(nahBei(ableitungNumerisch(FVon, x), fVon(x), 1e-3),
        `${kennzeichnung}: F'(${x}) numerisch ${ableitungNumerisch(FVon, x)}, erwartet f(${x})=${fVon(x)}`);
    }
    return;
  }

  if (generator.id === 'int.bestimmt') {
    const wert = wertVon(aufgabe, 'wert');
    if (p.art === 'ln') {
      // Unabhängig: Simpson-Quadratur von f(x)=koeffizient/x gegen den
      // angezeigten (gerundeten) Wert.
      const fVon = (x) => p.koeffizient / x;
      const quad = simpson(fVon, p.a, p.b);
      pruefe(nahBei(quad, wert, 5e-2),
        `${kennzeichnung}: Simpson-Quadratur ergibt ${quad}, erwartet ${wert}`);
      return;
    }
    // Unabhängig: f = F' per Potenzregel neu hergeleitet (separat von baue()),
    // dann per Simpson-Quadratur gegen den angezeigten Wert geprüft.
    const termeF_abgeleitet = p.termeF.map(({ zaehler, nenner, exponent }) => ({
      wert: (zaehler / nenner) * exponent, exponent: exponent - 1,
    }));
    const fVon = (x) => termeF_abgeleitet.reduce((s, t) => s + t.wert * Math.pow(x, t.exponent), 0);
    const quad = simpson(fVon, p.a, p.b);
    pruefe(nahBei(quad, wert, 1e-2),
      `${kennzeichnung}: Simpson-Quadratur ergibt ${quad}, erwartet ${wert}`);
    return;
  }

  if (generator.id === 'int.konsumentenrente') {
    const pN = (x) => p.a - p.b * x;
    const pA = (x) => p.c * x;
    pruefe(nahBei(pN(p.x0), p.p0, 1e-6), `${kennzeichnung}: p_N(x0)=${pN(p.x0)}, erwartet p0=${p.p0}`);
    pruefe(nahBei(pA(p.x0), p.p0, 1e-6), `${kennzeichnung}: p_A(x0)=${pA(p.x0)}, erwartet p0=${p.p0}`);
    const KRquad = simpson(pN, 0, p.x0) - p.x0 * p.p0;
    const PRquad = p.x0 * p.p0 - simpson(pA, 0, p.x0);
    pruefe(nahBei(KRquad, wertVon(aufgabe, 'KR'), 1e-2),
      `${kennzeichnung}: KR per Quadratur ${KRquad}, erwartet ${wertVon(aufgabe, 'KR')}`);
    pruefe(nahBei(PRquad, wertVon(aufgabe, 'PR'), 1e-2),
      `${kennzeichnung}: PR per Quadratur ${PRquad}, erwartet ${wertVon(aufgabe, 'PR')}`);
    return;
  }

  if (generator.id === 'int.kosten-aus-grenzkosten') {
    // Unabhängig: K' per Differenzenquotient aus der angegebenen K(x) muss
    // wieder K'(x)=mx+n ergeben; K(0) muss den gegebenen Fixkosten entsprechen.
    const KKoeff = wertVon(aufgabe, 'K');
    const KVon = (x) => wertePolynom(KKoeff, [2, 1, 0], x);
    pruefe(nahBei(ableitungNumerisch(KVon, 3), p.m * 3 + p.n, 1e-3),
      `${kennzeichnung}: K'(3) numerisch ${ableitungNumerisch(KVon, 3)}, erwartet ${p.m * 3 + p.n}`);
    pruefe(nahBei(KVon(0), p.Kf, 1e-6), `${kennzeichnung}: K(0)=${KVon(0)}, erwartet Kf=${p.Kf}`);
    return;
  }

  if (generator.id === 'alg.matrixprodukt') {
    // Unabhängig: separat geschriebene Dreifachschleife statt der
    // Generator-eigenen matrixMal-Funktion (PLAN.md Testkonzept).
    if (p.teilA.art === 'definiert') {
      const { v, M } = p.teilA;
      const nachgerechnet = matrixMalUnabhaengig([v], M)[0];
      pruefe(nachgerechnet.every((w, i) => nahBei(w, wertVon(aufgabe, 'a')[0][i], 1e-6)),
        `${kennzeichnung}: a) nachgerechnet ${nachgerechnet}, erwartet ${wertVon(aufgabe, 'a')[0]}`);
    } else if (p.teilA.art === 'transponiert') {
      const { A } = p.teilA;
      const erwartetA = wertVon(aufgabe, 'a'); // n×m
      // Unabhängig: direkt per Indextausch nachbauen statt die Generator-
      // eigene transponiere()-Funktion erneut aufzurufen.
      for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < A[0].length; j++) {
          pruefe(nahBei(A[i][j], erwartetA[j][i], 1e-6),
            `${kennzeichnung}: a) Aᵗ[${j}][${i}] erwartet A[${i}][${j}]=${A[i][j]}, war ${erwartetA[j][i]}`);
        }
      }
    } else if (p.teilA.art === 'skalar') {
      const { A, a } = p.teilA;
      const erwartetA = wertVon(aufgabe, 'a');
      pruefe(A.every((zeile, i) => zeile.every((w, j) => nahBei(a * w, erwartetA[i][j], 1e-6))),
        `${kennzeichnung}: a) a·A nachgerechnet ${JSON.stringify(A.map((z) => z.map((w) => a * w)))}, erwartet ${JSON.stringify(erwartetA)}`);
    } else if (p.teilA.art === 'einheitsmatrix') {
      const { A } = p.teilA;
      const erwartetA = wertVon(aufgabe, 'a');
      pruefe(A.every((zeile, i) => zeile.every((w, j) => nahBei(w, erwartetA[i][j], 1e-6))),
        `${kennzeichnung}: a) A·E nachgerechnet ${JSON.stringify(A)}, erwartet ${JSON.stringify(erwartetA)}`);
    } else if (p.teilA.art === 'aussenprodukt') {
      // Übung 22 h): Außenprodukt D·Fᵗ — direkt per Doppelschleife
      // nachgerechnet, nicht über die flatMap/map-Kette des Generators.
      const { D, F } = p.teilA;
      const erwartetA = wertVon(aufgabe, 'a');
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          pruefe(nahBei(D[i] * F[j], erwartetA[i][j], 1e-6),
            `${kennzeichnung}: a) Außenprodukt[${i}][${j}] nachgerechnet ${D[i] * F[j]}, erwartet ${erwartetA[i][j]}`);
        }
      }
    } else if (p.teilA.art === 'skalarprodukt1x1') {
      // Übung 22 i): Dᵗ·F als 1×1-Matrix — eigene Summierschleife statt der
      // Generator-eigenen skalarprodukt()-Funktion.
      const { D, F } = p.teilA;
      const erwartetA = wertVon(aufgabe, 'a');
      let summe = 0;
      for (let i = 0; i < 3; i++) summe += D[i] * F[i];
      pruefe(nahBei(summe, erwartetA[0][0], 1e-6),
        `${kennzeichnung}: a) Dᵗ·F nachgerechnet ${summe}, erwartet ${erwartetA[0][0]}`);
    } else if (p.teilA.art === 'transponierte-regel') {
      // Übung 22 k): AᵗC − (CᵗA)ᵗ = 0 — über die separate Dreifachschleife
      // matrixMalUnabhaengig und einen eigenen Index-Tausch für "transponiert"
      // nachgerechnet, nicht über die generator-eigene transponiere()/
      // matrixMal()-Kombination.
      const { A, C } = p.teilA;
      const erwartetA = wertVon(aufgabe, 'a');
      const At = A[0].map((_, j) => A.map((zeile) => zeile[j]));
      const Ct = C[0].map((_, j) => C.map((zeile) => zeile[j]));
      const AtC = matrixMalUnabhaengig(At, C);
      const CtA = matrixMalUnabhaengig(Ct, A);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          pruefe(nahBei(AtC[i][j] - CtA[j][i], erwartetA[i][j], 1e-9),
            `${kennzeichnung}: a) AᵗC-(CᵗA)ᵗ[${i}][${j}] nachgerechnet ${AtC[i][j] - CtA[j][i]}, erwartet ${erwartetA[i][j]}`);
          pruefe(Math.abs(erwartetA[i][j]) < 1e-9,
            `${kennzeichnung}: a) AᵗC-(CᵗA)ᵗ muss die Nullmatrix sein, war ${erwartetA[i][j]}`);
        }
      }
    } else {
      const { C, D } = p.teilA;
      pruefe(C[0].length !== D.length,
        `${kennzeichnung}: a) als "nicht definiert" markiert, aber Spalten von C (${C[0].length}) = Zeilen von D (${D.length})`);
    }
    const nachgerechnetB = matrixMalUnabhaengig(p.teilB.X, p.teilB.Y);
    const erwartetB = wertVon(aufgabe, 'b');
    pruefe(nachgerechnetB.every((zeile, i) => zeile.every((w, j) => nahBei(w, erwartetB[i][j], 1e-6))),
      `${kennzeichnung}: b) nachgerechnet ${JSON.stringify(nachgerechnetB)}, erwartet ${JSON.stringify(erwartetB)}`);
    return;
  }

  if (generator.id === 'alg.produktionsprozess') {
    // Übung 23 (einstufig, p.stufen === 1): A ist bereits die Gesamtbedarfs-
    // matrix, es gibt kein B. Musterklausur 8 (zweistufig): AB = A·B.
    const AB = p.stufen === 1 ? p.A : matrixMalUnabhaengig(p.A, p.B);
    const R = matrixMalUnabhaengig(AB, p.E);
    const erwartetR = wertVon(aufgabe, 'R');
    pruefe(R.every((zeile, i) => nahBei(zeile[0], erwartetR[i][0], 1e-6)),
      `${kennzeichnung}: R nachgerechnet ${JSON.stringify(R)}, erwartet ${JSON.stringify(erwartetR)}`);
    pruefe(R.every((zeile) => zeile[0] > 0), `${kennzeichnung}: Rohstoffbedarf muss positiv sein, ist ${JSON.stringify(R)}`);
    pruefe(p.A.every((zeile) => zeile.every((w) => w >= 0)) && (p.stufen === 1 || p.B.every((zeile) => zeile.every((w) => w >= 0))),
      `${kennzeichnung}: A und B müssen nicht-negativ sein`);
    let kosten = 0;
    for (let i = 0; i < p.PR.length; i++) kosten += p.PR[i] * R[i][0];
    let erloes = 0;
    for (let i = 0; i < p.PE.length; i++) erloes += p.PE[i] * p.E[i][0];
    pruefe(nahBei(erloes - kosten, wertVon(aufgabe, 'G'), 1e-6),
      `${kennzeichnung}: G nachgerechnet ${erloes - kosten}, erwartet ${wertVon(aufgabe, 'G')}`);
    const gewinn = erloes - kosten;
    pruefe(gewinn > 0, `${kennzeichnung}: Gewinn muss positiv sein, ist ${gewinn}`);
    pruefe(gewinn >= 0.1 * erloes - 1e-9,
      `${kennzeichnung}: Gewinn ${gewinn} ist unplausibel klein gegenüber Erlös ${erloes} (< 10 %)`);
    return;
  }

  if (generator.id === 'alg.matrixrechnung') {
    // Unabhängig: jeden Eintrag direkt aus den Rohdaten (p.A/B/C/r/s) neu
    // ausrechnen, nicht über die Generator-eigenen Zwischenschritte.
    const a = wertVon(aufgabe, 'a');
    const b = wertVon(aufgabe, 'b');
    const c = wertVon(aufgabe, 'c');
    const d = wertVon(aufgabe, 'd');
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        pruefe(nahBei(a[i][j], p.r * (p.A[i][j] - p.C[i][j]), 1e-9),
          `${kennzeichnung}: a)[${i}][${j}] nachgerechnet ${p.r * (p.A[i][j] - p.C[i][j])}, erwartet ${a[i][j]}`);
        const bWert = p.r * p.A[i][j] + p.s * p.B[i][j] - p.r * p.C[i][j];
        pruefe(nahBei(b[i][j], bWert, 1e-9),
          `${kennzeichnung}: b)[${i}][${j}] nachgerechnet ${bWert}, erwartet ${b[i][j]}`);
        pruefe(nahBei(c[i][j], (p.r + p.s) * p.A[i][j], 1e-9),
          `${kennzeichnung}: c)[${i}][${j}] nachgerechnet ${(p.r + p.s) * p.A[i][j]}, erwartet ${c[i][j]}`);
        // d) ist die Transponierte von b) — Eintrag (i,j) von d entspricht (j,i) von b.
        pruefe(nahBei(d[i][j], b[j][i], 1e-9),
          `${kennzeichnung}: d)[${i}][${j}] erwartet b)[${j}][${i}]=${b[j][i]}, war ${d[i][j]}`);
      }
    }
    return;
  }

  if (generator.id === 'alg.lgs') {
    const x = wertVon(aufgabe, 'x');
    // Unabhängig: direkt in jede Zeile von A·x=b einsetzen, statt die
    // Gauß-Elimination/Cramersche Regel des Generators nachzuvollziehen.
    for (let i = 0; i < 3; i++) {
      const zeileWert = p.A[i][0] * x[0] + p.A[i][1] * x[1] + p.A[i][2] * x[2];
      pruefe(nahBei(zeileWert, p.b[i], 1e-6),
        `${kennzeichnung}: Zeile ${i + 1} eingesetzt ${zeileWert}, erwartet b=${p.b[i]}`);
    }
    // Determinante unabhängig per Kofaktor-Entwicklung entlang der ersten
    // Zeile (ein anderer Rechenweg als die Regel von Sarrus im Generator).
    const det2 = (m) => m[0][0] * m[1][1] - m[0][1] * m[1][0];
    const minor = (m, zeileWeg, spalteWeg) =>
      m.filter((_, i) => i !== zeileWeg).map((zeile) => zeile.filter((_, j) => j !== spalteWeg));
    const D = p.A[0][0] * det2(minor(p.A, 0, 0)) - p.A[0][1] * det2(minor(p.A, 0, 1)) + p.A[0][2] * det2(minor(p.A, 0, 2));
    pruefe(Math.abs(D) > 1e-9, `${kennzeichnung}: Determinante D=${D} darf nicht null sein (eindeutige Lösung erfordert det(A)≠0)`);
    pruefe(x.every((w) => Number.isInteger(w)), `${kennzeichnung}: Lösung ${x} ist nicht ganzzahlig`);
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

    // Vorlesungsregel: Klausur-Ergebnisse auf 2 Nachkommastellen, außer bei
    // Prozentsätzen (Zinssätzen) 4 — siehe CLAUDE.md Abschnitt 6. Eine
    // Eingabe gilt als Zinssatz-Ergebnis, wenn sie exakt die dafür
    // vorgesehene Toleranz (KONFIG.toleranz.prozentpunkte) trägt; alle
    // anderen (nicht-term-)Ergebniswerte dürfen höchstens 2 Nachkomma-
    // stellen brauchen (iPhone-Rückmeldung: f'(5) zeigte "6,9402").
    for (const eingabe of aufgabe.eingaben) {
      if (eingabe.toleranz === KONFIG.toleranz.prozentpunkte) continue;
      let werte = [];
      if (eingabe.typ === 'zahl') werte = [eingabe.loesung];
      else if (eingabe.typ === 'koeffizienten') werte = eingabe.loesung;
      else if (eingabe.typ === 'matrix') werte = eingabe.loesung.flat();
      for (const wert of werte) {
        pruefe(
          minimaleNachkommastellen(wert) <= 2,
          `${generator.id} seed=${seed} eingabe=${eingabe.id}: Ergebnis ${wert} braucht mehr als 2 Nachkommastellen (kein Zinssatz-Ergebnis)`
        );
      }
    }

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
      pruefe(
        !ASCII_MINUS_VOR_ZIFFER.test(text),
        `${generator.id} seed=${seed}: ${feld} zeigt ein negatives Vorzeichen mit ASCII "-" statt echtem Minus "−": "${text}"`
      );
      // Nur die eigentliche Aufgabenstellung (frage.*, Kartentitel, Eingabe-
      // Labels) — nicht loesung.schritte[].hinweis/loesung.ergebnisse[].label:
      // dort stehen feste, seedunabhängige Regel-Erklärungen ("(xⁿ)' = n·xⁿ⁻¹"),
      // die kurze, etablierte Unicode-Notation ist dort so gewollt (siehe
      // LATEX_RESTE-Kommentar), anders als eine lange, seedabhängige
      // Funktionsformel mitten im Fragetext.
      if (!feld.startsWith('loesung.')) {
        pruefe(
          !PLAINTEXT_VARIABLEN_EXPONENT.test(text),
          `${generator.id} seed=${seed}: ${feld} zeigt eine Funktionsvariable mit Exponent als reinen Fließtext statt als KaTeX (frage.formel): "${text}"`
        );
      }
      if (istFliesstextFormelFeld(feld)) {
        pruefe(
          !PLAINTEXT_INDEXVARIABLE.test(text),
          `${generator.id} seed=${seed}: ${feld} zeigt eine Funktionsvariable mit Index als reinen Fließtext statt als KaTeX (frage.formel): "${text}"`
        );
      }
    }

    // Koeffizient 1/-1 muss überall weggelassen werden, auch in Formelfeldern
    // (nicht nur in Prosa) — "x" statt "1x", "x0" statt "1 \cdot x0". Und:
    // kein "+ -"/"- -" (unverschmolzene Doppelvorzeichen) irgendwo im Text.
    for (const { feld, text } of sammleAlleTextfelder(aufgabe)) {
      pruefe(
        !KOEFFIZIENT_EINS.test(text),
        `${generator.id} seed=${seed}: ${feld} zeigt Koeffizient 1 aus statt ihn wegzulassen: "${text}"`
      );
      pruefe(
        !DOPPELVORZEICHEN.test(text),
        `${generator.id} seed=${seed}: ${feld} zeigt ein unverschmolzenes Doppelvorzeichen: "${text}"`
      );
      pruefe(
        !DOPPELKLAMMER.test(text),
        `${generator.id} seed=${seed}: ${feld} zeigt eine doppelte öffnende Klammer "((": "${text}"`
      );
      pruefe(
        !AUSWERTUNGSSTRICH_KURZSCHREIBWEISE.test(text),
        `${generator.id} seed=${seed}: ${feld} nutzt die "|_{x=...}"-Kurzschreibweise statt eingesetzter Zahlen: "${text}"`
      );
      pruefe(
        !CDOT_OHNE_LEERZEICHEN.test(text),
        `${generator.id} seed=${seed}: ${feld} zeigt "\\cdot" direkt vor einem Buchstaben ohne Trennung (KaTeX-Fehlerrisiko): "${text}"`
      );
      pruefeGekuerzteBrueche(text, feld, `${generator.id} seed=${seed}`);
      pruefeGeldFormat(text, feld, `${generator.id} seed=${seed}`);
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

// ---------------------------------------------------------------------------
// Bruch-Toleranz (Integralrechnung, Phase-3-Nachbesserung): ein Ergebnis,
// das als Dezimalzahl abbricht (z. B. 1,25), ist exakt — keine Rundung,
// also auch keine großzügige Toleranz dafür. Nur ein wirklich nicht
// abbrechender Bruch (z. B. 2/3) braucht die lockerere Rundungstoleranz.
// ---------------------------------------------------------------------------
function testeBruchToleranz() {
  const faelle = [
    ['1,25', 1.25, KONFIG.toleranz.exakt, true], // exakter Treffer
    ['1,24', 1.25, KONFIG.toleranz.exakt, false], // exaktes Ergebnis, aber falsch — darf nicht durchrutschen
    ['0,67', 2 / 3, KONFIG.toleranz.bruch, true], // 2/3 auf 2 Nachkommastellen gerundet
    ['0,667', 2 / 3, KONFIG.toleranz.bruch, true], // 2/3 auf 3 Nachkommastellen gerundet
    ['0,7', 2 / 3, KONFIG.toleranz.bruch, false], // zu grob gerundet — darf nicht akzeptiert werden
  ];
  for (const [eingabe, erwartet, toleranz, sollRichtigSein] of faelle) {
    const ergebnis = pruefeZahl(eingabe, erwartet, toleranz);
    pruefe(
      ergebnis.korrekt === sollRichtigSein,
      `Bruchtoleranz: "${eingabe}" korrekt=${ergebnis.korrekt}, erwartet ${sollRichtigSein} (Antwort=${erwartet}, Toleranz=${toleranz})`
    );
  }
  console.log(`Bruchtoleranz: ${faelle.length} Fälle geprüft`);
}

// ---------------------------------------------------------------------------
// Box-weise Bewertung von Koeffizientenzeilen (app.js-Prüflogik, hier als
// reine Funktion in pruefung.js getestet statt im Browser): nur eine KOMPLETT
// leere Zeile zählt als leer; sobald mindestens eine Box gefüllt ist, zählt
// jede leere Box als eingegebene 0.
// ---------------------------------------------------------------------------
function testeBewerteKoeffizientenZeile() {
  const loesung = [-2, 43, 0]; // E(x) = -2x² + 43x, Konstante 0

  // Alle Boxen gefüllt, alle richtig.
  let b = bewerteKoeffizientenZeile(['-2', '43', '0'], loesung);
  pruefe(b.leer === 0 && b.proBox.every((p) => p.korrekt), 'Koeffizientenzeile: voll ausgefüllt und richtig wird als 0 leer erkannt');

  // Konstante (= 0) leer gelassen statt "0" einzutippen: muss trotzdem als
  // richtig gelten (Nutzerfall aus der iPhone-Rückmeldung).
  b = bewerteKoeffizientenZeile(['-2', '43', ''], loesung);
  pruefe(b.leer === 0, 'Koeffizientenzeile: teilweise gefüllt zählt nicht als komplett leer');
  pruefe(b.proBox.length === 3 && b.proBox.every((p) => p.bewertet && p.korrekt), 'Koeffizientenzeile: leere Box bei Lösung 0 wird als richtige 0 gewertet');

  // Gemischt: eine Box falsch, eine leer (bei Lösung 0 richtig), eine richtig.
  b = bewerteKoeffizientenZeile(['-3', '43', ''], loesung);
  pruefe(b.proBox[0].korrekt === false && b.proBox[1].korrekt === true && b.proBox[2].korrekt === true, 'Koeffizientenzeile: gemischt gibt pro Box das richtige Ergebnis');

  // Leere Box bei einer Lösung ≠ 0 muss falsch sein (nicht automatisch als 0 akzeptiert).
  b = bewerteKoeffizientenZeile(['-2', '', '0'], loesung);
  pruefe(b.proBox[1].korrekt === false, 'Koeffizientenzeile: leere Box bei Lösung ≠ 0 zählt als falsch, nicht als leer');

  // Komplett leere Zeile: alle Boxen zählen als leer, keine wird bewertet.
  b = bewerteKoeffizientenZeile(['', '', ''], loesung);
  pruefe(b.leer === 3 && b.proBox.every((p) => p.bewertet === false), 'Koeffizientenzeile: komplett leer zählt als leer, nicht als falsch');

  console.log('Koeffizientenzeile-Bewertung: 5 Fälle geprüft');
}

// ---------------------------------------------------------------------------
// Box-weise Bewertung von Matrizen (app.js-Prüflogik) — dieselbe Regel wie
// bei Koeffizientenzeilen, nur auf zwei Dimensionen.
// ---------------------------------------------------------------------------
function testeBewerteMatrix() {
  const loesung = [[1, 0], [0, 2]];

  let b = bewerteMatrix([['1', '0'], ['0', '2']], loesung);
  pruefe(b.leer === 0 && b.proZelle.every((zeile) => zeile.every((z) => z.korrekt)), 'Matrix: voll ausgefüllt und richtig wird als 0 leer erkannt');

  // Anders als bei Koeffizientenzeilen zählt eine leere Null-Zelle HIER als
  // leer, nicht als richtige 0 — sonst würde ein unbeantwortetes Feld bei
  // Lösung 0 fälschlich grün erscheinen (iPhone-Rückmeldung).
  b = bewerteMatrix([['1', ''], ['0', '2']], loesung);
  pruefe(b.leer === 1 && b.proZelle[0][1].bewertet === false, 'Matrix: eine leere Zelle zählt als leer, auch wenn die Lösung dort 0 ist');
  pruefe(b.proZelle[0][0].korrekt && b.proZelle[1][0].korrekt && b.proZelle[1][1].korrekt, 'Matrix: die übrigen, ausgefüllten Zellen werden normal bewertet');

  // Komplett leere Matrix: alle Zellen zählen als leer.
  b = bewerteMatrix([['', ''], ['', '']], loesung);
  pruefe(b.leer === 4 && b.proZelle.every((zeile) => zeile.every((z) => z.bewertet === false)), 'Matrix: komplett leer zählt als leer, nicht als falsch');

  console.log('Matrix-Bewertung: 3 Fälle geprüft');
}

// ---------------------------------------------------------------------------
// Teilpunkte werden auf das nächste halbe Raster ABgerundet, nie aufgerundet
// und nie als krummer Dezimalbruch gezeigt (iPhone-Rückmeldung: 1 von 9
// Matrixeinträgen bei 2 Punkten ergab vorher 0,22 Punkte statt 0; 5 von 9
// ergab 1,11 statt 1).
// ---------------------------------------------------------------------------
function testeRundePunkteAbwaerts() {
  pruefe(rundePunkteAbwaerts((1 / 9) * 2) === 0, `1 von 9 Boxen bei 2 Punkten: erwartet 0 P, war ${rundePunkteAbwaerts((1 / 9) * 2)}`);
  pruefe(rundePunkteAbwaerts((5 / 9) * 2) === 1, `5 von 9 Boxen bei 2 Punkten: erwartet 1 P, war ${rundePunkteAbwaerts((5 / 9) * 2)}`);
  pruefe(rundePunkteAbwaerts((9 / 9) * 2) === 2, `9 von 9 Boxen bei 2 Punkten: erwartet 2 P, war ${rundePunkteAbwaerts((9 / 9) * 2)}`);
  pruefe(rundePunkteAbwaerts((1 / 2) * 3) === 1.5, `1 von 2 Boxen bei 3 Punkten: erwartet 1,5 P, war ${rundePunkteAbwaerts((1 / 2) * 3)}`);
  pruefe(rundePunkteAbwaerts((2 / 3) * 3) === 2, `2 von 3 Boxen bei 3 Punkten: erwartet 2 P (2,0 abgerundet), war ${rundePunkteAbwaerts((2 / 3) * 3)}`);
  // Jedes Ergebnis muss ein Vielfaches von 0,5 sein — sonst könnte eine
  // Anzeige mehr als eine Nachkommastelle brauchen.
  for (let richtig = 0; richtig <= 9; richtig++) {
    for (const punkte of [1, 2, 3, 4, 8]) {
      const ergebnis = rundePunkteAbwaerts((richtig / 9) * punkte);
      pruefe(Math.abs(ergebnis * 2 - Math.round(ergebnis * 2)) < 1e-9,
        `rundePunkteAbwaerts(${richtig}/9 * ${punkte}) = ${ergebnis} ist kein Vielfaches von 0,5`);
    }
  }
  // Die Abrundung gilt je EINGABE (Teilaufgabe a), b), …), nicht einmal über
  // die ganze Aufgabe summiert — die Klausur vergibt Punkte je Teilaufgabe,
  // jede steht mit ihrer eigenen Punktzahl auf dem Blatt (iPhone-Rückmeldung,
  // Korrektur einer vorherigen Fassung: alg.matrixprodukt mit a) 1 von 3
  // Zellen und b) 2 von 9 Zellen bei je 2 Punkten muss 0,5 P + 0 P = 0,5 P
  // ergeben, NICHT 1 P aus der vorher aufsummierten Rohpunktzahl).
  const rohA = (1 / 3) * 2;
  const rohB = (2 / 9) * 2;
  const jeTeilaufgabeGerundetSumme = rundePunkteAbwaerts(rohA) + rundePunkteAbwaerts(rohB);
  pruefe(jeTeilaufgabeGerundetSumme === 0.5,
    `Je-Teilaufgabe-Rundung (a=1/3 bei 2P, b=2/9 bei 2P): erwartet 0,5 P, war ${jeTeilaufgabeGerundetSumme}`);

  console.log('Punkte-Abrundung: 5 Fälle + Rasterprobe + Je-Teilaufgabe-Kontrolle geprüft');
}

// ---------------------------------------------------------------------------
// Komposer (Probeklausur, Phase 5): je Preset muss über viele Seeds hinweg
// eine Generator-Kombination gefunden werden, deren Punkte JE TEIL exakt die
// Zielsumme aus KONFIG.presets treffen (die Kataloge sind so klein und so
// gebaut, dass eine exakte Teilmenge immer existiert — kein Generator kommt
// dabei doppelt vor, weil eine Teilmenge ihn ohnehin nur einmal enthält).
// Außerdem: gleicher Seed ergibt dieselbe Zusammenstellung (Determinismus).
// ---------------------------------------------------------------------------
function testeKomposer() {
  const KOMPOSER_SEEDS = 200;
  for (const [presetName, split] of Object.entries(KONFIG.presets)) {
    for (let seed = 0; seed < KOMPOSER_SEEDS; seed++) {
      const teile = komponiereKlausur(split, GENERATOREN_NACH_TEIL, mulberry32(seed));
      for (const teil of teile) {
        pruefe(teil.exakt, `Komposer (${presetName}) seed=${seed}: Teil "${teil.teil}" trifft das Ziel ${teil.ziel} nicht exakt (Summe ${teil.summe})`);
        pruefe(teil.summe === teil.ziel, `Komposer (${presetName}) seed=${seed}: Teil "${teil.teil}" Summe ${teil.summe} ≠ Ziel ${teil.ziel}`);
        const ids = teil.generatoren.map((g) => g.id);
        pruefe(new Set(ids).size === ids.length, `Komposer (${presetName}) seed=${seed}: Teil "${teil.teil}" enthält einen Generator doppelt (${JSON.stringify(ids)})`);
      }

      const teile2 = komponiereKlausur(split, GENERATOREN_NACH_TEIL, mulberry32(seed));
      const idsVon = (t) => t.map((teil) => teil.generatoren.map((g) => g.id));
      pruefe(JSON.stringify(idsVon(teile)) === JSON.stringify(idsVon(teile2)),
        `Komposer (${presetName}) seed=${seed}: gleicher Seed ergibt unterschiedliche Zusammenstellungen`);
    }
  }
  console.log(`Komposer: ${Object.keys(KONFIG.presets).length} Presets × ${KOMPOSER_SEEDS} Seeds geprüft`);
}

testeZahlenparser();
testeEffektivzinsToleranz();
testeBruchToleranz();
testeBewerteKoeffizientenZeile();
testeBewerteMatrix();
testeRundePunkteAbwaerts();
testeKomposer();
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
