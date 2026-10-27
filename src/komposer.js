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

// Für die Mini-Klausur aus dem Übungsfilter (app.js): derselbe Zweck wie
// waehleKombination oben, aber über einen potenziell viel größeren,
// ungruppierten Pool (bis zu allen Generatoren, nicht nur die vier/fünf
// eines einzelnen Teils) UND mit bis zu maxVorkommen Vorkommen je Generator
// statt höchstens einem — reicht der Pool bei einfacher Verwendung nicht an
// das Ziel heran, darf jeder Typ ein zweites Mal mit neuen Zahlen auftreten.
// 2^(maxVorkommen·n) Teilmengen wären bei alleTeilmengen()/waehleKombination
// für einen Pool dieser Größe nicht mehr praktikabel — stattdessen eine
// Teilmengensummen-Suche per dynamischer Programmierung über die
// erreichbaren Summen (Komplexität ~ Slots × Zielbereich, nicht
// exponentiell in der Anzahl der Generatoren).
export function waehleKombinationMitWiederholung(generatoren, ziel, maxVorkommen = 2) {
  if (generatoren.length === 0 || ziel === 0) return { generatoren: [], summe: 0, exakt: ziel === 0 };

  // Jeder Generator liefert bis zu maxVorkommen "Slots" — für die Summen-
  // bildung zählt nur seine Punktzahl, welcher Generator dahintersteht wird
  // separat über slot.gi verfolgt (für die Rückverfolgung nach der Suche).
  const slots = [];
  generatoren.forEach((g, gi) => {
    for (let k = 0; k < maxVorkommen; k++) slots.push({ gi, punkte: g.punkte });
  });

  // Alles jenseits einer großzügigen Obergrenze kann nie die beste (zum
  // Ziel nächste) Summe sein — Abweichung wächst für Summen > ziel streng
  // monoton weiter, es reicht also, nur wenig über das Ziel hinaus zu
  // verfolgen.
  const obergrenze = ziel * 2 + 20;
  let erreichbar = new Map([[0, []]]);
  slots.forEach((slot, si) => {
    const neu = new Map(erreichbar);
    for (const [summe, gewaehlt] of erreichbar) {
      const neueSumme = summe + slot.punkte;
      if (neueSumme > obergrenze || neu.has(neueSumme)) continue;
      neu.set(neueSumme, [...gewaehlt, si]);
    }
    erreichbar = neu;
  });

  let besteSumme = 0;
  let besteAbweichung = Infinity;
  for (const summe of erreichbar.keys()) {
    const abweichung = Math.abs(summe - ziel);
    if (abweichung < besteAbweichung) { besteAbweichung = abweichung; besteSumme = summe; }
  }
  const gewaehlteGeneratoren = erreichbar.get(besteSumme).map((si) => generatoren[slots[si].gi]);
  return { generatoren: gewaehlteGeneratoren, summe: besteSumme, exakt: besteSumme === ziel };
}
