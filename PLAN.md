# Mathe-Trainer Wirtschaftsmathematik — Aufgabenkatalog und Bauplan

## Kontext

Klausur Wirtschaftsmathematik (W4BW_106): 60 Minuten, 60 Punkte, 8 Aufgaben.
Ziel ist ein Trainer, der Klausuraufgaben **generiert** statt sie aus einem Pool zu ziehen:
jeder Aufgabentyp ist ein Generator, der bei jedem Aufruf neue Zahlen im Stil der
Musterklausur erzeugt und die vollständige Lösung auf Deutsch in der Notation der Folien
anzeigt (Formel → Umstellen → Einsetzen → Ergebnis).

Ausgeliefert wird eine **PWA auf GitHub Pages**: installierbar auf dem iPhone über „Zum
Home-Bildschirm", nach dem ersten Besuch offline tauglich. Kein Server außer der
GitHub-Pages-Auslieferung, kein Account zur Nutzung der Seite selbst, keine KI zur
Laufzeit. (Ursprünglich war eine einzelne lokale HTML-Datei über iCloud Drive geplant —
siehe Arbeitsregel 4, warum das verworfen wurde.)

## Arbeitsregeln

1. **Der Obsidian-Vault ist nur lesbar.** In
   `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Studium` wird nichts angelegt,
   geändert oder gelöscht. Nie.
2. **Node ist Voraussetzung.** Ohne `node` kein Build und kein Test. Installation nur über
   den offiziellen Installer von nodejs.org. Kein `sudo` durch Claude, kein Homebrew ohne
   Rückfrage. (Vorhanden seit 2026-10-19: Node v24.22.0, npm 11.19.1.)
3. **Nach jeder Phase wird gestoppt.** Claude sagt genau, was zu testen ist, und wartet auf
   ein OK, bevor die nächste Phase beginnt.
4. **Auslieferung über GitHub Pages als PWA.** Eine lokale HTML-Datei über iCloud Drive
   zeigt iOS nur als Quick-Look-Vorschau ohne JavaScript (geprüft 2026-10-18 mit
   `probe.html`: JavaScript, `localStorage`, `data:`-URIs und Eingabefelder blieben inaktiv,
   online wie im Flugmodus; Mac Safari war nicht betroffen). Ausgeliefert wird deshalb über
   eine **öffentliche GitHub-Pages-Seite** als installierbare PWA (Manifest + Service
   Worker, nach dem ersten Aufruf offline, „Zum Home-Bildschirm"). Kein Account für die
   Nutzung der Seite selbst, kein Server, keine KI zur Laufzeit — nur die Auslieferung läuft
   über GitHub.
5. **Das Repo ist öffentlich — nichts vom Dozenten hinein.** Niemals PDFs aus dem Vault
   committen, niemals Aufgabentexte wörtlich aus Musterklausur oder WS22-Übungen übernehmen.
   Generatoren dürfen den **Stil** der Aufgaben nachbilden (Formulierungsregister, Aufbau),
   aber keine Sätze des Dozenten kopieren. Fixtures enthalten ausschließlich Zahlen
   (Parameter → erwartetes Ergebnis), keinen Aufgabentext. `.gitignore` schließt `*.pdf` und
   bekannte Vault-Pfade aus; vor jedem Push kurz `git status` prüfen.
6. **iPhone-Test über die Pages-URL, nicht über eine Datei.** Sobald die Seite auf GitHub
   Pages liegt, wird sie dort geöffnet und zum Home-Bildschirm hinzugefügt — vor Phase 1 und
   nach jedem Deploy, der die PWA-Konfiguration betrifft.
7. **Jede Phase endet mit grünen Tests.** `node test/alle.mjs` muss durchlaufen, bevor eine
   Phase als fertig gilt.

### Befunde aus den Quellen (geprüft)

- `Mathematik Musterklausur.md` deckt sich **wörtlich** mit der Musterlösung-PDF, inklusive
  der dort notierten Lücken (Aufgabe 3c nennt nur `x₁ = 5`; Aufgabe 4 nennt keine
  Funktionswerte). Die Datei ist damit als Referenz für die Generatoren brauchbar — bleibt
  aber nur lokal, siehe Arbeitsregel 5.
- Punkteverteilung Musterklausur: Finanzmathematik 12, Differentialrechnung 36,
  Integralrechnung 0, Lineare Algebra 12.
- Integralrechnung steckt im Skript in Kapitel 3 (Folien 146–160) und in den WS22-Übungen
  18 (unbestimmtes Integral), 19 (bestimmtes Integral) und 20 (Konsumenten-/Produzenten-
  rente). Daran orientieren sich die Integral-Generatoren.
- Notation laut Formelsammlung und Folien: `q = 1 + i`, `R₀ = r·(qⁿ−1)/(i·qⁿ)`,
  `Rₙ = r·(qⁿ−1)/i`, `i_eff = (1 + i_nom/m)^m − 1`, `p-q-Formel`, `Det(H)`, `KR`/`PR`.
  Die WS22-Lösungen schreiben teils `qⁿ(q−1)` statt `i·qⁿ` — mathematisch identisch, die
  Lösungsanzeige folgt der Musterlösung (`i·qⁿ`).
- **Werkzeug-Hinweis:** auf diesem Mac gibt es kein `pdftotext`/poppler. PDF-Text geht über
  PDFKit per JXA: `osascript -l JavaScript tools/pdftext.js <datei> [von] [bis]`.

### Festgelegte Entscheidungen

- **Antwortprüfung:** Polynome über Koeffizientenfelder, Matrizen über ein Feld je Eintrag,
  beides automatisch geprüft. Echte Symbolterme (√, eˣ, ln) werden aufgedeckt und selbst
  bewertet, zusätzlich optionaler Zahlencheck `f'(x₀)`.
- **Themenumfang:** zuerst alle Musterklausur-Typen und die Integral-Typen, danach als
  eigene Phase die Zusatzthemen (Finanzmathematik-Erweiterung, Elastizitäten, LGS).
- **Quellstruktur:** Module in `src/` plus `build.mjs`, das die eine HTML-Datei backt. Das
  Testskript importiert genau die Module, die auch im Browser laufen.
- **Auslieferung:** GitHub Pages als installierbare PWA statt einer Datei über iCloud Drive
  (siehe Arbeitsregel 4).

---

## Aufgabenkatalog

Spalte „rückwärts" beschreibt, was zuerst gewählt wird (die saubere Lösung) und was daraus
abgeleitet wird (die Parameter der Aufgabe).

### 1 Finanzmathematik — 12 Punkte

| Kennung | Name | P | Vorlage | Was variiert | Rückwärts / saubere Zahlen |
|---|---|---|---|---|---|
| `fin.rente-aus-kapital` | Rente aus einem Anfangskapital | 3 | MK 1 I, Übung 5c | `R₀` ∈ 50.000…250.000 (Schritt 10.000), `i` ∈ {1; 1,5; 2; 2,5; 3; 4; 5} %, `n` ∈ {10; 12; 15; 20; 25}, Story (Rentenversicherung, Lebenserwartung) | `R₀` runde Summe, `i` ≤ 2 Dezimalen, `n` ganz. Ergebnis `r = R₀·i·qⁿ/(qⁿ−1)` auf Cent; Zwischenwert `qⁿ` mit 6 Dezimalen anzeigen. Prüft `r` ∈ plausibler Spanne |
| `fin.rente-veraenderlich` | Barwert einer veränderlichen nachschüssigen Rente | 3 | MK 1 II | `n` ∈ {3; 4; 5}, Startzahlung ∈ {40; 50; 100; 200; 500}, Zuwachs `d` ∈ {5; 10; 20; 25; 50}, `i` ∈ {2; 4; 5; 8; 10} % | Zahlungen ganzzahlig, `i` ≤ 2 Dezimalen. Summe einzeln abgezinst, Ergebnis auf 2 Dezimalen. Tabelle `t`/`rₜ` wie in der Klausur |
| `fin.verdopplungszeit` | Laufzeit bei Zinseszins | 3 | MK 2a, Übung 1d/2a | Variante A: Verdopplung/Verdreifachung, `i` ∈ 1…8 % (Schritt 0,25). Variante B: `K₀` und `Kₙ` gegeben | A: `n = ln2/ln q`, Ergebnis 2 Dezimalen (Klausur: 17,67). B rückwärts wie WS22 1d: `n` ganz wählen, `K₀` rund, `Kₙ = runde(K₀·qⁿ, 2)` → Antwort ≈ ganze Jahre |
| `fin.effektivzins` | Effektivzins bei unterjährlicher Verzinsung | 3 | MK 2b, Übung 3b/c | `m` ∈ {2; 4; 12; 360}, `i_nom` 1…12 %, Umkehrvariante (`i_nom` aus `i_eff`, Übung 3a) als Untertyp | `i_nom/m` muss endlich dezimal sein: bei `m=12` nur `i_nom` ∈ {1,2; 2,4; 3; 3,6; 4,8; 6; 7,2} %, bei `m=4` ganze %, bei `m=2` beliebig. Ausgabe `3,04 %` **und** exakt `3,0416 %` (Rundungsregel des Dozenten) |

Zusammen 4 × 3 P = 12 P, genau Aufgabe 1 + 2 der Musterklausur.

### 2 Differentialrechnung — 24 P im Standard-Split (36 P im Musterklausur-Original)

| Kennung | Name | P | Vorlage | Was variiert | Rückwärts / saubere Zahlen |
|---|---|---|---|---|---|
| `diff.gewinn-breakeven` | Erlös, Gewinn, Grenzkosten, Gewinnschwelle, Gewinnmaximum (4 Teilaufgaben 2+2+4+4) | 12 | MK 3, Übung 13 | `p(x) = a − bx`, `K(x) = cx² + dx + e`; Stelle `x₀` der Grenzkosten | **Zuerst die Nullstellen:** `x₁ < x₂` ganz (oder halb), `A = b + c` aus {1; 2; 2,4; 3; 3,5; 4; 10,5}, dann `G(x) = −A(x−x₁)(x−x₂)`, also `d = a − A(x₁+x₂)` und `e = A·x₁·x₂`. Bedingungen: `b` ∈ {1; 2; 3}, `c = A − b > 0`; `x_max = (x₁+x₂)/2` höchstens halbzahlig; `p(x₂) > 0`; `p(x_max)` ganz; `G_max = A·((x₂−x₁)/2)²` glatt; `K'(x₀) = 2c·x₀ + d` ganz. Reproduziert die Klausur exakt: `x₁=5, x₂=10, A=2,4, b=2, c=0,4, a=25 → d=−11, e=120` |
| `diff.extremwerte-2var` | Extremwerte und Sattelpunkte, zwei Variablen (kubische Form) | 12 | MK 4 | `f(x,y) = x³ + a·xy + b·x² + c·y²` | `f_y = ax + 2cy = 0 → y = −(a/2c)x`; eingesetzt `3x² + (2b − a²/(2c))x = 0` → immer `x₁ = 0` und `x₂ = −(2b − a²/(2c))/3`. **Rückwärts:** `a` gerade, `c` ∈ {−1; −2; 1; 2}, `x₂` ∈ {±1; ±2; ±3} wählen und `b` daraus bestimmen; `y₂ = −(a/2c)·x₂` ganz. Prüfen: `Det(H) ≠ 0` an beiden Punkten und genau ein Sattelpunkt + ein Extremum (wie in der Klausur). Funktionswerte ganz. Lösung nennt **auch** die Funktionswerte (Lücke der Musterlösung) |
| `diff.extremwerte-2var-quadratisch` | Extremwerte, zwei Variablen (quadratische Form) | 12 | Übung 15 | `f(x,y) = Ax² + Bx + Cy² + Dy + Exy + F` | Stationären Punkt `(x*, y*)` ganz wählen, `f_xx = 2A`, `f_yy = 2C`, `f_xy = E` ganz mit `Det(H) ≠ 0`, dann `B = −(2Ax* + Ey*)`, `D = −(2Cy* + Ex*)`. Immer genau ein Punkt, Typ über `Det(H)` und `f_xx` |
| `diff.nutzenmaximum` | Nutzenmaximum unter Budget-Nebenbedingung | 8 | MK 5, Übung 16 | `U = αx₁ + βx₂ + γx₁x₂ + δ`, Preise `P₁, P₂` ∈ 1…5, Einkommen `Y` | **Optimum zuerst:** `x₁*, x₂*` positive ganze Zahlen, dann `Y = P₁x₁* + P₂x₂*` (rund halten). Optimalitätsbedingung `P₂(α + γx₂*) = P₁(β + γx₁*)` über ganzzahlige Suche in `α, β, γ` erfüllen. `U'' = −2γP₁/P₂ < 0`. Reproduziert MK 5: `α=8, β=4, γ=2, P₁=2, P₂=4, Y=60 → (18; 6)`. Lösung zeigt Einsetzungs- **und** Lagrangeweg (λ fällt ganz aus) |
| `diff.ableitungen` | Ableitungen bilden (2 Teilaufgaben à 2 P) | 4 | MK 6, Übung 9–11 | Teil a) Potenzregel-Summe: `ax^n + 1/x`, `±bx^{-k}`, `√x`, `c·x^{p}`. Teil b) Produkt-/Ketten-/Quotientenregel: `(x−a)√(x²−b)`, `x²eˣ`, `eˣ·ln x`, `(ax+b)^n`, `e^{g(x)}`, `ln(g(x))`, `u/v` | Exponenten und Koeffizienten so, dass die Ableitung in der Schreibweise der Folien kurz bleibt (ganze oder halbe Exponenten, kleine Koeffizienten). Für den Zahlencheck `x₀` so wählen, dass `f'(x₀)` definiert und nicht nahe einer Polstelle ist |

Mögliche 24-Punkte-Kombinationen: 12+12, 12+8+4, 8+4+12. Musterklausur-Original: 12+12+8+4 = 36.

### 3 Integralrechnung — 12 Punkte (kein Klausurvorbild, modelliert auf WS22 + Skript)

| Kennung | Name | P | Vorlage | Was variiert | Rückwärts / saubere Zahlen |
|---|---|---|---|---|---|
| `int.unbestimmt` | Stammfunktion bestimmen | 3 | Übung 18, Folie 152 | Polynom mit 2–4 Gliedern, optional `1/x` → `ln\|x\|`, `eˣ`, `aˣ`, negative Exponenten | Koeffizient `a_k` so, dass `a_k/(k+1)` einen Nenner aus {1; 2; 3; 4; 5} hat (Übung 18a: `∫2x²dx = ⅔x³ + c`). Immer `+ c` in der Lösung, Kontrollsatz „Ableitung der Stammfunktion muss die Ausgangsfunktion ergeben" wie auf Folie 149 |
| `int.bestimmt` | Bestimmtes Integral berechnen | 4 | Übung 19, Folien 156/157 | Summe von Potenztermen, auch negative Exponenten; Grenzen `a < b` klein und ganz; Variante mit `1/x` → `ln` | **Stammfunktion zuerst:** `F(x) = Σ c_k x^k` mit glatten `c_k` wählen, `f = F'`. Grenzen so, dass `F(b) − F(a)` ganz oder ein kleiner Bruch ist (Übung 19c: `25 1/9`). Bei negativen Exponenten oder `ln` Grenzen `> 0` (Übung 19d: 1…2). Ergebnis als Bruch **und** Dezimalzahl |
| `int.konsumentenrente` | Gleichgewicht, Konsumenten- und Produzentenrente | 5 | Übung 20, Folien 158/159 | `p_N(x) = a − bx`, `p_A(x) = cx`; Variante `p_A(x) = cx + f` abschaltbar | **Gleichgewicht zuerst:** `x₀` ganz (4…20), `c` ∈ {0,1; 0,2; 0,5; 1; 2; 3; 5}, `p₀ = c·x₀`; `b` ∈ {0,5; 1; 1,5; 2; 4} und `a = p₀ + b·x₀`. Dann `KR = (b/2)·x₀²`, `PR = (c/2)·x₀²`, beide höchstens halbzahlig. Reproduziert Übung 20a–e |
| `int.kosten-aus-grenzkosten` | Kostenfunktion aus Grenzkostenfunktion | 3 | Folien 153/154 | `K'(x) = 2cx + d` (auch quadratisch), Fixkosten `K_f`; Varianten Erlös aus Grenzerlös, Gewinn aus Grenzgewinn | Koeffizienten ganz, `K_f` rund. Lösung betont: Integrationskonstante `C = K_f`, ohne bekannte Fixkosten nicht bestimmbar (Formulierung von Folie 154). Optional Rückfrage `K(x₀)` mit ganzem Ergebnis |

12-Punkte-Kombinationen: 3+4+5 oder 4+5+3.

### 4 Lineare Algebra — 12 Punkte

| Kennung | Name | P | Vorlage | Was variiert | Rückwärts / saubere Zahlen |
|---|---|---|---|---|---|
| `alg.matrixprodukt` | Matrizenprodukte berechnen (2 Teilaufgaben à 2 P) | 4 | MK 7, Übung 22 | a) Zeilenvektor (1×2 / 1×3) × Matrix; b) 3×3 × 3×3. Varianten aus Übung 22: Transponierte, Skalarvielfaches, `A·E = A`, nicht definiertes Produkt mit Begründung | Einträge ganz aus −3…4, mindestens ein Drittel Nullen (wie in der Klausur), Ergebniseinträge \|·\| ≤ 99, damit es im Kopf geht. Dimensionen werden in der Lösung mitgeschrieben (`(1×2)·(2×2) = (1×2)`) |
| `alg.produktionsprozess` | Zweistufiger Produktionsprozess, Rohstoffbedarf und Gewinn (a 4 P, b 4 P) | 8 | MK 8, Übung 24 | `A` (3×3), `B` (3×2), `E` (2×1), `P_E` (1×2), `P_R` (1×3); einstufige Variante nach Übung 23 | `A`, `B` ganz ≥ 0 mit Nullen, `E` runde Stückzahlen (10…50 in Schritten von 2), Preise ganz. Erst Kosten `P_R·A·B·E` ausrechnen, dann `P_E` so wählen, dass der Gewinn positiv und ≤ 4-stellig ist. Lösung zeigt `A·B` als Gesamtbedarfsmatrix, dann `·E` (Reihenfolge der Musterlösung) |

### 5 Zusatzthemen (Phase 6, in der Probeklausur standardmäßig aus)

| Kennung | Name | P | Vorlage | Hinweise |
|---|---|---|---|---|
| `fin.endwert-rente` | Rentenendwert nach-/vorschüssig | 3 | Übung 5a, 6a | `Rₙ = r(qⁿ−1)/i`, vorschüssig `·q` |
| `fin.ewige-rente` | Barwert einer ewigen Rente | 2 | Übung 7 | `R₀ = r/i`, vorschüssig `r' + r'/i`; `r/i` glatt wählen |
| `fin.verzinsung-grundformen` | Einfache, unterjährliche, stetige Verzinsung | 3 | Übung 1, 3, 4 | `Kₙ = K₀(1+i·n)`, `K₀(1+j)^{n·m}`, `K₀e^{i·n}` |
| `fin.tilgungsplan` | Ratentilgung / Annuitätentilgung | 4 | Kapitel 1.3 | `K₀` durch `n` teilbar; Annuität `A = K₀·qⁿi/(qⁿ−1)`; Plan-Tabelle für 3–4 Perioden |
| `diff.elastizitaet` | Preiselastizität der Nachfrage | 3 | Übung 17 | `ε = f'(x)·x/f(x)`; Zahlen so, dass `ε` ganz ist (Übung 17: −1, −3, −4) |
| `alg.lgs` | Lineares Gleichungssystem, Gauß und Cramer | 6 | Übung 25 | Lösungsvektor ganz wählen, Koeffizientenmatrix mit `det ≠ 0` und kleinen Einträgen, rechte Seite daraus; Lösungsanzeige mit Zeilenschritten |

---

## Probeklausur-Modus

Konfiguration als **ein** Objekt am Anfang von `src/konfig.js`, im UI zusätzlich umschaltbar:

```js
export const KONFIG = {
  dauer: 60 * 60,                  // Sekunden
  punkte: { finanz: 12, diff: 24, integral: 12, algebra: 12 },  // Summe 60
  presets: {
    standard:   { finanz: 12, diff: 24, integral: 12, algebra: 12 },
    original:   { finanz: 12, diff: 36, integral:  0, algebra: 12 },  // Musterklausur
  },
  zusatzthemenInKlausur: false,
};
```

Der Komposer sucht je Teil eine Teilmenge der aktiven Generatoren, deren Punkte **exakt**
die Zielpunktzahl treffen (kein Generator doppelt), und wählt daraus zufällig. Findet er
keine exakte Kombination, nimmt er die nächstbeste Summe und sagt es im UI. Dadurch bleibt
der Split eine Einstellung und nicht fest verdrahtet.

Ablauf: Start → Timer 60:00 läuft sichtbar runter, alle Aufgaben untereinander wie auf einem
Klausurbogen → „Abgeben" (oder Timeout) → Auswertung mit Punkten je Teilaufgabe, Summe,
Note-Ampel und vollständigen Lösungen; bei Symbolaufgaben Selbstbewertung richtig/halb/falsch.

---

## Architektur

```
~/Projekte/mathe-trainer
├── PLAN.md                   # dieser Plan
├── CLAUDE.md                 # Kurzregeln für neue Sessions
├── build.mjs                 # backt Module + KaTeX + PWA-Dateien nach docs/
├── docs/                     # von GitHub Pages ausgeliefert (main-Branch, Ordner /docs)
│   ├── index.html            # Ergebnis von build.mjs, eine Datei mit allem Code
│   ├── manifest.json         # PWA-Manifest (Name, Icons, display: standalone)
│   ├── sw.js                 # Service Worker, cacht index.html beim ersten Besuch
│   └── icons/                 # 180×180 (iOS), 192×192, 512×512
├── src/
│   ├── konfig.js             # Punkte-Split, Dauer, Rundungs- und Toleranzregeln
│   ├── rng.js                # mulberry32, seedbasiert und reproduzierbar
│   ├── zahl.js                # deutsche Formatierung/Parsing, Runden, Brüche
│   ├── latex.js               # Bausteine: Zahl in LaTeX, Matrix, Bruch, Potenz
│   ├── loesung.js             # Schritt-Renderer: Formel → Umstellen → Einsetzen → Ergebnis
│   ├── pruefung.js            # Antworttypen, Toleranzen, Punktevergabe
│   ├── komposer.js            # Probeklausur aus Punkte-Split zusammenstellen
│   ├── app.js                 # UI: Übungsmodus, Probeklausur, Timer, Auswertung
│   ├── stil.css
│   └── generatoren/
│       ├── index.js           # Registry aller Generatoren
│       ├── finanz.js  diff.js  integral.js  algebra.js  zusatz.js
├── test/
│   ├── alle.mjs               # 1.000 Instanzen je Generator, unabhängige Prüfung
│   ├── fixtures.mjs           # nur Zahlen: Parameter → erwartetes Ergebnis (kein Aufgabentext)
│   └── numerik.mjs            # Ableitung per Differenzenquotient, Simpson-Quadratur
├── vendor/katex/              # einmal geladen, dann offline
├── tools/pdftext.js           # PDF-Text per PDFKit (kein poppler nötig), nur lokal genutzt
└── .gitignore                 # *.pdf und Vault-Pfade, damit nie Dozentenmaterial committet wird
```

### Generator-Schnittstelle

Zwei getrennte Funktionen, damit die Fixtures die Klausurzahlen einspeisen können:

```js
{
  id: 'fin.rente-aus-kapital',
  teil: 'finanz',
  name: 'Rente aus einem Anfangskapital',
  punkte: 3,
  vorlage: 'Musterklausur 1 I / Übung 5c',
  waehleParameter(rng) -> params,      // nur Zufall, keine Mathematik
  baue(params) -> aufgabe,             // deterministisch, von Tests direkt aufrufbar
}
```

`baue` liefert:

```js
{
  frage:    { text, latex?, tabelle? },
  eingaben: [ { id, label, typ, einheit?, punkte, loesung, toleranz? } ],
  loesung:  { schritte: [ { titel: 'Formel'|'Umstellen'|'Einsetzen'|'Ergebnis', latex, hinweis? } ],
              ergebnisse: [ { label, latex } ] },
  params,
}
```

Antworttypen in `pruefung.js`:

- `zahl` — Zahlfeld, deutsche Eingabe (`7.782,55`, `7782,55`, `7782.55` gelten alle)
- `prozent` — Feld mit `%`, akzeptiert gerundet und exakt (`3,04` und `3,0416`)
- `koeffizienten` — feste Basis, je Glied ein Feld: `G(x) = [__]x² + [__]x + [__]`
- `matrix` — ein Feld je Eintrag, Dimension aus der Aufgabe
- `auswahl` — Klassifikation (Maximum / Minimum / Sattelpunkt)
- `term` — Lösung aufdecken, Selbstbewertung richtig/halb/falsch, dazu optionaler
  Zahlencheck `f'(x₀)` als automatisch geprüftes `zahl`-Feld

Rundung und Toleranz (zentral in `konfig.js`, nicht je Generator):
Geld 2 Dezimalen, Toleranz ±0,05 (deckt das Runden von `qⁿ` auf 6 Stellen ab);
Zinssätze 2 Dezimalen in Prozentpunkten, Toleranz ±0,01 pp, exakter Wert mit 4 Stellen
zusätzlich angezeigt; Jahre ±0,01; Mengen, Matrixeinträge und Koeffizienten exakt (1e-9).
Jeder Generator muss sicherstellen, dass innerhalb der Toleranz keine zweite plausible
Antwort liegt.

### PWA auf GitHub Pages, offline nach dem ersten Besuch

`build.mjs` bündelt die Module weiterhin zu **einer** HTML-Seite (`docs/index.html`,
einfache Konkatenation in einen IIFE, keine Toolchain), inlined `stil.css` sowie KaTeX-CSS
und -JS und bettet alle 20 KaTeX-WOFF2-Fonts als Base64 ein (nur woff2, keine ttf/woff-
Fallbacks — Safari auf Mac und iPhone unterstützt woff2 vollständig). Gemessene Dateigröße
nach Phase 0 mit nur dem Platzhalter-Generator: 644 KB. KaTeX wird **einmal** geladen
(`npm pack katex` nach `vendor/katex/`), danach braucht nichts mehr Netz.

Zusätzlich erzeugt `build.mjs`:

- `docs/manifest.json` — Name, Icons, `display: standalone`, Startseite, Theme-Farben
- `docs/sw.js` — Service Worker, der `index.html` und alle eingebetteten Assets beim ersten
  Besuch cacht (Cache-First, ein Cache-Name pro Version); danach läuft die Seite komplett
  offline, auch im Flugmodus
- `docs/icons/` — PWA-Icons (180×180 für iOS, 192×192 und 512×512 für den Rest)

GitHub Pages serviert den Ordner `docs/` vom `main`-Branch. Auf dem iPhone: Pages-URL in
Safari öffnen, „Zum Home-Bildschirm" — danach startet die App als Vollbild-PWA ohne
Safari-Chrome, mit eigenem Icon, und funktioniert offline. `localStorage` läuft unter
`https://` zuverlässig (anders als unter `file://`, wo der Zugriff je nach iOS-Version
blockiert sein kann), Fortschritt wird trotzdem in `try/catch` geschrieben, mit Rückfall
auf RAM.

---

## GitHub-Einrichtung (einmalig, vor Phase 0)

1. Account auf github.com anlegen (falls noch keiner existiert), kostenloser Plan reicht.
2. Neues **öffentliches** Repo `mathe-trainer` anlegen, ohne README/License/.gitignore
   vorausgewählt (die legt dieses Projekt selbst an).
3. Lokal mit dem Repo verbinden (`git init`, `git remote add origin …`, erster Commit,
   `git push`).
4. GitHub Pages aktivieren: Repo → Settings → Pages → Source „Deploy from a branch" →
   Branch `main`, Ordner `/docs`.
5. Nach dem ersten Push mit Inhalt in `docs/` ist die Seite unter
   `https://<benutzername>.github.io/mathe-trainer/` erreichbar (kann beim ersten Mal
   einige Minuten dauern).

Sicherheitsnetz: `.gitignore` schließt `*.pdf` und bekannte Vault-Pfade aus, damit nie
versehentlich Dozentenmaterial committet wird. Vor jedem Push kurz `git status` prüfen.

---

## Testkonzept

`node test/alle.mjs` erzeugt **1.000 Instanzen je Generator** mit durchnummerierten Seeds
und prüft jede Lösung auf einem anderen Rechenweg als der Generator sie gebaut hat. Bei
Fehlschlag werden Generator-ID, Seed und Parameter ausgegeben, damit der Fall reproduzierbar
ist.

Pro Generator unabhängig geprüft:

- `fin.rente-aus-kapital`: die `n` Zahlungen `r` einzeln abgezinst müssen `R₀` ergeben
- `fin.rente-veraenderlich`: Summe gegen Einzelabzinsung in anderer Reihenfolge und gegen
  geschlossene Form der arithmetisch steigenden Rente
- `fin.verdopplungszeit`: `K₀·q^n` am gefundenen `n` muss `Kₙ` treffen
- `fin.effektivzins`: `m`-fache Aufzinsung mit `j = i_nom/m` numerisch gegen `1 + i_eff`
- `diff.gewinn-breakeven`: `G(x₁) = G(x₂) = 0`, `G'(x_max) = 0` per Differenzenquotient,
  `E(x) = p(x)·x` an Stichproben, `K'(x₀)` numerisch, `G_max = G(x_max)`
- `diff.extremwerte-2var` (beide Formen): `f_x`, `f_y` numerisch ≈ 0 an den stationären
  Punkten; Klassifikation durch Abtasten von `f` auf einem kleinen Kreis (Maximum: alle
  Proben kleiner; Sattelpunkt: beide Vorzeichen); `Det(H)` gegen numerische Hesse-Matrix
- `diff.nutzenmaximum`: Budget exakt eingehalten, `U` im Optimum größer als an zulässigen
  Nachbarpunkten, Lagrange-λ aus beiden Bedingungen identisch
- `diff.ableitungen`: angezeigte Ableitung gegen zentralen Differenzenquotienten an
  mehreren Stellen des Definitionsbereichs
- `int.unbestimmt`, `int.bestimmt`: `F' = f` numerisch; beim bestimmten Integral zusätzlich
  Simpson-Quadratur gegen den angegebenen Wert
- `int.konsumentenrente`: `p_N(x₀) = p_A(x₀) = p₀`; `KR`/`PR` per Quadratur
- `int.kosten-aus-grenzkosten`: `K'` numerisch aus der angegebenen `K`; `K(0) = K_f`
- `alg.matrixprodukt`, `alg.produktionsprozess`: Produkte mit einer separat geschriebenen
  Dreifachschleife nachgerechnet, Dimensionsregeln geprüft, `G` gegen Erlös minus Kosten

Querschnittsprüfungen für jede Instanz: alle angezeigten Zahlen erfüllen die deklarierten
Sauberkeitsregeln (ganz / ≤ 2 Dezimalen / Nenner aus der erlaubten Menge); kein KaTeX-Fehler
beim Rendern aller Schritte; Summe der Teilpunkte = `punkte`; keine Lösung liegt so nah an
einer Alternative, dass die Toleranz beide akzeptiert; gleicher Seed ergibt gleiche Aufgabe.

`test/fixtures.mjs` ruft `baue(params)` mit den Originalzahlen auf und vergleicht Schritt
für Schritt mit dem erwarteten Ergebnis (nur Zahlen, kein Aufgabentext, siehe Arbeitsregel 5):

| Fixture | Erwartung |
|---|---|
| MK 1 I (100.000; 2 %; 15) | `r = 7.782,55 €` |
| MK 1 II (50/55/60/65; 10 %) | `R₀ = 180,38` |
| MK 2a (Verdopplung; 4 %) | `t = 17,67` Jahre |
| MK 2b (3 %; m = 12) | `i_eff = 3,04 %` (exakt 3,0416 %) |
| MK 3 (`p = 25−2x`, `K = 0,4x²−11x+120`) | `E = 25x−2x²`, `G = −2,4x²+36x−120`, `K'(50) = 29`, `x₁ = 5`, `x₂ = 10`, `x_max = 7,5`, `p = 10`, `G_max = 15` |
| MK 4 (`x³+4xy−x²−y²`) | Sattelpunkt `(0\|0\|0)`, Maximum `(−2\|−4\|4)` |
| MK 5 (`8x₁+4x₂+2x₁x₂+8`; Y=60; 2/4) | `(x₁; x₂) = (18; 6)`, `λ = −10` |
| MK 6a/b | `−6x − 1/x²`; `√(x²−1) + (x−1)x/√(x²−1)` |
| MK 7a/b | `(7 2)`; `((4 1 4)(8 2 5)(4 4 3))` |
| MK 8a/b | `R = (106; 208; 206)`, `G = 632` |
| Übung 18a/b | `⅔x³ + c`; `x⁴ − x³ + x² − x + c` |
| Übung 19a–d | `1/10`; `−20,25`; `25 1/9`; `−21` |
| Übung 20a–e | je `x₀`, `p₀`, `KR`, `PR` |
| Übung 13a–d, 15a–d, 16a–d | je Break-even, Maximum, stationäre Punkte, Güterbündel |

Damit ist die Forderung erfüllt: jeder Musterklausur-Generator reproduziert die Musterlösung
mit ihren Zahlen, die Integral-Generatoren reproduzieren die WS22-Lösungen — die Fixtures
selbst enthalten dabei nur Zahlen, keinen aus den PDFs übernommenen Aufgabentext.

---

## Baureihenfolge

Nach jeder Phase wird gestoppt und auf ein OK gewartet.

**Phase 0 — Fundament.** GitHub-Account und öffentliches Repo einrichten (siehe Abschnitt
„GitHub-Einrichtung"), `.gitignore` gegen versehentliche PDF-Commits, Projektgerüst,
`build.mjs` mit eingebettetem KaTeX und PWA-Ausgabe (`docs/index.html`, `manifest.json`,
`sw.js`, Icons), `rng.js`, `zahl.js`, `latex.js`, `loesung.js`, `pruefung.js`,
Übungsmodus-UI, Testharness mit einem Dummy-Generator, GitHub Pages aktiviert (Branch
`main`, Ordner `/docs`). **Enthält den iPhone-Test:** die Pages-URL wird auf dem iPhone
geöffnet, zum Home-Bildschirm hinzugefügt und im Flugmodus erneut gestartet — sie muss dort
JavaScript ausführen, Formeln setzen und offline weiterlaufen. Scheitert das, wird vor dem
ersten Generator ein anderer Auslieferungsweg entschieden.

**Phase 1 — Finanzmathematik.** `fin.rente-aus-kapital`, `fin.rente-veraenderlich`,
`fin.verdopplungszeit`, `fin.effektivzins` samt Fixtures (MK 1, MK 2, Übung 5c) und
1.000er-Tests. Ergebnis: Übungsmodus Finanzmathematik komplett, 12 Punkte.

**Phase 2 — Differentialrechnung.** `diff.gewinn-breakeven` (zuerst, höchster Punktwert),
dann `diff.extremwerte-2var`, `diff.extremwerte-2var-quadratisch`, `diff.nutzenmaximum`,
`diff.ableitungen`. Fixtures MK 3–6 und Übung 12/13/15/16.

**Phase 3 — Integralrechnung.** `int.unbestimmt`, `int.bestimmt`, `int.konsumentenrente`,
`int.kosten-aus-grenzkosten`. Fixtures Übung 18/19/20 und Folien 154/159.

**Phase 4 — Lineare Algebra.** `alg.matrixprodukt`, `alg.produktionsprozess`. Fixtures
MK 7/8 und Übung 22/23/24. Ab hier sind alle vier Teile vorhanden.

**Phase 5 — Probeklausur.** Komposer nach Punkte-Split, Timer 60:00, Klausurbogen-Layout,
Abgabe und Auswertung mit Punkten und Selbstbewertung, Presets „Standard 12/24/12/12" und
„Musterklausur-Original 12/36/0/12".

**Phase 6 — Zusatzthemen.** Finanzmathematik-Erweiterung (Rentenendwert, ewige Rente,
einfache/unterjährliche/stetige Verzinsung, Tilgungsrechnung), Elastizitäten, lineare
Gleichungssysteme (Gauß und Cramer). Im Übungsmodus zuschaltbar, in der Probeklausur
standardmäßig aus.

**Phase 7 — Feinschliff.** iPhone-Layout (Eingabefelder mit numerischer Tastatur, keine
Querscroll-Formeln), Rundungsregeln gegengeprüft, Fortschritt in `localStorage` mit
Fallback, alle Tests grün, kurze `README.md` mit Bedienung und wie man den Punkte-Split
ändert.

---

## Verifikation

1. `node test/alle.mjs` — 1.000 Instanzen je Generator, unabhängige Nachrechnung, plus
   Fixtures gegen Musterlösung und WS22. Muss ohne Fehlschlag durchlaufen; Fehler nennen
   Generator, Seed und Parameter.
2. `node build.mjs` — erzeugt `docs/index.html`, `docs/manifest.json`, `docs/sw.js`,
   `docs/icons/`; Prüfung, dass `docs/index.html` keine externen `http(s)`-Referenzen mehr
   enthält (`grep -o 'https\?://[^"]*' docs/index.html` liefert nichts außer Kommentaren).
3. Netzwerk aus, `docs/index.html` in Safari auf dem Mac öffnen: je Teil 3–4 Aufgaben
   rechnen, Lösung aufdecken, Formelsatz und deutsche Zahlformate kontrollieren.
4. Probeklausur starten: Punkte je Teil müssen dem Split entsprechen, Timer läuft, Abgabe
   erzeugt eine Auswertung über 60 Punkte.
5. Pages-URL auf dem iPhone öffnen, zum Home-Bildschirm hinzufügen, im Flugmodus erneut
   starten: Layout, Tastatur, Timer und Offline-Fähigkeit prüfen.
6. Stichprobe von Hand: eine generierte Aufgabe je Teil mit Taschenrechner nachrechnen und
   mit der angezeigten Lösung vergleichen.
