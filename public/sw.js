// NanoStudy app-shell service worker.
// It caches only same-origin app assets. Firebase, AI Logic and Firestore
// traffic is never intercepted or stored, so personal study data does not
// linger in the Cache Storage API.
const CACHE = "nanostudy-shell-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/assets/") ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image" ||
    request.destination === "worker"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, then the cached shell for a full offline reload.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/index.html")) || Response.error())
    );
    return;
  }

  // Hashed Vite assets, the bundled PDF.js worker, icons: cache first.
  if (isCacheableAsset(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
