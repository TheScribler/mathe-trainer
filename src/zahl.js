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

  // Bruch-Eingabe ("2/3", "-1/4" — das führende Vorzeichen ist oben schon
  // abgetrennt). Zähler und Nenner laufen durch denselben Parser, damit sie
  // selbst wieder Komma/Punkt-Schreibweisen oder ein eigenes Vorzeichen haben
  // dürfen (z. B. "6/-4"), ohne die Logik zu verdoppeln.
  if (s.includes('/')) {
    const teile = s.split('/');
    if (teile.length !== 2) return NaN;
    const zaehler = parseDeZahl(teile[0]);
    const nenner = parseDeZahl(teile[1]);
    if (!isFinite(zaehler) || !isFinite(nenner) || nenner === 0) return NaN;
    const wert = zaehler / nenner;
    return negativ ? -wert : wert;
  }

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

// Wie viele Nachkommastellen eine Zahl mindestens braucht, um sie exakt
// darzustellen (bis zu maxStellen) — Grundlage für "ohne überflüssige
// Nullen"-Anzeigen wie in finanz.js (anteilLatexOhneNullen,
// prozentOhneNullenProse) und für polynomLatex (latex.js).
export function minimaleNachkommastellen(zahl, maxStellen = 4) {
  for (let dp = 0; dp <= maxStellen; dp++) {
    if (Math.abs(runde(zahl, dp) - zahl) < 1e-9) return dp;
  }
  return maxStellen;
}

// Eigene Regel für Geldbeträge, abweichend von minimaleNachkommastellen:
// ein glatter Betrag zeigt 0 Nachkommastellen ("68.000 €"), ein unglatter
// IMMER genau 2 — nie 1 (minimaleNachkommastellen hätte 48733,2 mit nur
// einer Nachkommastelle gezeigt statt der bei Geld üblichen zwei,
// "48.733,20 €") und nie mehr als 2 (Geld wird immer auf den Cent
// gerundet, siehe CLAUDE.md Abschnitt 6 — ungerundete Zwischenwerte
// gehören hier ohnehin nicht her).
export function geldNachkommastellen(zahl) {
  return Number.isInteger(runde(zahl, 2)) ? 0 : 2;
}

// Größter gemeinsamer Teiler (immer ≥ 0) — Grundlage fürs Kürzen von Brüchen
// (bruchGekuerzt/bruchMitDezimal in latex.js, Integralrechnung).
export function ggT(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}
