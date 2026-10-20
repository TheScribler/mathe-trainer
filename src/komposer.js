import { zufallAus } from './rng.js';

// Stellt für den Punkte-Split in KONFIG.punkte (oder einem Preset) je Teil
// eine Teilmenge der Generatoren dieses Teils zusammen, deren Punkte exakt
// die Zielsumme treffen (jeder Generator höchstens einmal — eine Teilmenge
// kann ihn ohnehin nur einmal enthalten). Findet sich keine exakte
// Kombination, wird die mit der kleinsten Abweichung genommen und das in
// der Rückgabe (`exakt: false`) vermerkt, statt die Klausur zu verweigern.

// 2^n Teilmengen einer Liste — n ist je Teil klein (höchstens rund fünf
// Generatoren), Brute-Force reicht, kein Rucksack-Algorithmus nötig.
function alleTeilmengen(liste) {
  let ergebnis = [[]];
  for (const eintrag of liste) {
    ergebnis = ergebnis.concat(ergebnis.map((teil) => [...teil, eintrag]));
  }
  return ergebnis;
}

function summePunkte(generatoren) {
  return generatoren.reduce((s, g) => s + g.punkte, 0);
}

function waehleKombination(rng, generatoren, ziel) {
  if (ziel === 0) return { generatoren: [], summe: 0, exakt: true };

  const teilmengen = alleTeilmengen(generatoren).filter((t) => t.length > 0);
  const treffer = teilmengen.filter((t) => summePunkte(t) === ziel);
  if (treffer.length > 0) {
    return { generatoren: zufallAus(rng, treffer), summe: ziel, exakt: true };
  }

  // Keine exakte Kombination: kleinste Abweichung wählen, bei Gleichstand
  // zufällig unter den Bestplatzierten.
  let besteAbweichung = Infinity;
  let beste = [];
  for (const t of teilmengen) {
    const abweichung = Math.abs(summePunkte(t) - ziel);
    if (abweichung < besteAbweichung) {
      besteAbweichung = abweichung;
      beste = [t];
    } else if (abweichung === besteAbweichung) {
      beste.push(t);
    }
  }
  const gewaehlt = zufallAus(rng, beste);
  return { generatoren: gewaehlt, summe: summePunkte(gewaehlt), exakt: summePunkte(gewaehlt) === ziel };
}

// punkteSplit: { finanz: 12, diff: 24, integral: 12, algebra: 12 } (oder ein
// Preset daraus). generatorenNachTeil: { finanz: [...], diff: [...], ... }.
// Rückgabe: ein Array, ein Eintrag je Teil, in der Reihenfolge der Schlüssel
// von punkteSplit — { teil, ziel, summe, exakt, generatoren }.
export function komponiereKlausur(punkteSplit, generatorenNachTeil, rng) {
  const teile = [];
  for (const teilName of Object.keys(punkteSplit)) {
    const ziel = punkteSplit[teilName];
    const kandidaten = generatorenNachTeil[teilName] || [];
    const { generatoren, summe, exakt } = waehleKombination(rng, kandidaten, ziel);
    teile.push({ teil: teilName, ziel, summe, exakt, generatoren });
  }
  return teile;
}
