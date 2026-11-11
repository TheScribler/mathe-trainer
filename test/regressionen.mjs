// test/regressionen.mjs — Regressionstests zu den zehn Befunden des
// Generator-Reviews (2026-11-11). Jeder Befund wird zuerst mit genau dem Seed
// aus dem Review geprüft (Seeds wie in der App:
// waehleParameter(mulberry32(seed), { erlaubeZusatzvarianten: true })),
// danach über viele Seeds, damit derselbe Fehler nicht mit einem anderen
// Seed zurückkommt. Nur Zahlen und eigene Formulierungen, kein Aufgabentext
// aus den Vorlesungsunterlagen (CLAUDE.md Abschnitt 2).

import { mulberry32 } from '../src/rng.js';
import { runde, formatDeZahl } from '../src/zahl.js';
import { KONFIG } from '../src/konfig.js';
import { pruefeZahlEingabe, eingabenMitZuordnung, bewerteLeerErwartet, bewerteMatrix } from '../src/pruefung.js';
import { findeGenerator } from '../src/generatoren/index.js';
import { effektivzins } from '../src/generatoren/finanz.js';
import { nutzenmaximum, elastizitaet } from '../src/generatoren/diff.js';

const SWEEP = 3000;

function instanz(id, seed) {
  const generator = findeGenerator(id);
  const params = generator.waehleParameter(mulberry32(seed), { erlaubeZusatzvarianten: true });
  return generator.baue(params);
}

function eingabe(aufgabe, id) {
  return aufgabe.eingaben.find((e) => e.id === id);
}

function alleLatex(aufgabe) {
  return aufgabe.loesung.schritte.map((s) => s.latex).join('\n');
}

function alleHinweise(aufgabe) {
  return aufgabe.loesung.schritte.map((s) => s.hinweis ?? '').join('\n');
}

function zahlText(zahl) {
  return String(zahl).replace('.', ',');
}

// Tilgungsplan nach dem Rechenweg der Vorlesung (Folie 62), eigene Schleife:
// ungerundet weiterrechnen, Annuität konstant, erst für die Eingabe runden.
function tilgungsplanVorlesung(p) {
  const i = p.iProzent / 100;
  const q = 1 + i;
  const A = p.art === 'annuitaet' ? (p.K0 * i * q ** p.n) / (q ** p.n - 1) : null;
  let K = p.K0;
  const zeilen = [];
  for (let t = 1; t <= p.n; t++) {
    const Z = K * i;
    const T = p.art === 'raten' ? p.K0 / p.n : A - Z;
    const At = p.art === 'raten' ? Z + T : A;
    zeilen.push([K, Z, T, At].map((w) => zahlText(runde(w, 2))));
    K -= T;
  }
  return zeilen;
}

// Dieselbe Tabelle, aber jede Zeile auf Cent gerundet weitergerechnet.
function tilgungsplanZeilenweiseGerundet(p) {
  const i = p.iProzent / 100;
  const q = 1 + i;
  const A = p.art === 'annuitaet' ? runde((p.K0 * i * q ** p.n) / (q ** p.n - 1), 2) : null;
  let K = p.K0;
  const zeilen = [];
  for (let t = 1; t <= p.n; t++) {
    const Z = runde(K * i, 2);
    const T = p.art === 'raten' ? p.K0 / p.n : (t === p.n ? runde(K, 2) : runde(A - Z, 2));
    const At = p.art === 'raten' ? runde(Z + T, 2) : (t === p.n ? runde(Z + T, 2) : A);
    zeilen.push([K, Z, T, At].map((w) => zahlText(runde(w, 2))));
    K = runde(K - T, 2);
  }
  return zeilen;
}

export function testeReviewRegressionen() {
  let fehler = 0;
  const geprueft = [];
  function pruefe(bedingung, beschreibung) {
    if (!bedingung) {
      fehler += 1;
      console.error('REGRESSION:', beschreibung);
    }
  }

  // Befund 1: Tilgungsplan (Annuität) — der Rechenweg der Vorlesung und der
  // zeilenweise gerundete Weg werden beide in JEDER Zelle als richtig gewertet.
  // Seed 5: K₃ ungerundet 53.716,54 statt 53.716,53; Seed 11: letzte
  // Annuität konstant 59.045,62 statt angepasst 59.045,64.
  {
    let annuitaetsPlaene = 0;
    for (let seed = 1; seed <= SWEEP; seed++) {
      const a = instanz('fin.tilgungsplan', seed);
      const plan = eingabe(a, 'plan');
      for (const [weg, tabelle] of [['Vorlesung', tilgungsplanVorlesung(a.params)], ['zeilenweise gerundet', tilgungsplanZeilenweiseGerundet(a.params)]]) {
        const b = bewerteMatrix(tabelle, plan.loesung, plan.toleranz, plan.alternativLoesungen ?? []);
        const falsch = b.proZelle.flatMap((zeile, t) => zeile.map((z, k) => (z.korrekt ? null : `Jahr ${t + 1} Spalte ${k + 1}: ${tabelle[t][k]}`))).filter(Boolean);
        if (seed === 5 || seed === 11 || falsch.length > 0) {
          pruefe(falsch.length === 0, `Befund 1, fin.tilgungsplan seed=${seed} (${weg}): abgelehnt ${falsch.join('; ')}`);
        }
      }
      if (a.params.art === 'annuitaet') annuitaetsPlaene += 1;
    }
    pruefe(KONFIG.toleranz.tilgungszelle === 0.05, `Befund 1: Toleranz je Tabellenzelle ist ${KONFIG.toleranz.tilgungszelle}, erwartet 0,05`);
    pruefe(annuitaetsPlaene > 0, 'Befund 1: Sweep enthielt keinen Annuitätenplan');
    geprueft.push('Befund 1 (Tilgungsplan, beide Rechenwege)');
  }

  // Befund 6 (Review-Nr. 7): Spalten wie Folie 61 — K_{t−1} ist die Restschuld
  // zu JAHRESBEGINN, Spaltenköpfe und Aufgabentext erklären die Spalten.
  {
    const a = instanz('fin.tilgungsplan', 5);
    const plan = eingabe(a, 'plan');
    pruefe(plan.loesung[0][0] === a.params.K0, `Befund 6, seed=5: erste Zelle ${plan.loesung[0][0]}, erwartet K₀ = ${a.params.K0}`);
    pruefe(plan.loesung[3][0] === 53716.53, `Befund 6, seed=5: K₃ in Zeile 4 ist ${plan.loesung[3][0]}, erwartet 53716,53`);
    pruefe(JSON.stringify(plan.spaltenLabels) === JSON.stringify(['K<sub>t−1</sub>', 'Z<sub>t</sub>', 'T<sub>t</sub>', 'A<sub>t</sub>']) && plan.spaltenLabelsHtml,
      `Befund 6, seed=5: Spaltenköpfe ${JSON.stringify(plan.spaltenLabels)}`);
    const erklaerung = (a.frage.teile ?? []).map((t) => t.textHtml ?? t.text ?? '').join(' ');
    pruefe(erklaerung.includes('Restschuld zu Beginn') && erklaerung.includes('Zinsen') && erklaerung.includes('Tilgung') && erklaerung.includes('Annuität'),
      `Befund 6, seed=5: Aufgabe erklärt die Spalten nicht: "${erklaerung}"`);
    pruefe(!/S_\{/.test(alleLatex(a)), 'Befund 6, seed=5: Lösung nutzt noch die alte S-Notation statt K');
    for (let seed = 1; seed <= SWEEP; seed++) {
      const b = instanz('fin.tilgungsplan', seed);
      const l = eingabe(b, 'plan').loesung;
      if (l[0][0] !== b.params.K0) pruefe(false, `Befund 6, seed=${seed}: erste Spalte beginnt nicht mit K₀`);
      for (let t = 1; t < l.length; t++) {
        if (Math.abs(l[t][0] - runde(l[t - 1][0] - l[t - 1][2], 2)) > 1e-9) pruefe(false, `Befund 6, seed=${seed}: K_${t} ≠ K_${t - 1} − T_${t}`);
      }
    }
    geprueft.push('Befund 6 (Tilgungsplan-Spalten)');
  }

  // Befund 4: Zinssatz als Prozentzahl ODER als Dezimalzahl (Vorlesung:
  // 4 Nachkommastellen) — Seed 7: 12,36 % = 0,1236.
  {
    const a = instanz('fin.effektivzins', 7);
    const e = eingabe(a, 'iEff');
    for (const [text, soll] of [['12,36', true], ['0,1236', true], ['0,123600', true], ['12,37', false], ['0,1237', false], ['1236', false]]) {
      pruefe(pruefeZahlEingabe(e, text).korrekt === soll, `Befund 4, fin.effektivzins seed=7: "${text}" korrekt=${!soll}, erwartet ${soll}`);
    }
    const mk2b = effektivzins.baue({ richtung: 'vorwaerts', m: 12, iNomProzent: 3 });
    for (const [text, soll] of [['3,04', true], ['0,0304', true], ['0,030416', true], ['0,0305', false]]) {
      pruefe(pruefeZahlEingabe(mk2b.eingaben[0], text).korrekt === soll, `Befund 4, MK2b: "${text}" erwartet ${soll}`);
    }
    for (let seed = 1; seed <= SWEEP; seed++) {
      const b = instanz('fin.effektivzins', seed);
      const f = b.eingaben[0];
      const dezimal = zahlText(runde(f.loesung / 100, 4));
      if (!f.zinssatz || !pruefeZahlEingabe(f, dezimal).korrekt || !pruefeZahlEingabe(f, zahlText(f.loesung)).korrekt) {
        pruefe(false, `Befund 4, fin.effektivzins seed=${seed}: ${f.id} akzeptiert ${zahlText(f.loesung)} oder ${dezimal} nicht`);
      }
    }
    geprueft.push('Befund 4 (Zinssatz in % oder dezimal)');
  }

  // Befund 9: zwei stationäre Punkte in beliebiger Reihenfolge — Seed 3.
  {
    for (let seed = 1; seed <= SWEEP; seed++) {
      const a = instanz('diff.extremwerte-2var', seed);
      const w = Object.fromEntries(a.eingaben.map((e) => [e.id, e.loesung]));
      const text = (v) => (typeof v === 'number' ? zahlText(v) : v);
      const vertauscht = {
        p1x: text(w.p2x), p1y: text(w.p2y), p1typ: w.p2typ, p1wert: text(w.p2wert),
        p2x: text(w.p1x), p2y: text(w.p1y), p2typ: w.p1typ, p2wert: text(w.p1wert),
      };
      const gerade = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, text(v)]));
      for (const [name, werte] of [['vertauscht', vertauscht], ['gerade', gerade]]) {
        const bewertet = eingabenMitZuordnung(a, werte);
        const falsch = bewertet.filter((e) => (e.typ === 'auswahl' ? werte[e.id] !== e.loesung : !pruefeZahlEingabe(e, werte[e.id]).korrekt));
        if (seed === 3 || falsch.length > 0) {
          pruefe(falsch.length === 0, `Befund 9, diff.extremwerte-2var seed=${seed} (${name}): falsch bewertet ${falsch.map((e) => e.id).join(', ')}`);
        }
      }
      // Ein gemischt falscher Eintrag darf nicht durch den Tausch "richtig" werden.
      const halbFalsch = { ...gerade, p2x: '999' };
      const bewertet = eingabenMitZuordnung(a, halbFalsch);
      const p2x = bewertet.find((e) => e.id === 'p2x');
      if (pruefeZahlEingabe(p2x, '999').korrekt) pruefe(false, `Befund 9, seed=${seed}: falscher Wert 999 wird akzeptiert`);
    }
    geprueft.push('Befund 9 (Punkte in beliebiger Reihenfolge)');
  }

  // Befund 5: vollständiger Lagrange-Weg (I: L_x1, II: L_x2, III: L_λ,
  // Elimination wie in der Musterlösung) — Seed 3; dazu P2 = 1 ohne "/1".
  {
    const a = instanz('diff.nutzenmaximum', 3);
    const latex = alleLatex(a);
    for (const teil of ['L_{x_1}', 'L_{x_2}', 'L_{\\lambda}', '\\text{I in II: }', 'x_1\\text{ einsetzen: }']) {
      pruefe(latex.includes(teil), `Befund 5, diff.nutzenmaximum seed=3: Lagrange-Schritt "${teil}" fehlt`);
    }
    pruefe(!/\}\{1\}/.test(latex) && !/ \/ 1 /.test(latex), `Befund 5, seed=3 (P₂ = 1): Bruch bzw. Division durch 1 in der Lösung`);
    // MK 5 (nur Zahlen): λ = −10, x₂ = 6, x₁ = 18.
    const mk5 = nutzenmaximum.baue({ x1Stern: 18, x2Stern: 6, P1: 2, P2: 4, gamma: 2, alpha: 8, beta: 4, delta: 8 });
    const mk5Latex = alleLatex(mk5);
    pruefe(mk5Latex.includes('\\lambda = -4 - x_2') && mk5Latex.includes('x_1 = 6 + 2x_2') && mk5Latex.includes('x_2 = 6') && mk5Latex.includes('\\lambda = -10'),
      `Befund 5, MK5: Lagrange-Zwischenergebnisse fehlen oder sind falsch:\n${mk5Latex}`);
    for (let seed = 1; seed <= SWEEP; seed++) {
      const b = instanz('diff.nutzenmaximum', seed);
      const p = b.params;
      const l = alleLatex(b);
      // Unabhängig: das 3×3-LGS der Lagrange-Bedingungen per Einsetzen lösen.
      const Y = p.P1 * p.x1Stern + p.P2 * p.x2Stern;
      const x2 = (Y - p.P1 * ((p.P2 * p.alpha - p.P1 * p.beta) / (p.P1 * p.gamma))) / (2 * p.P2);
      if (Math.abs(x2 - p.x2Stern) > 1e-9 || !l.includes(`x_2 = ${p.x2Stern}`) || !l.includes('L_{\\lambda}')) {
        pruefe(false, `Befund 5, diff.nutzenmaximum seed=${seed}: Lagrange-Weg unvollständig oder x₂=${x2} ≠ ${p.x2Stern}`);
      }
    }
    geprueft.push('Befund 5 (Lagrange-Weg)');
  }

  // Befund 7 (Review-Nr. 6): Elastizität mit p(x), beide Wege der Vorlesung,
  // manchmal Preis p₁ statt Menge x₀ — Seed 1.
  {
    const a = instanz('diff.elastizitaet', 1);
    pruefe(a.frage.text.includes('p(x) =') && !a.frage.text.includes('f(x)'), `Befund 7, seed=1: Funktion heißt nicht p(x): "${a.frage.text}"`);
    const latex = alleLatex(a);
    pruefe(latex.includes("x'(p)") && latex.includes("\\dfrac{1}{p'(x) \\cdot \\dfrac{x}{p}}"), `Befund 7, seed=1: Weg 1 oder Weg 2 fehlt:\n${latex}`);
    pruefe(alleHinweise(a).includes('Weg 1') && alleHinweise(a).includes('Weg 2'), 'Befund 7, seed=1: Wege nicht benannt');
    // Übung 17a mit gegebenem Preis (nur Zahlen): p = 100 − 10x, p₁ = 50 -> x₁ = 5, ε = −1.
    const u17a = elastizitaet.baue({ variante: 0, a: 100, b: 10, x0: 5, gegeben: 'p' });
    pruefe(u17a.eingaben[0].loesung === -1 && u17a.frage.text.includes('p₁ = 50') && alleLatex(u17a).includes('x_1 = 5'),
      `Befund 7, Übung 17a (Preis gegeben): ε=${u17a.eingaben[0].loesung}, Text "${u17a.frage.text}"`);
    let mitPreis = 0;
    let mitMenge = 0;
    for (let seed = 1; seed <= SWEEP; seed++) {
      const b = instanz('diff.elastizitaet', seed);
      if (b.params.variante !== 0) continue;
      if (b.params.gegeben === 'p') mitPreis += 1; else mitMenge += 1;
      const p1 = b.params.a - b.params.b * b.params.x0;
      // Unabhängig über Weg 1: x(p) = (a − p)/b, x'(p) = −1/b.
      const epsWeg1 = (-1 / b.params.b) * (p1 / ((b.params.a - p1) / b.params.b));
      if (Math.abs(epsWeg1 - b.eingaben[0].loesung) > 1e-6 || !b.frage.text.includes('p(x) =')) {
        pruefe(false, `Befund 7, seed=${seed}: ε=${b.eingaben[0].loesung}, Weg 1 ergibt ${epsWeg1}`);
      }
    }
    pruefe(mitPreis > 0 && mitMenge > 0, `Befund 7: Variante p(x) hatte ${mitPreis}× Preis und ${mitMenge}× Menge gegeben, erwartet beides`);
    geprueft.push('Befund 7 (Elastizität p(x), Weg 1/2)');
  }

  // Befund 3 und 2: kein Zahlencheck nahe 0 (Seeds 187, 10) und kein
  // Quotient, der sich zu einer Konstante kürzt (Seed 21).
  {
    for (let seed = 1; seed <= SWEEP; seed++) {
      const a = instanz('diff.ableitungen', seed);
      const p = a.params;
      const nahNull = a.eingaben.filter((e) => e.typ === 'zahl' && Math.abs(e.loesung) < 0.5);
      if ([187, 10].includes(seed) || nahNull.length > 0) {
        pruefe(nahNull.length === 0, `Befund 3, diff.ableitungen seed=${seed}: Zahlencheck ${nahNull.map((e) => `${e.id}=${e.loesung}`).join(', ')} liegt zu nah an 0`);
      }
      for (const e of a.eingaben.filter((x) => x.typ === 'zahl')) {
        if (pruefeZahlEingabe(e, '0').korrekt || pruefeZahlEingabe(e, zahlText(-e.loesung)).korrekt) {
          pruefe(false, `Befund 3, seed=${seed}: ${e.id}=${e.loesung} akzeptiert 0 oder das falsche Vorzeichen`);
        }
      }
      const konstant = p.variante === 1 && p.m * p.q - p.n * p.p === 0;
      if (seed === 21 || konstant) pruefe(!konstant, `Befund 2, diff.ableitungen seed=${seed}: Quotient kürzt sich zu einer Konstante ${JSON.stringify(p)}`);
    }
    geprueft.push('Befund 3 (Zahlencheck ≥ 0,5)', 'Befund 2 (kein konstanter Quotient)');
  }

  // Befund 8: Das Inversen-Feld ist immer da; bei singulärem A ist "leer
  // lassen" richtig — Seed 7.
  {
    const a = instanz('alg.determinante-inverse', 7);
    const inv = eingabe(a, 'inv');
    pruefe(a.eingaben.find((e) => e.id === 'det').loesung === 0 && inv && inv.leerErwartet,
      `Befund 8, alg.determinante-inverse seed=7: singuläre Matrix ohne Inversen-Feld`);
    pruefe(bewerteLeerErwartet([['', ''], ['', '']]).korrekt === true, 'Befund 8: leeres Feld bei singulärem A muss richtig sein');
    pruefe(bewerteLeerErwartet([['1', ''], ['', '']]).korrekt === false, 'Befund 8: ausgefüllte Inverse bei singulärem A muss falsch sein');
    const formFelder = (b) => b.eingaben.map((e) => `${e.id}:${e.typ}:${e.zeilen ?? ''}x${e.spalten ?? ''}:${e.punkte}`).join('|');
    let singulaer = 0;
    let regulaer = 0;
    let formRegulaer = null;
    let formSingulaer = null;
    for (let seed = 1; seed <= SWEEP; seed++) {
      const b = instanz('alg.determinante-inverse', seed);
      if (!eingabe(b, 'inv')) pruefe(false, `Befund 8, seed=${seed}: kein Inversen-Feld`);
      if (eingabe(b, 'det').loesung === 0) { singulaer += 1; formSingulaer = formFelder(b); } else { regulaer += 1; formRegulaer = formFelder(b); }
    }
    pruefe(singulaer > 0 && regulaer > 0 && formSingulaer === formRegulaer,
      `Befund 8: Formular unterscheidet sich zwischen regulär (${formRegulaer}) und singulär (${formSingulaer})`);
    geprueft.push('Befund 8 (Inversen-Feld immer da)');
  }

  // Befund 10: gerundete Einzelwerte, die nicht exakt zum Ergebnis summieren,
  // werden erklärt — Seed 2 (Summe 298,85, Ergebnis 298,84).
  {
    const a = instanz('fin.rente-veraenderlich', 2);
    pruefe(alleHinweise(a).includes('298,85') && alleHinweise(a).includes('ungerundeten'),
      `Befund 10, fin.rente-veraenderlich seed=2: Rundungsdifferenz nicht erklärt: "${alleHinweise(a)}"`);
    for (let seed = 1; seed <= SWEEP; seed++) {
      const b = instanz('fin.rente-veraenderlich', seed);
      const p = b.params;
      const i = p.iProzent / 100;
      let summe = 0;
      for (let t = 1; t <= p.n; t++) summe += runde((p.r1 + (t - 1) * p.d) / (1 + i) ** t, 2);
      summe = runde(summe, 2);
      const R0 = b.eingaben[0].loesung;
      if (Math.abs(summe - R0) > 1e-9 && !alleHinweise(b).includes(formatDeZahl(summe, 2))) {
        pruefe(false, `Befund 10, seed=${seed}: Einzelwerte ergeben ${summe}, Ergebnis ${R0}, ohne Erklärung`);
      }
      if (!pruefeZahlEingabe(b.eingaben[0], zahlText(summe)).korrekt) pruefe(false, `Befund 10, seed=${seed}: Summe der gerundeten Werte ${summe} wird abgelehnt`);
    }
    geprueft.push('Befund 10 (Rundungsdifferenz erklärt)');
  }

  console.log(`Review-Regressionen: ${geprueft.length} Befunde geprüft (${geprueft.join(', ')}), je ${SWEEP} Seeds`);
  return fehler;
}
