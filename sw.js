const CACHE_NAME = 'fandaharana-v2'; // Changé à v2 pour forcer la mise à jour
const urlsToCache = [
  './',
  './index.html',
  './dashboard.html',
  './admin.html',
  './css/style.css',
  './js/config.js',
  './js/auth.js',
  './js/schedule.js',
  './icon.png'
];

self.addEventListener('install', event => {
  // Force le nouveau Service Worker à s'installer immédiatement
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Supprime les vieux caches (comme v1) lors de l'activation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prend le contrôle immédiat des clients
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // STRATÉGIE NETWORK-FIRST (Toujours demander internet d'abord, sinon utiliser le cache hors ligne)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre à jour le cache silencieusement
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
