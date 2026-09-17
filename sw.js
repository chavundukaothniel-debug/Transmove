// ==============================================================================
// TRANSMOVE PROGRESSIVE WEB APP SERVICE WORKER
// Caching Strategy: Static assets cached; all private APIs, JWTs, messages,
// payments, and verification documents strictly BYPASSED from cache.
// ==============================================================================

const CACHE_NAME = "transmove-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/css/style.css",
  "/assets/images/icon.svg"
];

// Install Event - Pre-cache minimal public static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Strict Privacy Filter & Cache Strategy
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Non-GET requests always bypass cache
  if (request.method !== "GET") {
    return;
  }

  // STRICT PRIVACY EXCLUSIONS:
  // Never cache trusted API, Appwrite database/storage calls, messages, payments,
  // verification docs, or auth tokens.
  const isPrivateOrApi =
    url.pathname.includes("/api/") ||
    url.pathname.includes("/.netlify/") ||
    url.pathname.includes("/functions/") ||
    url.hostname.includes("appwrite.io") ||
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("messages") ||
    url.pathname.includes("payments") ||
    url.pathname.includes("verification") ||
    url.pathname.includes("documents") ||
    url.searchParams.has("jwt") ||
    url.searchParams.has("token");

  if (isPrivateOrApi) {
    // Network-only, zero caching
    event.respondWith(fetch(request));
    return;
  }

  // For static assets: Cache-First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch update in background for next time (stale-while-revalidate for local static assets)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        // Cache valid static responses
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});
