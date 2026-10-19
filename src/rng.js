// Seedbasierter Zufallszahlengenerator (mulberry32) und Hilfsfunktionen.
// Deterministisch: derselbe Seed ergibt immer dieselbe Folge — das macht die
// 1.000er-Tests reproduzierbar (siehe PLAN.md, Testkonzept).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function erzeugeSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

// Ganzzahl zwischen min und max, beide Grenzen eingeschlossen.
export function zufallInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function zufallAus(rng, liste) {
  return liste[zufallInt(rng, 0, liste.length - 1)];
}

export function zufallBool(rng, wahrscheinlichkeit = 0.5) {
  return rng() < wahrscheinlichkeit;
}
