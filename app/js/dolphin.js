/* Dolphin Command Center — the Wii / Wii U half of the app.
 *
 * Browsers can't emulate a Wii, so this side doesn't pretend to. It tracks the
 * library, keeps per-game Dolphin settings where you can actually find them,
 * and hands off to the real emulator. */

const DolphinView = (function () {
  const esc = WiiUI.escapeHtml;
  const shelfEl = document.getElementById("shelf");
  const viewEl = document.getElementById("view-dolphin");
  const menuEl = document.getElementById("view-menu");

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

  const DOLPHINIOS_SITE = "https://dolphinios.oatmealdome.me";

  function isApplePhone() {
    // iPadOS reports itself as a Mac, so touch points are the giveaway.
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function launchDolphin() {
    if (/android/i.test(navigator.userAgent)) {
      // Chrome resolves this to Dolphin's launcher activity, and falls back to
      // the Play Store listing when it isn't installed.
      WiiUI.feedback("boot");
      location.href = "intent:#Intent;package=" + DOLPHIN_PACKAGE +
        ";action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;" +
        "S.browser_fallback_url=" + encodeURIComponent(PLAY_STORE) + ";end";
      return;
    }

    if (isApplePhone()) {
      showIphoneRoute();
      return;
    }

    showDesktopRoute();
  }

  /* ---------- Desktop: actually opening Dolphin --------------------------
     If Wii Bridge is running on this computer, the button really does open
     the emulator — the bridge is a local program and can do what the page
     cannot. Without it there is nothing to press, so the panel says how to
     start it rather than showing a button that does nothing. */

  function showDesktopRoute() {
    WiiUI.play("hover");
    WiiUI.panel(
      "<h2>Dolphin on this computer</h2>" +
      '<div id="bridge-state">' +
        '<p class="muted"><span class="spinner is-inline"></span> ' +
        "Looking for Wii Bridge…</p>" +
      "</div>" +
      '<div class="panel-actions" id="bridge-actions">' +
        '<button class="wii-btn" data-close>Close</button>' +
      "</div>",
      { noAutofocus: true }
    );

    const stateEl = document.getElementById("bridge-state");
    const actionsEl = document.getElementById("bridge-actions");
    if (!stateEl) return;

    LocalBridge.probe().then((status) => {
      if (!status) {
        stateEl.innerHTML =
          "<p>Dolphin is installed on your computer, not in this page — so " +
          "this page can't open it on its own. <strong>Wii Bridge</strong> is " +
          "a small helper that can.</p>" +
          '<p class="muted">In a terminal, from your copy of this repo:</p>' +
          '<pre class="code-block">python3 app/bridge/wiibridge.py</pre>' +
          '<p class="muted">Leave it running and press Launch again. It also ' +
          "turns your phone into a Wii Remote — motion and all — which is the " +
          "only way Wii Sports is worth playing without the real thing.</p>" +
          '<p class="muted" style="font-size:12px">Already running? The browser ' +
          "has to trust the bridge's certificate before it will talk to it. " +
          "The README has the one command for that.</p>";
        return;
      }

      if (!status.canLaunch) {
        stateEl.innerHTML =
          "<p>Wii Bridge is running, but it can't find Dolphin on this " +
          "computer.</p>" +
          '<p class="muted">Put <strong>Dolphin.app</strong> in your ' +
          "Applications folder and press Launch again.</p>";
        actionsEl.insertAdjacentHTML("afterbegin",
          '<a class="wii-btn is-primary" href="https://dolphin-emu.org/download/" ' +
          'target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">' +
          "Get Dolphin</a>");
        return;
      }

      stateEl.innerHTML =
        "<p>Wii Bridge is running and Dolphin is installed. " +
        "This will open it.</p>" +
        '<p class="muted">' + (status.dolphin
          ? "Dolphin is already talking to the bridge, so your phone's motion " +
            "is going through."
          : "Dolphin isn't reading the bridge yet — turn on the DSU client in " +
            "its controller settings to use your phone as a Wii Remote.") +
        "</p>";

      const button = document.createElement("button");
      button.className = "wii-btn is-primary";
      button.textContent = "Open Dolphin";
      button.addEventListener("click", () => {
        WiiUI.feedback("boot");
        button.disabled = true;
        button.textContent = "Opening…";
        LocalBridge.launch().then((result) => {
          button.disabled = false;
          button.textContent = "Open Dolphin";
          if (result.ok) {
            WiiUI.toast("Dolphin is opening", 2600);
          } else {
            WiiUI.toast(result.message || "Couldn't open Dolphin", 5000);
            WiiUI.play("error");
          }
        });
      });
      actionsEl.insertBefore(button, actionsEl.firstChild);
    });
  }

  /* iPhone can run Dolphin, but nothing on a web page can start it: iOS only
     lets a link open an app that has registered a URL scheme, and DolphiniOS
     publishes none. So this explains the route instead of pretending to
     launch — including the part that catches people out. */
  function showIphoneRoute() {
    WiiUI.play("hover");
    WiiUI.panel(
      "<h2>Dolphin on iPhone</h2>" +
      "<p>It exists — <strong>DolphiniOS</strong>, the official iOS port of " +
      "Dolphin. It plays GameCube and Wii games on an iPhone.</p>" +

      "<h3>Watch out for fakes</h3>" +
      '<p class="muted">DolphiniOS is <strong>not on the App Store</strong>. ' +
      "Apps there calling themselves “Dolphin Emulator” are not it — Apple " +
      "doesn't allow what Dolphin needs to run at speed, so anything claiming " +
      "otherwise is somebody else's app using the name.</p>" +

      "<h3>The real way in</h3>" +
      '<p class="muted">You install it yourself with <strong>SideStore</strong> ' +
      "or <strong>AltStore Classic</strong>, which needs a computer running " +
      "AltServer once to set up — Windows is fine, it doesn't have to be a Mac. " +
      "After that it lives on your phone like any other app.</p>" +
      '<p class="muted">Then add OatmealDome\'s source inside that app and ' +
      "install DolphiniOS from it. The official site has the current steps.</p>" +

      "<h3>Before you bother</h3>" +
      '<p class="muted">GameCube wants an iPhone 13 or newer to run properly, ' +
      "and Wii is heavier still. On an older phone it will struggle whatever " +
      "you do.</p>" +

      '<p class="muted">There is no button for this because iOS gives a web ' +
      "page no way to open it. Once it's installed you launch it from your " +
      "home screen, and this shelf keeps your settings and notes.</p>" +

      '<div class="panel-actions">' +
        '<a class="wii-btn is-primary" href="' + DOLPHINIOS_SITE + '" ' +
        'target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">' +
        "Official DolphiniOS site</a>" +
        '<button class="wii-btn" data-close>Close</button>' +
      "</div>",
      { noAutofocus: true }
    );
  }

  /* ---------- Phone as a Wii Remote --------------------------------------
     Deliberately its own button rather than a note buried in the guide: it is
     a different job from launching the emulator, and it's the answer to the
     one thing keyboard-and-mouse Dolphin genuinely can't do. */

  function showRemoteRoute() {
    WiiUI.feedback("click");
    const onPhone = isApplePhone() || /android/i.test(navigator.userAgent);

    WiiUI.panel(
      "<h2>Your phone as a Wii Remote</h2>" +
      "<p>Your phone has a gyroscope and an accelerometer — the same two " +
      "things a Wii Remote has. <strong>Wii Bridge</strong> carries them into " +
      "Dolphin, so swinging the phone swings the remote. That's Wii Sports, " +
      "Wii Play, Zelda's pointer — the parts a keyboard can't do.</p>" +
      '<div id="remote-state"><p class="muted">' +
        '<span class="spinner is-inline"></span>Looking for the bridge…</p></div>' +
      '<div class="panel-actions" id="remote-actions">' +
        '<button class="wii-btn" data-close>Close</button>' +
      "</div>",
      { noAutofocus: true }
    );

    const stateEl = document.getElementById("remote-state");
    const actionsEl = document.getElementById("remote-actions");
    if (!stateEl) return;

    LocalBridge.probe().then((status) => {
      if (status) {
        stateEl.innerHTML =
          "<p>The bridge is running on this machine.</p>" +
          '<p class="muted">' + (status.dolphin
            ? "Dolphin is connected to it."
            : "Dolphin isn't reading it yet — Config → Controllers → " +
              "Alternate Input Sources → Enable, server 127.0.0.1:26760.") +
          "</p>";
        actionsEl.insertAdjacentHTML("afterbegin",
          '<a class="wii-btn is-primary" href="' + LocalBridge.controllerUrl() + '" ' +
          'target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex">' +
          "Open the controller</a>");
        return;
      }

      stateEl.innerHTML = onPhone
        ? "<p>Start the bridge on your computer first:</p>" +
          '<pre class="code-block">python3 app/bridge/wiibridge.py</pre>' +
          '<p class="muted">It prints an address. Open that address on this ' +
          "phone — the first time it walks you through trusting its " +
          "certificate, which Safari needs before it will hand over the " +
          "motion sensors.</p>"
        : "<p>Run this on this computer, from your copy of the repo:</p>" +
          '<pre class="code-block">python3 app/bridge/wiibridge.py</pre>' +
          '<p class="muted">It prints an address to open on your phone. ' +
          "Nothing to install — it's plain Python, and everything stays on " +
          "your own network.</p>";

      stateEl.insertAdjacentHTML("beforeend",
        '<p class="muted" style="font-size:12px">Full walkthrough, including ' +
        "which Dolphin fields to bind: <strong>app/bridge/README.md</strong>.</p>");
    });
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
      "<p class='muted'><strong>Android:</strong> install Dolphin from the Play " +
      "Store or dolphin-emu.org.<br>" +
      "<strong>iPhone:</strong> DolphiniOS, sideloaded with SideStore or AltStore " +
      "Classic. It is not on the App Store, and the apps there using the name are " +
      "not it.<br>" +
      "<strong>Computer:</strong> Dolphin installs normally on Windows, macOS and " +
      "Linux.</p>" +
      "<p class='muted'>Then point the emulator at a folder holding your game " +
      "files and they appear in its list. Wii U is a different emulator entirely " +
      "— Cemu — and is desktop-only in any usable form.</p>" +

      "<h2 style='font-size:16px;margin-top:16px'>The Launch button</h2>" +
      "<p class='muted'>On Android it opens Dolphin's game list. Dolphin doesn't " +
      "publish a URL scheme for booting one specific game, so nothing on the web " +
      "can jump straight into a title — pick it from Dolphin's own list.<br>" +
      "On iPhone the button explains how to install DolphiniOS instead, because " +
      "iOS gives a web page no way to open it at all.</p>" +

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
    hide();
  });

  document.getElementById("btn-guide").addEventListener("click", () => {
    WiiUI.feedback("click");
    openGuide();
  });

  document.getElementById("btn-add").addEventListener("click", () => {
    WiiUI.feedback("click");
    editEntry({ title: "Untitled", platform: "wii", status: "backlog", rating: 0, notes: "", settings: "" });
  });

  document.getElementById("btn-remote").addEventListener("click", showRemoteRoute);

  const launchButton = document.getElementById("btn-launch");
  launchButton.addEventListener("click", launchDolphin);
  // Say what the button will actually do on this device.
  const launchSub = launchButton.querySelector(".btn-sub");
  if (launchSub) {
    if (/android/i.test(navigator.userAgent)) {
      launchSub.textContent = "android";
    } else if (isApplePhone()) {
      launchButton.firstChild.textContent = "Dolphin on iPhone";
      launchSub.textContent = "how to install";
    } else {
      launchSub.textContent = "desktop";
    }
  }

  document.getElementById("filters").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    WiiUI.feedback("click");
    filter = chip.getAttribute("data-filter");
    document.querySelectorAll(".chip").forEach((el) => el.classList.toggle("is-on", el === chip));
    render();
  });

  function show() {
    menuEl.hidden = true;
    viewEl.hidden = false;
    window.scrollTo(0, 0);
    if (location.hash !== "#dolphin") location.hash = "#dolphin";
    return refresh();
  }

  function hide() {
    viewEl.hidden = true;
    menuEl.hidden = false;
    window.scrollTo(0, 0);
    if (location.hash === "#dolphin") {
      // Replace rather than push, so Back doesn't bounce straight back in.
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  // Deep links and the Back gesture both route through the hash.
  window.addEventListener("hashchange", () => {
    if (location.hash === "#dolphin") {
      if (viewEl.hidden) show();
    } else if (!viewEl.hidden) {
      hide();
    }
  });

  if (location.hash === "#dolphin") {
    show();
  } else {
    refresh();
  }

  return { show: show, hide: hide, refresh: refresh };
})();
