#!/usr/bin/env node
// test/layout.mjs — rendert jeden Generator in echtem Safari (über
// safaridriver, das mit macOS ausgeliefert wird — keine zusätzliche
// Abhängigkeit) bei 375px Breite und prüft, dass kein Element breiter ist
// als sein Container, außer in einem bewusst scrollbaren Element
// (overflow-x: auto/scroll). Separat von test/alle.mjs, weil es ein
// echtes Browserfenster öffnet und deutlich länger braucht.
//
// Aufruf: node test/layout.mjs

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));
const INDEX_HTML = join(WURZEL, 'docs', 'index.html');
const PORT = 9975;
const BREITE = 375; // WebDriver window/rect setzt die Viewport-Breite exakt (gemessen, kein Chrome-Aufschlag nötig)
const SEEDS_PRO_GENERATOR = 50;
// Kleinere Zahl als oben: pro Instanz wird JEDES Eingabefeld einzeln fokussiert
// (O(Felderzahl²) Rect-Vergleiche), das summiert sich schneller auf.
const FOKUS_SEEDS_PRO_GENERATOR = 10;
// Kleinere Zahl als SEEDS_PRO_GENERATOR: deckt denselben Renderpfad-
// Unterschied (Probeklausur statt Übungsmodus) ab, nicht zusätzliche
// Zufallswerte — die eigentliche Seed-Streuung prüft der Übungsmodus-
// Durchlauf oben bereits ausreichend.
const KLAUSUR_SEEDS_PRO_GENERATOR = 15;

const GENERATOR_IDS = [
  'fin.rente-aus-kapital',
  'fin.rente-veraenderlich',
  'fin.verdopplungszeit',
  'fin.effektivzins',
  'fin.verzinsung-grundformen',
  'fin.endwert-rente',
  'fin.ewige-rente',
  'fin.tilgungsplan',
  'diff.gewinn-breakeven',
  'diff.extremwerte-2var',
  'diff.extremwerte-2var-quadratisch',
  'diff.nutzenmaximum',
  'diff.ableitungen',
  'diff.elastizitaet',
  'diff.partielle-ableitungen',
  'int.unbestimmt',
  'int.bestimmt',
  'int.konsumentenrente',
  'int.kosten-aus-grenzkosten',
  'alg.matrixprodukt',
  'alg.produktionsprozess',
  'alg.matrixrechnung',
  'alg.lgs',
];
// Für gezielte Diagnose eines einzelnen Generators ohne den vollen (mehrere
// Minuten dauernden) Durchlauf: GENERATOR_FILTER=alg.lgs node test/layout.mjs
const AKTIVE_GENERATOR_IDS = process.env.GENERATOR_FILTER
  ? process.env.GENERATOR_FILTER.split(',')
  : GENERATOR_IDS;

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wd(pfad, methode = 'GET', body) {
  const antwort = await fetch(`http://localhost:${PORT}${pfad}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const daten = await antwort.json();
  if (daten.value && daten.value.error) {
    throw new Error(`WebDriver-Fehler bei ${methode} ${pfad}: ${JSON.stringify(daten.value)}`);
  }
  return daten.value;
}

// Läuft im Browser (per execute/sync übergeben).
//
// Allgemeine Regel statt einer festen Liste von Klassen, in zwei Teilen:
//   1. Ein Element mit overflow-x:auto/scroll darf INNEN breiter sein als es
//      selbst (genau dafür ist es da — z. B. .loesung-formel, dessen
//      .katex-display-Kind absichtlich breiter sein darf), aber die Box
//      SELBST darf nicht breiter sein als ihr Elternbereich, sonst passt die
//      Scrollbox gar nicht erst auf den Bildschirm.
//   2. Jedes andere Element darf nicht intern überlaufen (scrollWidth >
//      clientWidth) — das hieße, Inhalt ist abgeschnitten und nirgends
//      erreichbar. KaTeX-eigene DOM-Struktur (alles innerhalb .katex, z. B.
//      die nur für Screenreader gedachte katex-mathml mit clientWidth:1)
//      wird dabei übersprungen — das ist KaTeX' eigener Rendering-Mechanismus,
//      nicht etwas, das dieses Projekt kontrolliert oder prüfen sollte.
// clientWidth===0 übersprungen: inline-Elemente haben dort immer 0,
// unabhängig vom Inhalt, die Prüfung wäre für sie bedeutungslos.
const LAYOUT_PRUEFSKRIPT = `
  const probleme = [];
  const seitenbreite = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > seitenbreite + 1) {
    probleme.push('Seite scrollt horizontal: scrollWidth=' + document.documentElement.scrollWidth + ' > ' + seitenbreite);
  }

  function hatScrollbarenVorfahren(el) {
    let aktuell = el.parentElement;
    while (aktuell && aktuell.id !== 'app') {
      const s = getComputedStyle(aktuell);
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
      aktuell = aktuell.parentElement;
    }
    return false;
  }

  document.querySelectorAll('#app *').forEach((el) => {
    if (el.clientWidth === 0) return;
    const stil = getComputedStyle(el);
    const istScrollbar = stil.overflowX === 'auto' || stil.overflowX === 'scroll';
    if (istScrollbar) {
      const eltern = el.parentElement;
      if (eltern && el.clientWidth > eltern.clientWidth + 1) {
        probleme.push((el.className || el.tagName) + ': scrollbare Box selbst zu breit (' + el.clientWidth + ' > Elternbreite ' + eltern.clientWidth + ')');
      }
      return;
    }
    if (el.closest('.katex')) return;
    // Ein scrollbarer Vorfahre (z. B. .loesung-formel) fängt den Überlauf
    // bereits ab — genau dafür ist er da, dieses Element selbst ist dann
    // kein eigenständiges Problem.
    if (hatScrollbarenVorfahren(el)) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      probleme.push((el.className || el.tagName) + ': eigener Inhalt überläuft ohne Scroll-Möglichkeit (scrollWidth=' + el.scrollWidth + ' > clientWidth=' + el.clientWidth + ')');
    }
  });

  // KaTeX rendert mit throwOnError:false (siehe src/loesung.js) — ein
  // kaputtes LaTeX-Fragment wirft also nie eine JS-Exception, sondern
  // erscheint nur als rot markiertes .katex-error im DOM. Ohne diesen
  // expliziten Scan würde das lautlos durchrutschen (PLAN.md Testkonzept:
  // "kein KaTeX-Fehler beim Rendern aller Schritte").
  document.querySelectorAll('#app .katex-error').forEach((fehler) => {
    probleme.push('KaTeX-Fehler: ' + (fehler.title || fehler.textContent));
  });

  // .frage-formel (die gegebenen Werte, z. B. A/B/E/PE/PR) darf NIE
  // horizontal scrollen müssen, auch wenn overflow-x:auto das technisch
  // abfinge — anders als bei .loesung-formel (lange Herleitungen, wo
  // Scrollen als Rückfall bewusst akzeptiert ist, siehe stil.css), müssen
  // die Vorgaben einer Aufgabe auf einen Blick sichtbar sein, ohne zu
  // wischen (iPhone-Rückmeldung: E und P_R liefen bei produktionsprozess
  // ab dem Bildschirmrand ab). Prüft sowohl die Box selbst als auch jedes
  // .katex-display darin, falls KaTeX intern noch einen eigenen Scroll-
  // Container baut.
  document.querySelectorAll('#app .frage-formel, #app .frage-formel .katex-display').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1) {
      probleme.push('frage-formel: Vorgaben überlaufen (scrollWidth=' + el.scrollWidth + ' > clientWidth=' + el.clientWidth + ') — müssen ohne Scrollen sichtbar sein');
    }
  });

  // JEDER Lösungsschritt (nicht nur "Ergebnis") muss ohne Scrollen lesbar
  // sein — .loesung-formel erlaubt technisch überall overflow-x:auto, das
  // fing früher nur bei "Ergebnis"-Schritten als Fehler (fin.tilgungsplans
  // Ergebnis-Tabelle schnitt die letzte Spalte "Annuität" ab). Ein
  // "Einsetzen"-Schritt, der nur per Wischen sichtbar wird (kein sichtbarer
  // Scrollbalken in mobile Safari), ist genauso ein abgeschnittener
  // Rechenweg wie eine abgeschnittene Endantwort — zuerst bei den
  // Sarrus-Zeilen in alg.lgs gefunden, dann bewusst auf ALLE Generatoren
  // ausgeweitet (iPhone-Rückmeldung) und jeder dabei gefundene Überlauf
  // behoben (fin.rente-veraenderlich, diff.nutzenmaximum/-extremwerte-2var/
  // -partielle-ableitungen, int.unbestimmt, alg.produktionsprozess/
  // -matrixrechnung/-lgs). Toleranz +3 statt +1 wie bei
  // .loesung-ergebnis-wert: dasselbe Sub-Pixel-Rauschen bei
  // pmatrix-Klammern tritt auch hier auf.
  document.querySelectorAll('#app .loesung-schritt .loesung-formel').forEach((formel) => {
    if (formel.scrollWidth > formel.clientWidth + 3) {
      probleme.push('Lösungsschritt überläuft (scrollWidth=' + formel.scrollWidth + ' > clientWidth=' + formel.clientWidth + ') — Rechenweg muss ohne Scrollen sichtbar sein: ' + formel.textContent.slice(0, 80));
    }
  });

  // Dieselbe Regel für die abschließende Ergebnis-Zusammenfassung
  // (loesung.ergebnisse, eigene .loesung-ergebnis-wert-Box) — auch das ist
  // eine fertige Endantwort, kein Rückfall-Scrollen akzeptabel. Toleranz +3
  // statt +1: ein pmatrix-Ergebnis (z. B. alg.produktionsprozess/
  // matrixprodukt) zeigt hier durchgängig ein konstantes 2px-Sub-Pixel-
  // Rauschen beim Klammer-Rendering, kein inhaltliches Überlaufen — anders
  // als fin.tilgungsplan, das mit 4 bis 59px tatsächlich beschnitten wurde.
  document.querySelectorAll('#app .loesung-ergebnis-wert').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 3) {
      probleme.push('loesung-ergebnis-wert überläuft (scrollWidth=' + el.scrollWidth + ' > clientWidth=' + el.clientWidth + ') — Endantwort muss ohne Scrollen sichtbar sein');
    }
  });

  // Lücke zwischen dem letzten Eingabefeld-Block und der Prüfen/Lösung/
  // Neue-Aufgabe-Zeile (Übungsmodus) darf nicht größer sein als die reale
  // Höhe des −/⁄-Knopfpaars plus normaler Abstand — zuvor stapelten sich
  // mehrere Browser-Standardabstände (<p>-Margin u. a.) zu einer Lücke von
  // über 100px (iPhone-Rückmeldung: "etwa ein Drittel des Bildschirms").
  // 90 statt der zunächst vorgeschlagenen 80: bei koeffizienten/matrix
  // kommt zur Knopfpaar-Höhe (40px) noch der kleine, unvermeidbare
  // Abstand des Gitters zum Label hinzu (das Gitter selbst braucht ihn,
  // sonst klebt es am Beschriftungstext) — 84–88px ist dort nach dem Fix
  // der tatsächlich erreichbare Bestwert, nicht mehr die über 180px von
  // vorher.
  const MAX_LUECKE_VOR_KNOPFREIHE = 90;
  // Bei mehrteiligen Aufgaben gibt es jetzt mehrere .eingaben-Listen (eine je
  // Teilaufgabe plus ggf. eine Rest-Liste, siehe baueAufgabenInhalt in
  // app.js) — ":last-child"träfe nur das letzte Element der JEWEILS ERSTEN
  // passenden Liste (querySelector nimmt den ersten Treffer in Dokument-
  // reihenfolge), nicht die tatsächlich letzte Zeile vor der Knopf-Reihe.
  // Stattdessen das letzte Element über ALLE .eingabe-zeile hinweg nehmen.
  const alleZeilenFuerLetzte = document.querySelectorAll('#app .eingaben .eingabe-zeile');
  const letzteZeile = alleZeilenFuerLetzte.length > 0 ? alleZeilenFuerLetzte[alleZeilenFuerLetzte.length - 1] : null;
  const knopfReihe = document.querySelector('#app .knopf-reihe');
  if (letzteZeile && knopfReihe) {
    // Bei koeffizienten/matrix steckt die Zeile mehrere Eingabefelder (ein
    // mehrzeiliges Gitter bei matrix) — querySelector('input') träfe nur das
    // ERSTE Feld (oben links), nicht das unterste. Das unterste (größtes
    // bottom) ist der richtige Bezugspunkt für die Lücke danach.
    const felder = Array.from(letzteZeile.querySelectorAll('input, select'));
    if (felder.length > 0) {
      const unterkante = Math.max(...felder.map((f) => f.getBoundingClientRect().bottom));
      const luecke = knopfReihe.getBoundingClientRect().top - unterkante;
      if (luecke > MAX_LUECKE_VOR_KNOPFREIHE) {
        probleme.push('Lücke vor der Knopf-Reihe zu groß (' + luecke.toFixed(1) + 'px > ' + MAX_LUECKE_VOR_KNOPFREIHE + 'px)');
      }
    }
  }

  // Lücke zwischen je zwei aufeinanderfolgenden Eingabe-Zeilen INNERHALB
  // DERSELBEN .eingaben-Liste (nicht nur vor der Knopf-Reihe, siehe oben)
  // darf nicht größer sein als der normale Flex-Gap plus etwas Spielraum —
  // sonst stapelt sich wie beim Lücke-vor-Knopfreihe-Fall eine unerwünscht
  // große Lücke (iPhone-Rückmeldung: Lücke nach der a)-Box bei
  // diff.ableitungen). NUR innerhalb derselben Liste: bei mehrteiligen
  // Aufgaben liegt zwischen der letzten Zeile einer Teilaufgabe und der
  // ersten der nächsten absichtlich ein ganzer .frage-teil-Block (Fragetext/
  // -formel der nächsten Teilaufgabe) — das ist kein Fehler, sondern genau
  // die gewünschte Gruppierung (baueAufgabenInhalt in app.js).
  const MAX_LUECKE_ZWISCHEN_ZEILEN = 40;
  // Einzelne Zahlenfelder (.zahlenfeld-reihe, kein reservierter Leerraum
  // mehr darunter seit dem −/⁄-Knopfpaar direkt neben dem Feld) müssen enger
  // aufeinanderfolgen als Koeffizienten-/Matrix-Zeilen.
  const MAX_LUECKE_EINZELFELDER = 24;
  document.querySelectorAll('#app .eingaben').forEach((liste) => {
    const zeilenInListe = Array.from(liste.children).filter((el) => el.classList.contains('eingabe-zeile'));
    for (let i = 1; i < zeilenInListe.length; i++) {
      const vorherige = zeilenInListe[i - 1];
      const aktuelle = zeilenInListe[i];
      const luecke = aktuelle.getBoundingClientRect().top - vorherige.getBoundingClientRect().bottom;
      const beideEinzelfelder = vorherige.querySelector('.zahlenfeld-reihe') && aktuelle.querySelector('.zahlenfeld-reihe');
      const grenze = beideEinzelfelder ? MAX_LUECKE_EINZELFELDER : MAX_LUECKE_ZWISCHEN_ZEILEN;
      if (luecke > grenze) {
        probleme.push('Lücke zwischen zwei Eingabe-Zeilen zu groß (' + luecke.toFixed(1) + 'px > ' + grenze + 'px)');
      }
    }
  });

  // Einzelnes Zahlenfeld: das −/⁄-Knopfpaar muss dauerhaft sichtbar (nicht
  // erst beim Fokussieren) UND in derselben Zeile wie das Feld stehen, nicht
  // darunter (iPhone-Rückmeldung).
  document.querySelectorAll('#app .zahlenfeld-reihe').forEach((reihe) => {
    const feld = reihe.querySelector('input');
    const paar = reihe.querySelector('.vorzeichen-bruch-paar');
    if (!feld || !paar) return;
    if (getComputedStyle(paar).visibility === 'hidden') {
      probleme.push('zahlenfeld-reihe: Vorzeichen/Bruch-Knopfpaar ist nicht dauerhaft sichtbar');
    }
    if (Math.abs(feld.getBoundingClientRect().top - paar.getBoundingClientRect().top) > 20) {
      probleme.push('zahlenfeld-reihe: Knopfpaar steht nicht in derselben Zeile wie das Feld');
    }
  });

  // Eine koeffizienten-Reihe (z. B. F(x) = __x⁴ + __x³ + __x² + __x + c) muss
  // auf EINER Zeile bleiben — scrollWidth/clientWidth allein hätten einen
  // Umbruch nicht erkannt (flex-wrap bricht um, OHNE horizontal zu
  // überlaufen, siehe iPhone-Rückmeldung zu int.unbestimmt). offsetTop allein
  // reicht nicht: align-items:center setzt ein niedrigeres "+"-Zeichen schon
  // auf derselben Zeile tiefer an als die höhere Box daneben (false positive
  // bei int.kosten-aus-grenzkosten geprüft). Ein echter Umbruch zeigt sich
  // stattdessen daran, dass die linke Kante NICHT mehr von links nach rechts
  // wächst — ein neues Element beginnt dann wieder am Zeilenanfang.
  document.querySelectorAll('#app .koeffizienten-reihe').forEach((reihe) => {
    const kinder = Array.from(reihe.children);
    if (kinder.length < 2) return;
    let vorherigeLinkeKante = -Infinity;
    let umgebrochen = false;
    for (const k of kinder) {
      if (k.getBoundingClientRect().left < vorherigeLinkeKante) { umgebrochen = true; break; }
      vorherigeLinkeKante = k.getBoundingClientRect().left;
    }
    if (umgebrochen) {
      probleme.push('koeffizienten-reihe: Terme brechen auf mehrere Zeilen um (' + reihe.textContent.replace(/\\s+/g, ' ') + ')');
    }
  });

  return { seitenbreite, probleme };
`;

// Fokussiert nacheinander jedes Eingabefeld und prüft zwei Dinge (iPhone-
// Rückmeldung): (1) KEIN Eingabefeld darf sich dabei verschieben — weder
// das gerade fokussierte noch irgendein anderes auf der Seite — und (2) das
// zugehörige −/⁄-Knopfpaar muss mit seiner linken Kante am fokussierten Feld
// ausgerichtet sein (±2px).
const FOKUS_PRUEFSKRIPT = `
  const probleme = [];
  const eingaben = Array.from(document.querySelectorAll('#app input[type="text"]'));
  const startRects = eingaben.map((f) => f.getBoundingClientRect());

  eingaben.forEach((feld, i) => {
    feld.focus();
    eingaben.forEach((anderesFeld, j) => {
      const rect = anderesFeld.getBoundingClientRect();
      const start = startRects[j];
      if (Math.abs(rect.left - start.left) > 0.5 || Math.abs(rect.top - start.top) > 0.5) {
        probleme.push('Feld ' + j + ' hat sich verschoben, als Feld ' + i + ' fokussiert wurde (von (' + start.left.toFixed(1) + ',' + start.top.toFixed(1) + ') zu (' + rect.left.toFixed(1) + ',' + rect.top.toFixed(1) + '))');
      }
    });
    // Bei einem einzelnen Zahlenfeld (.zahlenfeld-reihe) sitzt das Knopfpaar
    // absichtlich RECHTS neben dem Feld, nicht darunter — die Links-
    // Ausrichtung gilt nur für Koeffizientenreihen/Matrizen, wo das
    // gemeinsame Paar als absolutes Overlay unter die fokussierte Zelle
    // wandert (siehe .vorzeichen-bruch-paar.unter-feld, positioniere-
    // KnopfPaarUnterFeld in app.js). Für .zahlenfeld-reihe prüft
    // LAYOUT_PRUEFSKRIPT bereits, dass Feld und Paar in derselben Zeile stehen.
    // Das Overlay klammert seine linke Kante auf die Zeilenbreite (nie über
    // den rechten Rand hinaus) — bei einer weit rechts stehenden Zelle sitzt
    // es darum NICHT exakt linksbündig zum Feld, sondern flächig am rechten
    // Rand der Zeile; genau das ist beabsichtigt, die Prüfung lässt diesen
    // Fall darum ausdrücklich zu, verlangt aber in jedem Fall, dass das Paar
    // nie weiter rechts als das Feld beginnt und nie über die Zeile hinausragt.
    if (!feld.closest('.zahlenfeld-reihe')) {
      const zeile = feld.closest('.eingabe-zeile');
      const paar = zeile ? zeile.querySelector('.vorzeichen-bruch-paar') : null;
      if (paar) {
        const paarRect = paar.getBoundingClientRect();
        const feldRect = feld.getBoundingClientRect();
        const zeileRect = zeile.getBoundingClientRect();
        const geklammert = Math.abs(paarRect.right - zeileRect.right) <= 2;
        if (paarRect.left > feldRect.left + 2 || (!geklammert && Math.abs(paarRect.left - feldRect.left) > 2)) {
          probleme.push('Knopfpaar für Feld ' + i + ' nicht ausgerichtet: paar.left=' + paarRect.left.toFixed(1) + ', feld.left=' + feldRect.left.toFixed(1));
        }
      }
    }
    // Das gemeinsame Knopfpaar einer Koeffizientenreihe/Matrix wird als
    // absolutes Overlay unter die fokussierte Zelle gelegt (positioniere-
    // KnopfPaarUnterFeld in app.js, auf die Zeilenbreite geklammert) — zur
    // Sicherheit trotzdem direkt die rechte Kante des sichtbaren Knopfpaars
    // gegen die Fensterbreite prüfen (document.documentElement.scrollWidth
    // allein ist dafür nicht zuverlässig, body hat overflow-x:hidden, siehe
    // stil.css). Die übrigen Layout-Prüfungen fokussieren nie ein Feld und
    // übersahen das vor der Umstellung auf das Overlay darum (iPhone-
    // Rückmeldung: "/"-Knopf abgeschnitten, Seite scrollte seitwärts).
    const seitenbreite = document.documentElement.clientWidth;
    const paarAktiv = document.querySelector('#app .vorzeichen-bruch-paar.aktiv');
    if (paarAktiv) {
      const paarRect = paarAktiv.getBoundingClientRect();
      if (paarRect.right > seitenbreite + 1) {
        probleme.push('Knopfpaar ragt bei Feld ' + i + ' über den rechten Bildschirmrand hinaus (right=' + paarRect.right.toFixed(1) + ' > ' + seitenbreite + ')');
      }
    }
    if (document.documentElement.scrollWidth > seitenbreite + 1) {
      probleme.push('Seite scrollt horizontal, nachdem Feld ' + i + ' fokussiert wurde: scrollWidth=' + document.documentElement.scrollWidth + ' > ' + seitenbreite);
    }
    feld.blur();
  });

  return probleme;
`;

async function main() {
  if (!existsSync(INDEX_HTML)) {
    console.error('docs/index.html fehlt — vorher `node build.mjs` ausführen.');
    process.exit(1);
  }

  console.log('Starte safaridriver …');
  const treiber = spawn('/usr/bin/safaridriver', ['-p', String(PORT)], { stdio: 'ignore' });
  treiber.on('error', (e) => { console.error('safaridriver konnte nicht gestartet werden:', e.message); process.exit(1); });

  let sitzung;
  let fehler = 0;
  let geprueft = 0;

  try {
    // Auf den /status-Endpunkt warten, statt eine feste Zeit zu raten.
    for (let versuch = 0; versuch < 20; versuch++) {
      try {
        const status = await wd('/status');
        if (status && status.ready) break;
      } catch (e) { /* noch nicht bereit */ }
      await warte(300);
    }

    sitzung = await wd('/session', 'POST', {
      capabilities: { alwaysMatch: { browserName: 'safari' } },
    });
    const id = sitzung.sessionId;

    await wd(`/session/${id}/window/rect`, 'POST', { width: BREITE, height: 850, x: 0, y: 0 });
    await wd(`/session/${id}/url`, 'POST', { url: `file://${INDEX_HTML}` });
    await warte(500); // KaTeX-Fonts/erstes Rendering abwarten

    const { value: tatsaechlicheBreite } = { value: await wd(`/session/${id}/execute/sync`, 'POST', {
      script: 'return document.documentElement.clientWidth;', args: [],
    }) };
    console.log(`Tatsächliche Viewport-Breite: ${tatsaechlicheBreite}px (Ziel ≈ 375px)`);

    for (const generatorId of AKTIVE_GENERATOR_IDS) {
      let problemeFuerGenerator = 0;
      for (let seed = 0; seed < SEEDS_PRO_GENERATOR; seed++) {
        await wd(`/session/${id}/execute/sync`, 'POST', {
          script: 'window.__testErzeugeAufgabe(arguments[0], arguments[1], true);',
          args: [generatorId, seed],
        });
        const ergebnis = await wd(`/session/${id}/execute/sync`, 'POST', {
          script: LAYOUT_PRUEFSKRIPT, args: [],
        });
        geprueft += 1;
        for (const problem of ergebnis.probleme) {
          fehler += 1;
          problemeFuerGenerator += 1;
          console.error(`FEHLER: ${generatorId} seed=${seed}: ${problem}`);
        }
      }
      console.log(`${generatorId}: ${SEEDS_PRO_GENERATOR} Instanzen bei ${tatsaechlicheBreite}px geprüft, ${problemeFuerGenerator} Layout-Probleme`);
    }

    // Dieselben Aufgabe+Lösung-Renderpfade zusätzlich über die Probeklausur
    // prüfen (zeichneLaufendeKlausur ohne Lösung, zeichneAuswertung MIT
    // Lösung) — der Übungsmodus-Durchlauf oben besucht diese Renderpfade
    // NIE, abgeschnittene Zeilen, die nur dort auftraten, blieben darum
    // unentdeckt (iPhone-Rückmeldung).
    console.log('\nPrüfe Probeklausur-Renderpfade (laufende Klausur + Auswertung) …');
    for (const generatorId of AKTIVE_GENERATOR_IDS) {
      let problemeFuerGenerator = 0;
      for (let seed = 0; seed < KLAUSUR_SEEDS_PRO_GENERATOR; seed++) {
        for (const abgegeben of [false, true]) {
          await wd(`/session/${id}/execute/sync`, 'POST', {
            script: 'window.__testZeigeKlausurAufgabe(arguments[0], arguments[1], arguments[2]);',
            args: [generatorId, seed, abgegeben],
          });
          const ergebnis = await wd(`/session/${id}/execute/sync`, 'POST', {
            script: LAYOUT_PRUEFSKRIPT, args: [],
          });
          geprueft += 1;
          for (const problem of ergebnis.probleme) {
            fehler += 1;
            problemeFuerGenerator += 1;
            console.error(`FEHLER (Probeklausur, ${abgegeben ? 'Auswertung' : 'laufend'}): ${generatorId} seed=${seed}: ${problem}`);
          }
        }
      }
      console.log(`${generatorId}: ${KLAUSUR_SEEDS_PRO_GENERATOR} Instanzen × 2 Ansichten in der Probeklausur geprüft, ${problemeFuerGenerator} Layout-Probleme`);
    }

    // Probeklausur-Startbildschirm ("Zusatzthemen einbeziehen"- und "Nur
    // Themen aus dem Übungsfilter"-Schalter plus Preset-/Mini-Klausur-Knöpfe)
    // — bisher nie besucht, weil die übrigen Probeklausur-Checks direkt über
    // __testZeigeKlausurAufgabe in eine laufende Klausur springen und den
    // Startbildschirm selbst nie rendern. Der "Nur Filter"-Schalter ändert
    // tatsächlich die Knopfzeile (Presets vs. Mini-Klausur-Knopf vs.
    // Warnhinweis bei leerem Filter), darum per echtem "change"-Event
    // umgeschaltet statt nur die checked-Eigenschaft zu setzen.
    console.log('\nPrüfe Probeklausur-Startbildschirm ("Zusatzthemen einbeziehen" / "Nur Themen aus dem Übungsfilter") …');
    let startbildschirmFehler = 0;

    for (const angehakt of [false, true]) {
      await wd(`/session/${id}/execute/sync`, 'POST', {
        script: `
          try { window.localStorage.removeItem('mathe-trainer-uebung-filter-v1'); } catch (e) {}
          window.__testZeigeProbeklausurStart();
          const feld = document.querySelector('#probeklausur-zusatzthemen-schalter');
          feld.checked = arguments[0];
          feld.dispatchEvent(new Event('change', { bubbles: true }));
        `,
        args: [angehakt],
      });
      const ergebnis = await wd(`/session/${id}/execute/sync`, 'POST', {
        script: LAYOUT_PRUEFSKRIPT, args: [],
      });
      geprueft += 1;
      for (const problem of ergebnis.probleme) {
        fehler += 1;
        startbildschirmFehler += 1;
        console.error(`FEHLER (Probeklausur-Startbildschirm, Zusatzthemen=${angehakt}): ${problem}`);
      }
    }

    // "Nur Filter" an, einmal mit einem nicht-leeren Übungsfilter (Mini-
    // Klausur-Knopf) und einmal mit komplett abgewählten Typen (Warnhinweis
    // statt Knopf) — beide Zweige rendern unterschiedliches Markup.
    for (const leererFilter of [false, true]) {
      await wd(`/session/${id}/execute/sync`, 'POST', {
        script: `
          try {
            if (arguments[0]) {
              const alleIds = window.__testAlleGeneratorIds();
              window.localStorage.setItem('mathe-trainer-uebung-filter-v1', JSON.stringify({ teil: 'alle', ausgeschlossen: alleIds, offen: false }));
            } else {
              window.localStorage.removeItem('mathe-trainer-uebung-filter-v1');
            }
          } catch (e) {}
          window.__testZeigeProbeklausurStart();
          const feld = document.querySelector('#probeklausur-nur-filter-schalter');
          feld.checked = true;
          feld.dispatchEvent(new Event('change', { bubbles: true }));
        `,
        args: [leererFilter],
      });
      const ergebnis = await wd(`/session/${id}/execute/sync`, 'POST', {
        script: LAYOUT_PRUEFSKRIPT, args: [],
      });
      geprueft += 1;
      for (const problem of ergebnis.probleme) {
        fehler += 1;
        startbildschirmFehler += 1;
        console.error(`FEHLER (Probeklausur-Startbildschirm, NurFilter=an, leer=${leererFilter}): ${problem}`);
      }
    }
    // Die laufende Mini-Klausur selbst (eigener Punkte-Topf, eigene Dauer)
    // einmal tatsächlich starten und auf Überlauf prüfen — nicht nur den
    // Startbildschirm mit dem Knopf drauf.
    await wd(`/session/${id}/execute/sync`, 'POST', {
      script: `
        try { window.localStorage.removeItem('mathe-trainer-uebung-filter-v1'); } catch (e) {}
        window.__testZeigeProbeklausurStart();
        const feld = document.querySelector('#probeklausur-nur-filter-schalter');
        feld.checked = true;
        feld.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('#app .knopf-reihe button').click();
      `,
      args: [],
    });
    {
      const ergebnis = await wd(`/session/${id}/execute/sync`, 'POST', {
        script: LAYOUT_PRUEFSKRIPT, args: [],
      });
      geprueft += 1;
      for (const problem of ergebnis.probleme) {
        fehler += 1;
        startbildschirmFehler += 1;
        console.error(`FEHLER (laufende Mini-Klausur aus Übungsfilter): ${problem}`);
      }
    }
    console.log(`Probeklausur-Startbildschirm: 5 Schalterstellungen/Ansichten geprüft, ${startbildschirmFehler} Layout-Probleme`);

    // Aufräumen: die gerade gestartete Mini-Klausur und der simulierte
    // Übungsfilter-Zustand sollen keine späteren Checks in dieser Sitzung
    // beeinflussen (z. B. welcher Modus beim nächsten Start gezeigt wird).
    await wd(`/session/${id}/execute/sync`, 'POST', {
      script: `
        try {
          window.localStorage.removeItem('mathe-trainer-probeklausur-v1');
          window.localStorage.removeItem('mathe-trainer-uebung-filter-v1');
          window.localStorage.removeItem('mathe-trainer-probeklausur-zusatzthemen-v1');
          window.localStorage.removeItem('mathe-trainer-probeklausur-nur-filter-v1');
        } catch (e) {}
      `,
      args: [],
    });

    // Fokus-Stabilität: für jeden Generator ein paar Seeds durchgehen und
    // jedes Eingabefeld einzeln fokussieren (siehe FOKUS_PRUEFSKRIPT oben) —
    // kein Feld darf sich dabei verschieben, und das −/⁄-Knopfpaar muss dem
    // fokussierten Feld folgen (iPhone-Rückmeldung: Koeffizientenzeilen
    // brachen um, Matrix-Knopfpaar blieb immer links kleben).
    console.log('\nPrüfe Fokus-Stabilität (Eingabefelder dürfen sich nie verschieben) …');
    let fokusFehler = 0;
    let fokusGeprueft = 0;
    for (const generatorId of AKTIVE_GENERATOR_IDS) {
      for (let seed = 0; seed < FOKUS_SEEDS_PRO_GENERATOR; seed++) {
        await wd(`/session/${id}/execute/sync`, 'POST', {
          script: 'window.__testErzeugeAufgabe(arguments[0], arguments[1], false);',
          args: [generatorId, seed],
        });
        const probleme = await wd(`/session/${id}/execute/sync`, 'POST', {
          script: FOKUS_PRUEFSKRIPT, args: [],
        });
        fokusGeprueft += 1;
        for (const problem of probleme) {
          fehler += 1;
          fokusFehler += 1;
          console.error(`FEHLER (Fokus): ${generatorId} seed=${seed}: ${problem}`);
        }
      }
    }
    console.log(`Fokus-Stabilität: ${fokusGeprueft} Instanzen geprüft, ${fokusFehler} Probleme`);
    geprueft += fokusGeprueft;

    // Dynamic-Island-Simulation: echtes Desktop-Safari liefert immer
    // env(safe-area-inset-*) = 0 (kein Notch), darum lässt sich die Insel nicht
    // über die Fensterbreite/-höhe erzeugen. Stattdessen wird body.padding-top
    // direkt per injiziertem <style> auf 59px überschrieben (der Wert, den der
    // Nutzer für die Dynamic-Island-Höhe im Hochformat angegeben hat) und
    // geprüft, dass dadurch kein horizontales Scrollen oder Abschneiden entsteht.
    console.log('\nSimuliere Dynamic Island (safe-area-inset-top: 59px) …');
    await wd(`/session/${id}/execute/sync`, 'POST', {
      script: `
        const stil = document.createElement('style');
        stil.textContent = 'body { padding-top: 59px !important; padding-bottom: 48px !important; }';
        document.head.appendChild(stil);
      `, args: [],
    });
    let inselFehler = 0;
    for (const generatorId of AKTIVE_GENERATOR_IDS) {
      await wd(`/session/${id}/execute/sync`, 'POST', {
        script: 'window.__testErzeugeAufgabe(arguments[0], arguments[1], true);',
        args: [generatorId, 0],
      });
      const ergebnis = await wd(`/session/${id}/execute/sync`, 'POST', {
        script: LAYOUT_PRUEFSKRIPT, args: [],
      });
      geprueft += 1;
      for (const problem of ergebnis.probleme) {
        fehler += 1;
        inselFehler += 1;
        console.error(`FEHLER (Dynamic Island): ${generatorId}: ${problem}`);
      }
      const { value: kopfSichtbar } = { value: await wd(`/session/${id}/execute/sync`, 'POST', {
        script: `
          const kopf = document.querySelector('.kopf h1') || document.querySelector('#app');
          if (!kopf) return null;
          const rect = kopf.getBoundingClientRect();
          return rect.top >= 59;
        `, args: [],
      }) };
      if (kopfSichtbar === false) {
        fehler += 1;
        inselFehler += 1;
        console.error(`FEHLER (Dynamic Island): ${generatorId}: Kopfbereich beginnt oberhalb der simulierten Insel (< 59px)`);
      }
    }
    console.log(`Dynamic-Island-Simulation: ${GENERATOR_IDS.length} Generatoren geprüft, ${inselFehler} Probleme`);
  } finally {
    if (sitzung && sitzung.sessionId) {
      await wd(`/session/${sitzung.sessionId}`, 'DELETE').catch(() => {});
    }
    treiber.kill();
  }

  console.log(`\n${geprueft} Instanzen geprüft.`);
  if (fehler > 0) {
    console.error(`${fehler} Layout-Fehler gefunden.`);
    process.exit(1);
  }
  console.log('Keine Layout-Fehler gefunden.');
}

main().catch((e) => {
  console.error('Layout-Test abgebrochen:', e.message);
  process.exit(1);
});
