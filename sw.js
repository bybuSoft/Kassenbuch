// Service Worker: macht die App offlinefähig. Strategie „Netz zuerst, Cache als Rückfall“:
// Online wird immer die aktuelle Fassung geladen (und im Cache abgelegt), offline kommt die zuletzt geladene Fassung aus dem Cache.
const CACHE = 'kassenbuch-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/auswertungen.js', 'js/backup.js', 'js/buchung.js', 'js/crypto.js', 'js/db.js', 'js/einstellungen.js',
  'js/kassenbuch.js', 'js/kontakte.js', 'js/kontaktpick.js', 'js/lock.js', 'js/menu.js', 'js/nav.js', 'js/periodbar.js',
  'js/testdata.js', 'js/ui.js', 'js/util.js', 'js/version.js', 'js/xlsx.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' }); // immer beim Server nachfragen, damit Updates sofort ankommen
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await caches.match('index.html'); if (idx) return idx; }
      throw new Error('offline');
    }
  })());
});
