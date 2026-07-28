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

    const system = SYSTEM_BY_CORE[game.core];
    titleEl.textContent = game.title;
    document.title = game.title + " — Wii Channel Arcade";

    // A BIOS is only needed by a couple of systems; pass it when we have one.
    return Bios.get(game.core).then((bios) => {
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

      if (bios && bios.blob) {
        window.EJS_biosUrl = asFile(bios.blob, bios.filename || "bios.bin");
      }

      window.EJS_onGameStart = () => {
        statusEl.remove();
        startPlaytime();
        if (system && system.heavy) {
          WiiUI.toast("Heavy system — if it stutters, try the emulator's settings menu", 4200);
        } else if (window.innerHeight > window.innerWidth) {
          WiiUI.toast("Turn your phone sideways for a bigger screen", 3200);
        }
      };

      window.EJS_onExit = () => {
        clearInterval(flushTimer);
        goBack();
      };

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
