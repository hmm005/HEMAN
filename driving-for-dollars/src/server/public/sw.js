const CACHE_NAME = 'd4d-v1';
const STATIC_ASSETS = [
  '/',
  '/css/app.css',
  '/js/app.js',
  '/js/map.js',
  '/js/properties.js',
  '/js/skipTrace.js',
  '/js/routes.js',
  '/manifest.json'
];

// Cache static assets on install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Clean old caches on activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls: always try network first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Map tiles: cache with network fallback
  if (url.hostname.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open('map-tiles').then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            cache.put(e.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Static assets: cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
