/* Cross-origin isolation, so the heavy cores can run.
 *
 * PSP, 3DS and DOS are compiled with threads, and a browser only exposes
 * SharedArrayBuffer to a page that is "cross-origin isolated". A page earns
 * that by being served with two headers:
 *
 *     Cross-Origin-Opener-Policy: same-origin
 *     Cross-Origin-Embedder-Policy: require-corp
 *
 * GitHub Pages is a static host and won't send them. But a service worker sits
 * between the page and the network, so it can add the headers to responses on
 * their way through — the page can't tell the difference. That is what
 * `sw.js?coi=1` does.
 *
 * Two consequences make this opt-in rather than always-on:
 *
 *   - Isolation is strict about cross-origin content. The worker also stamps
 *     Cross-Origin-Resource-Policy onto everything it proxies to compensate,
 *     but anything it can't read (an opaque response) may still be blocked.
 *   - The headers only exist on responses the worker served, so the page has
 *     to be loaded once more after the worker takes control.
 *
 * If it doesn't take, `failed` is set and Settings offers a way back.
 */

const Isolation = (function () {
  const FLAG = "wii-heavy-systems";
  const RELOAD_GUARD = "wii-coi-reloaded";

  let enabled = localStorage.getItem(FLAG) === "on";
  const active = window.crossOriginIsolated === true;
  const supported = "serviceWorker" in navigator;

  // Asked for, the page has already been reloaded to get it, and it still
  // isn't isolated: this browser won't do it.
  const failed = enabled && !active && sessionStorage.getItem(RELOAD_GUARD) === "1";

  function workerUrl(coi) {
    return coi ? "sw.js?coi=1" : "sw.js";
  }

  function controllerIsCoi() {
    const controller = navigator.serviceWorker.controller;
    return !!controller && controller.scriptURL.indexOf("coi=1") !== -1;
  }

  /* Reloading before the newly registered worker has taken over means the old
     one answers the navigation, so the headers are missing and — worse — the
     swap mid-load can leave the document half-parsed. Wait for the handover. */
  function waitForController(wantCoi) {
    return new Promise((resolve) => {
      if (navigator.serviceWorker.controller && controllerIsCoi() === wantCoi) {
        resolve();
        return;
      }
      let timer = null;
      function onChange() {
        if (!navigator.serviceWorker.controller) return;
        if (controllerIsCoi() !== wantCoi) return;
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        clearTimeout(timer);
        resolve();
      }
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      // Never hang the UI on this; a reload that doesn't isolate is recoverable.
      timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }, 8000);
    });
  }

  function register(coi) {
    if (!supported) return Promise.resolve(null);
    return navigator.serviceWorker.register(workerUrl(coi)).catch(() => null);
  }

  function boot() {
    register(enabled).then((registration) => {
      if (!registration) return;

      if (!enabled || active) {
        sessionStorage.removeItem(RELOAD_GUARD);
        return;
      }
      if (sessionStorage.getItem(RELOAD_GUARD) === "1") return; // already tried

      waitForController(true).then(() => {
        if (!controllerIsCoi()) return; // handover never happened; leave it be
        sessionStorage.setItem(RELOAD_GUARD, "1");
        location.reload();
      });
    });
  }

  function set(on) {
    enabled = on;
    localStorage.setItem(FLAG, on ? "on" : "off");
    sessionStorage.removeItem(RELOAD_GUARD);
    if (!supported) {
      location.reload();
      return;
    }
    register(on)
      .then(() => waitForController(on))
      .catch(() => null)
      .then(() => location.reload());
  }

  /* A plain-language description for Settings. */
  function status() {
    if (!enabled) return "Off — PSP, 3DS and DOS are hidden";
    if (active) return "On and working";
    if (failed) return "On, but this browser refused it";
    return "On — starting up";
  }

  /* The web font is loaded from script rather than a <link> in the markup, for
     two reasons: a stylesheet blocks script execution while it downloads, so a
     slow or unreachable font host stalls the whole app; and under isolation a
     cross-origin stylesheet may be refused outright. Isolated sessions simply
     use the system font stack, which the CSS already falls back to. */
  function loadWebFont() {
    if (active) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800&display=swap";
    // Applying it only once loaded keeps it off the critical path entirely.
    link.media = "print";
    link.addEventListener("load", () => { link.media = "all"; });
    document.head.appendChild(link);
  }

  boot();
  loadWebFont();

  return {
    set: set,
    status: status,
    get enabled() { return enabled; },
    get active() { return active; },
    get failed() { return failed; },
    get supported() { return supported; }
  };
})();
