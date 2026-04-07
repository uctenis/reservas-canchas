const CACHE_NAME = 'tenis-uct-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  'normas.html',
  'cec.jpg',
  'cjp.jpg',
  'logo192.png',
  'logo512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto y archivos principales guardados');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en el caché, lo devuelve.
        if (response) {
          return response;
        }
        // Si no, lo busca en la red.
        return fetch(event.request);
      })
  );
});