#!/usr/bin/env node
// build.mjs — baut docs/index.html, docs/manifest.json, docs/sw.js, docs/icons/*
// aus den Modulen in src/ und dem eingebetteten KaTeX in vendor/katex/.
// Keine Toolchain: reine Textverarbeitung, keine Abhängigkeiten außer Node selbst.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = dirname(fileURLToPath(import.meta.url));
const SRC = join(WURZEL, 'src');
const VENDOR_KATEX = join(WURZEL, 'vendor', 'katex');
const DOCS = join(WURZEL, 'docs');

function lesen(pfad) {
  return readFileSync(pfad, 'utf8');
}

// Ein Zeitstempel, einmal berechnet und für zwei Zwecke genutzt: lesbar als
// sichtbarer Build-Stand unten auf der Seite, und daraus abgeleitet als
// Service-Worker-Cache-Name — beide bleiben dadurch immer zueinander
// nachvollziehbar (lokale Zeit des Build-Rechners, nicht UTC).
function formatiereZeitstempel(datum) {
  const zweistellig = (n) => String(n).padStart(2, '0');
  return `${datum.getFullYear()}-${zweistellig(datum.getMonth() + 1)}-${zweistellig(datum.getDate())} ` +
    `${zweistellig(datum.getHours())}:${zweistellig(datum.getMinutes())}`;
}
const BUILD_ZEITSTEMPEL = formatiereZeitstempel(new Date());
const BUILD_VERSION = BUILD_ZEITSTEMPEL.replace(/[^0-9]/g, '');

// ---------------------------------------------------------------------------
// 1. Module aus src/ zu einem einzigen Skript ohne import/export zusammensetzen.
//    Reihenfolge ist Abhängigkeitsreihenfolge: jedes Modul darf nur Namen aus
//    vorherigen Modulen verwenden.
// ---------------------------------------------------------------------------
const MODUL_REIHENFOLGE = [
  'konfig.js',
  'rng.js',
  'zahl.js',
  'latex.js',
  'pruefung.js',
  'loesung.js',
  'generatoren/finanz.js',
  'generatoren/diff.js',
  'generatoren/integral.js',
  'generatoren/algebra.js',
  'generatoren/index.js',
  'komposer.js',
  'app.js',
];

function entferneModulSyntax(code) {
  return code
    // [\s\S]*? statt .+, damit auch ein mehrzeiliges "import { a, b,\n c }
    // from '...';" komplett entfernt wird — ein einzeiliges ".+" ließ genau
    // das einmal durchrutschen (import.js, Phase 3) und erzeugte im
    // gebauten Bundle ein rohes "import {...}", das im Browser sofort mit
    // einem SyntaxError abbrach.
    .replace(/^import\s[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+(default\s+)?/gm, '');
}

function escapeSchlussTag(code) {
  // Schutz gegen ein eingebettetes "</script", das den <script>-Block vorzeitig
  // beenden würde. In JS ist der escapte Schrägstrich syntaktisch unbedenklich.
  return code.replace(/<\/script/gi, '<\\/script');
}

const appSkriptRoh = MODUL_REIHENFOLGE
  .map((pfad) => `// ---- src/${pfad} ----\n` + entferneModulSyntax(lesen(join(SRC, pfad))))
  .join('\n\n');

const appSkript = `(function () {\n${escapeSchlussTag(appSkriptRoh)}\n})();`;

// ---------------------------------------------------------------------------
// 2. KaTeX einbetten: CSS mit Base64-Fonts (nur woff2, Safari ≥ Mac/iPhone
//    unterstützt das vollständig), dazu das unveränderte katex.min.js.
// ---------------------------------------------------------------------------
function bettewFontsEin(css) {
  let ergebnis = css.replace(
    /,url\(fonts\/[^)]+\.woff\) format\("woff"\),url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g,
    ''
  );
  ergebnis = ergebnis.replace(/url\(fonts\/([^)]+\.woff2)\)/g, (_treffer, dateiname) => {
    const bytes = readFileSync(join(VENDOR_KATEX, 'fonts', dateiname));
    return `url(data:font/woff2;base64,${bytes.toString('base64')})`;
  });
  return ergebnis;
}

const katexCss = bettewFontsEin(lesen(join(VENDOR_KATEX, 'katex.min.css')));
const katexJs = escapeSchlussTag(lesen(join(VENDOR_KATEX, 'katex.min.js')));

if (/<\/style/i.test(katexCss)) {
  throw new Error('katex.min.css enthält "</style" — Build abgebrochen, bitte prüfen.');
}

// ---------------------------------------------------------------------------
// 3. Eigenes Stylesheet
// ---------------------------------------------------------------------------
const stilCss = lesen(join(SRC, 'stil.css'));
if (/<\/style/i.test(stilCss)) {
  throw new Error('stil.css enthält "</style" — Build abgebrochen, bitte prüfen.');
}

// ---------------------------------------------------------------------------
// 4. Icons erzeugen (reines Node, keine Bildbibliothek nötig)
// ---------------------------------------------------------------------------
function crc32(buf) {
  let c;
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xFF;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(typ, daten) {
  const typBuf = Buffer.from(typ, 'ascii');
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typBuf, daten])), 0);
  return Buffer.concat([laenge, typBuf, daten, crcBuf]);
}

function erzeugeIcon(groesse) {
  const hintergrund = [0x1f, 0x7a, 0x3d];
  const vordergrund = [0xfb, 0xfa, 0xf8];
  const rand = Math.round(groesse * 0.16);
  const zeilen = [];
  for (let y = 0; y < groesse; y++) {
    const zeile = Buffer.alloc(1 + groesse * 3);
    zeile[0] = 0; // kein Filter
    for (let x = 0; x < groesse; x++) {
      const innen = x >= rand && x < groesse - rand && y >= rand && y < groesse - rand;
      const farbe = innen ? vordergrund : hintergrund;
      zeile[1 + x * 3] = farbe[0];
      zeile[1 + x * 3 + 1] = farbe[1];
      zeile[1 + x * 3 + 2] = farbe[2];
    }
    zeilen.push(zeile);
  }
  const roh = Buffer.concat(zeilen);
  const idatDaten = deflateSync(roh);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(groesse, 0);
  ihdr.writeUInt32BE(groesse, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // Farbtyp RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const signatur = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signatur,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatDaten),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(DOCS, 'icons'), { recursive: true });
for (const groesse of [180, 192, 512]) {
  writeFileSync(join(DOCS, 'icons', `icon-${groesse}.png`), erzeugeIcon(groesse));
}

// ---------------------------------------------------------------------------
// 5. manifest.json
// ---------------------------------------------------------------------------
const manifest = {
  name: 'Mathe-Trainer Wirtschaftsmathematik',
  short_name: 'Mathe-Trainer',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#fbfaf8',
  theme_color: '#1f7a3d',
  lang: 'de',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
writeFileSync(join(DOCS, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// ---------------------------------------------------------------------------
// 6. Service Worker — ein neuer Cache-Name pro Build erzwingt ein Update.
// ---------------------------------------------------------------------------
const swJs = `// Erzeugt von build.mjs am ${BUILD_ZEITSTEMPEL} — nicht von Hand bearbeiten.
const CACHE = 'mathe-trainer-${BUILD_VERSION}';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NETZ_ZEITLIMIT_MS = 3000;

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  // Netz zuerst: wer online ist, bekommt immer den neuesten Stand (wichtig
  // während der Entwicklung — ein Cache-First-Ansatz hätte sonst nach jedem
  // Build eine veraltete Version weiter ausgeliefert). Bei einer schwachen
  // Zugverbindung kann das Netz aber erreichbar sein und trotzdem minuten-
  // lang hängen, statt sauber zu scheitern — deshalb ein Zeitlimit: wartet
  // das Netz länger als 3 Sekunden, greift sofort der zuletzt erfolgreich
  // geladene Cache, genau wie bei einem echten Fehlschlag (Flugmodus).
  ev.respondWith(
    new Promise((resolve) => {
      let entschieden = false;
      const zeitlimit = setTimeout(() => {
        if (entschieden) return;
        entschieden = true;
        caches.match(ev.request).then(resolve);
      }, NETZ_ZEITLIMIT_MS);

      fetch(ev.request)
        .then((antwort) => {
          const kopie = antwort.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, kopie));
          if (entschieden) return; // Zeitlimit ist schon mit dem Cache beantwortet worden
          entschieden = true;
          clearTimeout(zeitlimit);
          resolve(antwort);
        })
        .catch(() => {
          if (entschieden) return;
          entschieden = true;
          clearTimeout(zeitlimit);
          caches.match(ev.request).then(resolve);
        });
    })
  );
});
`;
writeFileSync(join(DOCS, 'sw.js'), swJs);

// ---------------------------------------------------------------------------
// 7. index.html zusammensetzen
// ---------------------------------------------------------------------------
const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mathe-Trainer">
<meta name="theme-color" content="#1f7a3d">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<title>Mathe-Trainer Wirtschaftsmathematik</title>
<style>
${katexCss}
${stilCss}
</style>
</head>
<body>
<div id="status-leiste"></div>
<main id="app"></main>
<footer class="build-stamp">Version ${BUILD_ZEITSTEMPEL}</footer>
<script>
${katexJs}
</script>
<script>
${appSkript}
</script>
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
</script>
</body>
</html>
`;

mkdirSync(DOCS, { recursive: true });
writeFileSync(join(DOCS, 'index.html'), html);

console.log('gebaut: docs/index.html (' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB)');
console.log('gebaut: docs/manifest.json, docs/sw.js, docs/icons/icon-{180,192,512}.png');
