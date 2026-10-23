# Mathe-Trainer — Regeln für dieses Projekt

Trainer für die Klausur Wirtschaftsmathematik (W4BW_106, 60 Minuten, 60 Punkte).
Vollständiger Aufgabenkatalog, Architektur und Baureihenfolge: **`PLAN.md`**. Dieses
Dokument enthält nur die Regeln, die in jeder Session gelten müssen.

## 1 Der Vault ist nur lesbar

Quellen liegen in
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Studium/01 Vorlesungen/Semester 1/Mathematik/`:

- `Material/Musterklausur Mathematik.pdf`, `Material/Musterlösung Musterklausur Mathematik.pdf`
- `Material/Musterlösungen_Übungsaufgaben Mathe WS22.pdf`
- `Material/Mathematik_ 2023_WHD22B1.pdf` (Skript, 212 Folien)
- `Material/Formelsammlung_Mathe.pdf`
- `Mathematik Musterklausur.md` (eigene Übersicht, deckt sich wörtlich mit der Musterlösung)

**Dort wird nichts angelegt, geändert oder gelöscht. Nie.** Nur lesen.

PDF-Text: auf diesem Mac gibt es kein poppler/`pdftotext`. Stattdessen
`osascript -l JavaScript tools/pdftext.js "<pfad.pdf>" [vonSeite] [bisSeite]` (PDFKit).

## 2 Das Repo ist öffentlich — nichts vom Dozenten hinein

Eine lokale HTML-Datei über iCloud Drive funktioniert auf iOS nicht (Quick-Look-Vorschau
ohne JavaScript, geprüft 2026-10-18). Ausgeliefert wird deshalb über ein **öffentliches**
GitHub-Pages-Repo als PWA. Daraus folgt eine harte Regel:

- **Niemals** PDFs aus dem Vault committen.
- **Niemals** Aufgabentexte wörtlich aus der Musterklausur oder den WS22-Übungen
  übernehmen. Generatoren dürfen den **Stil** nachbilden (Formulierungsregister, Aufbau),
  aber keine Sätze des Dozenten kopieren.
- Fixtures (`test/fixtures.mjs`) enthalten **ausschließlich Zahlen**: Parameter →
  erwartetes Ergebnis. Kein Aufgabentext aus den PDFs.
- `.gitignore` schließt `*.pdf` und bekannte Vault-Pfade aus. Vor jedem `git push` kurz
  `git status` prüfen — nichts Unerwartetes im Diff.

## 3 Werkzeuge

- Node ist Voraussetzung für Build und Tests (vorhanden: v24.22.0 / npm 11.19.1). Fehlt
  `node` in einer neuen Umgebung, **stoppen** und zur Installation über den offiziellen
  Installer von nodejs.org auffordern.
- Kein `sudo` durch Claude. Kein Homebrew und keine sonstige Software-Installation ohne
  Rückfrage (`gh` CLI ist aktuell nicht installiert — Repo-Verwaltung läuft über `git` plus
  die GitHub-Weboberfläche, nicht über `gh`, solange nicht anders vereinbart).
- Keine Laufzeit-Abhängigkeiten im Browser außer dem eingebetteten KaTeX. Kein CDN, kein
  Netzzugriff zur Laufzeit, kein Account zur Nutzung der Seite, keine KI.

## 4 Arbeitsweise

- **Nach jeder Phase stoppen**, genau sagen was zu testen ist, und auf ein OK warten, bevor
  die nächste Phase beginnt. Phasen stehen in `PLAN.md`.
- Eine Phase gilt erst als fertig, wenn `node test/alle.mjs` grün ist.
- Deliverable ist eine **PWA auf GitHub Pages** (`docs/index.html` + `manifest.json` +
  `sw.js`, erzeugt von `build.mjs`): installierbar auf dem iPhone über „Zum
  Home-Bildschirm", nach dem ersten Besuch offline tauglich.

## 5 Befehle

```sh
node build.mjs          # erzeugt docs/index.html, docs/manifest.json, docs/sw.js, docs/icons/
node test/alle.mjs      # 1.000 Instanzen je Generator + Fixtures gegen die Musterlösung
grep -c 'https\?://' docs/index.html   # muss 0 ergeben (außer Kommentaren)
```

## 6 Generator-Schnittstelle

Jeder Aufgabentyp ist ein Generator. Zufall und Mathematik sind getrennt, damit Tests die
Original-Klausurzahlen einspeisen können:

```js
{
  id: 'fin.rente-aus-kapital',
  teil: 'finanz' | 'diff' | 'integral' | 'algebra',
  name: 'Rente aus einem Anfangskapital',
  punkte: 3,
  vorlage: 'Musterklausur 1 I / Übung 5c',
  waehleParameter(rng) -> params,   // nur Zufall, keine Mathematik
  baue(params) -> aufgabe,          // deterministisch, direkt testbar
}
```

`baue(params)` liefert `{ frage, eingaben[], loesung: { schritte[], ergebnisse[] }, params }`.
Antworttypen: `zahl`, `prozent`, `koeffizienten`, `matrix`, `auswahl`, `term`.

**Rückwärts konstruieren:** zuerst die saubere Lösung wählen, dann die Parameter daraus
ableiten — nie zufällige Parameter mit Hoffnung auf ein glattes Ergebnis. Die konkreten
Bedingungen je Generator stehen in der Katalogtabelle in `PLAN.md`.

**Lösungsanzeige:** immer Deutsch, in der Notation der Folien und der Musterlösung
(`q = 1+i`, `R₀ = r·(qⁿ−1)/(i·qⁿ)`, `i_eff`, `Det(H)`, `KR`/`PR`), in der Abfolge
Formel → Umstellen → Einsetzen → Ergebnis. Fragetexte selbst formulieren (Stil nachbilden,
siehe Abschnitt 2 — nicht aus den PDFs kopieren).

**Rundung und Toleranz** stehen zentral in `src/konfig.js`, nicht in den Generatoren:
Geld 2 Dezimalen ±0,05; Jahre ±0,01; Mengen, Koeffizienten und Matrixeinträge exakt.
Zinssätze/Prozentsätze als Ergebnis folgen einer eigenen Regel, siehe nächster Absatz.
Toleranz beim Prüfen eines Zinssatz-Ergebnisses: ±0,01 Prozentpunkte (`KONFIG.toleranz.
prozentpunkte`) — deckt die Rundung auf 4 Nachkommastellen komfortabel ab.

**Rundungsregel für Zinssätze (Vorlesung, bestätigt aus den Vorlesungsnotizen):**
„Ergebnisse bei Klausur auf 2 Nachkommastellen, außer bei Prozentsätzen 4 Nachkomma-
stellen." Die Musterlösung wendet das als Dezimalzahl auf 4 Nachkommastellen an,
gleichwertig mit 2 Nachkommastellen in Prozent, weil Prozent = Dezimalzahl × 100 den
Dezimalpunkt um genau 2 Stellen verschiebt — z. B. Übung 1d: `0,0080 = 0,80 %`;
Musterklausur 2b: `0,0304 = 3,04 %`. Gilt nur für **Ergebnisse** (das, was als Antwort
hingeschrieben wird), nicht für gegebene Werte in einer Aufgabenstellung — die bleiben
in ihrer natürlichen, oft kürzeren Schreibweise (z. B. „Effektivzins von 8,16 %" als
gegebene Größe in einer Umkehraufgabe).

Anzeige in der Lösung: `i_{eff} = 0{,}0304 = 3{,}04\%` als LaTeX-Zeile des Ergebnis-
Schritts, dazu als `hinweis` (reiner Text, kein LaTeX) „Rundung laut Vorlesung:
Zinssätze als Dezimalzahl auf 4 Nachkommastellen." — plus „Ungerundet: 0,030416."
**nur wenn** der ungerundete Wert tatsächlich abweicht (sonst entfällt dieser Zusatz,
z. B. wenn der Zinssatz schon exakt vorgegeben war). Muster dafür in
`src/generatoren/finanz.js`: `zinssatzRunden`, `zinssatzErgebnisLatex`,
`zinssatzRundungsHinweis` — neue Generatoren mit einem Zinssatz-Ergebnis rufen diese
drei Funktionen auf, statt die Rundung neu zu erfinden. Die Anzahl Nachkommastellen
(aktuell 4) steht zentral in `KONFIG.nachkommastellen.zinssatzDezimal`.

Alle anderen Ergebnisse (Geldbeträge, Jahre, Mengen, Koeffizienten) bleiben bei den
oben genannten 2 Dezimalen — das ist eine Rundungs-**Genauigkeit** (der Wert wird vor
der Anzeige auf `runde(x, 2)` gebracht), keine erzwungene Anzeige-Nachkommastellenzahl.
Angezeigt wird danach mit `zahlZuLatex(x, minimaleNachkommastellen(x))`, nicht mit
`zahlZuLatex(x, 2)`: ein glattes Ergebnis wie 670 oder 8 Jahre erscheint so ohne
überflüssiges ",00" (iPhone-Rückmeldung 2026-10-23 — K(10) zeigte "670,00" während
andere Ergebnisse ganzzahlig erschienen; `, 2)` fest zu verdrahten verlor dabei keine
Genauigkeit, da der Wert ja schon gerundet war, sah aber inkonsistent aus). Einzige
Ausnahme bleibt die Zinssatz-Regel oben: dort wird fest auf 4 Stellen angezeigt, auch
wenn weniger reichen würden, weil die Vorlesung genau das vorschreibt.

## 7 Testpflichten

Für jeden neuen Generator gehören in `test/`:

1. **1.000 Instanzen** mit durchnummerierten Seeds, jede Lösung **unabhängig** nachgerechnet
   — auf einem anderen Rechenweg als der Generator sie gebaut hat (numerische Ableitung,
   Simpson-Quadratur, separat geschriebene Matrixmultiplikation, Rückeinsetzen in die
   Ausgangsgleichung). Fehlschläge geben Generator-ID, Seed und Parameter aus.
2. **Fixture:** `baue(params)` mit den Originalzahlen der Musterklausur bzw. der
   WS22-Übungen muss deren Ergebnis exakt reproduzieren (Liste in `PLAN.md`). Nur Zahlen,
   kein Aufgabentext (siehe Abschnitt 2).
3. **Querschnitt:** Zahlen erfüllen die Sauberkeitsregeln, Teilpunkte summieren auf
   `punkte`, KaTeX rendert jeden Schritt fehlerfrei, gleicher Seed ergibt gleiche Aufgabe.

## 8 Punkte-Split

Der Split ist eine Einstellung, keine Verdrahtung: `KONFIG.punkte` in `src/konfig.js`.
Standard Finanz 12 / Diff 24 / Integral 12 / Algebra 12; Preset „Original" 12/36/0/12 wie
die Musterklausur. Der Komposer stellt je Teil eine Generator-Kombination zusammen, die die
Zielpunktzahl exakt trifft.
