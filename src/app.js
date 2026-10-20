// Übungsmodus-UI. Wählt einen Generator, zeigt die Frage, prüft Zahlantworten
// automatisch und rendert die Lösung in der Formel-Notation der Folien.
// Die Probeklausur (Timer, Punkte-Split) kommt erst in Phase 5.

// Hochgestellte Ziffern für Potenz-Beschriftungen in reinem UI-Text (nicht
// LaTeX) — eigenständig hier definiert statt aus finanz.js importiert: in
// der gebündelten Datei wären private Hilfsfunktionen anderer Module zwar
// technisch erreichbar (die einfache Konkatenation kennt kein echtes
// Modul-Scoping mehr), aber sich darauf zu verlassen wäre eine stille,
// zufällige Kopplung, die unter Node (echte ES-Module, siehe test/alle.mjs)
// nicht gilt. Deshalb lieber eine eigene, winzige Kopie.
const APP_HOCHGESTELLTE_ZIFFERN = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function potenzBeschriftung(exponent) {
  if (exponent === 0) return '';
  if (exponent === 1) return 'x';
  if (exponent < 0) return 'x⁻' + String(-exponent).split('').map((z) => APP_HOCHGESTELLTE_ZIFFERN[Number(z)]).join('');
  return 'x' + String(exponent).split('').map((z) => APP_HOCHGESTELLTE_ZIFFERN[Number(z)]).join('');
}

// iOS' inputMode="decimal"-Tastatur hat weder "−" noch "/" — ohne diese
// zwei Funktionen ließen sich negative Antworten oder Brüche auf dem iPhone
// gar nicht eingeben. Arbeiten direkt auf dem übergebenen Feld, lösen selbst
// ein "input"-Event aus (damit "Eingelesen als" und die gut/schlecht-Klassen
// wie bei echter Tastatureingabe aktualisiert werden).
function schalteVorzeichenUm(feld) {
  if (!feld) return;
  const startPos = feld.selectionStart ?? feld.value.length;
  const wert = feld.value;
  let neuerWert;
  let verschiebung;
  if (wert[0] === '-' || wert[0] === '−') {
    neuerWert = wert.slice(1);
    verschiebung = -1;
  } else {
    neuerWert = '-' + wert;
    verschiebung = 1;
  }
  feld.value = neuerWert;
  feld.focus();
  const neuePos = Math.max(0, startPos + verschiebung);
  feld.setSelectionRange(neuePos, neuePos);
  feld.dispatchEvent(new Event('input', { bubbles: true }));
}

function fuegeBruchstrichEin(feld) {
  if (!feld) return;
  const start = feld.selectionStart ?? feld.value.length;
  const end = feld.selectionEnd ?? feld.value.length;
  const wert = feld.value;
  feld.value = wert.slice(0, start) + '/' + wert.slice(end);
  feld.focus();
  const neuePos = start + 1;
  feld.setSelectionRange(neuePos, neuePos);
  feld.dispatchEvent(new Event('input', { bubbles: true }));
}

function baueTabelle(tabelle) {
  const wrapper = document.createElement('div');
  wrapper.className = 'frage-tabelle-wrapper';
  const table = document.createElement('table');
  table.className = 'frage-tabelle';

  const kopfZeile = document.createElement('tr');
  for (const titel of tabelle.kopf) {
    const th = document.createElement('th');
    th.textContent = titel;
    kopfZeile.appendChild(th);
  }
  table.appendChild(kopfZeile);

  for (const zeile of tabelle.zeilen) {
    const tr = document.createElement('tr');
    for (const wert of zeile) {
      const td = document.createElement('td');
      td.textContent = wert;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  wrapper.appendChild(table);
  return wrapper;
}

function starteApp() {
  const wurzel = document.getElementById('app');
  wurzel.innerHTML = '';

  const kopf = document.createElement('header');
  kopf.className = 'kopf';
  kopf.innerHTML = '<h1>Mathe-Trainer Wirtschaftsmathematik</h1>';
  wurzel.appendChild(kopf);

  const karte = document.createElement('section');
  karte.className = 'aufgabe-karte';
  wurzel.appendChild(karte);

  // Feste Werkzeugleiste für "−" und "/" (siehe schalteVorzeichenUm/
  // fuegeBruchstrichEin oben) — ein einziges Exemplar statt je Feld eins,
  // wirkt auf aktivesFeld (das zuletzt fokussierte Eingabefeld). Bleibt
  // über Aufgabenwechsel hinweg bestehen (liegt außerhalb von karte, das
  // bei jeder neuen Aufgabe neu aufgebaut wird).
  let aktivesFeld = null;
  const werkzeugLeiste = document.createElement('div');
  werkzeugLeiste.className = 'vorzeichen-bruch-leiste';
  werkzeugLeiste.style.display = 'none';

  function werkzeugKnopf(text, titel, aktion) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = text;
    knopf.setAttribute('aria-label', titel);
    // mousedown/touchstart statt click: preventDefault hier verhindert, dass
    // der Tap dem fokussierten Eingabefeld den Fokus entzieht (sonst klappt
    // die iOS-Tastatur zu, bevor die Aktion überhaupt ausgeführt wird).
    // Beide Events bekommen denselben Handler — auf Touch-Geräten unterdrückt
    // preventDefault auf touchstart die synthetische Maus-Event-Folge, auf
    // reinen Zeigegeräten feuert nur mousedown — nie beide für denselben Tap.
    const verarbeiten = (ereignis) => {
      ereignis.preventDefault();
      aktion(aktivesFeld);
    };
    knopf.addEventListener('mousedown', verarbeiten);
    knopf.addEventListener('touchstart', verarbeiten);
    return knopf;
  }
  werkzeugLeiste.appendChild(werkzeugKnopf('−', 'Vorzeichen umschalten', schalteVorzeichenUm));
  werkzeugLeiste.appendChild(werkzeugKnopf('/', 'Bruchstrich einfügen', fuegeBruchstrichEin));
  wurzel.appendChild(werkzeugLeiste);

  let aktuelleAufgabe = null;

  function neueAufgabe() {
    const rngAuswahl = mulberry32(erzeugeSeed());
    const generator = zufallAus(rngAuswahl, GENERATOREN);
    const rngAufgabe = mulberry32(erzeugeSeed());
    const params = generator.waehleParameter(rngAufgabe);
    aktuelleAufgabe = generator.baue(params);
    zeichneAufgabe(generator);
  }

  function zeichneAufgabe(generator) {
    karte.innerHTML = '';
    aktivesFeld = null; // Felder der vorigen Aufgabe sind gleich nicht mehr im DOM

    const titel = document.createElement('h2');
    titel.textContent = generator.name + ' (' + generator.punkte + ' P)';
    karte.appendChild(titel);

    const frage = document.createElement('p');
    frage.className = 'frage-text';
    frage.textContent = aktuelleAufgabe.frage.text;
    karte.appendChild(frage);

    if (aktuelleAufgabe.frage.tabelle) {
      karte.appendChild(baueTabelle(aktuelleAufgabe.frage.tabelle));
    }

    // mitEigenerHinweis=false: das Feld bekommt keinen eigenen "Eingelesen
    // als"-Hinweis direkt daneben (für Koeffizientenreihen, wo das die Zeile
    // zum Umbrechen bringen würde — ein gemeinsamer Hinweis unter der ganzen
    // Reihe wird stattdessen vom Aufrufer gebaut, siehe unten).
    function baueZahlenfeld(zeile, { mitEigenerHinweis = true } = {}) {
      const feld = document.createElement('input');
      feld.type = 'text';
      feld.inputMode = 'decimal';
      feld.autocomplete = 'off';
      feld.autocorrect = 'off';
      feld.spellcheck = false;
      zeile.appendChild(feld);
      feld.addEventListener('focus', function () {
        aktivesFeld = feld;
      });

      if (mitEigenerHinweis) {
        const eingelesenAls = document.createElement('span');
        eingelesenAls.className = 'eingelesen-als';
        zeile.appendChild(eingelesenAls);
        feld.addEventListener('input', function () {
          feld.classList.remove('gut', 'schlecht');
          aktualisiereEingelesenAls(feld.value, eingelesenAls);
        });
      } else {
        feld.addEventListener('input', function () {
          feld.classList.remove('gut', 'schlecht');
        });
      }
      return feld;
    }

    function aktualisiereEingelesenAls(text, ziel) {
      const getrimmt = text.trim();
      if (getrimmt === '') {
        ziel.textContent = ' '; // geschütztes Leerzeichen: Höhe bleibt reserviert
        return;
      }
      const wert = parseDeZahl(getrimmt);
      ziel.textContent = isFinite(wert)
        ? 'Eingelesen als ' + formatDeZahlFrei(wert)
        : 'Eingelesen als: keine Zahl erkannt';
    }

    const form = document.createElement('div');
    form.className = 'eingaben';
    const felder = {};
    for (const eingabe of aktuelleAufgabe.eingaben) {
      const zeile = document.createElement('label');
      zeile.className = 'eingabe-zeile';
      const beschriftung = document.createElement('span');
      beschriftung.textContent = eingabe.label + ': ';
      zeile.appendChild(beschriftung);

      if (eingabe.typ === 'koeffizienten') {
        const reihe = document.createElement('span');
        reihe.className = 'koeffizienten-reihe';
        const teilfelder = [];
        eingabe.exponenten.forEach((exponent, i) => {
          if (i > 0) {
            const plus = document.createElement('span');
            plus.className = 'koeffizienten-plus';
            plus.textContent = '+';
            reihe.appendChild(plus);
          }
          const teilZeile = document.createElement('span');
          teilZeile.className = 'koeffizienten-teil';
          const feld = baueZahlenfeld(teilZeile, { mitEigenerHinweis: false });
          const potenzLabel = document.createElement('span');
          potenzLabel.className = 'koeffizienten-potenz';
          potenzLabel.textContent = potenzBeschriftung(exponent);
          teilZeile.appendChild(potenzLabel);
          reihe.appendChild(teilZeile);
          teilfelder.push(feld);
        });
        zeile.appendChild(reihe);

        // Ein gemeinsamer Hinweis unter der ganzen Reihe, nicht je Feld —
        // zeigt alle Koeffizienten zusammen, z. B. "Eingelesen als: -2, 25, 0".
        const eingelesenAls = document.createElement('span');
        eingelesenAls.className = 'eingelesen-als eingelesen-als-reihe';
        eingelesenAls.textContent = ' ';
        zeile.appendChild(eingelesenAls);
        teilfelder.forEach((feld) => {
          feld.addEventListener('input', function () {
            const werte = teilfelder.map((f) => f.value.trim());
            if (werte.every((w) => w === '')) {
              eingelesenAls.textContent = ' ';
              return;
            }
            const geparst = werte.map((w) => {
              if (w === '') return '–';
              const z = parseDeZahl(w);
              return isFinite(z) ? formatDeZahlFrei(z) : '?';
            });
            eingelesenAls.textContent = 'Eingelesen als: ' + geparst.join(', ');
          });
        });

        felder[eingabe.id] = teilfelder;
      } else if (eingabe.typ === 'auswahl') {
        const auswahl = document.createElement('select');
        const platzhalter = document.createElement('option');
        platzhalter.value = '';
        platzhalter.textContent = '— bitte wählen —';
        auswahl.appendChild(platzhalter);
        for (const option of eingabe.optionen) {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option;
          auswahl.appendChild(opt);
        }
        auswahl.addEventListener('change', function () {
          auswahl.classList.remove('gut', 'schlecht');
        });
        zeile.appendChild(auswahl);
        felder[eingabe.id] = auswahl;
      } else if (eingabe.typ === 'term') {
        // Symbolterme (z. B. Ableitungen) werden nicht automatisch geprüft:
        // schriftlich lösen, dann mit "Lösung zeigen" selbst vergleichen.
        // null ist das Zeichen für den Prüfen-Knopf, dieses Feld zu überspringen.
        const hinweis = document.createElement('span');
        hinweis.className = 'eingelesen-als';
        hinweis.textContent = 'Schriftlich lösen, dann mit „Lösung zeigen" vergleichen.';
        zeile.appendChild(hinweis);
        felder[eingabe.id] = null;
      } else {
        felder[eingabe.id] = baueZahlenfeld(zeile);
      }

      form.appendChild(zeile);
    }
    karte.appendChild(form);

    // Nur anzeigen, wenn es überhaupt ein Zahlenfeld gibt — bei reinen
    // Auswahl-/Textaufgaben wäre die Leiste nutzlos.
    const hatZahlenfeld = aktuelleAufgabe.eingaben.some((e) => e.typ === 'zahl' || e.typ === 'koeffizienten');
    werkzeugLeiste.style.display = hatZahlenfeld ? 'flex' : 'none';

    const ergebnisZeile = document.createElement('p');
    ergebnisZeile.className = 'pruef-ergebnis';
    karte.appendChild(ergebnisZeile);

    const loesungContainer = document.createElement('div');
    loesungContainer.className = 'loesung-container';

    const knopfReihe = document.createElement('div');
    knopfReihe.className = 'knopf-reihe';

    const pruefenKnopf = document.createElement('button');
    pruefenKnopf.type = 'button';
    pruefenKnopf.textContent = 'Prüfen';
    pruefenKnopf.addEventListener('click', function () {
      // Jedes Feld zählt unabhängig: leer ist "noch nicht beantwortet"
      // (neutral, keine rote Markierung), nicht automatisch falsch. Am Ende
      // steht eine Zusammenfassung über alle (nicht-term-)Felder.
      let gesamt = 0;
      let richtig = 0;
      let leer = 0;
      for (const eingabe of aktuelleAufgabe.eingaben) {
        const feldOderFelder = felder[eingabe.id];
        if (eingabe.typ === 'term') continue; // nicht automatisch geprüft, siehe oben

        if (eingabe.typ === 'koeffizienten') {
          feldOderFelder.forEach((f) => f.classList.remove('gut', 'schlecht'));
          gesamt += feldOderFelder.length;
          const werte = feldOderFelder.map((f) => f.value);
          const bewertung = bewerteKoeffizientenZeile(werte, eingabe.loesung, eingabe.toleranz);
          if (bewertung.leer > 0) {
            leer += bewertung.leer;
            continue;
          }
          bewertung.proBox.forEach((box, i) => {
            feldOderFelder[i].classList.add(box.korrekt ? 'gut' : 'schlecht');
            if (box.korrekt) richtig += 1;
          });
        } else if (eingabe.typ === 'auswahl') {
          gesamt += 1;
          feldOderFelder.classList.remove('gut', 'schlecht');
          if (feldOderFelder.value === '') {
            leer += 1;
            continue;
          }
          const ergebnis = pruefeAuswahl(feldOderFelder.value, eingabe.loesung);
          feldOderFelder.classList.add(ergebnis.korrekt ? 'gut' : 'schlecht');
          if (ergebnis.korrekt) richtig += 1;
        } else {
          gesamt += 1;
          feldOderFelder.classList.remove('gut', 'schlecht');
          if (feldOderFelder.value.trim() === '') {
            leer += 1;
            continue;
          }
          const ergebnis = pruefeZahl(feldOderFelder.value, eingabe.loesung, eingabe.toleranz);
          feldOderFelder.classList.add(ergebnis.korrekt ? 'gut' : 'schlecht');
          if (ergebnis.korrekt) richtig += 1;
        }
      }

      const falsch = gesamt - richtig - leer;
      if (leer === gesamt) {
        ergebnisZeile.textContent = 'Bitte mindestens ein Feld ausfüllen.';
        ergebnisZeile.className = 'pruef-ergebnis neutral';
      } else if (richtig === gesamt) {
        ergebnisZeile.textContent = 'Richtig.';
        ergebnisZeile.className = 'pruef-ergebnis gut';
      } else {
        const leerZusatz = leer > 0 ? `, ${leer} Feld${leer === 1 ? '' : 'er'} leer` : '';
        ergebnisZeile.textContent = `${richtig} von ${gesamt} richtig${leerZusatz}.`;
        ergebnisZeile.className = 'pruef-ergebnis ' + (falsch > 0 ? 'schlecht' : 'neutral');
      }
    });
    knopfReihe.appendChild(pruefenKnopf);

    const loesungKnopf = document.createElement('button');
    loesungKnopf.type = 'button';
    loesungKnopf.textContent = 'Lösung zeigen';
    loesungKnopf.addEventListener('click', function () {
      renderLoesung(aktuelleAufgabe.loesung, loesungContainer);
    });
    knopfReihe.appendChild(loesungKnopf);

    const neueKnopf = document.createElement('button');
    neueKnopf.type = 'button';
    neueKnopf.textContent = 'Neue Aufgabe';
    neueKnopf.addEventListener('click', neueAufgabe);
    knopfReihe.appendChild(neueKnopf);

    karte.appendChild(knopfReihe);
    karte.appendChild(loesungContainer);
  }

  // Nur für Tests (test/layout.mjs): erzeugt eine bestimmte Aufgabe
  // deterministisch und zeigt optional sofort die Lösung, damit ein
  // Layout-Test ohne Klicksimulation eine konkrete Instanz prüfen kann.
  // Ohne Effekt auf die normale Nutzung.
  window.__testErzeugeAufgabe = function (generatorId, seed, mitLoesung) {
    const generator = findeGenerator(generatorId);
    if (!generator) throw new Error('Unbekannter Generator: ' + generatorId);
    const params = generator.waehleParameter(mulberry32(seed));
    aktuelleAufgabe = generator.baue(params);
    zeichneAufgabe(generator);
    if (mitLoesung) {
      renderLoesung(aktuelleAufgabe.loesung, karte.querySelector('.loesung-container'));
    }
  };

  neueAufgabe();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starteApp);
  } else {
    starteApp();
  }
}
