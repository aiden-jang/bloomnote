// Minimal service worker: enough for installability and an offline app shell.
// bloomnote's API lives under /api/*, so that traffic always goes to the
// network and is never cached (garden reads/writes must stay fresh).

// A new cache also clears private navigation metadata saved by older shells.
const CACHE = 'bloomnote-v3';
const SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.cache === 'no-store') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (/^\/(?:api|og)(?:\/|$)/.test(url.pathname)) return;
  if (request.method !== 'GET') return;

  // Only the public homepage can replace the offline shell; gift HTML carries private metadata.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (url.pathname === SHELL && res.ok && res.headers.get('content-type')?.includes('text/html')) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(SHELL, copy)));
          }
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  const immutable = url.pathname.startsWith('/assets/') && /-[\w-]{8,}\./.test(url.pathname);
  const fromNetwork = () => fetch(request, immutable ? undefined : { cache: 'no-cache' }).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      event.waitUntil(caches.open(CACHE).then((c) => c.put(request, copy)));
    }
    return res;
  });
  event.respondWith(immutable
    ? caches.match(request).then((hit) => hit || fromNetwork())
    : fromNetwork().catch(() => caches.match(request)));
});
