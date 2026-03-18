const CACHE_NAME = 'fandaharana-v1';
const urlsToCache = [
  './index.html',
  './dashboard.html',
  './admin.html',
  './css/style.css',
  './js/config.js',
  './js/auth.js',
  './js/schedule.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retourne le cache si trouvé
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
