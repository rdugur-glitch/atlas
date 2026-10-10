// Yalnızca statik kabuğu önbelleğe alır. /api isteklerine asla dokunmaz.
const CACHE = 'atlas-shell-v5';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('atlas-shell-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(response => {
      if (response.ok) {
        const copy = response.clone();
        e.waitUntil(caches.open(CACHE).then(cache => cache.put('/', copy)));
      }
      return response;
    }).catch(async () => (await caches.match('/')) || new Response('ATLAS çevrimdışı. Yeniden bağlanıp sayfayı yenileyin.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        e.waitUntil(caches.open(CACHE).then((cache) => cache.put(req, copy)));
      }
      return response;
    })));
  }
});
