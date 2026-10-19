// Rendert loesung.schritte und loesung.ergebnisse in einen Container.
// Nutzt KaTeX (window.katex), das build.mjs als eigenes <script> einbettet.
// Ohne DOM (z. B. unter Node in den Tests) wird dieses Modul nicht aufgerufen —
// die Tests prüfen die Werte aus baue(params) direkt, nicht die Darstellung.

export function renderLoesung(loesung, container) {
  container.innerHTML = '';
  const liste = document.createElement('div');
  liste.className = 'loesung-schritte';

  for (const schritt of loesung.schritte) {
    const zeile = document.createElement('div');
    zeile.className = 'loesung-schritt';

    const titel = document.createElement('div');
    titel.className = 'loesung-titel';
    titel.textContent = schritt.titel;
    zeile.appendChild(titel);

    const formel = document.createElement('div');
    formel.className = 'loesung-formel';
    renderFormel(formel, schritt.latex);
    zeile.appendChild(formel);

    if (schritt.hinweis) {
      const hinweis = document.createElement('div');
      hinweis.className = 'loesung-hinweis';
      hinweis.textContent = schritt.hinweis;
      zeile.appendChild(hinweis);
    }

    liste.appendChild(zeile);
  }

  if (loesung.ergebnisse && loesung.ergebnisse.length) {
    const block = document.createElement('div');
    block.className = 'loesung-ergebnisse';
    for (const ergebnis of loesung.ergebnisse) {
      const zeile = document.createElement('div');
      zeile.className = 'loesung-ergebnis-zeile';

      const label = document.createElement('span');
      label.className = 'loesung-ergebnis-label';
      label.textContent = ergebnis.label + ':';
      zeile.appendChild(label);

      const wert = document.createElement('span');
      wert.className = 'loesung-ergebnis-wert';
      renderFormel(wert, ergebnis.latex);
      zeile.appendChild(wert);

      block.appendChild(zeile);
    }
    liste.appendChild(block);
  }

  container.appendChild(liste);
}

function renderFormel(ziel, latex) {
  if (typeof window !== 'undefined' && window.katex) {
    window.katex.render(latex, ziel, { throwOnError: false, displayMode: true });
  } else {
    ziel.textContent = latex;
  }
}
