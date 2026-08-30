/**
 * Gymlic service worker.
 *
 * The one invariant this file must keep: nothing tenant-scoped is ever
 * written to a cache. The panel is multi-tenant behind Supabase RLS, so a
 * cached HTML document or API payload could be replayed to the next account
 * signed in on the same device — a data leak no amount of clearing after the
 * fact fixes reliably. Only build output is stored, which is public and
 * content-hashed.
 *
 * Concretely, everything below falls through to the network untouched:
 *   - Supabase (and any other origin), so no authenticated payload is stored
 *   - navigations, which return the tenant's rendered HTML
 *   - Next.js RSC payloads (/dashboard?_rsc=...), which carry the same data
 *
 * Keep it that way. Adding a rule that caches any of those re-opens the leak.
 */

const CACHE_VERSION = "v1";
const ASSET_CACHE = `gymlic-assets-${CACHE_VERSION}`;
const OFFLINE_CACHE = `gymlic-offline-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Content-hashed build output and the installed app's icons. A new deploy
// changes these URLs, so a cached entry is never stale — it is only ever
// unreferenced, and the activate handler drops it with its cache version.
const ASSET_PREFIXES = ["/_next/static/", "/icons/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      // A single self-contained file, so caching it is enough to guarantee it
      // renders — see the note in public/offline.html. cache: "reload"
      // bypasses the HTTP cache, so a stale copy can't become the offline
      // page for this version's whole lifetime.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      // Safe to activate immediately: no HTML is cached, so an open page can
      // never be served a document from a previous version.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([ASSET_CACHE, OFFLINE_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("gymlic-") && !keep.has(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first with an offline fallback. The document itself is never
  // stored, so a signed-in page is never replayed to anyone.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL, {
            cacheName: OFFLINE_CACHE,
          });
          return cached ?? Response.error();
        }
      })()
    );
    return;
  }

  if (ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: ASSET_CACHE });
        if (cached) return cached;

        const response = await fetch(request);
        // Only a complete 200 is worth storing; caching a 206 or an error
        // would replay it as a broken asset for the rest of the version.
        if (response.status === 200) {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      })()
    );
  }
});
