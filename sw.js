// Service Worker: macht die App offlinefähig. Strategie „Netz zuerst, Cache als Rückfall“:
// Online wird immer die aktuelle Fassung geladen (und im Cache abgelegt), offline kommt die zuletzt geladene Fassung aus dem Cache.
const CACHE = 'kassenbuch-v5';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/auswertungen.js', 'js/backup.js', 'js/buchung.js', 'js/crypto.js', 'js/db.js', 'js/einstellungen.js', 'js/hilfe.js',
  'js/kassenbuch.js', 'js/kontaktdruck.js', 'js/kontakte.js', 'js/kontaktpick.js', 'js/lock.js', 'js/menu.js', 'js/nav.js', 'js/notizen.js', 'js/periodbar.js', 'js/quittung.js',
  'js/testdata.js', 'js/ui.js', 'js/util.js', 'js/version.js', 'js/xlsx.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Antworten nach Weiterleitung dürfen für Navigationen nicht aus dem Cache geliefert werden (Safari: weisser Screen) -> sauber neu verpacken
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

// Netz mit Zeitlimit: ohne (oder mit hängender) Verbindung nicht ewig warten, sondern auf den Cache zurückfallen
const fetchTimeout = (req, ms = 4000) => new Promise((resolve, reject) => {
  const ctl = new AbortController();
  const t = setTimeout(() => { ctl.abort(); reject(new Error('timeout')); }, ms);
  fetch(req, { cache: 'no-cache', signal: ctl.signal }).then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetchTimeout(req); // immer beim Server nachfragen, damit Updates sofort ankommen
      if (res.ok && res.status === 200) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch {
      if (req.mode === 'navigate') {
        const idx = (await caches.match(req, { ignoreSearch: true })) || (await caches.match('index.html')) || (await caches.match('./'));
        if (idx) return clean(idx);
      }
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return clean(hit);
      return new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
