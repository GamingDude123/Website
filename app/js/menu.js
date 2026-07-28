/* The channel grid: every game you add becomes its own channel, like a Wii. */

(function () {
  const grid = document.getElementById("grid");
  const fileInput = document.getElementById("file-input");
  const esc = WiiUI.escapeHtml;

  const MIN_TILES = 12;
  let library = [];

  fileInput.setAttribute("accept", ACCEPT_ATTR);
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
    el.addEventListener("click", () => {
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

    grid.appendChild(tile({
      className: "is-disc",
      art: "linear-gradient(160deg,#eaf7ff 0%,#bfe6fa 100%)",
      glyph: "💿",
      label: "Disc Channel",
      sub: "insert game",
      onOpen: () => fileInput.click()
    }));

    grid.appendChild(tile({
      art: gradient(["#3b82f6", "#0b3f8f"]),
      glyph: "🐬",
      label: "Dolphin Center",
      sub: "wii / wii u",
      onOpen: () => { location.href = "dolphin.html"; }
    }));

    library.forEach((game) => {
      const system = SYSTEM_BY_CORE[game.core];
      grid.appendChild(tile({
        art: gradient(system ? system.art : ["#94a3b8", "#475569"]),
        initials: initialsFor(game.title),
        label: game.title,
        sub: system ? system.short : game.core,
        badge: game.playSeconds ? formatDuration(game.playSeconds) : "",
        onOpen: () => openChannel(game.id)
      }));
    });

    // Pad the page out so the grid keeps its shape when the library is small.
    for (let i = grid.children.length; i < MIN_TILES; i++) {
      const empty = document.createElement("div");
      empty.className = "channel is-empty";
      empty.setAttribute("aria-hidden", "true");
      grid.appendChild(empty);
    }
  }

  function refresh() {
    return Games.all().then((games) => {
      library = games;
      render();
      updateStorageLabel();
    });
  }

  function updateStorageLabel() {
    const used = library.reduce((total, game) => total + (game.size || 0), 0);
    const label = document.getElementById("sd-sub");
    label.textContent = library.length
      ? library.length + " game" + (library.length === 1 ? "" : "s") + " · " + formatBytes(used)
      : "library";
  }

  /* ---------- Channel preview (the Wii's "channel page") ----------------- */

  function openChannel(id) {
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
          ? '<p class="muted">Heads up: this system is demanding. Expect some slowdown on ' +
            "older phones.</p>"
          : "") +
        '<div class="panel-actions">' +
          '<button class="wii-btn is-wide is-primary" data-start>▶ Start</button>' +
          '<button class="wii-btn" data-rename>Rename</button>' +
          '<button class="wii-btn" data-delete>Delete</button>' +
          '<button class="wii-btn" data-close>Back</button>' +
        "</div>"
      );

      modal.el.querySelector("[data-start]").addEventListener("click", () => {
        WiiUI.feedback("boot", [12, 40, 18]);
        location.href = "play.html?id=" + encodeURIComponent(game.id);
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
        '<button class="wii-btn" data-save>Save</button>' +
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
    if (files.length) handleFiles(files);
  });

  function handleFiles(files) {
    // One at a time so an unknown extension can prompt without racing.
    const next = () => {
      const file = files.shift();
      if (!file) {
        refresh();
        return;
      }
      handleFile(file).then(next);
    };
    next();
  }

  function handleFile(file) {
    const detected = detectSystem(file.name);

    if (detected.kind === "system") {
      return addGame(file, detected.system.core);
    }

    if (detected.kind === "dolphin") {
      return offerDolphin(file);
    }

    return askSystem(file);
  }

  function addGame(file, core) {
    return Games.add(file, core).then((record) => {
      WiiUI.feedback("insert", [10, 30, 10]);
      WiiUI.toast("“" + record.title + "” added");
      return refresh();
    }).catch((err) => {
      WiiUI.play("error");
      WiiUI.toast("Couldn't save that file: " + (err && err.name ? err.name : "unknown error"), 4200);
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
          '<button class="wii-btn" data-add>Add to shelf</button>' +
          '<button class="wii-btn" data-close>No thanks</button>' +
        "</div>",
        { onClose: resolve }
      );
      modal.el.querySelector("[data-add]").addEventListener("click", () => {
        WiiUI.feedback("click");
        const platform = /\.(wud|wux|wua)$/i.test(file.name) ? "wiiu" : "wii";
        Shelf.add({ title: prettyTitle(file.name), platform: platform })
          .then(() => {
            modal.close();
            WiiUI.toast("Added to your Dolphin shelf");
            resolve();
          });
      });
    });
  }

  /* `.iso` could be PlayStation or Wii; `.zip` could be anything. Ask. */
  function askSystem(file) {
    return new Promise((resolve) => {
      const options = SYSTEMS
        .map((sys) => '<option value="' + sys.core + '">' + esc(sys.name) + "</option>")
        .join("");
      const modal = WiiUI.panel(
        "<h2>Which console?</h2>" +
        '<p class="muted">' + esc(file.name) + " · " + formatBytes(file.size) + "</p>" +
        "<p>This file's extension doesn't say which system it's for. Pick one:</p>" +
        '<label class="field">Console<select data-core>' + options + "</select></label>" +
        '<div class="panel-actions">' +
          '<button class="wii-btn" data-add>Add channel</button>' +
          '<button class="wii-btn" data-dolphin>It\'s a Wii game</button>' +
          '<button class="wii-btn" data-close>Skip</button>' +
        "</div>",
        { onClose: resolve }
      );
      modal.el.querySelector("[data-add]").addEventListener("click", () => {
        WiiUI.feedback("click");
        const core = modal.el.querySelector("[data-core]").value;
        modal.close();
        addGame(file, core).then(resolve);
      });
      modal.el.querySelector("[data-dolphin]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        offerDolphin(file).then(resolve);
      });
    });
  }

  /* ---------- Bottom bar ------------------------------------------------- */

  document.getElementById("btn-board").addEventListener("click", () => {
    WiiUI.feedback("click");
    location.href = "dolphin.html";
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
            return '<tr><td style="padding:6px 0">' + esc(game.title) +
              '<br><span class="muted">' + esc(system ? system.short : game.core) +
              " · " + formatBytes(game.size) + "</span></td></tr>";
          }).join("")
        : '<tr><td class="muted" style="padding:6px 0">No games yet. Tap the Disc ' +
          "Channel to add one.</td></tr>";

      WiiUI.panel(
        "<h2>SD Card</h2>" +
        '<p class="muted">' + library.length + " game" + (library.length === 1 ? "" : "s") +
        " · " + formatBytes(used) + " stored" +
        (estimate && estimate.quota
          ? " · about " + formatBytes(estimate.quota) + " available on this device"
          : "") +
        "</p>" +
        '<table style="width:100%;border-collapse:collapse;font-size:14px">' + rows + "</table>" +
        '<div class="panel-actions">' +
          '<button class="wii-btn is-wide" data-add>Insert a game</button>' +
          '<button class="wii-btn" data-close>Close</button>' +
        "</div>"
      ).el.querySelector("[data-add]").addEventListener("click", () => {
        WiiUI.feedback("click");
        fileInput.click();
      });
    });
  }

  function openSettings() {
    Bios.all().then((biosFiles) => {
      const biosList = biosFiles.length
        ? biosFiles.map((entry) => {
            const system = SYSTEM_BY_CORE[entry.core];
            return "<li>" + esc(system ? system.short : entry.core) + " — " +
              esc(entry.filename) + "</li>";
          }).join("")
        : '<li class="muted">None loaded</li>';

      const modal = WiiUI.panel(
        "<h2>Wii Settings</h2>" +
        '<label class="field" style="text-transform:none;font-weight:500">' +
          '<input type="checkbox" data-sound style="width:auto;display:inline;margin-right:8px"' +
          (WiiUI.soundOn ? " checked" : "") + ">Menu sounds</label>" +
        '<label class="field" style="text-transform:none;font-weight:500">' +
          '<input type="checkbox" data-haptics style="width:auto;display:inline;margin-right:8px"' +
          (WiiUI.hapticsOn ? " checked" : "") + ">Vibration</label>" +

        "<h2 style='font-size:16px;margin-top:18px'>BIOS files</h2>" +
        '<p class="muted">PlayStation and Lynx games need a BIOS file from your own ' +
        "console. Everything else runs without one.</p>" +
        '<ul style="font-size:13px;padding-left:18px">' + biosList + "</ul>" +
        '<button class="wii-btn" data-bios>Add BIOS file</button>' +

        "<h2 style='font-size:16px;margin-top:18px'>Install to home screen</h2>" +
        '<p class="muted"><strong>iPhone:</strong> Share button → Add to Home Screen.<br>' +
        "<strong>Android:</strong> ⋮ menu → Install app. Then it opens fullscreen with " +
        "no browser bar, and works offline.</p>" +

        "<h2 style='font-size:16px;margin-top:18px'>About your games</h2>" +
        '<p class="muted">This app ships no games and downloads none. It only runs ' +
        "files you add yourself, and they never leave your device — everything is " +
        "stored locally in your browser.</p>" +

        '<div class="panel-actions">' +
          '<button class="wii-btn" data-close>Close</button>' +
        "</div>"
      );

      modal.el.querySelector("[data-sound]").addEventListener("change", (event) => {
        WiiUI.setSound(event.target.checked);
        WiiUI.play("click");
      });
      modal.el.querySelector("[data-haptics]").addEventListener("change", (event) => {
        WiiUI.setHaptics(event.target.checked);
        WiiUI.buzz();
      });
      modal.el.querySelector("[data-bios]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        addBios();
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
        '<button class="wii-btn" data-save>Save</button>' +
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
  refresh();

  // Dropping a ROM onto the window works on desktop, which makes testing easy.
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) handleFiles(files);
  });
})();
