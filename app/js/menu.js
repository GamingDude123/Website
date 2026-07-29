/* The channel grid: every game you add becomes its own channel, like a Wii.
 *
 * Tapping a channel plays it. Options (rename, delete, info) live behind a
 * press-and-hold, or the Edit button for people who won't discover that. */

(function () {
  const grid = document.getElementById("grid");
  const fileInput = document.getElementById("file-input");
  const editButton = document.getElementById("btn-edit");
  const esc = WiiUI.escapeHtml;

  let library = [];
  let editMode = false;

  WiiUI.startClock(document.getElementById("date"), document.getElementById("clock"));

  /* ---------- Rendering -------------------------------------------------- */

  function tile(options) {
    const el = document.createElement("button");
    el.className = "channel" + (options.className ? " " + options.className : "");
    el.type = "button";
    el.innerHTML =
      (options.badge ? '<span class="channel-badge">' + esc(options.badge) + "</span>" : "") +
      '<span class="channel-art" style="background:' + options.art + '">' +
        '<span class="' + (options.glyph ? "glyph" : "initials") + '">' +
          esc(options.glyph || options.initials) +
        "</span>" +
      "</span>" +
      '<span class="channel-label">' + esc(options.label) + "</span>" +
      '<span class="channel-sub">' + esc(options.sub) + "</span>";

    el.addEventListener("pointerenter", () => WiiUI.play("hover"));

    let longPressed = () => false;
    if (options.onHold) {
      longPressed = WiiUI.onLongPress(el, options.onHold);
    }

    el.addEventListener("click", () => {
      // A completed hold already opened the options; don't also activate.
      if (longPressed()) return;
      WiiUI.feedback("click");
      options.onOpen();
    });
    return el;
  }

  function gradient(colors) {
    return "linear-gradient(160deg," + colors[0] + " 0%," + colors[1] + " 100%)";
  }

  function render() {
    grid.textContent = "";
    grid.classList.toggle("is-editing", editMode);

    grid.appendChild(tile({
      className: "is-disc",
      art: "linear-gradient(160deg,#eaf7ff 0%,#bfe6fa 100%)",
      glyph: "💿",
      label: "Disc Channel",
      sub: "add a game",
      onOpen: () => fileInput.click()
    }));

    grid.appendChild(tile({
      art: gradient(["#3b82f6", "#0b3f8f"]),
      glyph: "🐬",
      label: "Dolphin Center",
      sub: "wii / wii u",
      onOpen: () => DolphinView.show()
    }));

    // Ring the game you played most recently, so picking up where you left
    // off doesn't mean hunting the grid.
    const lastPlayed = library.reduce(
      (best, game) => (game.lastPlayed > (best ? best.lastPlayed : 0) ? game : best),
      null
    );

    library.forEach((game) => {
      const system = SYSTEM_BY_CORE[game.core];
      grid.appendChild(tile({
        className: "is-game" +
          (lastPlayed && game.id === lastPlayed.id ? " is-recent" : ""),
        art: gradient(system ? system.art : ["#94a3b8", "#475569"]),
        initials: initialsFor(game.title),
        label: game.title,
        sub: system ? system.short : game.core,
        badge: game.playSeconds ? formatDuration(game.playSeconds) : "",
        onOpen: () => (editMode ? openOptions(game.id) : startGame(game)),
        onHold: () => openOptions(game.id)
      }));
    });

    // Pad out the last row so the grid keeps a tidy rectangle, with a couple
    // of rows minimum when the library is small.
    const columns = window.innerWidth >= 620 ? 4 : 3;
    const minimum = columns * 2;
    let count = grid.children.length;
    const target = Math.max(minimum, Math.ceil(count / columns) * columns);
    for (let i = count; i < target; i++) {
      const empty = document.createElement("div");
      empty.className = "channel is-empty";
      empty.setAttribute("aria-hidden", "true");
      grid.appendChild(empty);
    }

    editButton.textContent = editMode ? "Done" : "Edit";
    editButton.classList.toggle("is-primary", editMode);
    editButton.hidden = library.length === 0;
  }

  function refresh() {
    return Games.all().then((games) => {
      library = games;
      if (!library.length) editMode = false;
      render();
      updateStorageLabel();
    });
  }

  function updateStorageLabel() {
    const used = library.reduce((total, game) => total + (game.size || 0), 0);
    document.getElementById("sd-sub").textContent = library.length
      ? library.length + " game" + (library.length === 1 ? "" : "s") + " · " + formatBytes(used)
      : "no games yet";
  }

  function startGame(game) {
    WiiUI.play("boot");
    WiiUI.buzz([12, 40, 18]);
    location.href = "play.html?id=" + encodeURIComponent(game.id);
  }

  /* ---------- Channel options -------------------------------------------- */

  function openOptions(id) {
    Games.get(id).then((game) => {
      if (!game) return;
      const system = SYSTEM_BY_CORE[game.core];
      const modal = WiiUI.panel(
        "<h2>" + esc(game.title) + "</h2>" +
        '<p class="muted">' + esc(system ? system.name : game.core) + " · " +
          formatBytes(game.size) +
          (game.playSeconds ? " · played " + formatDuration(game.playSeconds) : "") +
        "</p>" +
        (system && system.heavy
          ? '<p class="muted">This system is demanding — expect some slowdown on ' +
            "older phones.</p>"
          : "") +
        '<div class="panel-actions">' +
          '<button class="wii-btn is-wide is-primary" data-start>▶ Play</button>' +
          '<button class="wii-btn" data-rename>Rename</button>' +
          '<button class="wii-btn is-danger" data-delete>Delete</button>' +
          '<button class="wii-btn" data-close>Back</button>' +
        "</div>"
      );

      modal.el.querySelector("[data-start]").addEventListener("click", () => {
        startGame(game);
      });

      modal.el.querySelector("[data-rename]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        renameChannel(game);
      });

      modal.el.querySelector("[data-delete]").addEventListener("click", () => {
        WiiUI.feedback("click");
        WiiUI.confirm("Delete “" + game.title + "” from this device?", "Delete").then((ok) => {
          if (!ok) return;
          Games.remove(game.id)
            .then(refresh)
            .then(() => {
              modal.close();
              WiiUI.toast("Channel deleted");
            });
        });
      });
    });
  }

  function renameChannel(game) {
    const modal = WiiUI.panel(
      "<h2>Rename channel</h2>" +
      '<label class="field">Title<input type="text" data-title value="' +
        esc(game.title) + '" maxlength="60"></label>' +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-primary" data-save>Save</button>' +
        '<button class="wii-btn" data-close>Cancel</button>' +
      "</div>"
    );
    const input = modal.el.querySelector("[data-title]");
    modal.el.querySelector("[data-save]").addEventListener("click", () => {
      const title = input.value.trim();
      if (!title) {
        WiiUI.play("error");
        input.focus();
        return;
      }
      WiiUI.feedback("click");
      Games.update(game.id, { title: title })
        .then(refresh)
        .then(() => {
          modal.close();
          WiiUI.toast("Renamed");
        });
    });
  }

  /* ---------- Adding games ----------------------------------------------- */

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = "";
    if (files.length) importFiles(files);
  });

  /* Files are handled one at a time so an unknown extension can prompt without
     racing the next file's prompt. */
  function importFiles(files) {
    const total = files.length;
    const overlay = total > 1 || files[0].size > 4 * 1024 * 1024
      ? WiiUI.busy("Adding " + files[0].name + "…")
      : null;
    let added = 0;
    let skipped = 0;

    function next(index) {
      if (index >= total) {
        if (overlay) overlay.close();
        return refresh().then(() => {
          if (added) {
            WiiUI.play("insert");
            WiiUI.buzz([10, 30, 10]);
          }
          if (added && skipped) {
            WiiUI.toast(added + " added, " + skipped + " already in your library");
          } else if (skipped && !added) {
            WiiUI.toast(skipped === 1 ? "That game is already here" : "Those games are already here");
          } else if (added > 1) {
            WiiUI.toast(added + " games added");
          }
        });
      }

      const file = files[index];
      if (overlay) {
        overlay.update(total > 1
          ? "Adding " + (index + 1) + " of " + total + " — " + file.name
          : "Adding " + file.name + "…");
      }

      return handleFile(file).then((result) => {
        if (result === "added") added++;
        if (result === "duplicate") skipped++;
        return next(index + 1);
      });
    }

    next(0);
  }

  function handleFile(file) {
    return Games.findDuplicate(file).then((existing) => {
      if (existing) return "duplicate";

      const detected = detectSystem(file.name, file.size);
      if (detected.kind === "system") return addGame(file, detected.system.core);
      if (detected.kind === "dolphin") return offerDolphin(file);
      return askSystem(file);
    });
  }

  function addGame(file, core) {
    return Games.add(file, core).then((record) => {
      // A single quiet add still deserves confirmation.
      WiiUI.toast("“" + record.title + "” added");
      return "added";
    }).catch((err) => {
      WiiUI.play("error");
      const name = err && err.name === "QuotaExceededError"
        ? "There isn't enough storage left on this device for that file."
        : "Couldn't save that file: " + (err && err.name ? err.name : "unknown error");
      WiiUI.toast(name, 4600);
      return "failed";
    });
  }

  /* Wii/Wii U images can't be emulated in a browser, so route them to the
     Dolphin shelf instead of failing silently. */
  function offerDolphin(file) {
    return new Promise((resolve) => {
      WiiUI.play("error");
      const modal = WiiUI.panel(
        "<h2>That's a Wii disc image</h2>" +
        "<p><strong>" + esc(file.name) + "</strong> is a Wii or Wii&nbsp;U game. " +
        "No phone browser can emulate those — it needs Dolphin running natively, " +
        "with the file staying on your device's storage.</p>" +
        "<p>Want to add the title to your Dolphin shelf so you can track it and " +
        "keep its settings?</p>" +
        '<div class="panel-actions">' +
          '<button class="wii-btn is-primary" data-add>Add to shelf</button>' +
          '<button class="wii-btn" data-close>No thanks</button>' +
        "</div>",
        { onClose: () => resolve("skipped") }
      );
      modal.el.querySelector("[data-add]").addEventListener("click", () => {
        WiiUI.feedback("click");
        const platform = /\.(wud|wux|wua)$/i.test(file.name) ? "wiiu" : "wii";
        Shelf.add({ title: prettyTitle(file.name), platform: platform }).then(() => {
          WiiUI.toast("Added to your Dolphin shelf");
          modal.close();
        });
      });
    });
  }

  /* Only reached for genuinely ambiguous files, like a bare .zip. */
  function askSystem(file) {
    return new Promise((resolve) => {
      const options = SYSTEMS
        .map((sys) => '<option value="' + sys.core + '">' + esc(sys.name) + "</option>")
        .join("");
      const modal = WiiUI.panel(
        "<h2>Which console?</h2>" +
        '<p class="muted">' + esc(file.name) + " · " + formatBytes(file.size) + "</p>" +
        "<p>This file's name doesn't say which system it's for. Pick one:</p>" +
        '<label class="field">Console<select data-core>' + options + "</select></label>" +
        '<div class="panel-actions">' +
          '<button class="wii-btn is-primary" data-add>Add channel</button>' +
          '<button class="wii-btn" data-dolphin>It\'s a Wii game</button>' +
          '<button class="wii-btn" data-close>Skip</button>' +
        "</div>",
        { onClose: () => resolve("skipped") }
      );
      modal.el.querySelector("[data-add]").addEventListener("click", () => {
        WiiUI.feedback("click");
        const core = modal.el.querySelector("[data-core]").value;
        addGame(file, core).then((result) => {
          modal.close();
          resolve(result);
        });
      });
      modal.el.querySelector("[data-dolphin]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        offerDolphin(file).then(resolve);
      });
    });
  }

  /* ---------- First run --------------------------------------------------- */

  function showWelcome() {
    const modal = WiiUI.panel(
      "<h2>Welcome to your Arcade</h2>" +
      "<p>This is a Wii Menu for your pocket. Every game you add becomes its own " +
      "channel — tap one to play it.</p>" +
      "<p class='muted'><strong>1.</strong> Tap the Disc Channel and pick a game " +
      "file from your phone.<br>" +
      "<strong>2.</strong> Tap its channel to play. Touch controls appear " +
      "automatically.<br>" +
      "<strong>3.</strong> Add this page to your home screen and it runs " +
      "fullscreen, offline, with its own icon.</p>" +
      "<p class='muted'>No games come with the app and none are downloaded — it " +
      "plays files you add yourself, and they never leave your phone.</p>" +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-wide is-primary" data-add>Add my first game</button>' +
        '<button class="wii-btn" data-close>Look around</button>' +
      "</div>",
      { dismissable: false, noAutofocus: true }
    );
    modal.el.querySelector("[data-add]").addEventListener("click", () => {
      WiiUI.feedback("click");
      modal.close();
      fileInput.click();
    });
    Settings.set("seen-welcome", true);
  }

  /* ---------- Bottom bar and header --------------------------------------- */

  editButton.addEventListener("click", () => {
    WiiUI.feedback("click");
    editMode = !editMode;
    render();
    if (editMode) WiiUI.toast("Tap a channel to rename or delete it");
  });

  document.getElementById("btn-board").addEventListener("click", () => {
    WiiUI.feedback("click");
    DolphinView.show();
  });

  document.getElementById("btn-sd").addEventListener("click", () => {
    WiiUI.feedback("click");
    openStorage();
  });

  document.getElementById("btn-wii").addEventListener("click", () => {
    WiiUI.feedback("click");
    openSettings();
  });

  function openStorage() {
    storageEstimate().then((estimate) => {
      const used = library.reduce((total, game) => total + (game.size || 0), 0);
      const rows = library.length
        ? library.map((game) => {
            const system = SYSTEM_BY_CORE[game.core];
            return '<li><span>' + esc(game.title) + "</span>" +
              '<span class="muted">' + esc(system ? system.short : game.core) +
              " · " + formatBytes(game.size) + "</span></li>";
          }).join("")
        : '<li class="muted">Nothing yet — tap “Add a game” below.</li>';

      const modal = WiiUI.panel(
        "<h2>SD Card</h2>" +
        '<p class="muted">' + library.length + " game" + (library.length === 1 ? "" : "s") +
        " · " + formatBytes(used) + " used" +
        (estimate && estimate.quota
          ? " of about " + formatBytes(estimate.quota) + " available"
          : "") +
        "</p>" +
        '<ul class="file-list">' + rows + "</ul>" +
        '<div class="panel-actions">' +
          '<button class="wii-btn is-wide is-primary" data-add>Add a game</button>' +
          '<button class="wii-btn" data-close>Close</button>' +
        "</div>"
      );
      modal.el.querySelector("[data-add]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        fileInput.click();
      });
    });
  }

  function openSettings() {
    Bios.all().then((biosFiles) => {
      const biosList = biosFiles.length
        ? biosFiles.map((entry) => {
            const system = SYSTEM_BY_CORE[entry.core];
            return "<li><span>" + esc(system ? system.short : entry.core) + "</span>" +
              '<span class="muted">' + esc(entry.filename) + "</span></li>";
          }).join("")
        : '<li class="muted">None loaded — most systems don\'t need one.</li>';

      const modal = WiiUI.panel(
        "<h2>Wii Settings</h2>" +

        '<label class="toggle"><input type="checkbox" data-sound' +
        (WiiUI.soundOn ? " checked" : "") + "><span>Menu sounds</span></label>" +
        '<label class="toggle"><input type="checkbox" data-music' +
        (WiiMusic.enabled ? " checked" : "") + "><span>Menu music</span></label>" +
        '<label class="toggle"><input type="checkbox" data-haptics' +
        (WiiUI.hapticsOn ? " checked" : "") + "><span>Vibration</span></label>" +

        "<h3>Music</h3>" +
        '<p class="muted">Playing now: <strong>' +
        esc(WiiMusic.customName() || "the built-in tune") + "</strong><br>" +
        "You can use any music file from your phone instead. It stays on this " +
        "device — nothing is uploaded, and no music ships with the app.</p>" +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px">' +
          '<button class="wii-btn" data-music-file>Use my own music</button>' +
          (WiiMusic.customName()
            ? '<button class="wii-btn" data-music-reset>Back to built-in</button>'
            : "") +
        "</div>" +

        "<h3>BIOS files</h3>" +
        '<p class="muted">PlayStation and Lynx games need a BIOS file from your ' +
        "own console. Everything else runs without one.</p>" +
        '<ul class="file-list">' + biosList + "</ul>" +
        '<button class="wii-btn" data-bios>Add BIOS file</button>' +

        "<h3>Install to your home screen</h3>" +
        '<p class="muted"><strong>iPhone:</strong> Share button → Add to Home ' +
        "Screen.<br><strong>Android:</strong> ⋮ menu → Install app.<br>" +
        "It then opens fullscreen with no browser bar, and works offline.</p>" +

        "<h3>About your games</h3>" +
        '<p class="muted">This app ships no games and downloads none. It only ' +
        "runs files you add yourself, and they never leave your device — " +
        "everything is stored locally in your browser.</p>" +

        '<p class="muted" style="margin-top:18px;text-align:center">Version ' +
        esc(APP_VERSION) + "</p>" +

        '<div class="panel-actions">' +
          '<button class="wii-btn" data-guide>Show the welcome guide</button>' +
          '<button class="wii-btn" data-close>Close</button>' +
        "</div>",
        { noAutofocus: true }
      );

      modal.el.querySelector("[data-sound]").addEventListener("change", (event) => {
        WiiUI.setSound(event.target.checked);
        WiiUI.play("click");
      });
      modal.el.querySelector("[data-music]").addEventListener("change", (event) => {
        WiiMusic.setEnabled(event.target.checked);
        WiiUI.play("click");
      });
      modal.el.querySelector("[data-haptics]").addEventListener("change", (event) => {
        WiiUI.setHaptics(event.target.checked);
        WiiUI.buzz();
      });
      modal.el.querySelector("[data-music-file]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        chooseMusic();
      });
      const musicReset = modal.el.querySelector("[data-music-reset]");
      if (musicReset) {
        musicReset.addEventListener("click", () => {
          WiiUI.feedback("click");
          WiiMusic.clearCustomTrack().then(() => {
            modal.close();
            WiiUI.toast("Back to the built-in tune");
          });
        });
      }
      modal.el.querySelector("[data-bios]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        addBios();
      });
      modal.el.querySelector("[data-guide]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        showWelcome();
      });
    });
  }

  /* Since the picker accepts anything, confirm the browser can actually decode
     the file before storing it — a clear message now beats silence later. */
  function canPlayAudio(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const probe = new Audio();
      let settled = false;

      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(ok);
      }

      const timeout = setTimeout(() => finish(false), 5000);
      probe.addEventListener("loadedmetadata", () => finish(true), { once: true });
      probe.addEventListener("canplay", () => finish(true), { once: true });
      probe.addEventListener("error", () => finish(false), { once: true });
      probe.preload = "metadata";
      probe.src = url;
    });
  }

  function chooseMusic() {
    const modal = WiiUI.panel(
      "<h2>Use your own music</h2>" +
      '<p class="muted">Pick any music file on your phone — mp3, m4a, wav or ' +
      "ogg. It loops quietly behind the menu and is stored on this device only.</p>" +
      // No `accept` here for the same reason as the game picker: iOS maps
      // accept entries to UTIs and greys out anything it doesn't match,
      // which hides mp3s sitting in Files. The choice is checked below.
      '<label class="field">Music file<input type="file" data-file></label>' +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-primary" data-save>Use this track</button>' +
        '<button class="wii-btn" data-close>Cancel</button>' +
      "</div>"
    );
    modal.el.querySelector("[data-save]").addEventListener("click", () => {
      const file = modal.el.querySelector("[data-file]").files[0];
      if (!file) {
        WiiUI.play("error");
        return;
      }
      WiiUI.feedback("click");
      const working = WiiUI.busy("Checking “" + file.name + "”…");
      canPlayAudio(file).then((ok) => {
        if (!ok) {
          working.close();
          WiiUI.play("error");
          WiiUI.toast("Your phone can't play that file — try an mp3, m4a or wav", 4600);
          return;
        }
        return WiiMusic.setCustomTrack(file).then(() => {
          working.close();
          modal.close();
          WiiUI.toast("Now playing “" + prettyTitle(file.name) + "”");
        });
      }).catch(() => {
        working.close();
        WiiUI.play("error");
        WiiUI.toast("Couldn't save that music file", 3600);
      });
    });
  }

  function addBios() {
    const options = SYSTEMS
      .filter((sys) => sys.bios)
      .map((sys) => '<option value="' + sys.core + '">' + esc(sys.name) +
        " (" + esc(sys.bios) + ")</option>")
      .join("");
    const modal = WiiUI.panel(
      "<h2>Add a BIOS file</h2>" +
      '<label class="field">For<select data-core>' + options + "</select></label>" +
      '<label class="field">File<input type="file" data-file></label>' +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-primary" data-save>Save</button>' +
        '<button class="wii-btn" data-close>Cancel</button>' +
      "</div>"
    );
    modal.el.querySelector("[data-save]").addEventListener("click", () => {
      const file = modal.el.querySelector("[data-file]").files[0];
      if (!file) {
        WiiUI.play("error");
        return;
      }
      WiiUI.feedback("click");
      Bios.put(modal.el.querySelector("[data-core]").value, file).then(() => {
        modal.close();
        WiiUI.toast("BIOS saved");
      });
    });
  }

  /* ---------- Boot ------------------------------------------------------- */

  requestPersistentStorage();

  refresh().then(() => Settings.get("seen-welcome", false)).then((seen) => {
    if (!seen) showWelcome();
  });

  // Re-render on rotation so the row padding matches the new column count.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  // Dropping a ROM onto the window works on desktop, which makes testing easy.
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) importFiles(files);
  });
})();
