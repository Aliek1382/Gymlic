/**
 * Gymlic service worker.
 *
 * The one invariant this file must keep: no response that carries an
 * account's data is ever written to a cache. The site is a static export, so
 * the HTML documents and RSC payloads served from this origin are the same
 * for everyone — they are an app shell, with no tenant data in them, and are
 * safe to keep so the installed app can open without a connection. All account
 * data comes from the API on another origin, and that is never touched here:
 * it falls through to the network. What the app shows offline is the last
 * synced data persisted by lib/query-persist.ts, which is tied to the signed-in
 * session and wiped at logout.
 *
 * Keep it that way. A rule that caches any cross-origin or authenticated
 * response re-opens the leak.
 */

const CACHE_VERSION = "v2";
const ASSET_CACHE = `gymlic-assets-${CACHE_VERSION}`;
const OFFLINE_CACHE = `gymlic-offline-${CACHE_VERSION}`;
const PAGE_CACHE = `gymlic-pages-${CACHE_VERSION}`;
// With a stored copy to fall back on, a hung connection is treated as offline
// after this long instead of leaving the app on a blank screen.
const NETWORK_TIMEOUT_MS = 4000;
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
      const keep = new Set([ASSET_CACHE, OFFLINE_CACHE, PAGE_CACHE]);
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

function withTrailingSlash(url) {
  const copy = new URL(url.href);
  if (!copy.pathname.endsWith("/") && !copy.pathname.split("/").pop().includes(".")) {
    copy.pathname += "/";
  }
  return copy.href;
}

async function shellResponse(request, url) {
  const cache = await caches.open(PAGE_CACHE);
  const isNavigation = request.mode === "navigate";
  const cached =
    (await cache.match(request)) ??
    (isNavigation ? await cache.match(withTrailingSlash(url)) : undefined);

  try {
    const network = fetch(request);
    network.catch(() => undefined); // a late failure after the timeout is not unhandled
    const response = cached
      ? await Promise.race([
          network,
          new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT_MS)),
        ])
      : await network;

    const type = response.headers.get("content-type") || "";
    const storable =
      response.status === 200 &&
      response.type === "basic" &&
      (isNavigation ? type.includes("text/html") : true);
    if (storable) {
      // A response that followed a redirect can't answer a navigation, so it
      // is stored as a fresh copy under the URL it ended at.
      const copy = response.redirected
        ? new Response(await response.clone().blob(), {
            status: 200,
            headers: response.headers,
          })
        : response.clone();
      await cache.put(response.redirected ? response.url : request, copy);
    }
    return response;
  } catch {
    if (cached) return cached;
    if (isNavigation) {
      const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
      return offline ?? Response.error();
    }
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: documents and the router's RSC payloads. Network-first so a
  // new deploy is picked up as soon as there is a connection; the last good
  // copy answers when there is none. Only a plain 200 is stored.
  const isRsc = url.searchParams.has("_rsc") || request.headers.has("RSC");
  if (request.mode === "navigate" || isRsc) {
    event.respondWith(shellResponse(request, url));
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

// Web Push. The payload ({ title, body, url }) is only ever shown, never
// stored: nothing tenant-scoped goes into a cache here either.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "جیم‌لیک", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "fa",
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        // navigate() is missing on some clients; focusing alone still beats a duplicate window.
        if ("navigate" in open) await open.navigate(target).catch(() => undefined);
        return open.focus();
      }
      return self.clients.openWindow(target);
    })()
  );
});
