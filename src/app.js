// Übungsmodus-UI. Wählt einen Generator, zeigt die Frage, prüft Zahlantworten
// automatisch und rendert die Lösung in der Formel-Notation der Folien.
// Phase 0: nur der Platzhalter-Generator ist registriert; die Probeklausur
// (Timer, Punkte-Split) kommt erst in Phase 5.

function starteApp() {
  const wurzel = document.getElementById('app');
  wurzel.innerHTML = '';

  const kopf = document.createElement('header');
  kopf.className = 'kopf';
  kopf.innerHTML = '<h1>Mathe-Trainer Wirtschaftsmathematik</h1>' +
    '<p class="unter">Übungsmodus — Phase 0: Infrastrukturtest mit einem Platzhalter-Generator.</p>';
  wurzel.appendChild(kopf);

  const karte = document.createElement('section');
  karte.className = 'aufgabe-karte';
  wurzel.appendChild(karte);

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

    const titel = document.createElement('h2');
    titel.textContent = generator.name + ' (' + generator.punkte + ' P)';
    karte.appendChild(titel);

    const frage = document.createElement('p');
    frage.className = 'frage-text';
    frage.textContent = aktuelleAufgabe.frage.text;
    karte.appendChild(frage);

    const form = document.createElement('div');
    form.className = 'eingaben';
    const felder = {};
    for (const eingabe of aktuelleAufgabe.eingaben) {
      const zeile = document.createElement('label');
      zeile.className = 'eingabe-zeile';
      const beschriftung = document.createElement('span');
      beschriftung.textContent = eingabe.label + ': ';
      zeile.appendChild(beschriftung);
      const feld = document.createElement('input');
      feld.type = 'text';
      feld.inputMode = 'decimal';
      feld.autocomplete = 'off';
      feld.autocorrect = 'off';
      feld.spellcheck = false;
      zeile.appendChild(feld);

      const eingelesenAls = document.createElement('span');
      eingelesenAls.className = 'eingelesen-als';
      zeile.appendChild(eingelesenAls);

      feld.addEventListener('input', function () {
        feld.classList.remove('gut', 'schlecht');
        const text = feld.value.trim();
        if (text === '') {
          eingelesenAls.textContent = '';
          return;
        }
        const wert = parseDeZahl(text);
        eingelesenAls.textContent = isFinite(wert)
          ? 'Eingelesen als ' + formatDeZahlFrei(wert)
          : 'Eingelesen als: keine Zahl erkannt';
      });

      form.appendChild(zeile);
      felder[eingabe.id] = feld;
    }
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
      let gibtLeereFelder = false;
      let alleRichtig = true;
      for (const eingabe of aktuelleAufgabe.eingaben) {
        const feld = felder[eingabe.id];
        feld.classList.remove('gut', 'schlecht');
        if (feld.value.trim() === '') {
          // Ein leeres Feld ist "noch nicht beantwortet", nicht "falsch" —
          // deshalb keine rote Markierung und keine neutrale Fehlermeldung.
          gibtLeereFelder = true;
          alleRichtig = false;
          continue;
        }
        const ergebnis = pruefeZahl(feld.value, eingabe.loesung, eingabe.toleranz);
        feld.classList.add(ergebnis.korrekt ? 'gut' : 'schlecht');
        if (!ergebnis.korrekt) alleRichtig = false;
      }
      if (gibtLeereFelder) {
        ergebnisZeile.textContent = 'Bitte eine Zahl eingeben.';
        ergebnisZeile.className = 'pruef-ergebnis neutral';
      } else if (alleRichtig) {
        ergebnisZeile.textContent = 'Richtig.';
        ergebnisZeile.className = 'pruef-ergebnis gut';
      } else {
        ergebnisZeile.textContent = 'Noch nicht richtig — Lösung ansehen?';
        ergebnisZeile.className = 'pruef-ergebnis schlecht';
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

  neueAufgabe();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starteApp);
  } else {
    starteApp();
  }
}
