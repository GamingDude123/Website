/* Boots a game from the library into EmulatorJS.
 *
 * The emulator cores are libretro builds compiled to WebAssembly, loaded from
 * the EmulatorJS CDN and then kept in the service worker's core cache so the
 * second launch works offline.
 */

(function () {
  const CDN = "https://cdn.emulatorjs.org/stable/data/";

  const statusEl = document.getElementById("status");
  const titleEl = document.getElementById("play-title");
  const gameId = new URLSearchParams(location.search).get("id");

  let playStartedAt = 0;
  let flushTimer = null;

  function showStatus(heading, message, linkLabel) {
    statusEl.innerHTML =
      "<h1>" + WiiUI.escapeHtml(heading) + "</h1>" +
      "<p>" + WiiUI.escapeHtml(message) + "</p>" +
      '<a href="index.html">' + WiiUI.escapeHtml(linkLabel || "Back to the menu") + "</a>";
  }

  function goBack() {
    flushPlaytime();
    location.href = "index.html";
  }

  document.getElementById("btn-back").addEventListener("click", () => {
    WiiUI.feedback("back");
    goBack();
  });

  document.getElementById("btn-full").addEventListener("click", () => {
    WiiUI.feedback("click");
    const target = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {
        WiiUI.toast("Fullscreen isn't available here — use the emulator's own ⛶ button");
      });
    } else {
      // iOS Safari has no Fullscreen API on non-video elements.
      WiiUI.toast("iPhone can't go fullscreen in Safari — add the app to your Home Screen instead", 4000);
    }
  });

  /* ---------- Bar visibility --------------------------------------------- */

  /* Once a game is running the 40px bar is worth reclaiming, especially in
     landscape. A grab handle stays put so it's always obvious how to return. */
  const handle = document.getElementById("bar-handle");

  function hideBar() {
    document.body.classList.add("is-immersive");
  }

  function showBar() {
    document.body.classList.remove("is-immersive");
  }

  handle.addEventListener("click", () => {
    WiiUI.play("hover");
    if (document.body.classList.contains("is-immersive")) {
      showBar();
    } else {
      hideBar();
    }
  });

  function smoothMode() {
    return localStorage.getItem("wii-smooth") !== "off";
  }

  /* Safety net. If the emulator ever puts up its "has exited" notice — from a
     path we haven't hidden, or because its exit event didn't reach us — the
     screen is dead and there is nothing to go back to. Spot it and leave. */
  function watchForStrandedExit() {
    const host = document.getElementById("game");
    if (!host || !window.MutationObserver) return;

    const observer = new MutationObserver(() => {
      const popup = host.querySelector(".ejs_popup_container");
      if (!popup) return;
      const heading = popup.querySelector("h4");
      if (heading && /exit/i.test(heading.textContent || "")) {
        observer.disconnect();
        clearInterval(flushTimer);
        goBack();
      }
    });
    observer.observe(host, { childList: true, subtree: true });
  }

  /* ---------- Touch feedback ---------------------------------------------- */

  /* A glass screen gives nothing back, so a press that misses the button feels
     identical to one that lands. A short tick on each press supplies the part
     a physical pad would. Delegated, because the emulator builds its gamepad
     after this runs. */
  function armTouchFeedback() {
    document.addEventListener("touchstart", (event) => {
      const target = event.target;
      if (target && target.closest && target.closest(".ejs_virtualGamepad_button")) {
        WiiUI.buzz(8);
      }
    }, { passive: true, capture: true });
  }

  /* ---------- Keeping the screen awake ------------------------------------ */

  /* A game is long stretches without a touch, so the screen dims and the phone
     starts throttling — which reads as the emulator stuttering. */
  let wakeLock = null;

  function requestWakeLock() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request("screen")
      .then((lock) => { wakeLock = lock; })
      .catch(() => { /* denied or unsupported; not worth surfacing */ });
  }

  // The lock is dropped whenever the page is backgrounded, so retake it.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && playStartedAt) requestWakeLock();
  });

  /* ---------- Play time -------------------------------------------------- */

  /* Written every 30s and whenever the page is hidden, because a write started
     during pagehide is not guaranteed to finish. */
  function flushPlaytime() {
    if (!playStartedAt || !gameId) return;
    const elapsed = (Date.now() - playStartedAt) / 1000;
    playStartedAt = Date.now();
    Games.addPlaytime(gameId, elapsed);
  }

  function startPlaytime() {
    if (playStartedAt) return;
    playStartedAt = Date.now();
    flushTimer = setInterval(flushPlaytime, 30000);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPlaytime();
  });
  window.addEventListener("pagehide", flushPlaytime);

  /* ---------- Boot ------------------------------------------------------- */

  if (!gameId) {
    showStatus("No game selected", "Pick a channel from the menu first.");
    return;
  }

  /* IndexedDB round-trips usually preserve File objects, but a plain Blob can
     come back on some engines. EmulatorJS reads the filename off a File to
     decide whether to unzip, so make sure it always gets one. */
  function asFile(blob, filename) {
    if (blob instanceof File) return blob;
    try {
      return new File([blob], filename, { type: blob.type || "application/octet-stream" });
    } catch (err) {
      return blob;
    }
  }

  Games.get(gameId).then((game) => {
    if (!game) {
      showStatus("Game not found", "It may have been deleted from this device.");
      return;
    }
    if (!game.blob) {
      showStatus("That game's file is missing",
        "The channel is still here but its file isn't. Delete the channel and add " +
        "the game again.");
      return;
    }

    const system = SYSTEM_BY_CORE[game.core];
    titleEl.textContent = game.title;
    document.title = game.title + " — Wii Channel Arcade";

    // A BIOS is only needed by a couple of systems; pass it when we have one.
    return Bios.get(game.core).then((bios) => {
      if (system && system.bios && !bios) {
        showStatus(
          "This one needs a BIOS file",
          system.name + " games need a BIOS file (" + system.bios + ") dumped from " +
          "your own console. Add one under the Wii button → Settings, then try again."
        );
        WiiUI.play("error");
        return;
      }

      window.EJS_player = "#game";
      window.EJS_core = game.core;
      window.EJS_gameUrl = asFile(game.blob, game.filename || game.title);
      window.EJS_gameName = game.title;
      window.EJS_pathtodata = CDN;
      window.EJS_startOnLoaded = false; // needs a tap here so audio is allowed
      window.EJS_color = "#009ee0";
      window.EJS_backgroundColor = "#000000";
      window.EJS_alignStartButton = "center";
      window.EJS_startButtonName = "Start " + game.title;
      window.EJS_askBeforeExit = false;

      /* Hide the emulator's own "Exit EmulatorJS" item. It replaces the screen
         with an "EmulatorJS has exited" notice and leaves you stranded there if
         its exit event doesn't reach us. The ◀ Menu button in the bar above is
         ours and always works, so there is one way out rather than two. */
      window.EJS_Buttons = { exitEmulation: false };
      // The threaded cores refuse to start unless this matches reality.
      window.EJS_threads = Isolation.active;

      /* Smooth mode: start the demanding cores at their cheapest settings —
         native resolution, no texture filtering, JIT on. These are defaults,
         so anything changed in the emulator's own settings menu still wins,
         and turning smooth mode off hands the core back its own defaults. */
      if (smoothMode() && system && system.perf) {
        window.EJS_defaultOptions = system.perf;
      }

      if (bios && bios.blob) {
        window.EJS_biosUrl = asFile(bios.blob, bios.filename || "bios.bin");
      }

      window.EJS_onGameStart = () => {
        statusEl.remove();
        startPlaytime();
        requestWakeLock();
        // Hand the screen over to the game; the bar comes back on demand.
        setTimeout(hideBar, 3500);
        if (system && system.warning) {
          WiiUI.toast(system.warning, 6000);
        } else if (system && system.heavy) {
          WiiUI.toast("Heavy system — if it stutters, try the emulator's settings menu", 4200);
        } else if (window.innerHeight > window.innerWidth) {
          WiiUI.toast("Turn your phone sideways for a bigger screen", 3200);
        }
      };

      window.EJS_onExit = () => {
        clearInterval(flushTimer);
        goBack();
      };

      watchForStrandedExit();
      armTouchFeedback();

      const script = document.createElement("script");
      script.src = CDN + "loader.js";
      script.onerror = () => {
        showStatus(
          "Couldn't load the emulator",
          system && system.name
            ? "The " + system.name + " core comes from the EmulatorJS CDN and " +
              "couldn't be reached. Check your connection — once a game has run " +
              "one time, its core is cached and works offline after that."
            : "The emulator core couldn't be downloaded. Check your connection."
        );
        WiiUI.play("error");
      };
      document.body.appendChild(script);
    });
  }).catch((err) => {
    showStatus("Something went wrong", (err && err.message) ? err.message : "Unknown error.");
  });
})();
