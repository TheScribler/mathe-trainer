// test/fixtures.mjs — ruft baue(params) mit den Originalzahlen aus der
// Musterklausur bzw. den WS22-Übungen auf und vergleicht gegen das bekannte
// Ergebnis. Nur Zahlen, kein Aufgabentext aus den PDFs (siehe CLAUDE.md
// Abschnitt 2). Exportiert testeFixtures(), das die Fehlerzahl zurückgibt.

import { nahBei } from '../src/zahl.js';
import {
  renteAusKapital,
  renteVeraenderlich,
  verdopplungszeit,
  effektivzins,
} from '../src/generatoren/finanz.js';

export function testeFixtures() {
  let fehler = 0;
  const faelle = [];

  function pruefe(bedingung, beschreibung) {
    if (!bedingung) {
      fehler += 1;
      console.error('FIXTURE-FEHLER:', beschreibung);
    }
  }

  // Musterklausur 1 I: R0=100.000, i=2 %, n=15 Jahre -> r=7.782,55 €
  // (identisch mit Übung 5c laut Mathematik Musterklausur.md).
  {
    const a = renteAusKapital.baue({ R0: 100000, iProzent: 2, n: 15, name: 'Platzhalter', vorlageIndex: 0 });
    const r = a.eingaben[0].loesung;
    pruefe(nahBei(r, 7782.55, 0.01), `MK1 I: r=${r}, erwartet 7782.55`);
    faelle.push('MK1 I');
  }

  // Musterklausur 1 II: Zahlungen 50/55/60/65 bei i=10 % -> R0=180,38.
  {
    const a = renteVeraenderlich.baue({ n: 4, r1: 50, d: 5, iProzent: 10, vorlageIndex: 0 });
    const R0 = a.eingaben[0].loesung;
    pruefe(nahBei(R0, 180.38, 0.01), `MK1 II: R0=${R0}, erwartet 180.38`);
    faelle.push('MK1 II');
  }

  // Musterklausur 2a: Verdopplung bei i=4 % -> t=17,67 Jahre.
  {
    const a = verdopplungszeit.baue({ variante: 'A', iProzent: 4, faktor: 2 });
    const n = a.eingaben[0].loesung;
    pruefe(nahBei(n, 17.67, 0.01), `MK2a: n=${n}, erwartet 17.67`);
    faelle.push('MK2a');
  }

  // Musterklausur 2b: i_nom=3 %, m=12 (monatlich) -> i_eff=3,04 % (exakt 3,0416 %).
  {
    const a = effektivzins.baue({ richtung: 'vorwaerts', m: 12, iNomProzent: 3 });
    const iEff = a.eingaben[0].loesung;
    pruefe(nahBei(iEff, 3.0416, 0.0001), `MK2b: i_eff=${iEff}, erwartet ≈3.0416`);
    pruefe(nahBei(Math.round(iEff * 100) / 100, 3.04, 1e-9), `MK2b gerundet: ${Math.round(iEff * 100) / 100}, erwartet 3.04`);
    faelle.push('MK2b');
  }

  // Übung 1d (WS22): K0=1.500 €, i=4 %, Kn=2.921,85 € -> n=17 Jahre.
  {
    const a = verdopplungszeit.baue({ variante: 'B', iProzent: 4, n: 17, K0: 1500 });
    const n = a.eingaben[0].loesung;
    const Kn = a.params.Kn;
    pruefe(n === 17, `Übung 1d: n=${n}, erwartet 17`);
    pruefe(nahBei(Kn, 2921.85, 0.01), `Übung 1d: Kn=${Kn}, erwartet 2921.85`);
    faelle.push('Übung 1d');
  }

  console.log(`Fixtures: ${faelle.length} geprüft (${faelle.join(', ')})`);
  return fehler;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fehler = testeFixtures();
  process.exit(fehler > 0 ? 1 : 0);
}
