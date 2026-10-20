// Ippuku POS service worker.
// - Never touches /api/*: orders, payments and sessions always go to the network.
// - Hashed build assets (/_next/static) are cache-first; they never change for a given URL.
// - Pages are network-first, falling back to the last copy, then to /offline.html.
// Bump VERSION to drop old caches after a change to this file.
const VERSION = "v1";
const STATIC_CACHE = `ipk-static-${VERSION}`;
const PAGE_CACHE = `ipk-pages-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

// A dev/LAN address (next dev, or `next start` on the Mac). Dev chunk names don't change with their
// content, so cache-first would keep serving old code — and a crash in that old code stops the app
// from ever unregistering us. Here the worker removes itself instead, then reloads open pages.
const LOCAL = /^(localhost|\[::1\])$|^(127|10)\.\d|^192\.168\.\d|\.local$/.test(self.location.hostname);

self.addEventListener("install", (event) => {
  if (LOCAL) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  if (LOCAL) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ipk-")).map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: "window" }))
        .then((wins) => wins.forEach((w) => w.navigate(w.url).catch(() => {}))),
    );
    return;
  }
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ipk-") && ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (LOCAL) return; // straight to the network
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/offline.html"))),
    );
  }
});
