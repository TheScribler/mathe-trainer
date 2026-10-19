// Deutsche Zahlformatierung und -erkennung.
// Regel (festgelegt 2026-10-19): Ein Komma ist immer das Dezimaltrennzeichen —
// alle Punkte davor gelten dann als Tausendertrennzeichen und werden entfernt.
// Ohne Komma ist ein einzelner Punkt der Dezimalpunkt, nicht die
// Tausendergruppierung. Das heißt "1,234" und "1.234" ergeben beide 1,234 —
// zwei Schreibweisen für dieselbe Zahl, keine Mehrdeutigkeit. Mehrere Punkte
// ohne Komma (z. B. "1.234.567") sind damit nicht mehr auflösbar und ergeben
// bewusst NaN statt einer Vermutung.

export function parseDeZahl(eingabe) {
  if (typeof eingabe === 'number') return eingabe;
  let s = String(eingabe).trim();
  if (s === '') return NaN;
  let negativ = false;
  if (s[0] === '-' || s[0] === '−') {
    negativ = true;
    s = s.slice(1);
  }
  s = s.replace(/\s/g, '').replace(/[€%]/g, '');
  if (s.includes(',')) {
    // Komma ist das Dezimaltrennzeichen; Punkte davor sind Tausendertrennzeichen.
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Sonst bleibt ein einzelner Punkt der Dezimalpunkt, z. B. "7782.55" oder "1.234".
  const zahl = Number(s);
  if (!isFinite(zahl)) return NaN;
  return negativ ? -zahl : zahl;
}

export function formatDeZahl(zahl, nachkommastellen = 2) {
  return zahl.toLocaleString('de-DE', {
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen,
  });
}

// Zeigt eine Zahl ohne erzwungene Nachkommastellen an (für "Eingelesen als …"),
// damit genau sichtbar ist, was der Parser gelesen hat — nicht gerundet auf
// eine feste Stellenzahl.
export function formatDeZahlFrei(zahl, maxNachkommastellen = 6) {
  return zahl.toLocaleString('de-DE', { maximumFractionDigits: maxNachkommastellen });
}

export function runde(zahl, nachkommastellen = 2) {
  const f = Math.pow(10, nachkommastellen);
  return Math.round((zahl + Number.EPSILON) * f) / f;
}

export function nahBei(a, b, toleranz = 1e-9) {
  return Math.abs(a - b) <= toleranz;
}
