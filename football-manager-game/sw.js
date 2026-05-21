// Football Manager Chile — Service Worker
// Enables PWA offline support and installability on Android / Desktop

const CACHE_NAME = "fmg-chile-v18";
const STATIC_ASSETS = [
  "./index.html",
  "./css/styles.css",
  "./manifest.json",
  "./assets/favicon.svg",
  "./data/teams.json",
  "./data/players.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  // Network-first for data, cache-first for assets
  const url = new URL(event.request.url);
  if (url.pathname.endsWith(".json") || url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match(event.request);
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        return cached || fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});
