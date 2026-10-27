// Erzeugt von build.mjs am 2026-10-27 22:58 — nicht von Hand bearbeiten.
const CACHE = 'mathe-trainer-202610272258';
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
