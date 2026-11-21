// App-shell only. AI requests and Firestore data are never cached here,
// so personal study data does not linger in the service worker cache.
const CACHE = "smart-study-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  // Network-first navigation, with the cached shell as the offline fallback.
  event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
});
