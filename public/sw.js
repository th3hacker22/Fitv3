// Development-safe register-only PWA service worker
const CACHE_NAME = "pulse-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through fetch handler for PWA installability
  event.respondWith(fetch(event.request));
});
