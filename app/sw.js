/* Wii Channel Arcade service worker.
 *
 * Two caches with different strategies:
 *   - the app shell is precached so the menu opens instantly and offline;
 *   - emulator cores are large, versioned and immutable, so they get a
 *     cache-first runtime cache filled the first time you boot a game.
 */

const SHELL_CACHE = "wii-arcade-shell-v2";
const CORE_CACHE = "wii-arcade-cores-v1";
const CORE_ORIGIN = "https://cdn.emulatorjs.org";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./play.html",
  "./dolphin.html",
  "./css/wii.css",
  "./js/store.js",
  "./js/systems.js",
  "./js/wii-ui.js",
  "./js/menu.js",
  "./js/play.js",
  "./js/dolphin.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll is all-or-nothing, so add individually: one 404 during
      // development shouldn't stop the whole worker from installing.
      .then((cache) => Promise.all(
        SHELL_ASSETS.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== CORE_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Emulator cores and their assets: serve from cache, fall back to network
  // and stash a copy. These never change for a given version.
  if (url.origin === CORE_ORIGIN) {
    event.respondWith(
      caches.open(CORE_CACHE).then((cache) =>
        cache.match(request).then((hit) => hit || fetch(request).then((response) => {
          if (response && (response.ok || response.type === "opaque")) {
            cache.put(request, response.clone());
          }
          return response;
        }))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App shell: network-first so edits show up immediately, cache as backup.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(
        (hit) => hit || caches.match("./index.html")
      ))
  );
});
