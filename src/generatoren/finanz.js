// Finanzmathematik — 4 Generatoren, 12 Punkte zusammen, entspricht Aufgabe 1+2
// der Musterklausur. Jeder Generator konstruiert rückwärts: erst die saubere
// Lösung, dann die Parameter (siehe PLAN.md, Katalog "1 Finanzmathematik").

import { zufallInt, zufallAus, zufallBool } from '../rng.js';
import { runde, formatDeZahl } from '../zahl.js';
import { zahlZuLatex, prozentLatex, bruch } from '../latex.js';
import { KONFIG } from '../konfig.js';

const NAMEN = ['Jana', 'Lena', 'Paul', 'Mara', 'Jonas', 'Nina', 'Felix', 'Sophie', 'Tom', 'Clara'];

// Zeigt einen Dezimalbruch mit so wenigen Nachkommastellen wie möglich (2–4),
// ohne das Ergebnis zu verändern — "0,02" statt "0,0200", aber "0,015" wenn
// zwei Nachkommastellen nicht reichen.
function anteilLatexOhneNullen(anteil) {
  for (let dp = 2; dp <= 4; dp++) {
    if (Math.abs(runde(anteil, dp) - anteil) < 1e-12) return zahlZuLatex(anteil, dp);
  }
  return zahlZuLatex(anteil, 4);
}

// ---------------------------------------------------------------------------
// fin.rente-aus-kapital — MK 1 I / Übung 5c
// Formel: R0 = r (q^n - 1) / (i q^n)  =>  r = R0 i q^n / (q^n - 1)
// ---------------------------------------------------------------------------
const VORLAGEN_RENTE_KAPITAL = [
  (name, R0, iProzent, jahre) => `${name} hat ${formatDeZahl(R0, 0)} € angespart und zahlt den Betrag in eine ` +
    `Rentenversicherung ein. Das aktuelle Zinsniveau beträgt ${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 1)} % p.a. ` +
    `Wie hoch ist die jährliche nachschüssige Rentenzahlung, wenn mit einer Lebenserwartung von ` +
    `weiteren ${jahre} Jahren kalkuliert wird?`,
  (name, R0, iProzent, jahre) => `${name} zahlt ${formatDeZahl(R0, 0)} € in eine Rentenversicherung ein. Der Markt bietet ` +
    `aktuell ${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 1)} % p.a. Zinsen. Welche jährliche nachschüssige Rente ` +
    `lässt sich daraus für die nächsten ${jahre} Jahre finanzieren?`,
];

export const renteAusKapital = {
  id: 'fin.rente-aus-kapital',
  teil: 'finanz',
  name: 'Rente aus einem Anfangskapital',
  punkte: 3,
  vorlage: 'Musterklausur 1 I / Übung 5c',
  waehleParameter(rng) {
    const R0 = zufallInt(rng, 5, 25) * 10000;
    const iProzent = zufallAus(rng, [1, 1.5, 2, 2.5, 3, 4, 5]);
    const n = zufallAus(rng, [10, 12, 15, 20, 25]);
    const name = zufallAus(rng, NAMEN);
    const vorlageIndex = zufallInt(rng, 0, VORLAGEN_RENTE_KAPITAL.length - 1);
    return { R0, iProzent, n, name, vorlageIndex };
  },
  baue(params) {
    const { R0, iProzent, n, name, vorlageIndex } = params;
    const i = iProzent / 100;
    const q = 1 + i;
    const qn = Math.pow(q, n);
    const r = runde((R0 * i * qn) / (qn - 1), KONFIG.nachkommastellen.geld);

    const iLatex = anteilLatexOhneNullen(i);
    const qLatex = anteilLatexOhneNullen(q);

    return {
      frage: { text: VORLAGEN_RENTE_KAPITAL[vorlageIndex](name, R0, iProzent, n) },
      eingaben: [
        { id: 'r', label: 'Jährliche Rente r', typ: 'zahl', punkte: 3, loesung: r, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: `R_0 = r \\cdot ${bruch('q^n - 1', 'i \\cdot q^n')}` },
          {
            titel: 'Umstellen',
            latex: `r = R_0 \\cdot ${bruch('i \\cdot q^n', 'q^n - 1')}`,
            hinweis: 'Beide Seiten durch den Bruch teilen, also mit seinem Kehrwert malnehmen.',
          },
          {
            titel: 'Einsetzen',
            latex: `r = ${zahlZuLatex(R0, 0)} \\cdot ${bruch(`${iLatex} \\cdot ${qLatex}^{${n}}`, `${qLatex}^{${n}} - 1`)}`,
            hinweis: `Zwischenwert: q^{${n}} = ${zahlZuLatex(qn, 6)}`,
          },
          { titel: 'Ergebnis', latex: `r = ${zahlZuLatex(r, 2)}\\ \\text{€}` },
        ],
        ergebnisse: [{ label: 'Jährliche Rente r', latex: `${zahlZuLatex(r, 2)}\\ \\text{€}` }],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// fin.rente-veraenderlich — MK 1 II
// Formel: R0 = sum_{t=1}^{n} r_t / (1+i)^t, r_t arithmetisch steigend
// ---------------------------------------------------------------------------
const VORLAGEN_RENTE_VERAENDERLICH = [
  (iProzent) => `Für die Zahlungszeitpunkte t aus der Tabelle sind nachschüssige Rentenzahlungen ` +
    `r_t gegeben. Bei einem Zinssatz von ${formatDeZahl(iProzent, 0)} % p.a.: Wie hoch ist der ` +
    `Rentenbarwert dieser Zahlungsreihe?`,
  (iProzent) => `Eine Zahlungsreihe mit nachschüssigen, von Jahr zu Jahr steigenden Zahlungen r_t ` +
    `(siehe Tabelle) soll bei einem Zinssatz von ${formatDeZahl(iProzent, 0)} % p.a. auf ihren ` +
    `heutigen Wert abgezinst werden. Berechnen Sie den Rentenbarwert.`,
];

export const renteVeraenderlich = {
  id: 'fin.rente-veraenderlich',
  teil: 'finanz',
  name: 'Barwert einer veränderlichen nachschüssigen Rente',
  punkte: 3,
  vorlage: 'Musterklausur 1 II',
  waehleParameter(rng) {
    const n = zufallAus(rng, [3, 4, 5]);
    const r1 = zufallAus(rng, [40, 50, 100, 200, 500]);
    const d = zufallAus(rng, [5, 10, 20, 25, 50]);
    const iProzent = zufallAus(rng, [2, 4, 5, 8, 10]);
    const vorlageIndex = zufallInt(rng, 0, VORLAGEN_RENTE_VERAENDERLICH.length - 1);
    return { n, r1, d, iProzent, vorlageIndex };
  },
  baue(params) {
    const { n, r1, d, iProzent, vorlageIndex } = params;
    const i = iProzent / 100;
    const zahlungen = Array.from({ length: n }, (_, k) => r1 + k * d);
    const terme = zahlungen.map((rt, k) => rt / Math.pow(1 + i, k + 1));
    const R0 = runde(terme.reduce((s, x) => s + x, 0), KONFIG.nachkommastellen.geld);

    const iLatex = anteilLatexOhneNullen(i);
    const einsetzenLatex = zahlungen
      .map((rt, k) => `${bruch(zahlZuLatex(rt, 0), `(1 + ${iLatex})^{${k + 1}}`)}`)
      .join(' + ');
    const termeHinweis = terme.map((x) => zahlZuLatex(runde(x, 2), 2)).join(' + ');

    return {
      frage: {
        text: VORLAGEN_RENTE_VERAENDERLICH[vorlageIndex](iProzent),
        tabelle: {
          kopf: ['t', 'r_t'],
          zeilen: zahlungen.map((rt, k) => [String(k + 1), String(rt)]),
        },
      },
      eingaben: [
        { id: 'R0', label: 'Rentenbarwert R₀', typ: 'zahl', punkte: 3, loesung: R0, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `R_0 = \\sum_{t=1}^{n} ${bruch('r_t', '(1+i)^t')}`,
            hinweis: 'Jede Zahlung einzeln abzinsen und addieren — die Rentenbarwertfaktor-Formel ' +
              'gilt hier nicht, weil die Zahlungen unterschiedlich hoch sind.',
          },
          { titel: 'Einsetzen', latex: `R_0 = ${einsetzenLatex}`, hinweis: `Einzelwerte: ${termeHinweis}` },
          { titel: 'Ergebnis', latex: `R_0 = ${zahlZuLatex(R0, 2)}` },
        ],
        ergebnisse: [{ label: 'Rentenbarwert R₀', latex: zahlZuLatex(R0, 2) }],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// fin.verdopplungszeit — MK 2a / Übung 1d, 2a
// Formel: K_n = K_0 q^n  =>  n = ln(K_n/K_0) / ln(q)
// ---------------------------------------------------------------------------
const ZINSSAETZE_VERDOPPLUNG = Array.from({ length: 29 }, (_, k) => runde(1 + k * 0.25, 2));

export const verdopplungszeit = {
  id: 'fin.verdopplungszeit',
  teil: 'finanz',
  name: 'Laufzeit bei Zinseszins',
  punkte: 3,
  vorlage: 'Musterklausur 2a / Übung 1d, 2a',
  waehleParameter(rng) {
    const variante = zufallBool(rng) ? 'A' : 'B';
    const iProzent = zufallAus(rng, ZINSSAETZE_VERDOPPLUNG);
    if (variante === 'A') {
      const faktor = zufallAus(rng, [2, 3]);
      return { variante, iProzent, faktor };
    }
    const n = zufallInt(rng, 5, 25);
    const K0 = zufallInt(rng, 1, 50) * 1000;
    return { variante, iProzent, n, K0 };
  },
  baue(params) {
    const { variante, iProzent } = params;
    const i = iProzent / 100;
    const q = 1 + i;
    const qLatex = anteilLatexOhneNullen(q);

    if (variante === 'A') {
      const { faktor } = params;
      const nExakt = Math.log(faktor) / Math.log(q);
      const n = runde(nExakt, KONFIG.nachkommastellen.jahre);
      const verb = faktor === 2 ? 'verdoppeln' : 'verdreifachen';
      return {
        frage: {
          text: `Wie lange braucht eine Kapitalanlage bei Zinseszinsrechnung, um sich bei einem ` +
            `Zins von ${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. zu ${verb}?`,
        },
        eingaben: [
          { id: 'n', label: 'Laufzeit n (Jahre)', typ: 'zahl', punkte: 3, loesung: n, toleranz: KONFIG.toleranz.jahre },
        ],
        loesung: {
          schritte: [
            { titel: 'Formel', latex: `K_n = K_0 \\cdot q^n \\quad \\text{mit } K_n = ${faktor} \\cdot K_0` },
            {
              titel: 'Umstellen',
              latex: `${faktor} = q^n \;\\Rightarrow\; \\ln ${faktor} = n \\cdot \\ln q ` +
                `\;\\Rightarrow\; n = ${bruch(`\\ln ${faktor}`, '\\ln q')}`,
              hinweis: 'Durch K₀ teilen (es kürzt sich heraus), dann beide Seiten logarithmieren ' +
                'und den Exponenten vor den Logarithmus ziehen.',
            },
            { titel: 'Einsetzen', latex: `n = ${bruch(`\\ln ${faktor}`, `\\ln ${qLatex}`)}` },
            { titel: 'Ergebnis', latex: `n = ${zahlZuLatex(n, 2)}\\ \\text{Jahre}` },
          ],
          ergebnisse: [{ label: 'Laufzeit n', latex: `${zahlZuLatex(n, 2)}\\ \\text{Jahre}` }],
        },
        params,
      };
    }

    const { n, K0 } = params;
    const Kn = runde(K0 * Math.pow(q, n), KONFIG.nachkommastellen.geld);
    return {
      frage: {
        text: `Eine Kapitalanlage von ${formatDeZahl(K0, 0)} € wächst bei einem Zinssatz von ` +
          `${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. (Zinseszins) auf ` +
          `${formatDeZahl(Kn, 2)} € an. Wie viele Jahre liegen dazwischen?`,
      },
      eingaben: [
        { id: 'n', label: 'Laufzeit n (Jahre)', typ: 'zahl', punkte: 3, loesung: n, toleranz: KONFIG.toleranz.jahre },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: 'K_n = K_0 \\cdot q^n' },
          {
            titel: 'Umstellen',
            latex: `q^n = ${bruch('K_n', 'K_0')} \;\\Rightarrow\; n = ${bruch(`\\ln(K_n / K_0)`, '\\ln q')}`,
            hinweis: 'Durch K₀ teilen, dann beide Seiten logarithmieren und den Exponenten vor ' +
              'den Logarithmus ziehen.',
          },
          { titel: 'Einsetzen', latex: `n = ${bruch(`\\ln(${zahlZuLatex(Kn, 2)} / ${zahlZuLatex(K0, 0)})`, `\\ln ${qLatex}`)}` },
          { titel: 'Ergebnis', latex: `n \\approx ${n}\\ \\text{Jahre}` },
        ],
        ergebnisse: [{ label: 'Laufzeit n', latex: `${n}\\ \\text{Jahre}` }],
      },
      params: { ...params, Kn },
    };
  },
};

// ---------------------------------------------------------------------------
// fin.effektivzins — MK 2b / Übung 3a, 3b, 3c
// Formel: i_eff = (1 + i_nom/m)^m - 1
// ---------------------------------------------------------------------------
const M12_PROZENTE = [1.2, 2.4, 3, 3.6, 4.8, 6, 7.2];
const M2_PROZENTE = Array.from({ length: 23 }, (_, k) => runde(1 + k * 0.5, 2));

function mText(m) {
  if (m === 2) return 'halbjährlicher';
  if (m === 4) return 'vierteljährlicher';
  return 'monatlicher';
}

export const effektivzins = {
  id: 'fin.effektivzins',
  teil: 'finanz',
  name: 'Effektivzins bei unterjährlicher Verzinsung',
  punkte: 3,
  vorlage: 'Musterklausur 2b / Übung 3a, 3b, 3c',
  waehleParameter(rng) {
    const richtung = zufallBool(rng) ? 'vorwaerts' : 'rueckwaerts';
    const m = zufallAus(rng, [2, 4, 12]);
    let iNomProzent;
    if (m === 12) iNomProzent = zufallAus(rng, M12_PROZENTE);
    else if (m === 4) iNomProzent = zufallInt(rng, 1, 12);
    else iNomProzent = zufallAus(rng, M2_PROZENTE);
    return { richtung, m, iNomProzent };
  },
  baue(params) {
    const { richtung, m, iNomProzent } = params;
    const iNom = iNomProzent / 100;
    const iEffExakt = Math.pow(1 + iNom / m, m) - 1;
    const iEffProzentExakt = iEffExakt * 100;

    if (richtung === 'vorwaerts') {
      const iEff2dp = runde(iEffProzentExakt, 2);
      const iEff4dp = runde(iEffProzentExakt, 4);
      return {
        frage: {
          text: `Eine Kapitalanlage hat einen Nominalzins von ${formatDeZahl(iNomProzent, iNomProzent % 1 === 0 ? 0 : 2)} % ` +
            `p.a. bei ${mText(m)} Verzinsung (m = ${m}). Wie hoch ist der Effektivzins?`,
        },
        eingaben: [
          {
            id: 'iEff', label: 'Effektivzins i_eff (%)', typ: 'zahl', punkte: 3,
            loesung: iEffProzentExakt, toleranz: KONFIG.toleranz.prozentpunkte,
          },
        ],
        loesung: {
          schritte: [
            { titel: 'Formel', latex: `i_{eff} = \\left(1 + ${bruch('i_{nom}', 'm')}\\right)^m - 1` },
            {
              titel: 'Einsetzen',
              latex: `i_{eff} = \\left(1 + ${bruch(prozentLatex(iNom, iNomProzent % 1 === 0 ? 0 : 2), String(m))}\\right)^{${m}} - 1`,
            },
            { titel: 'Ergebnis', latex: `i_{eff} = ${prozentLatex(iEff2dp / 100, 2)}\\ (\\text{genau } ${prozentLatex(iEff4dp / 100, 4)})` },
          ],
          ergebnisse: [
            { label: 'Effektivzins (2 Nachkommastellen)', latex: prozentLatex(iEff2dp / 100, 2) },
            { label: 'Effektivzins (4 Nachkommastellen, Rundungsregel des Dozenten)', latex: prozentLatex(iEff4dp / 100, 4) },
          ],
        },
        params,
      };
    }

    const iEffGegeben = runde(iEffProzentExakt, 4);
    return {
      frage: {
        text: `Eine Kapitalanlage mit ${mText(m)} Verzinsung (m = ${m}) erzielt einen Effektivzins ` +
          `von ${formatDeZahl(iEffGegeben, 4)} % p.a. Wie hoch ist der zugehörige Nominalzins?`,
      },
      eingaben: [
        {
          id: 'iNom', label: 'Nominalzins i_nom (%)', typ: 'zahl', punkte: 3,
          loesung: iNomProzent, toleranz: KONFIG.toleranz.prozentpunkte,
        },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: `i_{eff} = \\left(1 + ${bruch('i_{nom}', 'm')}\\right)^m - 1` },
          {
            titel: 'Umstellen',
            latex: `i_{nom} = \\left(\\left(1 + i_{eff}\\right)^{${bruch('1', 'm')}} - 1\\right) \\cdot m`,
            hinweis: 'Beide Seiten hoch 1/m, dann −1 und mal m.',
          },
          {
            titel: 'Einsetzen',
            latex: `i_{nom} = \\left(\\left(1 + ${prozentLatex(iEffGegeben / 100, 4)}\\right)^{${bruch('1', String(m))}} - 1\\right) \\cdot ${m}`,
          },
          { titel: 'Ergebnis', latex: `i_{nom} = ${zahlZuLatex(iNomProzent, iNomProzent % 1 === 0 ? 0 : 2)}\\ \\%` },
        ],
        ergebnisse: [{ label: 'Nominalzins i_nom', latex: `${zahlZuLatex(iNomProzent, iNomProzent % 1 === 0 ? 0 : 2)}\\ \\%` }],
      },
      params: { ...params, iEffGegeben },
    };
  },
};

export const FINANZ_GENERATOREN = [renteAusKapital, renteVeraenderlich, verdopplungszeit, effektivzins];
