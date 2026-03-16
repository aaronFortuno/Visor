/**
 * Visor — Service Worker
 *
 * Strategy: Network-first with offline fallback.
 * - API/WebSocket requests always go to network (never cached)
 * - Static assets (JS, CSS, fonts) are cached on first load
 * - If network fails, serve from cache
 */

const CACHE_NAME = "visor-v2";
const FONTS_CACHE = "visor-fonts-v1";

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/favicon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
  "/offline.html",
];

// ── Install: pre-cache shell ──────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== FONTS_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for everything ───────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip WebSocket upgrades and API calls — always network
  if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/api/")) return;

  // Cache Google Fonts with cache-first strategy
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.open(FONTS_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Skip other cross-origin requests — let browser handle
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Last resort: for navigation, try index.html then offline page
          if (event.request.mode === "navigate") {
            return caches
              .match("/")
              .then((index) => index || caches.match("/offline.html"));
          }
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        });
      })
  );
});
