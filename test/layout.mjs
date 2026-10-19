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

const GENERATOR_IDS = [
  'fin.rente-aus-kapital',
  'fin.rente-veraenderlich',
  'fin.verdopplungszeit',
  'fin.effektivzins',
  'diff.gewinn-breakeven',
  'diff.extremwerte-2var',
  'diff.extremwerte-2var-quadratisch',
  'diff.nutzenmaximum',
  'diff.ableitungen',
  'int.unbestimmt',
  'int.bestimmt',
  'int.konsumentenrente',
  'int.kosten-aus-grenzkosten',
];

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
// Wichtig: Wir policen NICHT, ob irgendein Element innen (z. B. .katex-display)
// breiter ist als sein eigener clientWidth — das ist bei overflow-x:auto
// erwartet und korrekt so (.katex-display selbst hat overflow:visible, sein
// scrollWidth > clientWidth ist genau der Inhalt, den der SCROLLBARE Eltern-
// Container .loesung-formel aufnimmt; das ist kein Bug, das ist der Mechanismus).
// Was tatsächlich zählt:
//   1. Die Seite selbst scrollt nie horizontal (document.documentElement).
//   2. Jede unserer eigenen Scroll-Boxen (.loesung-formel, .loesung-ergebnis-
//      wert, .frage-tabelle-wrapper) ist selbst nicht breiter als ihr eigener
//      Elternbereich — genau die Flex-Item-Klasse von Bug, die vorher bei
//      .loesung-ergebnis-wert aufgetreten ist (kein min-width:0, Box wurde
//      von ihrem Inhalt aufgedrückt statt zu scrollen).
const LAYOUT_PRUEFSKRIPT = `
  const probleme = [];
  const seitenbreite = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > seitenbreite + 1) {
    probleme.push('Seite scrollt horizontal: scrollWidth=' + document.documentElement.scrollWidth + ' > ' + seitenbreite);
  }

  document.querySelectorAll('#app .loesung-formel, #app .loesung-ergebnis-wert, #app .frage-tabelle-wrapper').forEach((box) => {
    const eltern = box.parentElement;
    if (box.clientWidth > eltern.clientWidth + 1) {
      probleme.push(box.className + ': eigene Breite ' + box.clientWidth + ' > Elternbreite ' + eltern.clientWidth);
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

  return { seitenbreite, probleme };
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

    for (const generatorId of GENERATOR_IDS) {
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
    for (const generatorId of GENERATOR_IDS) {
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
