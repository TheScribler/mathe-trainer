// Zentrale Konfiguration: Punkte-Split, Dauer, Rundungs- und Toleranzregeln.
// Rundung/Toleranz gehört hierher, nicht in einzelne Generatoren
// (siehe CLAUDE.md Abschnitt 6).

export const KONFIG = {
  dauer: 60 * 60,
  punkte: { finanz: 12, diff: 24, integral: 12, algebra: 12 },
  presets: {
    standard: { finanz: 12, diff: 24, integral: 12, algebra: 12 },
    original: { finanz: 12, diff: 36, integral: 0, algebra: 12 },
  },
  zusatzthemenInKlausur: false,
  toleranz: {
    geld: 0.05,
    // Enger als die normale Geld-Toleranz: in einem Tilgungsplan wird jede
    // Zeile aus der vorherigen berechnet, kleine Cent-Rundungen pro Zeile
    // sind laut Vorlesungsnotizen zulässig und akkumulieren sich über
    // mehrere Perioden — aber nicht beliebig, sonst würde am Ende eine
    // ganz andere Zahl noch als "richtig" durchgehen.
    tilgungszelle: 0.01,
    // Muss strikt kleiner sein als der 2-Dezimalstellen-Rundungsschritt
    // (0,01 pp), sonst wird die nächste Rundungsstufe fälschlich akzeptiert
    // (z. B. 3,05 bei einer Antwort von 3,04). Die Rundung auf 2 Dezimal-
    // stellen weicht im schlechtesten Fall um genau 0,005 vom ungerundeten
    // Wert ab — 0,006 lässt etwas Spielraum für Gleitkomma-Rauschen an
    // dieser Grenze, bleibt aber klar unter 0,01.
    prozentpunkte: 0.006,
    jahre: 0.01,
    exakt: 1e-9,
    // Für Ergebnisse der Integralrechnung, die ein Bruch sein können (z. B.
    // 2/3 = 0,6667): dieselbe Überlegung wie bei prozentpunkte, aber für die
    // normale 2-Dezimalstellen-Rundung (nicht die Sonderregel für Zinssätze).
    // Deckt sowohl "0,67" als auch "0,667" als Antwort für 2/3 ab — beides
    // sind plausible Rundungen desselben exakten Werts.
    bruch: 0.006,
  },
  nachkommastellen: {
    geld: 2,
    jahre: 2,
    // Zinssatz-ERGEBNISSE (finale Antworten, die ein Zinssatz sind) werden
    // als Dezimalzahl auf 4 Nachkommastellen angegeben — Vorlesungsregel,
    // siehe CLAUDE.md Abschnitt 6 ("Rundungsregel für Zinssätze"). Das ist
    // zahlenmäßig dasselbe wie 2 Nachkommastellen in Prozent (0,0304 = 3,04 %),
    // weil Prozent = Dezimalzahl × 100 den Dezimalpunkt um genau 2 Stellen
    // verschiebt. Gilt NICHT für gegebene Werte in einer Aufgabenstellung,
    // nur für das, was als Ergebnis hingeschrieben wird.
    zinssatzDezimal: 4,
  },
};
