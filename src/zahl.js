// Deutsche Zahlformatierung und -erkennung: Komma als Dezimaltrennzeichen,
// Punkt als optionales Tausendertrennzeichen. "7.782,55" und "7782,55" ergeben
// beide 7782.55; "7782.55" (Punkt als Dezimalzeichen) wird ebenfalls akzeptiert.

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
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Reine Tausendergruppen ohne Dezimalteil, z. B. "1.234.567".
    s = s.replace(/\./g, '');
  }
  // Sonst bleibt ein einzelner Punkt als Dezimalpunkt stehen, z. B. "7782.55".
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

export function runde(zahl, nachkommastellen = 2) {
  const f = Math.pow(10, nachkommastellen);
  return Math.round((zahl + Number.EPSILON) * f) / f;
}

export function nahBei(a, b, toleranz = 1e-9) {
  return Math.abs(a - b) <= toleranz;
}
