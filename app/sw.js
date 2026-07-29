/* Wii Channel Arcade service worker.
 *
 * Two caches with different strategies:
 *   - the app shell is precached so the menu opens instantly and offline;
 *   - emulator cores are large, versioned and immutable, so they get a
 *     cache-first runtime cache filled the first time you boot a game.
 */

const SHELL_CACHE = "wii-arcade-shell-v11";
const CORE_CACHE = "wii-arcade-cores-v1";
const CORE_ORIGIN = "https://cdn.emulatorjs.org";

/* Registered as sw.js?coi=1 when Heavy Systems is on. In that mode every
   response is stamped with the cross-origin isolation headers on its way
   through, which is what lets the threaded cores (PSP, 3DS, DOS) get a
   SharedArrayBuffer on a static host. See js/isolation.js. */
const COI = new URL(self.location.href).searchParams.get("coi") === "1";

function isolate(response) {
  if (!COI || !response) return response;
  // An opaque response has no readable body or headers to copy, so it has to
  // be passed through untouched; isolation may then block it.
  if (response.type === "opaque" || response.type === "opaqueredirect") return response;

  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./play.html",
  "./dolphin.html",
  "./css/wii.css",
  "./js/store.js",
  "./js/systems.js",
  "./js/isolation.js",
  "./js/wii-ui.js",
  "./js/music.js",
  "./js/menu.js",
  "./js/play.js",
  "./js/dolphin.js",
  "./manifest.webmanifest",
  "./games/star-catcher.nes",
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
        })).then(isolate)
      )
    );
    return;
  }

  // Under isolation every cross-origin response needs a resource policy or the
  // page refuses it. A no-cors response is opaque — unreadable, so nothing can
  // be added to it — which is what a plain <script src="https://…"> produces.
  // Reissuing in CORS mode gives a readable response that CORP can be stamped
  // onto, which is how the emulator CDN keeps working while isolated.
  // Outside isolation there is nothing to do and requests go straight out.
  if (url.origin !== self.location.origin) {
    if (!COI) return;
    event.respondWith(
      fetch(new Request(request.url, { mode: "cors", credentials: "omit" }))
        .then(isolate)
        // A host that sends no CORS headers can't be rescued; let the original
        // request through and let the page decide what to do about it.
        .catch(() => fetch(request))
    );
    return;
  }

  // App shell: network-first so edits show up immediately, cache as backup.
  //
  // The request is reissued with cache: "no-cache" so it is revalidated
  // against the server. Plain fetch() inside a worker may be answered from
  // the browser's own HTTP cache, and GitHub Pages sends max-age=600 — which
  // meant a fix could sit invisible on the device for ten minutes after
  // deploying, looking exactly like the fix had not worked.
  const fresh = new Request(request.url, {
    cache: "no-cache",
    credentials: "same-origin",
    headers: request.headers,
    mode: request.mode === "navigate" ? "same-origin" : request.mode,
    redirect: "follow"
  });

  event.respondWith(
    fetch(fresh)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return isolate(response);
      })
      .catch(() => caches.match(request)
        .then((hit) => hit || caches.match("./index.html"))
        .then(isolate))
  );
});
