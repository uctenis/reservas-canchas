const CACHE_NAME = 'tenis-uct-cache-v19';
const urlsToCache = ['./', 'index.html', 'normas.html', 'reservas.html', 'ranking.html', 'cec.jpg', 'cjp.jpg', 'logo_uctenis_v03.png', 'fotos/leader_badge.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  return self.clients.claim();
});

// Network-first: siempre busca en red, cache solo como fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
