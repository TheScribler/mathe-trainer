// Finanzmathematik — 4 Generatoren, 12 Punkte zusammen, entspricht Aufgabe 1+2
// der Musterklausur. Jeder Generator konstruiert rückwärts: erst die saubere
// Lösung, dann die Parameter (siehe PLAN.md, Katalog "1 Finanzmathematik").

import { zufallInt, zufallAus, zufallBool } from '../rng.js';
import { runde, formatDeZahl, minimaleNachkommastellen, geldNachkommastellen } from '../zahl.js';
import { zahlZuLatex, bruch, mehrzeiligeKette, mehrzeiligeGleichung } from '../latex.js';
import { KONFIG } from '../konfig.js';

const NAMEN = ['Jana', 'Lena', 'Paul', 'Mara', 'Jonas', 'Nina', 'Felix', 'Sophie', 'Tom', 'Clara'];

// Zeigt einen Dezimalbruch mit so wenigen Nachkommastellen wie möglich (2–6),
// ohne das Ergebnis zu verändern — "0,02" statt "0,0200", aber "0,086806"
// wenn ein 4-Nachkommastellen-Prozentwert (8,6806 %) als Bruch exakt
// dieselbe Genauigkeit behalten muss.
function anteilLatexOhneNullen(anteil) {
  for (let dp = 2; dp <= 6; dp++) {
    if (Math.abs(runde(anteil, dp) - anteil) < 1e-12) return zahlZuLatex(anteil, dp);
  }
  return zahlZuLatex(anteil, 6);
}

// Dieselbe Idee für Prozentwerte in reinem Fließtext (kein LaTeX-Escape, kein
// erzwungener Mindestwert an Nachkommastellen) — "8,16 %" statt "8,1600 %",
// aber auch "4 %" statt "4,00 %".
function prozentOhneNullenProse(prozent) {
  for (let dp = 0; dp <= 4; dp++) {
    if (Math.abs(runde(prozent, dp) - prozent) < 1e-9) return formatDeZahl(prozent, dp);
  }
  return formatDeZahl(prozent, 4);
}

// Hochgestellte Ziffern für Exponenten in reinem Fließtext, z. B. "q" + "25"
// -> "q²⁵" — kein LaTeX-Markup ("q^{25}") außerhalb von Formelfeldern.
const HOCHGESTELLTE_ZIFFERN = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function hochgestelltesExponent(n) {
  return String(n).split('').map((ziffer) => HOCHGESTELLTE_ZIFFERN[Number(ziffer)] ?? ziffer).join('');
}

// Rundungsregel der Vorlesung für Zinssatz-ERGEBNISSE (nicht für gegebene
// Werte in der Aufgabenstellung): Dezimalzahl auf KONFIG.nachkommastellen.
// zinssatzDezimal Nachkommastellen, angezeigt zusammen mit der gleichwertigen
// Prozentzahl — "0,0304 = 3,04 %". Siehe CLAUDE.md Abschnitt 6.
function zinssatzRunden(anteil) {
  return runde(anteil, KONFIG.nachkommastellen.zinssatzDezimal);
}

function zinssatzErgebnisLatex(anteilGerundet) {
  const stellenProzent = KONFIG.nachkommastellen.zinssatzDezimal - 2;
  const prozentGerundet = runde(anteilGerundet * 100, stellenProzent);
  return `${zahlZuLatex(anteilGerundet, KONFIG.nachkommastellen.zinssatzDezimal)} = ` +
    `${zahlZuLatex(prozentGerundet, stellenProzent)}\\%`;
}

function zinssatzRundungsHinweis(anteilExakt, anteilGerundet) {
  const basis = `Rundung laut Vorlesung: Zinssätze als Dezimalzahl auf ` +
    `${KONFIG.nachkommastellen.zinssatzDezimal} Nachkommastellen.`;
  if (Math.abs(anteilGerundet - anteilExakt) < 1e-9) return basis;
  return `${basis} Ungerundet: ${formatDeZahl(anteilExakt, 6)}.`;
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
            hinweis: `Zwischenwert: q${hochgestelltesExponent(n)} = ${formatDeZahl(qn, 6)}`,
          },
          { titel: 'Ergebnis', latex: `r = ${zahlZuLatex(r, geldNachkommastellen(r))}\\ \\text{€}` },
        ],
        ergebnisse: [{ label: 'Jährliche Rente r', latex: `${zahlZuLatex(r, geldNachkommastellen(r))}\\ \\text{€}` }],
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
    `rₜ gegeben. Bei einem Zinssatz von ${formatDeZahl(iProzent, 0)} % p.a.: Wie hoch ist der ` +
    `Rentenbarwert dieser Zahlungsreihe?`,
  (iProzent) => `Eine Zahlungsreihe mit nachschüssigen, von Jahr zu Jahr steigenden Zahlungen rₜ ` +
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
    // Je höchstens 2 Brüche pro Zeile statt aller n (3 bis 5) auf einer
    // Zeile — bei fünf Abzinsungsbrüchen liefen auch drei pro Zeile bei
    // 375px noch rechts ab (iPhone-Rückmeldung, gleiches Muster wie die
    // Sarrus-Zeilen in alg.lgs).
    const einsetzenTeile = zahlungen.map((rt, k) => bruch(zahlZuLatex(rt, 0), `(1 + ${iLatex})^{${k + 1}}`));
    const einsetzenGruppen = [];
    for (let k = 0; k < einsetzenTeile.length; k += 2) einsetzenGruppen.push(einsetzenTeile.slice(k, k + 2));
    const einsetzenLatex = mehrzeiligeKette(
      einsetzenGruppen.map((g, k) => (k === 0 ? `R_0 &= ${g.join(' + ')}` : `&\\quad + ${g.join(' + ')}`))
    );
    // Jeden abgezinsten Einzelwert als eigenen KaTeX-Schritt zeigen statt nur
    // als reinen Fließtext-Hinweis ("Einzelwerte: 462,96 + ...") — "jeder
    // Rechenschritt wird gezeigt" gilt auch für die Einzelwerte selbst
    // (iPhone-Rückmeldung).
    const werteTeile = terme.map((x) => zahlZuLatex(runde(x, 2), minimaleNachkommastellen(runde(x, 2))));
    const werteGruppen = [];
    for (let k = 0; k < werteTeile.length; k += 2) werteGruppen.push(werteTeile.slice(k, k + 2));
    const werteLatex = mehrzeiligeKette(
      werteGruppen.map((g, k) => (k === 0 ? `R_0 &= ${g.join(' + ')}` : `&\\quad + ${g.join(' + ')}`))
    );

    return {
      frage: {
        text: VORLAGEN_RENTE_VERAENDERLICH[vorlageIndex](iProzent),
        tabelle: {
          kopf: ['t', 'rₜ'],
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
          { titel: 'Einsetzen', latex: einsetzenLatex },
          { titel: 'Einsetzen', latex: werteLatex, hinweis: 'Jede Zahlung einzeln abgezinst.' },
          { titel: 'Ergebnis', latex: `R_0 = ${zahlZuLatex(R0, minimaleNachkommastellen(R0))}` },
        ],
        ergebnisse: [{ label: 'Rentenbarwert R₀', latex: zahlZuLatex(R0, minimaleNachkommastellen(R0)) }],
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
              latex: `${faktor} = q^n \\;\\Rightarrow\\; \\ln ${faktor} = n \\cdot \\ln q ` +
                `\\;\\Rightarrow\\; n = ${bruch(`\\ln ${faktor}`, '\\ln q')}`,
              hinweis: 'Durch K₀ teilen (es kürzt sich heraus), dann beide Seiten logarithmieren ' +
                'und den Exponenten vor den Logarithmus ziehen.',
            },
            { titel: 'Einsetzen', latex: `n = ${bruch(`\\ln ${faktor}`, `\\ln ${qLatex}`)}` },
            { titel: 'Ergebnis', latex: `n = ${zahlZuLatex(n, minimaleNachkommastellen(n))}\\ \\text{Jahre}` },
          ],
          ergebnisse: [{ label: 'Laufzeit n', latex: `${zahlZuLatex(n, minimaleNachkommastellen(n))}\\ \\text{Jahre}` }],
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
          `${formatDeZahl(Kn, geldNachkommastellen(Kn))} € an. Wie viele Jahre liegen dazwischen?`,
      },
      eingaben: [
        { id: 'n', label: 'Laufzeit n (Jahre)', typ: 'zahl', punkte: 3, loesung: n, toleranz: KONFIG.toleranz.jahre },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: 'K_n = K_0 \\cdot q^n' },
          {
            titel: 'Umstellen',
            latex: `q^n = ${bruch('K_n', 'K_0')} \\;\\Rightarrow\\; n = ${bruch(`\\ln(K_n / K_0)`, '\\ln q')}`,
            hinweis: 'Durch K₀ teilen, dann beide Seiten logarithmieren und den Exponenten vor ' +
              'den Logarithmus ziehen.',
          },
          { titel: 'Einsetzen', latex: `n = ${bruch(`\\ln(${zahlZuLatex(Kn, minimaleNachkommastellen(Kn))} / ${zahlZuLatex(K0, 0)})`, `\\ln ${qLatex}`)}` },
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

// Adverb statt Adjektiv ("halbjährlich verzinst", nicht "halbjährlicher
// verzinst") — mText() oben bleibt für die Fälle, wo das Wort ein
// nachfolgendes Substantiv beugt ("bei halbjährlicher Verzinsung").
function mTextAdverb(m) {
  if (m === 2) return 'halbjährlich';
  if (m === 4) return 'vierteljährlich';
  return 'monatlich';
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
      const iEffGerundet = zinssatzRunden(iEffExakt);
      const iEffAntwortProzent = runde(iEffGerundet * 100, 2);
      return {
        frage: {
          text: `Eine Kapitalanlage hat einen Nominalzins von ${formatDeZahl(iNomProzent, iNomProzent % 1 === 0 ? 0 : 2)} % ` +
            `p.a. bei ${mText(m)} Verzinsung (m = ${m}). Wie hoch ist der Effektivzins?`,
        },
        eingaben: [
          {
            id: 'iEff', label: 'Effektivzins (%)', typ: 'zahl', punkte: 3,
            loesung: iEffAntwortProzent, toleranz: KONFIG.toleranz.prozentpunkte,
          },
        ],
        loesung: {
          schritte: [
            { titel: 'Formel', latex: `i_{eff} = \\left(1 + ${bruch('i_{nom}', 'm')}\\right)^m - 1` },
            {
              titel: 'Einsetzen',
              latex: `i_{eff} = \\left(1 + ${bruch(anteilLatexOhneNullen(iNom), String(m))}\\right)^{${m}} - 1`,
            },
            {
              titel: 'Ergebnis',
              latex: `i_{eff} = ${zinssatzErgebnisLatex(iEffGerundet)}`,
              hinweis: zinssatzRundungsHinweis(iEffExakt, iEffGerundet),
            },
          ],
          ergebnisse: [{ label: 'Effektivzins', latex: zinssatzErgebnisLatex(iEffGerundet) }],
        },
        params,
      };
    }

    const iEffGegeben = runde(iEffProzentExakt, 4);
    return {
      frage: {
        text: `Eine Kapitalanlage mit ${mText(m)} Verzinsung (m = ${m}) erzielt einen Effektivzins ` +
          `von ${prozentOhneNullenProse(iEffGegeben)} % p.a. Wie hoch ist der zugehörige Nominalzins?`,
      },
      eingaben: [
        {
          id: 'iNom', label: 'Nominalzins (%)', typ: 'zahl', punkte: 3,
          loesung: iNomProzent, toleranz: KONFIG.toleranz.prozentpunkte,
        },
      ],
      loesung: {
        schritte: [
          { titel: 'Formel', latex: `i_{eff} = \\left(1 + ${bruch('i_{nom}', 'm')}\\right)^m - 1` },
          {
            titel: 'Umstellen',
            latex: `i_{nom} = \\left(\\left(1 + i_{eff}\\right)^{1/m} - 1\\right) \\cdot m`,
            hinweis: 'Beide Seiten hoch 1/m, dann −1 und mal m.',
          },
          {
            titel: 'Einsetzen',
            latex: `i_{nom} = \\left(\\left(1 + ${anteilLatexOhneNullen(iEffGegeben / 100)}\\right)^{1/${m}} - 1\\right) \\cdot ${m}`,
          },
          {
            titel: 'Ergebnis',
            latex: `i_{nom} = ${zinssatzErgebnisLatex(zinssatzRunden(iNom))}`,
            hinweis: zinssatzRundungsHinweis(iNom, zinssatzRunden(iNom)),
          },
        ],
        ergebnisse: [{ label: 'Nominalzins', latex: zinssatzErgebnisLatex(zinssatzRunden(iNom)) }],
      },
      params: { ...params, iEffGegeben },
    };
  },
};

// ---------------------------------------------------------------------------
// fin.verzinsung-grundformen — Formelsammlung 1.1/1.4, Übung 1, Übung 4e
// Drei Grundformen: einfache (lineare) Verzinsung Kn=K0(1+i·n), unterjährliche
// Verzinsung Kn=K0(1+i/m)^(n·m), stetige Verzinsung Kn=K0·e^(i·n).
// Zusatzthema (Phase 6) — in der Probeklausur standardmäßig aus.
// ---------------------------------------------------------------------------
const GRUNDFORMEN_M_POOL = [2, 4, 12];

export const verzinsungGrundformen = {
  id: 'fin.verzinsung-grundformen',
  teil: 'finanz',
  name: 'Einfache, unterjährliche und stetige Verzinsung',
  punkte: 3,
  vorlage: 'Formelsammlung 1.1/1.4, Übung 1, Übung 4e',
  zusatz: true,
  waehleParameter(rng) {
    const art = zufallAus(rng, ['einfach', 'unterjaehrig', 'stetig']);
    const K0 = zufallInt(rng, 2, 50) * 1000;
    const iProzent = zufallAus(rng, [2, 3, 4, 5, 6, 8]);
    const n = zufallInt(rng, 3, 10);
    if (art === 'unterjaehrig') {
      const m = zufallAus(rng, GRUNDFORMEN_M_POOL);
      return { art, K0, iProzent, n, m };
    }
    return { art, K0, iProzent, n };
  },
  baue(params) {
    const { art, K0, iProzent, n } = params;
    const i = iProzent / 100;
    const iLatex = anteilLatexOhneNullen(i);

    if (art === 'einfach') {
      const Kn = runde(K0 * (1 + i * n), KONFIG.nachkommastellen.geld);
      const faktor = runde(1 + i * n, minimaleNachkommastellen(1 + i * n) > 6 ? 6 : minimaleNachkommastellen(1 + i * n));
      return {
        titel: 'Einfache Verzinsung',
        frage: {
          text: `Ein Kapital von ${formatDeZahl(K0, 0)} € wird ${n} Jahre lang zu einem Zinssatz von ` +
            `${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. einfach (linear) verzinst. ` +
            `Wie hoch ist das Endkapital Kₙ?`,
        },
        eingaben: [
          { id: 'Kn', label: 'Endkapital Kₙ', typ: 'zahl', punkte: 3, loesung: Kn, toleranz: KONFIG.toleranz.geld },
        ],
        loesung: {
          schritte: [
            { titel: 'Formel', latex: `K_n = K_0 \\cdot (1 + i \\cdot n)`, hinweis: 'Einfache (lineare) Verzinsung: die Zinsen jedes Jahres beziehen sich immer auf das ursprüngliche Kapital K₀, nicht auf das bereits verzinste.' },
            {
              titel: 'Einsetzen',
              latex: mehrzeiligeGleichung('K_n', [
                `${zahlZuLatex(K0, 0)} \\cdot (1 + ${iLatex} \\cdot ${n})`,
                `${zahlZuLatex(K0, 0)} \\cdot ${zahlZuLatex(faktor, minimaleNachkommastellen(faktor))}`,
                `${zahlZuLatex(Kn, geldNachkommastellen(Kn))}\\ \\text{€}`,
              ]),
            },
          ],
          ergebnisse: [{ label: 'Endkapital Kₙ', latex: `${zahlZuLatex(Kn, geldNachkommastellen(Kn))}\\ \\text{€}` }],
        },
        params,
      };
    }

    if (art === 'unterjaehrig') {
      const { m } = params;
      const j = i / m;
      const s = n * m;
      const Kn = runde(K0 * Math.pow(1 + j, s), KONFIG.nachkommastellen.geld);
      const jLatex = anteilLatexOhneNullen(j);
      const faktor = runde(Math.pow(1 + j, s), 6);
      return {
        titel: 'Unterjährliche Verzinsung',
        frage: {
          text: `Ein Kapital von ${formatDeZahl(K0, 0)} € wird ${n} Jahre lang bei einem Nominalzins von ` +
            `${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. ${mTextAdverb(m)} verzinst (m = ${m}). ` +
            `Wie hoch ist das Endkapital Kₙ?`,
        },
        eingaben: [
          { id: 'Kn', label: 'Endkapital Kₙ', typ: 'zahl', punkte: 3, loesung: Kn, toleranz: KONFIG.toleranz.geld },
        ],
        loesung: {
          schritte: [
            {
              titel: 'Formel',
              latex: `K_n = K_0 \\cdot \\left(1 + ${bruch('i', 'm')}\\right)^{n \\cdot m}`,
              hinweis: `Je Zinsperiode wird nur der anteilige Zinssatz i/m verzinst, dafür über n·m = ${s} Perioden statt n Jahre.`,
            },
            {
              titel: 'Einsetzen',
              latex: mehrzeiligeGleichung('K_n', [
                `${zahlZuLatex(K0, 0)} \\cdot \\left(1 + ${jLatex}\\right)^{${s}}`,
                `${zahlZuLatex(K0, 0)} \\cdot ${zahlZuLatex(faktor, minimaleNachkommastellen(faktor))}`,
                `${zahlZuLatex(Kn, geldNachkommastellen(Kn))}\\ \\text{€}`,
              ]),
            },
          ],
          ergebnisse: [{ label: 'Endkapital Kₙ', latex: `${zahlZuLatex(Kn, geldNachkommastellen(Kn))}\\ \\text{€}` }],
        },
        params,
      };
    }

    // stetig
    const Kn = runde(K0 * Math.exp(i * n), KONFIG.nachkommastellen.geld);
    const expFaktor = runde(Math.exp(i * n), 6);
    return {
      titel: 'Stetige Verzinsung',
      frage: {
        text: `Ein Kapital von ${formatDeZahl(K0, 0)} € wird ${n} Jahre lang stetig (kontinuierlich) zu einem ` +
          `Zinssatz von ${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. verzinst. Wie hoch ist das Endkapital Kₙ?`,
      },
      eingaben: [
        { id: 'Kn', label: 'Endkapital Kₙ', typ: 'zahl', punkte: 3, loesung: Kn, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: `K_n = K_0 \\cdot e^{i \\cdot n}`,
            hinweis: 'Grenzfall der unterjährlichen Verzinsung für m → ∞: statt endlich vieler Zinsperioden wird ununterbrochen verzinst.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeGleichung('K_n', [
              `${zahlZuLatex(K0, 0)} \\cdot e^{${iLatex} \\cdot ${n}}`,
              `${zahlZuLatex(K0, 0)} \\cdot ${zahlZuLatex(expFaktor, minimaleNachkommastellen(expFaktor))}`,
              `${zahlZuLatex(Kn, geldNachkommastellen(Kn))}\\ \\text{€}`,
            ]),
          },
        ],
        ergebnisse: [{ label: 'Endkapital Kₙ', latex: `${zahlZuLatex(Kn, geldNachkommastellen(Kn))}\\ \\text{€}` }],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// fin.endwert-rente — Übung 5a (nachschüssig), Übung 6a (vorschüssig)
// Rn = r (q^n-1)/(q-1), vorschüssig: Rn = r' q (q^n-1)/(q-1)
// Zusatzthema (Phase 6) — in der Probeklausur standardmäßig aus.
// ---------------------------------------------------------------------------
const ENDWERT_R_POOL = [1000, 1500, 2000, 2500, 3000, 4000, 5000];

export const endwertRente = {
  id: 'fin.endwert-rente',
  teil: 'finanz',
  name: 'Rentenendwert nach- und vorschüssig',
  punkte: 3,
  vorlage: 'Übung 5a, Übung 6a',
  zusatz: true,
  waehleParameter(rng) {
    const variante = zufallBool(rng) ? 'nachschuessig' : 'vorschuessig';
    const r = zufallAus(rng, ENDWERT_R_POOL);
    const iProzent = zufallAus(rng, [2, 2.5, 3, 4, 5]);
    const n = zufallInt(rng, 5, 25);
    return { variante, r, iProzent, n };
  },
  baue(params) {
    const { variante, r, iProzent, n } = params;
    const i = iProzent / 100;
    const q = 1 + i;
    const qn = Math.pow(q, n);
    const qnGerundet = runde(qn, 6);
    const qLatex = anteilLatexOhneNullen(q);
    const vorschuessig = variante === 'vorschuessig';
    const faktor = runde((qn - 1) / (q - 1), 6);
    const Rn = runde((vorschuessig ? r * q : r) * (qn - 1) / (q - 1), KONFIG.nachkommastellen.geld);

    const zahlungText = vorschuessig
      ? `vorschüssige (zu Beginn jedes Jahres fällige) jährliche Zahlungen r' = ${formatDeZahl(r, 0)} €`
      : `nachschüssige (am Ende jedes Jahres fällige) jährliche Zahlungen r = ${formatDeZahl(r, 0)} €`;

    const formel = vorschuessig
      ? `R_n = r' \\cdot q \\cdot ${bruch('q^n - 1', 'q - 1')}`
      : `R_n = r \\cdot ${bruch('q^n - 1', 'q - 1')}`;

    // Jeder Teilschritt einzeln ausgerechnet, bevor er weiterverwendet wird:
    // erst q^n, dann der Bruch daraus, erst dann mit r (bzw. r'·q) multipliziert
    // (iPhone-Rückmeldung: direkt vom Bruch mit q^n zum Endwert zu springen
    // ließ die Zwischenwerte fehlen).
    const letzteZeile = vorschuessig
      ? `R_n = ${zahlZuLatex(r, 0)} \\cdot ${qLatex} \\cdot ${zahlZuLatex(faktor, minimaleNachkommastellen(faktor))} = ${zahlZuLatex(Rn, geldNachkommastellen(Rn))}\\ \\text{€}`
      : `R_n = ${zahlZuLatex(r, 0)} \\cdot ${zahlZuLatex(faktor, minimaleNachkommastellen(faktor))} = ${zahlZuLatex(Rn, geldNachkommastellen(Rn))}\\ \\text{€}`;

    return {
      titel: vorschuessig ? 'Rentenendwert (vorschüssig)' : 'Rentenendwert (nachschüssig)',
      frage: {
        text: `Über ${n} Jahre werden bei einem Zinssatz von ${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. ` +
          `${zahlungText} in einen Sparplan eingezahlt. Wie hoch ist der Rentenendwert nach ${n} Jahren?`,
      },
      eingaben: [
        { id: 'Rn', label: 'Rentenendwert Rₙ', typ: 'zahl', punkte: 3, loesung: Rn, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: formel,
            hinweis: vorschuessig
              ? 'Vorschüssig: jede Zahlung liegt ein Jahr früher als nachschüssig, verzinst sich also ein Jahr länger — darum der zusätzliche Faktor q.'
              : 'Jede der n Zahlungen verzinst sich bis zum Ende der Laufzeit unterschiedlich lange — die geometrische Reihe dieser Endwerte ergibt diese Formel.',
          },
          {
            titel: 'Einsetzen',
            latex: mehrzeiligeKette([
              `q^n = ${qLatex}^{${n}} = ${zahlZuLatex(qnGerundet, minimaleNachkommastellen(qnGerundet))}`,
              `${bruch('q^n - 1', 'q - 1')} = ${bruch(`${zahlZuLatex(qnGerundet, minimaleNachkommastellen(qnGerundet))} - 1`, `${qLatex} - 1`)} = ${zahlZuLatex(faktor, minimaleNachkommastellen(faktor))}`,
              letzteZeile,
            ]),
          },
        ],
        ergebnisse: [{ label: 'Rentenendwert Rₙ', latex: `${zahlZuLatex(Rn, geldNachkommastellen(Rn))}\\ \\text{€}` }],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// fin.ewige-rente — Übung 7a (nachschüssig), Übung 7b (vorschüssig)
// R0 = r/i, vorschüssig: R0 = r' + r'/i
// Zusatzthema (Phase 6) — in der Probeklausur standardmäßig aus.
// ---------------------------------------------------------------------------
const EWIGE_RENTE_R_POOL = [10000, 20000, 25000, 30000, 40000, 50000];

export const ewigeRente = {
  id: 'fin.ewige-rente',
  teil: 'finanz',
  name: 'Barwert einer ewigen Rente',
  punkte: 2,
  vorlage: 'Übung 7a, Übung 7b',
  zusatz: true,
  waehleParameter(rng) {
    const variante = zufallBool(rng) ? 'nachschuessig' : 'vorschuessig';
    const r = zufallAus(rng, EWIGE_RENTE_R_POOL);
    const iProzent = zufallAus(rng, [2, 2.5, 4, 5, 8, 10]);
    return { variante, r, iProzent };
  },
  baue(params) {
    const { variante, r, iProzent } = params;
    const i = iProzent / 100;
    const iLatex = anteilLatexOhneNullen(i);
    const vorschuessig = variante === 'vorschuessig';
    const rDurchI = runde(r / i, KONFIG.nachkommastellen.geld);
    const R0 = runde(vorschuessig ? r + r / i : r / i, KONFIG.nachkommastellen.geld);

    return {
      titel: vorschuessig ? 'Ewige Rente (vorschüssig)' : 'Ewige Rente (nachschüssig)',
      frage: {
        text: `Eine ${vorschuessig ? 'vorschüssige' : 'nachschüssige'} jährliche Zahlung von ${formatDeZahl(r, 0)} € ` +
          `soll unbegrenzt (als ewige Rente) bei einem Zinssatz von ${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. ` +
          `fließen. Wie hoch ist der heutige Barwert R₀?`,
      },
      eingaben: [
        { id: 'R0', label: 'Barwert R₀', typ: 'zahl', punkte: 2, loesung: R0, toleranz: KONFIG.toleranz.geld },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: vorschuessig ? `R_0 = r' + ${bruch("r'", 'i')}` : `R_0 = ${bruch('r', 'i')}`,
            hinweis: vorschuessig
              ? "Vorschüssig: die erste Zahlung r' fließt sofort (unabgezinst), erst ab der zweiten Zahlung wirkt die ewige Rentenformel r'/i."
              : 'Grenzwert des Rentenbarwerts für n → ∞: die abgezinsten Zahlungen summieren sich zu dieser geometrischen Reihe.',
          },
          {
            titel: 'Einsetzen',
            // Bei vorschüssig erst r'/i für sich ausrechnen, bevor r' addiert
            // wird (iPhone-Rückmeldung: direkt "r' + r'/i = Ergebnis" ließ
            // diesen Zwischenschritt fehlen).
            latex: vorschuessig
              ? mehrzeiligeGleichung('R_0', [
                `${zahlZuLatex(r, 0)} + ${bruch(zahlZuLatex(r, 0), iLatex)}`,
                `${zahlZuLatex(r, 0)} + ${zahlZuLatex(rDurchI, minimaleNachkommastellen(rDurchI))}`,
                `${zahlZuLatex(R0, geldNachkommastellen(R0))}\\ \\text{€}`,
              ])
              : `R_0 = ${bruch(zahlZuLatex(r, 0), iLatex)} = ${zahlZuLatex(R0, geldNachkommastellen(R0))}\\ \\text{€}`,
          },
        ],
        ergebnisse: [{ label: 'Barwert R₀', latex: `${zahlZuLatex(R0, geldNachkommastellen(R0))}\\ \\text{€}` }],
      },
      params,
    };
  },
};

// ---------------------------------------------------------------------------
// fin.tilgungsplan — Übung 8 (Folien 57ff)
// Ratentilgung: Tilgung konstant = K0/n, Zinsen_t = Restschuld_{t-1}·i.
// Annuitätentilgung: Annuität konstant = K0·q^n·i/(q^n-1), Tilgung_t =
// Annuität - Zinsen_t. Beide: Restschuld_t = Restschuld_{t-1} - Tilgung_t.
// Zusatzthema (Phase 6) — in der Probeklausur standardmäßig aus.
// ---------------------------------------------------------------------------
function baueTilgungstabelle(art, K0, i, n) {
  const q = 1 + i;
  const annuitaetKonstant = art === 'annuitaet' ? runde(K0 * Math.pow(q, n) * i / (Math.pow(q, n) - 1), 2) : null;
  const tilgungKonstant = art === 'raten' ? K0 / n : null;

  const zeilen = [];
  let restschuld = K0;
  let letzteAnnuitaetAngepasst = false;
  for (let jahr = 1; jahr <= n; jahr++) {
    const restschuldStart = restschuld;
    const zinsen = runde(restschuld * i, 2);
    let tilgung;
    let annuitaet;
    if (art === 'raten') {
      tilgung = tilgungKonstant;
      annuitaet = runde(zinsen + tilgung, 2);
    } else if (jahr === n) {
      // Letztes Jahr: Tilgung exakt auf die noch offene Restschuld setzen,
      // statt die über die Jahre konstant gehaltene Annuität weiter
      // anzuwenden — sonst bleibt durch die jährliche Rundung auf den Cent
      // (Zinsen, Annuität je einzeln gerundet) ein winziger Rest stehen,
      // und die Restschuld am Ende wäre nicht exakt 0.
      tilgung = runde(restschuldStart, 2);
      annuitaet = runde(zinsen + tilgung, 2);
      if (Math.abs(annuitaet - annuitaetKonstant) > 1e-9) letzteAnnuitaetAngepasst = true;
    } else {
      tilgung = runde(annuitaetKonstant - zinsen, 2);
      annuitaet = annuitaetKonstant;
    }
    restschuld = runde(restschuldStart - tilgung, 2);
    zeilen.push({ jahr, restschuldStart, restschuldEnde: restschuld, zinsen, tilgung, annuitaet });
  }
  return { zeilen, letzteAnnuitaetAngepasst };
}

export const tilgungsplan = {
  id: 'fin.tilgungsplan',
  teil: 'finanz',
  name: 'Tilgungsplan: Raten- und Annuitätentilgung',
  punkte: 4,
  vorlage: 'Übung 8 / Folien 57ff',
  zusatz: true,
  waehleParameter(rng) {
    const art = zufallBool(rng) ? 'raten' : 'annuitaet';
    const n = zufallAus(rng, [3, 4]);
    const iProzent = zufallAus(rng, [4, 5, 6, 7, 8, 10]);
    if (art === 'raten') {
      // K0 durch n teilbar wählen, damit die konstante Tilgung glatt ist.
      const tilgungProJahr = zufallAus(rng, [1000, 2000, 2500, 5000, 10000]);
      const K0 = tilgungProJahr * n;
      return { art, K0, iProzent, n };
    }
    const K0 = zufallAus(rng, [5, 10, 15, 20, 25, 30]) * 10000;
    return { art, K0, iProzent, n };
  },
  baue(params) {
    const { art, K0, iProzent, n } = params;
    const i = iProzent / 100;
    const q = 1 + i;
    const iLatex = anteilLatexOhneNullen(i);
    const qLatex = anteilLatexOhneNullen(q);
    const { zeilen, letzteAnnuitaetAngepasst } = baueTilgungstabelle(art, K0, i, n);

    const matrixLoesung = zeilen.map((z) => [z.restschuldEnde, z.zinsen, z.tilgung, z.annuitaet]);
    const konstante = art === 'raten' ? zeilen[0].tilgung : zeilen[0].annuitaet;

    // Je Jahr ein eigener, kompakter Block (Z, T bzw. A, S) statt nur Jahr 1
    // vorzurechnen und den Rest zu verschweigen (iPhone-Rückmeldung: "jedes
    // Jahr zeigen, nicht nur Jahr 1"). Die Konstante (T bzw. A) wird einmal
    // vorher hergeleitet, darum in jedem Jahresblock nur noch eingesetzt.
    const jahresSchritte = zeilen.map((z) => {
      const sStart = zahlZuLatex(z.restschuldStart, geldNachkommastellen(z.restschuldStart));
      const zinsenLatex = zahlZuLatex(z.zinsen, geldNachkommastellen(z.zinsen));
      const tilgungLatex = zahlZuLatex(z.tilgung, geldNachkommastellen(z.tilgung));
      const sEnde = zahlZuLatex(z.restschuldEnde, geldNachkommastellen(z.restschuldEnde));
      const dritteZeile = art === 'raten'
        ? `A_{${z.jahr}} &= ${zinsenLatex} + ${tilgungLatex} = ${zahlZuLatex(z.annuitaet, geldNachkommastellen(z.annuitaet))}`
        : `T_{${z.jahr}} &= ${zahlZuLatex(z.annuitaet, geldNachkommastellen(z.annuitaet))} - ${zinsenLatex} = ${tilgungLatex}`;
      const istAngepassteLetzteAnnuitaet = art === 'annuitaet' && z.jahr === n && letzteAnnuitaetAngepasst;
      return {
        titel: 'Einsetzen',
        // "&=" nur vor dem ersten "=" (dem Namen) — richtet Z/A/T/S
        // trotz unterschiedlich langer rechter Seiten aus (iPhone-
        // Rückmeldung).
        latex: mehrzeiligeKette([
          `Z_{${z.jahr}} &= ${sStart} \\cdot ${iLatex} = ${zinsenLatex}`,
          dritteZeile,
          `S_{${z.jahr}} &= ${sStart} - ${tilgungLatex} = ${sEnde}`,
        ]),
        hinweis: `Jahr ${z.jahr} (Restschuld zu Jahresbeginn: ${formatDeZahl(z.restschuldStart, geldNachkommastellen(z.restschuldStart))} €).` +
          (istAngepassteLetzteAnnuitaet ? ' Letzte Annuität um Rundungsdifferenz angepasst.' : ''),
      };
    });

    return {
      titel: `Tilgungsplan: ${art === 'raten' ? 'Ratentilgung' : 'Annuitätentilgung'}`,
      frage: {
        text: `Ein Kredit über ${formatDeZahl(K0, 0)} € wird über ${n} Jahre bei einem Zinssatz von ` +
          `${formatDeZahl(iProzent, iProzent % 1 === 0 ? 0 : 2)} % p.a. per ${art === 'raten' ? 'Ratentilgung (konstante Tilgung)' : 'Annuitätentilgung (konstante Annuität)'} ` +
          `getilgt. Stellen Sie den Tilgungsplan für die Jahre 1 bis ${n} auf.`,
      },
      eingaben: [
        {
          id: 'plan', label: `Tilgungsplan, Jahre 1–${n}`,
          typ: 'matrix', zeilen: n, spalten: 4, punkte: 4, loesung: matrixLoesung,
          toleranz: KONFIG.toleranz.tilgungszelle,
          // Ein Block je Jahr (2×2: S/Z oben, T/A unten) statt eines
          // durchgehenden n×4-Gitters — bei großen Beträgen passten nicht
          // genug Spalten nebeneinander auf 375px (iPhone-Rückmeldung).
          // loesung bleibt dieselbe n×4-Form, nur die Darstellung ändert
          // sich (siehe istJahresraster in app.js).
          jahresraster: {
            titel: zeilen.map((z) => `Jahr ${z.jahr}`),
            feldBeschriftungen: ['S', 'Z', 'T', 'A'],
          },
        },
      ],
      loesung: {
        schritte: [
          {
            titel: 'Formel',
            latex: art === 'raten'
              ? mehrzeiligeKette([
                `T = ${bruch('K_0', 'n')} \\quad (\\text{jedes Jahr gleich})`,
                `Z_t = S_{t-1} \\cdot i, \\quad A_t = Z_t + T, \\quad S_t = S_{t-1} - T`,
              ])
              : mehrzeiligeKette([
                `A = K_0 \\cdot ${bruch('q^n \\cdot i', 'q^n - 1')} \\quad (\\text{jedes Jahr gleich})`,
                `Z_t = S_{t-1} \\cdot i, \\quad T_t = A - Z_t, \\quad S_t = S_{t-1} - T_t`,
              ]),
            hinweis: art === 'raten'
              ? 'Bei der Ratentilgung ist die Tilgung T jedes Jahr gleich hoch — Zinsen und damit Annuität sinken, weil die Restschuld S sinkt.'
              : 'Bei der Annuitätentilgung ist die gesamte jährliche Zahlung A gleich hoch — der Tilgungsanteil steigt, weil der Zinsanteil mit sinkender Restschuld fällt.',
          },
          {
            titel: 'Einsetzen',
            latex: art === 'raten'
              ? `T = ${bruch(zahlZuLatex(K0, 0), String(n))} = ${zahlZuLatex(konstante, geldNachkommastellen(konstante))}`
              : `A = ${zahlZuLatex(K0, 0)} \\cdot ${bruch(`${qLatex}^{${n}} \\cdot ${iLatex}`, `${qLatex}^{${n}} - 1`)} = ${zahlZuLatex(konstante, geldNachkommastellen(konstante))}`,
            hinweis: art === 'raten'
              ? 'Die Tilgung T ist jedes Jahr gleich — einmal berechnet, in jedem Jahresblock unten nur noch eingesetzt.'
              : 'Die Annuität A ist jedes Jahr gleich — einmal berechnet, in jedem Jahresblock unten nur noch eingesetzt.',
          },
          ...jahresSchritte,
          {
            // Statt einer 5-spaltigen Tabelle (lief bei großen Beträgen über
            // den Bildschirmrand, letzte Spalte "Annuität" abgeschnitten —
            // iPhone-Rückmeldung) jedes Jahr auf zwei schmaleren Zeilen:
            // S/Z zusammen, T/A zusammen.
            titel: 'Ergebnis',
            latex: mehrzeiligeKette(
              zeilen.flatMap((z) => [
                `\\text{Jahr } ${z.jahr}:\\ S=${zahlZuLatex(z.restschuldEnde, geldNachkommastellen(z.restschuldEnde))},\\ Z=${zahlZuLatex(z.zinsen, geldNachkommastellen(z.zinsen))}`,
                `\\qquad T=${zahlZuLatex(z.tilgung, geldNachkommastellen(z.tilgung))},\\ A=${zahlZuLatex(z.annuitaet, geldNachkommastellen(z.annuitaet))}`,
              ])
            ),
            hinweis: 'Kleine Cent-Abweichungen durch Rundung je Zeile sind laut Vorlesung zulässig (Toleranz ±0,01 € je Tabellenzelle).',
          },
        ],
        ergebnisse: zeilen.map((z) => ({
          label: `Jahr ${z.jahr}`,
          latex: mehrzeiligeKette([
            `S=${zahlZuLatex(z.restschuldEnde, geldNachkommastellen(z.restschuldEnde))},\\ Z=${zahlZuLatex(z.zinsen, geldNachkommastellen(z.zinsen))}`,
            `T=${zahlZuLatex(z.tilgung, geldNachkommastellen(z.tilgung))},\\ A=${zahlZuLatex(z.annuitaet, geldNachkommastellen(z.annuitaet))}`,
          ]),
        })),
      },
      params,
    };
  },
};

export const FINANZ_GENERATOREN = [renteAusKapital, renteVeraenderlich, verdopplungszeit, effektivzins];
export const FINANZ_ZUSATZ_GENERATOREN = [verzinsungGrundformen, endwertRente, ewigeRente, tilgungsplan];
