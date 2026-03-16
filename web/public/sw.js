/**
 * Visor — Service Worker
 *
 * Strategy: Network-first with offline fallback.
 * - API/WebSocket requests always go to network (never cached)
 * - Static assets (JS, CSS, fonts) are cached on first load
 * - If network fails, serve from cache
 */

const CACHE_NAME = "visor-v1";

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/favicon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
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

  // Skip cross-origin requests (fonts CDN, etc.) — let browser handle
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
          // Last resort: return the cached index.html for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        });
      })
  );
});
