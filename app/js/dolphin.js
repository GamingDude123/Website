/* Dolphin Command Center — the Wii / Wii U half of the app.
 *
 * Browsers can't emulate a Wii, so this side doesn't pretend to. It tracks the
 * library, keeps per-game Dolphin settings where you can actually find them,
 * and hands off to the real emulator. */

(function () {
  const esc = WiiUI.escapeHtml;
  const shelfEl = document.getElementById("shelf");

  const DOLPHIN_PACKAGE = "org.dolphinemu.dolphinemu";
  const PLAY_STORE = "https://play.google.com/store/apps/details?id=" + DOLPHIN_PACKAGE;

  const STATUSES = [
    { id: "backlog", label: "Backlog" },
    { id: "playing", label: "Playing" },
    { id: "beaten", label: "Beaten" },
    { id: "dropped", label: "Dropped" }
  ];

  /* Settings worth reaching for when a game misbehaves. Offered as one-tap
     presets so the notes field doesn't start blank. */
  const PRESETS = [
    ["Runs slow", "Video backend: Vulkan · Internal resolution: 1x · Shader compilation: Ubershaders (hybrid)"],
    ["Graphics glitches", "Try OpenGL instead of Vulkan · Disable 'Store EFB copies to texture only' · Enable 'Defer EFB copies'"],
    ["Audio crackles", "Audio backend: Cubeb · Enable 'Audio stretching' · Lower the emulated latency"],
    ["Needs motion", "Bind Wii Remote to your phone's gyro, or pair a real Wii Remote over Bluetooth"],
    ["Needs pointer", "Use touchscreen IR pointer, or set 'Emulated Wii Remote' → sideways"]
  ];

  let shelf = [];
  let filter = "all";

  /* ---------- Rendering -------------------------------------------------- */

  function artFor(entry) {
    const colors = entry.platform === "wiiu"
      ? ["#14b8a6", "#0b4f4a"]
      : ["#7dd3fc", "#0369a1"];
    return "linear-gradient(160deg," + colors[0] + " 0%," + colors[1] + " 100%)";
  }

  function statusLabel(id) {
    const found = STATUSES.filter((s) => s.id === id)[0];
    return found ? found.label : id;
  }

  function matchesFilter(entry) {
    if (filter === "all") return true;
    if (filter === "wii" || filter === "wiiu") return entry.platform === filter;
    return entry.status === filter;
  }

  function render() {
    const visible = shelf.filter(matchesFilter);

    document.getElementById("stat-total").textContent = shelf.length;
    document.getElementById("stat-beaten").textContent =
      shelf.filter((entry) => entry.status === "beaten").length;
    const minutes = shelf.reduce((total, entry) => total + (entry.playMinutes || 0), 0);
    document.getElementById("stat-hours").textContent =
      minutes >= 60 ? Math.round(minutes / 60) + "h" : minutes + "m";

    shelfEl.textContent = "";

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "dc-empty";
      empty.innerHTML = shelf.length
        ? "Nothing matches that filter."
        : "Your shelf is empty.<br>Tap <strong>+ Add a title</strong> to start tracking " +
          "your Wii and Wii&nbsp;U games.";
      shelfEl.appendChild(empty);
      return;
    }

    visible.forEach((entry) => {
      const card = document.createElement("button");
      card.className = "dc-card";
      card.type = "button";
      card.innerHTML =
        '<span class="dc-art" style="background:' + artFor(entry) + '">' +
          esc(initialsFor(entry.title)) +
        "</span>" +
        '<span class="dc-body">' +
          '<span class="dc-title">' + esc(entry.title) + "</span>" +
          '<span class="dc-meta">' +
            '<span class="pill ' + entry.platform + '">' +
              (entry.platform === "wiiu" ? "Wii U" : "Wii") +
            "</span>" +
            '<span class="pill ' + esc(entry.status) + '">' + esc(statusLabel(entry.status)) + "</span>" +
          "</span>" +
          '<span class="dc-meta">' +
            (entry.playMinutes ? formatDuration(entry.playMinutes * 60) + " played" : "not started") +
            (entry.rating
              ? ' · <span class="stars">' + "★".repeat(entry.rating) + "</span>"
              : "") +
          "</span>" +
          (entry.notes || entry.settings
            ? '<span class="dc-notes">' + esc(entry.settings || entry.notes) + "</span>"
            : "") +
        "</span>";
      card.addEventListener("pointerenter", () => WiiUI.play("hover"));
      card.addEventListener("click", () => {
        WiiUI.feedback("click");
        editEntry(entry);
      });
      shelfEl.appendChild(card);
    });
  }

  function refresh() {
    return Shelf.all().then((rows) => {
      shelf = rows;
      render();
    });
  }

  /* ---------- Editor ----------------------------------------------------- */

  function editorMarkup(entry) {
    const statusOptions = STATUSES.map((status) =>
      '<option value="' + status.id + '"' +
      (entry.status === status.id ? " selected" : "") + ">" + esc(status.label) + "</option>"
    ).join("");

    const presetButtons = PRESETS.map((preset, index) =>
      '<button class="wii-btn" style="height:32px;font-size:11px;padding:0 11px" ' +
      'data-preset="' + index + '">' + esc(preset[0]) + "</button>"
    ).join("");

    return (
      '<label class="field">Title<input type="text" data-title value="' +
        esc(entry.title === "Untitled" ? "" : entry.title) +
        '" placeholder="Super Mario Galaxy" maxlength="80"></label>' +

      '<div style="display:flex;gap:10px">' +
        '<label class="field" style="flex:1">Console<select data-platform>' +
          '<option value="wii"' + (entry.platform === "wii" ? " selected" : "") + ">Wii</option>" +
          '<option value="wiiu"' + (entry.platform === "wiiu" ? " selected" : "") + ">Wii U</option>" +
        "</select></label>" +
        '<label class="field" style="flex:1">Status<select data-status>' +
          statusOptions + "</select></label>" +
      "</div>" +

      '<div style="display:flex;gap:10px">' +
        '<label class="field" style="flex:1">Hours played' +
          '<input type="number" data-hours min="0" max="9999" step="0.5" value="' +
          (entry.playMinutes ? (entry.playMinutes / 60) : "") + '" placeholder="0"></label>' +
        '<label class="field" style="flex:1">Rating' +
          '<select data-rating>' +
            [0, 1, 2, 3, 4, 5].map((n) =>
              '<option value="' + n + '"' + (entry.rating === n ? " selected" : "") + ">" +
              (n ? "★".repeat(n) : "—") + "</option>").join("") +
          "</select></label>" +
      "</div>" +

      '<label class="field">Dolphin settings<textarea data-settings ' +
        'placeholder="Vulkan, 2x internal resolution, ubershaders on">' +
        esc(entry.settings) + "</textarea></label>" +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:-6px 0 14px">' +
        presetButtons + "</div>" +

      '<label class="field">Notes<textarea data-notes ' +
        'placeholder="Where I am, what to do next, save file notes…">' +
        esc(entry.notes) + "</textarea></label>"
    );
  }

  function editEntry(entry) {
    const isNew = !entry.id;
    const modal = WiiUI.panel(
      "<h2>" + (isNew ? "Add a title" : esc(entry.title)) + "</h2>" +
      editorMarkup(entry) +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-wide is-primary" data-save>Save</button>' +
        (isNew ? "" : '<button class="wii-btn" data-delete>Delete</button>') +
        '<button class="wii-btn" data-close>Cancel</button>' +
      "</div>"
    );

    const el = modal.el;
    const settingsField = el.querySelector("[data-settings]");

    el.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        WiiUI.feedback("click");
        const preset = PRESETS[Number(button.getAttribute("data-preset"))];
        settingsField.value = settingsField.value.trim()
          ? settingsField.value.trim() + "\n" + preset[1]
          : preset[1];
      });
    });

    el.querySelector("[data-save]").addEventListener("click", () => {
      const title = el.querySelector("[data-title]").value.trim();
      if (!title) {
        WiiUI.play("error");
        el.querySelector("[data-title]").focus();
        return;
      }
      const hours = parseFloat(el.querySelector("[data-hours]").value);
      const patch = {
        title: title,
        platform: el.querySelector("[data-platform]").value,
        status: el.querySelector("[data-status]").value,
        rating: Number(el.querySelector("[data-rating]").value),
        playMinutes: isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0,
        settings: settingsField.value.trim(),
        notes: el.querySelector("[data-notes]").value.trim()
      };
      WiiUI.feedback("click");
      const saved = isNew ? Shelf.add(patch) : Shelf.update(entry.id, patch);
      saved.then(refresh).then(() => {
        modal.close();
        WiiUI.toast(isNew ? "Added to your shelf" : "Saved");
      });
    });

    const deleteButton = el.querySelector("[data-delete]");
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        WiiUI.feedback("click");
        WiiUI.confirm("Remove “" + entry.title + "” from your shelf?", "Remove").then((ok) => {
          if (!ok) return;
          Shelf.remove(entry.id).then(refresh).then(() => {
            modal.close();
            WiiUI.toast("Removed");
          });
        });
      });
    }
  }

  /* ---------- Launching the real emulator -------------------------------- */

  function launchDolphin() {
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) {
      WiiUI.play("error");
      WiiUI.panel(
        "<h2>Dolphin needs Android</h2>" +
        "<p>Dolphin has an official Android app, but no App Store release for " +
        "iPhone — Apple doesn't allow the just-in-time compilation Dolphin needs " +
        "to hit full speed. On an iPhone you'd have to sideload it.</p>" +
        "<p>On a computer, Dolphin runs natively on Windows, macOS and Linux.</p>" +
        '<div class="panel-actions">' +
          '<a class="wii-btn" href="https://dolphin-emu.org/download/" target="_blank" ' +
          'rel="noopener" style="text-decoration:none;display:inline-flex">Dolphin downloads</a>' +
          '<button class="wii-btn" data-close>Close</button>' +
        "</div>"
      );
      return;
    }

    // Chrome resolves this to Dolphin's launcher activity, and falls back to
    // the Play Store listing when it isn't installed.
    WiiUI.feedback("boot");
    location.href = "intent:#Intent;package=" + DOLPHIN_PACKAGE +
      ";action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;" +
      "S.browser_fallback_url=" + encodeURIComponent(PLAY_STORE) + ";end";
  }

  /* ---------- Guide ------------------------------------------------------ */

  function openGuide() {
    WiiUI.panel(
      "<h2>How this half works</h2>" +
      "<p>A phone browser can't emulate a Wii. Wii emulation needs a " +
      "just-in-time recompiler for the console's PowerPC chip and low-level GPU " +
      "access — neither of which any browser gives out. So this page doesn't try. " +
      "It's the shelf and the settings notebook; <strong>Dolphin</strong> does the " +
      "actual emulating.</p>" +

      "<h2 style='font-size:16px;margin-top:16px'>Getting Dolphin running</h2>" +
      "<p class='muted'>1. Install Dolphin from the Play Store or " +
      "dolphin-emu.org.<br>" +
      "2. Put your game files somewhere Dolphin can read them, then add that " +
      "folder in Dolphin's game list.<br>" +
      "3. Wii U is a different emulator entirely — Cemu. It's desktop-only in any " +
      "usable form; the Android builds are experimental and most games don't boot.</p>" +

      "<h2 style='font-size:16px;margin-top:16px'>The Launch button</h2>" +
      "<p class='muted'>It opens Dolphin's game list. Dolphin doesn't publish a " +
      "URL scheme for booting one specific game, so nothing on the web can jump " +
      "straight into a title — pick it from Dolphin's own list once you're there.</p>" +

      "<h2 style='font-size:16px;margin-top:16px'>Where games come from</h2>" +
      "<p class='muted'>Dolphin plays discs you dump from your own Wii using a " +
      "homebrew tool. Wii U images additionally need the encryption keys from your " +
      "own console. This app never downloads or ships game files.</p>" +

      '<div class="panel-actions"><button class="wii-btn" data-close>Got it</button></div>'
    );
  }

  /* ---------- Wiring ----------------------------------------------------- */

  document.getElementById("btn-home").addEventListener("click", () => {
    WiiUI.feedback("back");
    location.href = "index.html";
  });

  document.getElementById("btn-guide").addEventListener("click", () => {
    WiiUI.feedback("click");
    openGuide();
  });

  document.getElementById("btn-add").addEventListener("click", () => {
    WiiUI.feedback("click");
    editEntry({ title: "Untitled", platform: "wii", status: "backlog", rating: 0, notes: "", settings: "" });
  });

  document.getElementById("btn-launch").addEventListener("click", launchDolphin);

  document.getElementById("filters").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    WiiUI.feedback("click");
    filter = chip.getAttribute("data-filter");
    document.querySelectorAll(".chip").forEach((el) => el.classList.toggle("is-on", el === chip));
    render();
  });

  refresh();
})();
