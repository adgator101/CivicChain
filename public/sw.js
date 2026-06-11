/* CivicChain service worker — offline app shell for the complaint flow.
 *
 * Strategy (kept deliberately simple for reliability):
 *   - Precache the offline report route + core icons on install.
 *   - Navigations: network-first, fall back to the cached page when offline so
 *     the citizen can still open the form with no connection.
 *   - Next.js build assets (/_next/static): cache-first (they're content-hashed).
 *   - Never cache API / server-action POSTs — the outbox (IndexedDB) owns those.
 *
 * Submission queueing + sync lives in the page (src/lib/offline/*), not here, so
 * the photo blobs and form data survive even a full app close.
 */
const VERSION = "civicchain-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const PRECACHE_URLS = [
  "/offline-report",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // Don't fail the whole install if one URL 404s during dev.
        Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; let POSTs / server actions hit the network untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations → network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ||
            (await caches.match("/offline-report")) ||
            (await caches.match("/offline.html")) ||
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        })
    );
    return;
  }

  // Hashed build assets → cache-first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }
});

// Lets the page ask a freshly-installed SW to take over immediately.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
