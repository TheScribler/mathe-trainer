// Erzeugt von build.mjs am 2026-11-11 18:02 — nicht von Hand bearbeiten.
const VERSION = '202611111802';
const CACHE = 'mathe-trainer-' + VERSION;
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

// Die Seite fragt beim Start und bei jeder Rückkehr in die App nach der
// Version des aktiven Service Workers. Ist er neuer als die angezeigte
// Seite, erscheint der Hinweis "Neue Version verfügbar – neu laden".
self.addEventListener('message', (ev) => {
  if (ev.data === 'version' && ev.source) ev.source.postMessage({ typ: 'version', version: VERSION });
});

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  if (new URL(ev.request.url).origin !== self.location.origin) return;
  // Netz zuerst: wer online ist, bekommt immer den neuesten Stand. Bei einer
  // schwachen Zugverbindung kann das Netz aber erreichbar sein und trotzdem
  // minutenlang hängen, statt sauber zu scheitern — deshalb ein Zeitlimit:
  // wartet das Netz länger als 3 Sekunden, greift der zuletzt erfolgreich
  // geladene Cache (gibt es dort nichts, wird weiter auf das Netz gewartet).
  ev.respondWith(
    new Promise((resolve) => {
      let entschieden = false;
      const zeitlimit = setTimeout(() => {
        caches.match(ev.request).then((treffer) => {
          if (entschieden || !treffer) return;
          entschieden = true;
          resolve(treffer);
        });
      }, NETZ_ZEITLIMIT_MS);

      // cache: 'no-cache' — am HTTP-Cache des Browsers vorbei beim Server
      // nachfragen (per ETag, meist nur ein kurzes "304 unverändert").
      // GitHub Pages schickt "Cache-Control: max-age=600"; ohne das bekam
      // die Home-Bildschirm-App nach einem Push noch bis zu 10 Minuten die
      // alte index.html aus dem HTTP-Cache, obwohl "Netz zuerst" galt.
      fetch(ev.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((antwort) => {
          if (antwort.ok) {
            const kopie = antwort.clone();
            caches.open(CACHE).then((c) => c.put(ev.request, kopie));
          }
          if (entschieden) return; // Zeitlimit ist schon mit dem Cache beantwortet worden
          entschieden = true;
          clearTimeout(zeitlimit);
          resolve(antwort);
        })
        .catch(() => {
          clearTimeout(zeitlimit);
          caches.match(ev.request).then((treffer) => {
            if (entschieden) return;
            entschieden = true;
            resolve(treffer || Response.error());
          });
        });
    })
  );
});
