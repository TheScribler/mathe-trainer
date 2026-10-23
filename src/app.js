// UI: Übungsmodus und Probeklausur. Wählt Generatoren, zeigt Fragen, prüft
// Zahlantworten automatisch und rendert die Lösung in der Formel-Notation
// der Folien. Die Probeklausur (Timer, Punkte-Split, Auswertung) teilt sich
// die Frage-/Eingaben-Bausteine mit dem Übungsmodus (siehe baueFrageDarstellung,
// baueEingabenFelder, bewerteAlleEingaben weiter unten).

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

// Ob zaehler/nenner als Dezimalbruch abbricht — eigene, kleine Kopie der
// gleichnamigen Funktion in latex.js (dieselbe Begründung wie überall sonst
// in dieser Datei: echte Modul-Grenzen unter Node, keine stille Kopplung an
// private Hilfsfunktionen eines anderen Moduls).
function istAbbrechenderDezimalbruchApp(nenner) {
  let rest = Math.abs(nenner);
  while (rest % 2 === 0) rest /= 2;
  while (rest % 5 === 0) rest /= 5;
  return rest === 1;
}

// "=" mit dem exakten Dezimalwert, wenn der eingetippte Bruch abbricht
// (z. B. "-1/2 = -0,5"), sonst "≈" mit einer echten Rundung auf 2 Nachkomma-
// stellen ("2/3 ≈ 0,67") — dieselbe Regel wie in den Lösungen (bruchMitDezimal,
// latex.js). text ist die Rohschreibweise ("-1/2"), wert ihr Zahlenwert.
function bruchVergleichUndWert(text, wert) {
  const teile = text.split('/');
  if (teile.length === 2) {
    const nenner = parseDeZahl(teile[1]);
    if (Number.isInteger(nenner) && nenner !== 0 && istAbbrechenderDezimalbruchApp(nenner)) {
      return `= ${formatDeZahl(wert, minimaleNachkommastellen(wert))}`;
    }
  }
  return `≈ ${formatDeZahl(wert, 2)}`;
}

// feldOderGetter: entweder direkt das Feld (Standard-Zahlenfeld, immer
// dasselbe) oder eine Funktion, die das aktuell relevante Feld liefert
// (Koeffizientenreihe — mehrere Teilfelder teilen sich ein Knopfpaar, das
// auf das zuletzt fokussierte Teilfeld wirkt).
function werkzeugKnopf(text, titel, aktion, feldOderGetter) {
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
    const ziel = typeof feldOderGetter === 'function' ? feldOderGetter() : feldOderGetter;
    aktion(ziel);
  };
  knopf.addEventListener('mousedown', verarbeiten);
  knopf.addEventListener('touchstart', verarbeiten);
  return knopf;
}

// Knopfpaar "−"/"/", standardmäßig unsichtbar (siehe .vorzeichen-bruch-paar
// in stil.css) — wird vom Aufrufer per focus/blur auf dem betroffenen Feld
// sichtbar geschaltet (Klasse "aktiv"), erscheint also direkt neben/unter
// dem gerade fokussierten Feld statt als feste Leiste am Seitenende (dort
// landet sie bei langen Aufgaben hinter der aufklappenden iOS-Tastatur).
function baueVorzeichenBruchKnopfe(feldOderGetter) {
  const knopfPaar = document.createElement('span');
  knopfPaar.className = 'vorzeichen-bruch-paar';
  knopfPaar.appendChild(werkzeugKnopf('−', 'Vorzeichen umschalten', schalteVorzeichenUm, feldOderGetter));
  knopfPaar.appendChild(werkzeugKnopf('/', 'Bruchstrich einfügen', fuegeBruchstrichEin, feldOderGetter));
  return knopfPaar;
}

// Schiebt das (einzige, wiederverwendete) Knopfpaar per margin-left so, dass
// seine linke Kante mit der linken Kante von feld übereinstimmt — das Paar
// bleibt dabei ein normales Fließelement NACH der ganzen Reihe/dem Gitter
// (nie mittendrin eingefügt, das brachte vorher den Zeilenumbruch der
// Koeffizientenreihe durcheinander und ließ es bei Matrizen immer links
// kleben). Erst auf 0 zurücksetzen, dann über getBoundingClientRect neu
// vermessen — robust gegenüber Flex/Grid-Eigenheiten von offsetLeft.
function positioniereKnopfPaarUnterFeld(knopfPaar, feld) {
  knopfPaar.style.marginLeft = '0px';
  const feldLinks = feld.getBoundingClientRect().left;
  const paarLinks = knopfPaar.getBoundingClientRect().left;
  knopfPaar.style.marginLeft = `${Math.max(0, feldLinks - paarLinks)}px`;
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

// Frage-Text, optionale Tabelle und optionale LaTeX-Formel in eine Karte
// rendern — identisch für Übungsmodus und Probeklausur, deshalb hier einmal
// gebaut statt zweimal.
function baueFrageDarstellung(karte, aufgabe) {
  const frage = document.createElement('p');
  frage.className = 'frage-text';
  frage.textContent = aufgabe.frage.text;
  karte.appendChild(frage);

  if (aufgabe.frage.tabelle) {
    karte.appendChild(baueTabelle(aufgabe.frage.tabelle));
  }

  // frage.formel: LaTeX-Inhalt direkt in der Aufgabenstellung (z. B.
  // Matrizen als echtes pmatrix statt als Fließtext-Kurzschreibweise).
  if (aufgabe.frage.formel) {
    const formel = document.createElement('div');
    formel.className = 'frage-formel';
    if (typeof window !== 'undefined' && window.katex) {
      window.katex.render(aufgabe.frage.formel, formel, { throwOnError: false, displayMode: true });
    } else {
      formel.textContent = aufgabe.frage.formel;
    }
    karte.appendChild(formel);
  }
}

// Baut die komplette Eingaben-Sektion (.eingaben) für eine Aufgabe: ein Feld
// (oder mehrere, bei koeffizienten/matrix) je Teilaufgabe, inklusive
// Vorzeichen/Bruch-Knopfpaar und "Eingelesen als"-Hinweis. Gemeinsam genutzt
// von Übungsmodus und Probeklausur. onAenderung (optional) wird bei jeder
// Eingabe mit den aktuellen Antworten aufgerufen (liesAntworten()) — die
// Probeklausur nutzt das, um nach jedem Tastendruck in localStorage zu
// sichern; der Übungsmodus braucht es nicht.
function baueEingabenFelder(aufgabe, { onAenderung } = {}) {
  // mitEigenerHinweis=false: das Feld bekommt keinen eigenen "Eingelesen
  // als"-Hinweis direkt daneben (für Koeffizientenreihen, wo das die Zeile
  // zum Umbrechen bringen würde — ein gemeinsamer Hinweis unter der ganzen
  // Reihe wird stattdessen vom Aufrufer gebaut, siehe unten).
  function baueZahlenfeld(zeile, { mitEigenerHinweis = true, mitEigenenKnopfen = true } = {}) {
    const feld = document.createElement('input');
    feld.type = 'text';
    feld.inputMode = 'decimal';
    feld.autocomplete = 'off';
    feld.autocorrect = 'off';
    feld.spellcheck = false;
    zeile.appendChild(feld);

    if (mitEigenenKnopfen) {
      const knopfPaar = baueVorzeichenBruchKnopfe(feld);
      zeile.appendChild(knopfPaar);
      feld.addEventListener('focus', () => knopfPaar.classList.add('aktiv'));
      feld.addEventListener('blur', () => knopfPaar.classList.remove('aktiv'));
    }

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
      ziel.textContent = ' '; // geschütztes Leerzeichen: Höhe bleibt reserviert
      return;
    }
    const wert = parseDeZahl(getrimmt);
    if (!isFinite(wert)) {
      ziel.textContent = 'Eingelesen als: keine Zahl erkannt';
      return;
    }
    // Bei einem Bruch die eingegebene Schreibweise selbst zeigen (z. B.
    // "2/3 ≈ 0,67") statt nur die lange Dezimalzahl (0,666667) — sonst ist
    // nicht sofort zu erkennen, dass der Bruch richtig gelesen wurde.
    ziel.textContent = getrimmt.includes('/')
      ? `Eingelesen als ${getrimmt} ${bruchVergleichUndWert(getrimmt, wert)}`
      : 'Eingelesen als ' + formatDeZahlFrei(wert);
  }

  const form = document.createElement('div');
  form.className = 'eingaben';
  const felder = {};
  for (const eingabe of aufgabe.eingaben) {
    const zeile = document.createElement('label');
    zeile.className = 'eingabe-zeile';
    const beschriftung = document.createElement('span');
    // Kein Doppelpunkt nach einem Fragezeichen ("Ist das Produkt
    // definiert?" statt "...definiert?:", iPhone-Rückmeldung).
    beschriftung.textContent = eingabe.label + (eingabe.label.trim().endsWith('?') ? ' ' : ': ');
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
        const feld = baueZahlenfeld(teilZeile, { mitEigenerHinweis: false, mitEigenenKnopfen: false });
        const potenzLabel = document.createElement('span');
        potenzLabel.className = 'koeffizienten-potenz';
        potenzLabel.textContent = potenzBeschriftung(exponent);
        teilZeile.appendChild(potenzLabel);
        reihe.appendChild(teilZeile);
        teilfelder.push(feld);
      });
      // Bei einer unbestimmten Stammfunktion gehört "+ c" zur Lösung, auch
      // wenn c selbst nicht abgefragt wird — ohne diesen Hinweis sah die
      // Box-Reihe aus, als würde sie mitten im Term aufhören (iPhone-
      // Rückmeldung).
      if (eingabe.mitKonstante) {
        const plusC = document.createElement('span');
        plusC.className = 'koeffizienten-plus';
        plusC.textContent = '+ c';
        reihe.appendChild(plusC);
      }
      zeile.appendChild(reihe);

      // Ein einziges Knopfpaar für die ganze Reihe statt je Teilfeld eins
      // (in der engen Koeffizientenzeile wäre das zu beengt) — wirkt auf
      // das zuletzt fokussierte Teilfeld.
      let fokussiertesTeilfeld = null;
      const knopfPaarReihe = baueVorzeichenBruchKnopfe(() => fokussiertesTeilfeld);
      zeile.appendChild(knopfPaarReihe);

      // Ein gemeinsamer Hinweis unter der ganzen Reihe, nicht je Feld —
      // zeigt alle Koeffizienten zusammen, z. B. "Eingelesen als: -2, 25, 0".
      const eingelesenAls = document.createElement('span');
      eingelesenAls.className = 'eingelesen-als eingelesen-als-reihe';
      eingelesenAls.textContent = ' ';
      zeile.appendChild(eingelesenAls);
      teilfelder.forEach((feld) => {
        feld.addEventListener('focus', () => {
          fokussiertesTeilfeld = feld;
          // Das Knopfpaar bleibt ein normales Element NACH der ganzen
          // Reihe (nie mittendrin eingefügt — das brachte sonst den
          // Zeilenumbruch der Reihe durcheinander) und wird per
          // margin-left unter das fokussierte Kästchen verschoben.
          positioniereKnopfPaarUnterFeld(knopfPaarReihe, feld);
          knopfPaarReihe.classList.add('aktiv');
        });
        feld.addEventListener('blur', () => {
          knopfPaarReihe.classList.remove('aktiv');
        });
        feld.addEventListener('input', function () {
          const werte = teilfelder.map((f) => f.value.trim());
          if (werte.every((w) => w === '')) {
            eingelesenAls.textContent = ' ';
            return;
          }
          const geparst = werte.map((w) => {
            if (w === '') return '–';
            const z = parseDeZahl(w);
            if (!isFinite(z)) return '?';
            return w.includes('/') ? `${w} ${bruchVergleichUndWert(w, z)}` : formatDeZahlFrei(z);
          });
          eingelesenAls.textContent = 'Eingelesen als: ' + geparst.join(', ');
        });
      });

      felder[eingabe.id] = teilfelder;
    } else if (eingabe.typ === 'matrix') {
      const gitter = document.createElement('div');
      gitter.className = 'matrix-gitter';
      // Optionale Spalten-/Zeilen-Beschriftungen (z. B. Tilgungsplan: "S, Z,
      // T, A" über den Spalten, Jahreszahlen links neben den Zeilen) — ohne
      // sie war nicht erkennbar, welche Spalte welche Größe ist (iPhone-
      // Rückmeldung). Rein additiv: ohne spaltenLabels/zeilenLabels verhält
      // sich das Gitter exakt wie zuvor (alg.matrixprodukt u. a.).
      const spaltenLabels = eingabe.spaltenLabels ?? null;
      const zeilenLabels = eingabe.zeilenLabels ?? null;
      gitter.style.gridTemplateColumns = (zeilenLabels ? 'auto ' : '') + `repeat(${eingabe.spalten}, auto)`;

      if (spaltenLabels) {
        if (zeilenLabels) {
          const leer = document.createElement('span');
          leer.className = 'matrix-kopf-leer';
          gitter.appendChild(leer);
        }
        spaltenLabels.forEach((text) => {
          const kopf = document.createElement('span');
          kopf.className = 'matrix-spalten-label';
          kopf.textContent = text;
          gitter.appendChild(kopf);
        });
      }

      const zellen = [];
      for (let i = 0; i < eingabe.zeilen; i++) {
        if (zeilenLabels) {
          const zeilenLabel = document.createElement('span');
          zeilenLabel.className = 'matrix-zeilen-label';
          zeilenLabel.textContent = zeilenLabels[i];
          gitter.appendChild(zeilenLabel);
        }
        const zeilenFelder = [];
        for (let j = 0; j < eingabe.spalten; j++) {
          const feld = baueZahlenfeld(gitter, { mitEigenerHinweis: false, mitEigenenKnopfen: false });
          feld.classList.add('matrix-zelle');
          zeilenFelder.push(feld);
        }
        zellen.push(zeilenFelder);
      }
      zeile.appendChild(gitter);

      // Ein einziges Knopfpaar für die ganze Matrix statt je Zelle eins,
      // als normales Element NACH dem Gitter (nie als zusätzliches Grid-
      // Element eingefügt — das würde das Spaltenraster verschieben) und
      // per margin-left unter die fokussierte Zelle verschoben.
      const alleZellen = zellen.flat();
      let fokussierteZelle = null;
      const knopfPaarMatrix = baueVorzeichenBruchKnopfe(() => fokussierteZelle);
      zeile.appendChild(knopfPaarMatrix);

      const eingelesenAls = document.createElement('span');
      eingelesenAls.className = 'eingelesen-als eingelesen-als-reihe';
      eingelesenAls.textContent = ' ';
      zeile.appendChild(eingelesenAls);

      alleZellen.forEach((feld) => {
        feld.addEventListener('focus', () => {
          fokussierteZelle = feld;
          positioniereKnopfPaarUnterFeld(knopfPaarMatrix, feld);
          knopfPaarMatrix.classList.add('aktiv');
        });
        feld.addEventListener('blur', () => {
          knopfPaarMatrix.classList.remove('aktiv');
        });
        feld.addEventListener('input', function () {
          const alleLeer = alleZellen.every((f) => f.value.trim() === '');
          if (alleLeer) {
            eingelesenAls.textContent = ' ';
            return;
          }
          const geparst = alleZellen.map((f) => {
            const w = f.value.trim();
            if (w === '') return '–';
            const z = parseDeZahl(w);
            if (!isFinite(z)) return '?';
            return w.includes('/') ? `${w} ${bruchVergleichUndWert(w, z)}` : formatDeZahlFrei(z);
          });
          eingelesenAls.textContent = 'Eingelesen als: ' + geparst.join(', ');
        });
      });

      felder[eingabe.id] = zellen;
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
      // schriftlich lösen, dann mit "Lösung zeigen" (Übungsmodus) bzw. in
      // der Auswertung (Probeklausur) selbst vergleichen.
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

  function liesAntworten() {
    const werte = {};
    for (const eingabe of aufgabe.eingaben) {
      if (eingabe.typ === 'term') continue; // kein Eingabefeld, siehe oben
      const feldOderFelder = felder[eingabe.id];
      if (eingabe.typ === 'koeffizienten') werte[eingabe.id] = feldOderFelder.map((f) => f.value);
      else if (eingabe.typ === 'matrix') werte[eingabe.id] = feldOderFelder.map((zeile) => zeile.map((f) => f.value));
      else werte[eingabe.id] = feldOderFelder.value; // 'auswahl' und 'zahl'
    }
    return werte;
  }

  if (onAenderung) {
    form.addEventListener('input', () => onAenderung(liesAntworten()));
    form.addEventListener('change', () => onAenderung(liesAntworten()));
  }

  return { form, felder, liesAntworten };
}

// Setzt zuvor gespeicherte Antworten (liesAntworten()-Form) in die Felder
// zurück — für die Probeklausur: Fortschritt überlebt das Schließen der App.
// Löst auf einem Teilfeld je Eingabe ein "input"-Event aus, damit die
// gemeinsamen "Eingelesen als"-Hinweise (die bei jedem Teilfeld dieselben
// aktuellen Werte aller Teilfelder neu einlesen) ohne eigenen Sonderfall
// aktualisiert werden.
function setzeAntworten(aufgabe, felder, werte) {
  if (!werte) return;
  for (const eingabe of aufgabe.eingaben) {
    if (eingabe.typ === 'term' || !(eingabe.id in werte)) continue;
    const feldOderFelder = felder[eingabe.id];
    const wert = werte[eingabe.id];
    if (eingabe.typ === 'koeffizienten') {
      feldOderFelder.forEach((f, i) => { f.value = wert[i] ?? ''; });
      if (feldOderFelder[0]) feldOderFelder[0].dispatchEvent(new Event('input', { bubbles: true }));
    } else if (eingabe.typ === 'matrix') {
      feldOderFelder.forEach((zeile, i) => zeile.forEach((f, j) => { f.value = (wert[i] && wert[i][j]) ?? ''; }));
      if (feldOderFelder[0] && feldOderFelder[0][0]) feldOderFelder[0][0].dispatchEvent(new Event('input', { bubbles: true }));
    } else if (eingabe.typ === 'auswahl') {
      feldOderFelder.value = wert ?? '';
    } else {
      feldOderFelder.value = wert ?? '';
      feldOderFelder.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

// Bewertet alle (nicht-term-)Eingaben einer Aufgabe gegen ihre Lösung, setzt
// die gut/schlecht-Klassen auf den Feldern (sichtbares Feedback) und liefert
// zusätzlich erreichte/mögliche Punkte zurück — Grundlage sowohl für die
// Übungsmodus-Kurzmeldung ("4 von 6 richtig") als auch für die
// Probeklausur-Auswertung (Punkte je Teilaufgabe, Summe). Bei koeffizienten/
// matrix gibt es Teilpunkte proportional zu den richtigen Boxen/Zellen.
//
// Die Rundung auf halbe Punkte (rundePunkteAbwaerts) gilt je EINGABE (also
// je Teilaufgabe a), b), …) — so vergibt die Klausur auch wirklich Punkte:
// jede Teilaufgabe steht mit ihrer eigenen Punktzahl auf dem Blatt und wird
// einzeln bewertet, nicht erst am Ende über die ganze Aufgabe hinweg
// zusammengerechnet und dann gemeinsam gerundet (iPhone-Rückmeldung:
// matrixprodukt mit a) 1/3 und b) 2/9 richtig muss 0,5 P + 0 P = 0,5 P
// ergeben, nicht — wie eine vorherige Fassung das tat — 1 P aus der Summe
// vor dem Runden). Eine Aufgabe ohne mehrere Teilaufgaben-Felder (nur ein
// koeffizienten-/matrix-Feld) ist davon nicht betroffen: dort IST die
// Rundung je Feld ohnehin dasselbe wie die Rundung über die ganze Aufgabe.
function bewerteAlleEingaben(aufgabe, felder) {
  let gesamt = 0;
  let richtig = 0;
  let leer = 0;
  let erreichtePunkte = 0;
  let maxPunkteAutomatisch = 0;
  const proEingabe = [];

  for (const eingabe of aufgabe.eingaben) {
    if (eingabe.typ === 'term') {
      proEingabe.push({ id: eingabe.id, typ: 'term', punkte: eingabe.punkte });
      continue; // nicht automatisch geprüft — Selbstbewertung (Probeklausur-Auswertung)
    }
    maxPunkteAutomatisch += eingabe.punkte;
    const feldOderFelder = felder[eingabe.id];

    if (eingabe.typ === 'koeffizienten') {
      feldOderFelder.forEach((f) => f.classList.remove('gut', 'schlecht'));
      gesamt += feldOderFelder.length;
      const werte = feldOderFelder.map((f) => f.value);
      const bewertung = bewerteKoeffizientenZeile(werte, eingabe.loesung, eingabe.toleranz);
      if (bewertung.leer > 0) {
        leer += bewertung.leer;
        proEingabe.push({ id: eingabe.id, typ: eingabe.typ, punkte: eingabe.punkte, erreichtePunkte: 0, leer: true });
        continue;
      }
      let teilRichtig = 0;
      bewertung.proBox.forEach((box, i) => {
        feldOderFelder[i].classList.add(box.korrekt ? 'gut' : 'schlecht');
        if (box.korrekt) { richtig += 1; teilRichtig += 1; }
      });
      const punkteEingabe = rundePunkteAbwaerts((teilRichtig / feldOderFelder.length) * eingabe.punkte);
      erreichtePunkte += punkteEingabe;
      proEingabe.push({ id: eingabe.id, typ: eingabe.typ, punkte: eingabe.punkte, erreichtePunkte: punkteEingabe, leer: false });
    } else if (eingabe.typ === 'matrix') {
      // Anders als bei Koeffizientenzeilen zählt hier jede leere Zelle für
      // sich als leer (siehe bewerteMatrix) — leere und ausgefüllte Zellen
      // können nebeneinander vorkommen und werden unabhängig behandelt.
      const zellen = feldOderFelder;
      zellen.forEach((zeile) => zeile.forEach((f) => f.classList.remove('gut', 'schlecht')));
      const anzahl = zellen.reduce((s, zeile) => s + zeile.length, 0);
      gesamt += anzahl;
      const werte = zellen.map((zeile) => zeile.map((f) => f.value));
      const bewertung = bewerteMatrix(werte, eingabe.loesung, eingabe.toleranz);
      leer += bewertung.leer;
      let teilRichtig = 0;
      bewertung.proZelle.forEach((zeile, i) => zeile.forEach((zelle, j) => {
        if (!zelle.bewertet) return; // leer: bleibt neutral, keine gut/schlecht-Klasse
        zellen[i][j].classList.add(zelle.korrekt ? 'gut' : 'schlecht');
        if (zelle.korrekt) { richtig += 1; teilRichtig += 1; }
      }));
      const beantwortet = anzahl - bewertung.leer;
      const punkteEingabe = beantwortet > 0 ? rundePunkteAbwaerts((teilRichtig / anzahl) * eingabe.punkte) : 0;
      erreichtePunkte += punkteEingabe;
      proEingabe.push({ id: eingabe.id, typ: eingabe.typ, punkte: eingabe.punkte, erreichtePunkte: punkteEingabe, leer: beantwortet === 0 });
    } else if (eingabe.typ === 'auswahl') {
      gesamt += 1;
      feldOderFelder.classList.remove('gut', 'schlecht');
      if (feldOderFelder.value === '') {
        leer += 1;
        proEingabe.push({ id: eingabe.id, typ: eingabe.typ, punkte: eingabe.punkte, erreichtePunkte: 0, leer: true });
        continue;
      }
      const ergebnis = pruefeAuswahl(feldOderFelder.value, eingabe.loesung);
      feldOderFelder.classList.add(ergebnis.korrekt ? 'gut' : 'schlecht');
      if (ergebnis.korrekt) richtig += 1;
      const punkteEingabe = ergebnis.korrekt ? eingabe.punkte : 0;
      erreichtePunkte += punkteEingabe;
      proEingabe.push({ id: eingabe.id, typ: eingabe.typ, punkte: eingabe.punkte, erreichtePunkte: punkteEingabe, leer: false });
    } else {
      gesamt += 1;
      feldOderFelder.classList.remove('gut', 'schlecht');
      if (feldOderFelder.value.trim() === '') {
        leer += 1;
        proEingabe.push({ id: eingabe.id, typ: eingabe.typ, punkte: eingabe.punkte, erreichtePunkte: 0, leer: true });
        continue;
      }
      const ergebnis = pruefeZahl(feldOderFelder.value, eingabe.loesung, eingabe.toleranz);
      feldOderFelder.classList.add(ergebnis.korrekt ? 'gut' : 'schlecht');
      if (ergebnis.korrekt) richtig += 1;
      const punkteEingabe = ergebnis.korrekt ? eingabe.punkte : 0;
      erreichtePunkte += punkteEingabe;
      proEingabe.push({ id: eingabe.id, typ: eingabe.typ, punkte: eingabe.punkte, erreichtePunkte: punkteEingabe, leer: false });
    }
  }

  const falsch = gesamt - richtig - leer;
  return { gesamt, richtig, leer, falsch, erreichtePunkte, maxPunkteAutomatisch, proEingabe };
}

// ---------------------------------------------------------------------------
// Übungsmodus
// ---------------------------------------------------------------------------

const TEIL_NAMEN = { finanz: 'Finanzmathematik', diff: 'Differentialrechnung', integral: 'Integralrechnung', algebra: 'Lineare Algebra' };

// localStorage mit In-Memory-Ersatz (dieselbe Begründung wie bei der
// Probeklausur): merkt sich die zuletzt gewählte Themenfilter-Einstellung
// über einen Neustart der App hinweg.
const UEBUNG_FILTER_SCHLUESSEL = 'mathe-trainer-uebung-filter-v1';
let uebungFilterFallback = null;

function speichereUebungFilter(zustand) {
  const text = JSON.stringify(zustand);
  try { window.localStorage.setItem(UEBUNG_FILTER_SCHLUESSEL, text); } catch (fehler) { uebungFilterFallback = text; }
}

function ladeUebungFilter() {
  try {
    const text = window.localStorage.getItem(UEBUNG_FILTER_SCHLUESSEL);
    if (text) return JSON.parse(text);
  } catch (fehler) { /* weiter zum In-Memory-Fallback */ }
  if (uebungFilterFallback) { try { return JSON.parse(uebungFilterFallback); } catch (fehler) { return null; } }
  return null;
}

function starteUebungsmodus(wurzel) {
  let filterZustand = ladeUebungFilter();
  if (!filterZustand || !Array.isArray(filterZustand.ausgeschlossen) ||
    (filterZustand.teil !== 'alle' && !TEIL_NAMEN[filterZustand.teil])) {
    filterZustand = { teil: 'alle', ausgeschlossen: [], offen: false };
  }
  if (typeof filterZustand.offen !== 'boolean') filterZustand.offen = false;

  const filterContainer = document.createElement('div');
  filterContainer.className = 'themen-filter';
  wurzel.appendChild(filterContainer);

  const karte = document.createElement('section');
  karte.className = 'aufgabe-karte';
  wurzel.appendChild(karte);

  let aktuelleAufgabe = null;

  // Der Pool, aus dem "Neue Aufgabe" zieht: erst nach Teil eingeschränkt
  // (oder "alle"), dann um einzeln abgewählte Aufgabentypen bereinigt.
  function aktiverPool() {
    const basis = filterZustand.teil === 'alle' ? GENERATOREN : (GENERATOREN_NACH_TEIL[filterZustand.teil] || []);
    return basis.filter((g) => !filterZustand.ausgeschlossen.includes(g.id));
  }

  // "X von Y Typen" für die Zusammenfassungs-Zeile: Y ist die Größe des
  // aktuell gewählten Teils (oder aller Generatoren bei "Alle"), X davon
  // abzüglich der einzeln abgewählten.
  function filterZusammenfassung() {
    const basis = filterZustand.teil === 'alle' ? GENERATOREN : (GENERATOREN_NACH_TEIL[filterZustand.teil] || []);
    const aktiv = basis.filter((g) => !filterZustand.ausgeschlossen.includes(g.id)).length;
    const teilName = filterZustand.teil === 'alle' ? 'Alle' : TEIL_NAMEN[filterZustand.teil];
    return `${teilName} · ${aktiv} von ${basis.length} Typen`;
  }

  function zeichneFilter() {
    filterContainer.innerHTML = '';

    // Eingeklappt (Standard) nimmt der Filter nur eine Zeile ein — eine
    // Zusammenfassung mit Pfeil, antippen klappt auf/zu (iPhone-Rückmeldung:
    // die ausgeklappte Liste nahm sonst dauerhaft Platz über jeder Aufgabe weg).
    const zusammenfassung = document.createElement('button');
    zusammenfassung.type = 'button';
    zusammenfassung.className = 'themen-filter-zusammenfassung';
    zusammenfassung.textContent = filterZusammenfassung() + (filterZustand.offen ? ' ▴' : ' ▾');
    zusammenfassung.addEventListener('click', () => {
      filterZustand = { ...filterZustand, offen: !filterZustand.offen };
      speichereUebungFilter(filterZustand);
      zeichneFilter();
    });
    filterContainer.appendChild(zusammenfassung);

    if (!filterZustand.offen) return;

    const teilReihe = document.createElement('div');
    teilReihe.className = 'themen-filter-teile';
    ['alle', ...Object.keys(TEIL_NAMEN)].forEach((teil) => {
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.textContent = teil === 'alle' ? 'Alle' : TEIL_NAMEN[teil];
      knopf.className = 'themen-filter-knopf' + (filterZustand.teil === teil ? ' aktiv' : '');
      knopf.addEventListener('click', () => {
        if (filterZustand.teil === teil) return;
        filterZustand = { ...filterZustand, teil };
        speichereUebungFilter(filterZustand);
        zeichneFilter();
        neueAufgabe();
      });
      teilReihe.appendChild(knopf);
    });
    filterContainer.appendChild(teilReihe);

    // Die einzelnen Aufgabentypen nur innerhalb eines gewählten Teils
    // anzeigen — bei "Alle" wären das auf einmal alle ~20 Generatoren,
    // unübersichtlich bei 375px und auch nicht nötig (iPhone-Rückmeldung
    // wollte eine Auswahl "pro Teil").
    if (filterZustand.teil !== 'alle') {
      const liste = document.createElement('div');
      liste.className = 'themen-filter-liste';
      (GENERATOREN_NACH_TEIL[filterZustand.teil] || []).forEach((g) => {
        const zeile = document.createElement('label');
        zeile.className = 'themen-filter-zeile';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !filterZustand.ausgeschlossen.includes(g.id);
        checkbox.addEventListener('change', () => {
          const ausgeschlossen = new Set(filterZustand.ausgeschlossen);
          if (checkbox.checked) ausgeschlossen.delete(g.id); else ausgeschlossen.add(g.id);
          filterZustand = { ...filterZustand, ausgeschlossen: [...ausgeschlossen] };
          speichereUebungFilter(filterZustand);
          zusammenfassung.textContent = filterZusammenfassung() + (filterZustand.offen ? ' ▴' : ' ▾');
        });
        zeile.appendChild(checkbox);
        const text = document.createElement('span');
        text.textContent = g.name;
        zeile.appendChild(text);
        if (g.zusatz) {
          const abzeichen = document.createElement('span');
          abzeichen.className = 'themen-filter-abzeichen';
          abzeichen.textContent = 'Zusatzthema';
          zeile.appendChild(abzeichen);
        }
        liste.appendChild(zeile);
      });
      filterContainer.appendChild(liste);
    }
  }

  function neueAufgabe() {
    const pool = aktiverPool();
    if (pool.length === 0) {
      aktuelleAufgabe = null;
      karte.innerHTML = '<p class="frage-text">Keine Aufgabentypen ausgewählt — bitte oben mindestens einen Typ aktivieren.</p>';
      return;
    }
    const rngAuswahl = mulberry32(erzeugeSeed());
    const generator = zufallAus(rngAuswahl, pool);
    const rngAufgabe = mulberry32(erzeugeSeed());
    const params = generator.waehleParameter(rngAufgabe);
    aktuelleAufgabe = generator.baue(params);
    zeichneAufgabe(generator);
  }

  function zeichneAufgabe(generator) {
    karte.innerHTML = '';

    const titel = document.createElement('h2');
    // aufgabe.titel (optional): Generatoren mit mehreren zufälligen Varianten
    // (z. B. Tilgungsplan: Raten- oder Annuitätentilgung) nennen hier nur die
    // tatsächlich gezogene Variante statt aller möglichen im statischen
    // generator.name (iPhone-Rückmeldung).
    titel.textContent = (aktuelleAufgabe.titel ?? generator.name) + ' (' + generator.punkte + ' P)';
    karte.appendChild(titel);

    baueFrageDarstellung(karte, aktuelleAufgabe);

    const { form, felder } = baueEingabenFelder(aktuelleAufgabe);
    karte.appendChild(form);

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
      const r = bewerteAlleEingaben(aktuelleAufgabe, felder);
      if (r.leer === r.gesamt) {
        ergebnisZeile.textContent = 'Bitte mindestens ein Feld ausfüllen.';
        ergebnisZeile.className = 'pruef-ergebnis neutral';
      } else if (r.richtig === r.gesamt) {
        ergebnisZeile.textContent = 'Richtig.';
        ergebnisZeile.className = 'pruef-ergebnis gut';
      } else {
        const leerZusatz = r.leer > 0 ? `, ${r.leer} Feld${r.leer === 1 ? '' : 'er'} leer` : '';
        ergebnisZeile.textContent = `${r.richtig} von ${r.gesamt} richtig${leerZusatz}.`;
        ergebnisZeile.className = 'pruef-ergebnis ' + (r.falsch > 0 ? 'schlecht' : 'neutral');
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

  zeichneFilter();
  neueAufgabe();

  return {
    // Nur für Tests (test/layout.mjs): erzeugt eine bestimmte Aufgabe
    // deterministisch und zeigt optional sofort die Lösung, damit ein
    // Layout-Test ohne Klicksimulation eine konkrete Instanz prüfen kann.
    // Ohne Effekt auf die normale Nutzung.
    testErzeugeAufgabe(generatorId, seed, mitLoesung) {
      const generator = findeGenerator(generatorId);
      if (!generator) throw new Error('Unbekannter Generator: ' + generatorId);
      const params = generator.waehleParameter(mulberry32(seed));
      aktuelleAufgabe = generator.baue(params);
      zeichneAufgabe(generator);
      if (mitLoesung) {
        renderLoesung(aktuelleAufgabe.loesung, karte.querySelector('.loesung-container'));
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Probeklausur
// ---------------------------------------------------------------------------

// localStorage mit In-Memory-Ersatz: wirft localStorage (Privatmodus, volle
// Kontingent, o. Ä.), bleibt der Fortschritt wenigstens für die laufende
// Sitzung erhalten, statt die ganze Probeklausur abstürzen zu lassen.
const PROBEKLAUSUR_SPEICHER_SCHLUESSEL = 'mathe-trainer-probeklausur-v1';
let probeklausurSpeicherFallback = null;

function speichereProbeklausurZustand(zustand) {
  const text = JSON.stringify(zustand);
  try {
    window.localStorage.setItem(PROBEKLAUSUR_SPEICHER_SCHLUESSEL, text);
  } catch (fehler) {
    probeklausurSpeicherFallback = text;
  }
}

function ladeProbeklausurZustand() {
  try {
    const text = window.localStorage.getItem(PROBEKLAUSUR_SPEICHER_SCHLUESSEL);
    if (text) return JSON.parse(text);
  } catch (fehler) {
    // weiter zum In-Memory-Fallback
  }
  if (probeklausurSpeicherFallback) {
    try { return JSON.parse(probeklausurSpeicherFallback); } catch (fehler) { return null; }
  }
  return null;
}

function loescheProbeklausurZustand() {
  try { window.localStorage.removeItem(PROBEKLAUSUR_SPEICHER_SCHLUESSEL); } catch (fehler) { /* ignorieren */ }
  probeklausurSpeicherFallback = null;
}

function formatiereZeit(sekunden) {
  const s = Math.max(0, Math.round(sekunden));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return String(m).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
}

// Je gewähltem Generator eine konkrete Instanz (Parameter per Zufall, danach
// rein deterministisch über generator.baue()) und zu einer flachen, in der
// Klausur angezeigten Reihenfolge zusammenfassen (Teil für Teil, wie im
// Aufgabenkatalog).
function baueAufgabenliste(teile) {
  const rngAufgaben = mulberry32(erzeugeSeed());
  const aufgaben = [];
  for (const teil of teile) {
    for (const generator of teil.generatoren) {
      const params = generator.waehleParameter(rngAufgaben);
      aufgaben.push({ teil: teil.teil, generatorId: generator.id, params });
    }
  }
  return aufgaben;
}

// Zusatzthemen-Generatoren (g.zusatz === true) stehen in der Probeklausur
// standardmäßig nicht zur Verfügung — die Klausur folgt dem Aufbau der
// Musterklausur, Zusatzthemen sind nur im Übungsmodus (dort ohnehin alle
// GENERATOREN gleich wahrscheinlich, siehe starteUebungsmodus) gedacht.
// KONFIG.zusatzthemenInKlausur schaltet sie bei Bedarf dazu.
function generatorenFuerProbeklausur() {
  if (KONFIG.zusatzthemenInKlausur) return GENERATOREN_NACH_TEIL;
  const gefiltert = {};
  for (const [teil, generatoren] of Object.entries(GENERATOREN_NACH_TEIL)) {
    gefiltert[teil] = generatoren.filter((g) => !g.zusatz);
  }
  return gefiltert;
}

function erzeugeNeueProbeklausur(punkteSplit) {
  const rngKomposer = mulberry32(erzeugeSeed());
  const teile = komponiereKlausur(punkteSplit, generatorenFuerProbeklausur(), rngKomposer);
  const aufgaben = baueAufgabenliste(teile);
  const zustand = {
    version: 1,
    startZeit: Date.now(),
    dauerSekunden: KONFIG.dauer,
    teile: teile.map((t) => ({ teil: t.teil, ziel: t.ziel, summe: t.summe, exakt: t.exakt })),
    aufgaben,
    antworten: {},
    selbstbewertung: {},
    abgegeben: false,
  };
  speichereProbeklausurZustand(zustand);
  return zustand;
}

function starteProbeklausur(wurzel) {
  const zustand = ladeProbeklausurZustand();
  if (zustand && zustand.version === 1) {
    if (zustand.abgegeben) zeichneAuswertung(wurzel, zustand);
    else zeichneLaufendeKlausur(wurzel, zustand);
  } else {
    zeichneProbeklausurStart(wurzel);
  }
}

function zeichneProbeklausurStart(wurzel) {
  wurzel.innerHTML = '';

  const karte = document.createElement('section');
  karte.className = 'aufgabe-karte';
  const titel = document.createElement('h2');
  titel.textContent = 'Probeklausur';
  karte.appendChild(titel);
  const beschreibung = document.createElement('p');
  beschreibung.className = 'frage-text';
  beschreibung.textContent = `${Math.round(KONFIG.dauer / 60)} Minuten, Aufgaben nach Punkte-Split. ` +
    'Der Fortschritt bleibt auch erhalten, wenn die App zwischendurch geschlossen wird.';
  karte.appendChild(beschreibung);
  wurzel.appendChild(karte);

  const knopfReihe = document.createElement('div');
  knopfReihe.className = 'knopf-reihe';
  for (const [name, split] of Object.entries(KONFIG.presets)) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    const beschriftung = name.charAt(0).toUpperCase() + name.slice(1);
    knopf.textContent = `${beschriftung} (${split.finanz}/${split.diff}/${split.integral}/${split.algebra})`;
    knopf.addEventListener('click', () => {
      const neu = erzeugeNeueProbeklausur(split);
      zeichneLaufendeKlausur(wurzel, neu);
    });
    knopfReihe.appendChild(knopf);
  }
  wurzel.appendChild(knopfReihe);
}

function zeichneLaufendeKlausur(wurzel, zustand) {
  wurzel.innerHTML = '';

  const kopfzeile = document.createElement('div');
  kopfzeile.className = 'klausur-kopf';
  const timerAnzeige = document.createElement('span');
  timerAnzeige.className = 'klausur-timer';
  kopfzeile.appendChild(timerAnzeige);
  const abgebenKnopf = document.createElement('button');
  abgebenKnopf.type = 'button';
  abgebenKnopf.textContent = 'Abgeben';
  kopfzeile.appendChild(abgebenKnopf);
  wurzel.appendChild(kopfzeile);

  const nichtExakt = zustand.teile.filter((t) => !t.exakt && t.ziel > 0);
  if (nichtExakt.length > 0) {
    const hinweis = document.createElement('p');
    hinweis.className = 'loesung-hinweis';
    hinweis.textContent = 'Punkte-Ziel nicht exakt getroffen: ' +
      nichtExakt.map((t) => `${t.teil} (${t.summe} statt ${t.ziel})`).join(', ') + '.';
    wurzel.appendChild(hinweis);
  }

  zustand.aufgaben.forEach((eintrag, idx) => {
    const generator = findeGenerator(eintrag.generatorId);
    const aufgabe = generator.baue(eintrag.params);

    const karte = document.createElement('section');
    karte.className = 'aufgabe-karte';
    const titel = document.createElement('h2');
    titel.textContent = `Aufgabe ${idx + 1}: ${aufgabe.titel ?? generator.name} (${generator.punkte} P)`;
    karte.appendChild(titel);

    baueFrageDarstellung(karte, aufgabe);

    const { form, felder } = baueEingabenFelder(aufgabe, {
      onAenderung(werte) {
        zustand.antworten[idx] = werte;
        speichereProbeklausurZustand(zustand);
      },
    });
    setzeAntworten(aufgabe, felder, zustand.antworten[idx]);
    karte.appendChild(form);

    wurzel.appendChild(karte);
  });

  let timerId = null;
  let abgegeben = false;

  function gebeAb() {
    if (abgegeben) return;
    abgegeben = true;
    clearInterval(timerId);
    zustand.abgegeben = true;
    zustand.abgabeZeit = Date.now();
    speichereProbeklausurZustand(zustand);
    zeichneAuswertung(wurzel, zustand);
  }

  function aktualisiereTimer() {
    const verbleibend = zustand.dauerSekunden - (Date.now() - zustand.startZeit) / 1000;
    timerAnzeige.textContent = formatiereZeit(verbleibend);
    if (verbleibend <= 0) gebeAb();
  }
  aktualisiereTimer();
  timerId = setInterval(aktualisiereTimer, 1000);

  abgebenKnopf.addEventListener('click', () => {
    const verbleibend = zustand.dauerSekunden - (Date.now() - zustand.startZeit) / 1000;
    if (verbleibend > 60 && !window.confirm(`Noch ${formatiereZeit(verbleibend)} übrig — jetzt abgeben?`)) return;
    gebeAb();
  });
}

function zeichneAuswertung(wurzel, zustand) {
  wurzel.innerHTML = '';

  const kopf = document.createElement('section');
  kopf.className = 'aufgabe-karte';
  const titel = document.createElement('h2');
  titel.textContent = 'Auswertung';
  kopf.appendChild(titel);
  const gesamtZeile = document.createElement('p');
  gesamtZeile.className = 'klausur-gesamt';
  kopf.appendChild(gesamtZeile);
  const neueKlausurKnopf = document.createElement('button');
  neueKlausurKnopf.type = 'button';
  neueKlausurKnopf.textContent = 'Neue Probeklausur starten';
  neueKlausurKnopf.addEventListener('click', () => {
    loescheProbeklausurZustand();
    zeichneProbeklausurStart(wurzel);
  });
  kopf.appendChild(neueKlausurKnopf);
  wurzel.appendChild(kopf);

  let gesamtMaxPunkte = 0;
  let gesamtErreichtePunkte = 0;

  function aktualisiereGesamt() {
    gesamtZeile.textContent = `${formatDeZahlFrei(gesamtErreichtePunkte)} von ${formatDeZahlFrei(gesamtMaxPunkte)} Punkten.`;
  }

  zustand.aufgaben.forEach((eintrag, idx) => {
    const generator = findeGenerator(eintrag.generatorId);
    const aufgabe = generator.baue(eintrag.params);
    gesamtMaxPunkte += generator.punkte;

    const karte = document.createElement('section');
    karte.className = 'aufgabe-karte';
    const kartenTitel = document.createElement('h2');
    kartenTitel.textContent = `Aufgabe ${idx + 1}: ${aufgabe.titel ?? generator.name} (${generator.punkte} P)`;
    karte.appendChild(kartenTitel);

    baueFrageDarstellung(karte, aufgabe);

    const { form, felder } = baueEingabenFelder(aufgabe);
    setzeAntworten(aufgabe, felder, zustand.antworten[idx]);
    karte.appendChild(form);

    const bewertung = bewerteAlleEingaben(aufgabe, felder);
    // Nach der Abgabe ist die Aufgabe fertig bewertet — Felder nicht mehr
    // bearbeitbar, sonst würde ein nachträglicher Tipp die Anzeige verfälschen
    // (die Punkte werden nicht bei jeder weiteren Eingabe neu berechnet).
    form.querySelectorAll('input, select').forEach((el) => { el.disabled = true; });

    const aufgabenPunkteZeile = document.createElement('p');
    aufgabenPunkteZeile.className = 'pruef-ergebnis';
    karte.appendChild(aufgabenPunkteZeile);

    let termPunkte = 0;
    function aktualisiereAufgabenPunkte() {
      aufgabenPunkteZeile.textContent = `${formatDeZahlFrei(bewertung.erreichtePunkte + termPunkte)} von ${generator.punkte} Punkten.`;
    }

    // Selbstbewertung für Symbolterme (z. B. Ableitungen): automatisch nicht
    // prüfbar, darum Richtig/Teilweise/Falsch nach Ansicht der Lösung.
    const termEingaben = aufgabe.eingaben.filter((e) => e.typ === 'term');
    if (termEingaben.length > 0) {
      const selbstbewertungContainer = document.createElement('div');
      selbstbewertungContainer.className = 'selbstbewertung';
      for (const eingabe of termEingaben) {
        const gespeicherteStufe = zustand.selbstbewertung[idx]?.[eingabe.id] ?? null;
        let aktuelleStufe = gespeicherteStufe;
        if (aktuelleStufe) {
          const beitrag = punkteFuerSelbstbewertung(aktuelleStufe, eingabe.punkte);
          termPunkte += beitrag;
          gesamtErreichtePunkte += beitrag;
        }

        const zeile = document.createElement('div');
        zeile.className = 'selbstbewertung-zeile';
        const label = document.createElement('span');
        label.textContent = `${eingabe.label} (${eingabe.punkte} P):`;
        zeile.appendChild(label);

        // Eigene Zeile für die drei Knöpfe statt in einem Flex-Fluss mit dem
        // Label — bei langen Labels liefen die Knöpfe sonst mitten in der
        // Zeile um und landeten uneinheitlich hinter dem Text (iPhone-
        // Rückmeldung).
        const knopfReiheSelbst = document.createElement('div');
        knopfReiheSelbst.className = 'selbstbewertung-knoepfe';
        zeile.appendChild(knopfReiheSelbst);

        const knoepfe = [];
        for (const [stufe, text] of [['richtig', 'Richtig'], ['halb', 'Teilweise'], ['falsch', 'Falsch']]) {
          const knopf = document.createElement('button');
          knopf.type = 'button';
          knopf.textContent = text;
          knopf.className = 'selbstbewertung-knopf' + (aktuelleStufe === stufe ? ' aktiv' : '');
          knopf.addEventListener('click', () => {
            const alterBeitrag = aktuelleStufe ? punkteFuerSelbstbewertung(aktuelleStufe, eingabe.punkte) : 0;
            aktuelleStufe = stufe;
            const neuerBeitrag = punkteFuerSelbstbewertung(aktuelleStufe, eingabe.punkte);
            termPunkte += neuerBeitrag - alterBeitrag;
            gesamtErreichtePunkte += neuerBeitrag - alterBeitrag;
            knoepfe.forEach((k) => k.classList.remove('aktiv'));
            knopf.classList.add('aktiv');
            zustand.selbstbewertung[idx] = zustand.selbstbewertung[idx] || {};
            zustand.selbstbewertung[idx][eingabe.id] = aktuelleStufe;
            speichereProbeklausurZustand(zustand);
            aktualisiereAufgabenPunkte();
            aktualisiereGesamt();
          });
          knoepfe.push(knopf);
          knopfReiheSelbst.appendChild(knopf);
        }
        selbstbewertungContainer.appendChild(zeile);
      }
      karte.appendChild(selbstbewertungContainer);
    }

    aktualisiereAufgabenPunkte();
    gesamtErreichtePunkte += bewertung.erreichtePunkte;

    const loesungContainer = document.createElement('div');
    loesungContainer.className = 'loesung-container';
    karte.appendChild(loesungContainer);
    renderLoesung(aufgabe.loesung, loesungContainer);

    wurzel.appendChild(karte);
  });

  aktualisiereGesamt();
}

// ---------------------------------------------------------------------------
// Einstieg: Umschalten zwischen Übungsmodus und Probeklausur
// ---------------------------------------------------------------------------

function starteApp() {
  const wurzel = document.getElementById('app');
  wurzel.innerHTML = '';

  const kopf = document.createElement('header');
  kopf.className = 'kopf';
  kopf.innerHTML = '<h1>Mathe-Trainer Wirtschaftsmathematik</h1>';
  wurzel.appendChild(kopf);

  const modusLeiste = document.createElement('div');
  modusLeiste.className = 'modus-leiste';
  const uebungKnopf = document.createElement('button');
  uebungKnopf.type = 'button';
  uebungKnopf.textContent = 'Übung';
  const klausurKnopf = document.createElement('button');
  klausurKnopf.type = 'button';
  klausurKnopf.textContent = 'Probeklausur';
  modusLeiste.appendChild(uebungKnopf);
  modusLeiste.appendChild(klausurKnopf);
  wurzel.appendChild(modusLeiste);

  const inhalt = document.createElement('div');
  wurzel.appendChild(inhalt);

  let praxisApi = null;

  function setzeAktivenKnopf(aktiv) {
    uebungKnopf.classList.toggle('modus-aktiv', aktiv === uebungKnopf);
    klausurKnopf.classList.toggle('modus-aktiv', aktiv === klausurKnopf);
  }

  function zeigeUebung() {
    setzeAktivenKnopf(uebungKnopf);
    inhalt.innerHTML = '';
    praxisApi = starteUebungsmodus(inhalt);
  }

  function zeigeProbeklausur() {
    setzeAktivenKnopf(klausurKnopf);
    inhalt.innerHTML = '';
    starteProbeklausur(inhalt);
  }

  uebungKnopf.addEventListener('click', zeigeUebung);
  klausurKnopf.addEventListener('click', zeigeProbeklausur);

  // Nur für Tests (test/layout.mjs): erzwingt den Übungsmodus (unabhängig
  // vom aktuell gespeicherten Probeklausur-Zustand) und erzeugt dort eine
  // bestimmte Aufgabe deterministisch. Ohne Effekt auf die normale Nutzung.
  window.__testErzeugeAufgabe = function (generatorId, seed, mitLoesung) {
    zeigeUebung();
    praxisApi.testErzeugeAufgabe(generatorId, seed, mitLoesung);
  };
  // Nur für Tests: Zugriff auf findeGenerator/mulberry32, da sie sonst im
  // IIFE-Scope des gebauten Bundles verborgen bleiben.
  window.__testFindeGenerator = findeGenerator;
  window.__testMulberry32 = mulberry32;

  // Eine vorhandene Probeklausur hat Vorrang vor dem Übungsmodus — egal ob
  // noch laufend oder schon abgegeben (dann wird gleich die zuletzt gezeigte
  // Auswertung wieder angezeigt) — genau das "Fortschritt überlebt das
  // Schließen der App" aus Phase 5.
  const gespeichert = ladeProbeklausurZustand();
  if (gespeichert && gespeichert.version === 1) zeigeProbeklausur();
  else zeigeUebung();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starteApp);
  } else {
    starteApp();
  }
}
