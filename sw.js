const CACHE_NAME = 'tenis-uct-cache-v29';
const urlsToCache = [
  './',
  'index.html',
  'normas.html',
  'reservas.html',
  'ranking.html',
  'db.js',
  'script.js',
  'style.css',
  'theme.css',
  'site.js',
  'home-live.js',
  'ranking.css',
  'reservas.css',
  'manifest.json',
  'favicon.ico',
  'cec.jpg',
  'cjp.jpg',
  'logo_uctenis_v03.png',
  'fotos/leader_badge.png'
];

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

// Estrategia:
// - Solo se intercepta lo propio (GET del mismo sitio); Firestore, el backend
//   y las fuentes externas van directo a la red sin pasar por aquí.
// - Archivos versionados (?v=...) e imágenes: se sirven al instante desde la
//   caché y se refrescan por detrás. Al cambiar la versión cambia la URL, así
//   que nunca queda un JS/CSS viejo pegado.
// - Páginas y lo demás: red primero (siempre lo último) y caché si no hay red.
const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg|ico)$/i;

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.searchParams.has('v') || IMAGE_RE.test(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached || Response.error());
        if (cached) { event.waitUntil(network); return cached; }
        return network;
      })
    ));
    return;
  }

  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && (req.mode === 'navigate' || url.pathname.endsWith('.html'))) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
