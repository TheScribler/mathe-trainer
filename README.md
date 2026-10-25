# Mathe-Trainer

Übungstrainer für Wirtschaftsmathematik: Finanzmathematik, Differentialrechnung,
Integralrechnung und lineare Algebra. Jede Aufgabe wird bei jedem Aufruf neu generiert
(zufällige, aber saubere Zahlen) statt aus einem festen Pool gezogen — es gibt also keine
begrenzte Anzahl an Aufgaben.

Dies ist ein privates Lernprojekt. Es ist **nicht** offizielles Kursmaterial und steht in
keiner Verbindung zu einer bestimmten Hochschule, Vorlesung oder Lehrperson. Aufgabentypen
orientieren sich im Stil an klassischen Wirtschaftsmathematik-Klausuren, enthalten aber
keine wörtlich übernommenen Aufgabentexte.

## Nutzung

Die Seite ist eine installierbare PWA (Progressive Web App): auf dem iPhone über
„Zum Home-Bildschirm" hinzufügen, danach auch ohne Internetverbindung nutzbar.

**Übung** — eine einzelne Aufgabe üben:
- Oben ein Themenfilter (eingeklappt als eine Zeile mit Zusammenfassung, z. B. „Alle
  Themen"): ein Teilgebiet auswählen (Finanzmathematik, Differentialrechnung,
  Integralrechnung, lineare Algebra) oder einzelne Aufgabentypen abwählen. Die Auswahl
  bleibt beim nächsten Besuch erhalten.
- Eingabefelder ausfüllen, „Prüfen" zeigt eine Rückmeldung je Feld.
- „Lösung zeigen" zeigt den vollständigen Rechenweg (Formel → Umstellen → Einsetzen →
  Ergebnis) in der Notation der Vorlesung.
- „Neue Aufgabe" zieht eine neue Instanz desselben oder (je nach Filter) eines anderen
  Aufgabentyps.

**Probeklausur** — eine vollständige Klausur unter Zeitdruck:
- Zwei Voreinstellungen zur Auswahl (Punkte-Split Finanz/Differential/Integral/Algebra):
  „Standard" (12/24/12/12) und „Original" (12/36/0/12, wie die zugrunde liegende
  Musterklausur). Jede Voreinstellung stellt automatisch eine Aufgabenkombination
  zusammen, die die Zielpunktzahl trifft.
- Timer läuft automatisch mit; der Fortschritt bleibt auch erhalten, wenn die App
  zwischendurch geschlossen wird.
- Nach „Abgeben" folgt eine Auswertung mit Punkten je Aufgabe und — bei frei formulierten
  Termen, die nicht automatisch geprüft werden können — einer Selbstbewertung gegen die
  angezeigte Lösung.

## Punkte-Split ändern

Der Standard-Punkte-Split und die Probeklausur-Voreinstellungen stehen zentral in
`src/konfig.js`:

```js
export const KONFIG = {
  punkte: { finanz: 12, diff: 24, integral: 12, algebra: 12 },
  presets: {
    standard: { finanz: 12, diff: 24, integral: 12, algebra: 12 },
    original: { finanz: 12, diff: 36, integral: 0, algebra: 12 },
  },
  ...
};
```

Jeder Wert ist eine Zielpunktzahl für das jeweilige Teilgebiet; die Summe ergibt die
Gesamtpunktzahl der Probeklausur. Eine neue Voreinstellung lässt sich einfach als
weiterer Eintrag unter `presets` hinzufügen — sie erscheint dann automatisch als Knopf auf
dem Probeklausur-Startbildschirm. Rundungs- und Toleranzregeln (z. B. wie viele
Nachkommastellen ein Geldbetrag braucht, welche Abweichung bei der Prüfung noch als
richtig gilt) stehen ebenfalls in `src/konfig.js`, nicht in den einzelnen Generatoren.

## Build und Tests

Node ist Voraussetzung (keine weiteren Abhängigkeiten zur Laufzeit).

```sh
node build.mjs          # erzeugt docs/index.html, docs/manifest.json, docs/sw.js, docs/icons/
node test/alle.mjs      # 1.000 Instanzen je Aufgabentyp, unabhängig nachgerechnet, plus Fixtures
node test/layout.mjs    # Layout-Test bei 375px Breite in echtem Safari (macOS, safaridriver)
```

`docs/` ist das, was von GitHub Pages ausgeliefert wird — nach jeder Änderung an `src/`
muss `node build.mjs` erneut laufen, bevor die Änderung live ist.

## Projektstruktur

```
src/
  generatoren/   ein Modul je Themenbereich (finanz, diff, integral, algebra),
                 jeder Aufgabentyp ist ein Generator mit waehleParameter()/baue()
  konfig.js      Punkte-Split, Presets, Rundung/Toleranz
  app.js         UI (Übungsmodus, Probeklausur, Filter)
  latex.js       Bausteine für die LaTeX-Anzeige der Lösungswege
  pruefung.js    Antwortprüfung (Zahl, Koeffizientenzeile, Matrix, Auswahl)
test/
  alle.mjs       Haupttestlauf (Instanzen + Fixtures + Grenzfälle)
  layout.mjs     Browser-basierter 375px-Layout-Test
  fixtures.mjs   Originalzahlen zur Gegenprüfung einzelner Aufgabentypen
```
