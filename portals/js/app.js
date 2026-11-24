/* The page: lock screen, the arrow-through-your-portals viewer, and the list
 * editor. All the rules live in model.js and vault.js; this file only draws and
 * wires them up.
 *
 * Everything that came out of the vault is put on the page with textContent /
 * Node.append, never innerHTML, so a portal called "<img onerror=...>" is just
 * a funny name.
 */

(function () {
  "use strict";

  const AUTOLOCK_MS = 30 * 60 * 1000;

  const $ = function (id) { return document.getElementById(id); };

  const storage = (function () {
    try {
      const s = window.localStorage;
      s.setItem("college-portals.probe", "1");
      s.removeItem("college-portals.probe");
      return s;
    } catch (err) { return null; }
  })();

  const state = {
    view: "boot",
    session: null,   // the key, while unlocked
    data: null,      // the decrypted portal list, while unlocked
    index: 0,
    revealed: false,
    editingId: null, // the portal being edited in the form, or null for a new one
  };
  let saveChain = Promise.resolve();
  let lastActive = Date.now();

  /* ------------------------------------------------------------------ bits */

  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (let i = 2; i < arguments.length; i++) el.append(arguments[i]);
    return el;
  }

  const VIEWS = {
    unsupported: ["v-unsupported"],
    setup: ["v-setup", "v-restore"],
    locked: ["v-locked", "v-restore"],
    viewer: ["v-viewer"],
    manage: ["v-manage"],
  };

  function show(name, focusId) {
    Object.keys(VIEWS).forEach(function (k) {
      VIEWS[k].forEach(function (id) { $(id).hidden = true; });
    });
    VIEWS[name].forEach(function (id) { $(id).hidden = false; });
    $("top-actions").hidden = !(name === "viewer" || name === "manage");
    state.view = name;
    if (focusId) $(focusId).focus();
  }

  let toastTimer = 0;
  function say(message, kind) {
    const el = $("status");
    el.textContent = message || "";
    el.className = "toast" + (message ? " on " + (kind || "") : "");
    clearTimeout(toastTimer);
    if (message) toastTimer = setTimeout(function () { say(""); }, 3600);
  }

  /* The Clipboard API wants a secure context and a user gesture; the old
   * execCommand path covers the cases where it refuses. */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) { /* fall through */ }
    try {
      const ta = h("textarea", { readonly: true, class: "offscreen", "aria-hidden": "true", tabindex: "-1" });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (err) { return false; }
  }

  function copyAndSay(text, what) {
    if (!text) { say("No " + what + " saved for this portal.", "bad"); return; }
    copyText(text).then(function (ok) {
      say(ok ? "Copied the " + what + "." : "The browser wouldn't let me copy. Use Show and copy it by hand.", ok ? "" : "bad");
    });
  }

  /* A colour per portal, from its name, so they are easy to tell apart. */
  function hueOf(name) {
    let hue = 0;
    for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360;
    return hue;
  }

  function letterOf(name) {
    return (name.trim()[0] || "?").toUpperCase();
  }

  function avatar(p) {
    const el = h("div", { class: "avatar", "aria-hidden": "true" }, letterOf(p.name));
    el.style.setProperty("--hue", String(hueOf(p.name)));
    return el;
  }

  function current() { return state.data.portals[state.index] || null; }
  function today() { return Model.todayKey(); }

  /* --------------------------------------------------------------- saving */

  /* Saves are queued so two quick changes can't land out of order. */
  function persist() {
    const session = state.session;
    const snapshot = structuredClone(state.data);
    saveChain = saveChain.then(async function () {
      try {
        Vault.write(storage, await Vault.seal(session, snapshot));
      } catch (err) {
        say("Couldn't save that: " + err.message, "bad");
      }
    });
    return saveChain;
  }

  /* --------------------------------------------------------------- viewer */

  let frameUrl = null;
  function setFrame(url) {
    // Redrawing the page (Show password, tick the checkbox) must not reload
    // the portal you are halfway through using.
    if (url === frameUrl) return;
    frameUrl = url;
    const box = $("frame-box");
    box.replaceChildren();
    if (!url) return;
    // Never frame this site's own pages: a same-origin frame with scripts could
    // reach back into this one.
    try { if (new URL(url).origin === location.origin) { frameUrl = null; return; } } catch (err) { frameUrl = null; return; }
    // Sandboxed with no top-navigation, so a portal's frame-busting script
    // can't redirect this page; the portal itself keeps its scripts and forms.
    box.append(h("iframe", {
      src: url,
      title: "Portal preview",
      referrerpolicy: "no-referrer",
      sandbox: "allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
    }));
  }

  function replay(el, cls) {
    el.classList.remove("from-left", "from-right");
    void el.offsetWidth;                // restart the animation
    if (cls) el.classList.add(cls);
  }

  function renderViewer(direction) {
    const d = state.data;
    const n = d.portals.length;
    $("empty").hidden = n > 0;
    $("carousel").hidden = n === 0;
    if (!n) { setFrame(null); return; }

    state.index = Math.min(state.index, n - 1);
    const p = current();
    const day = today();
    const checked = Model.isChecked(d, p.id, day);
    const dir = direction > 0 ? "from-right" : direction < 0 ? "from-left" : "";

    const av = $("now-avatar");
    av.textContent = letterOf(p.name);
    av.style.setProperty("--hue", String(hueOf(p.name)));
    $("now-name").textContent = p.name;
    $("now-count").textContent = (state.index + 1) + " of " + n;
    replay($("now"), dir);
    replay($("card"), dir);

    $("dots").replaceChildren.apply($("dots"), d.portals.map(function (q, i) {
      const done = Model.isChecked(d, q.id, day);
      return h("button", {
        type: "button",
        class: "dot" + (done ? " done" : "") + (i === state.index ? " here" : ""),
        "aria-label": q.name + (done ? ", checked today" : ""),
        "aria-current": i === state.index ? "true" : false,
        title: q.name,
        onclick: function () { jump(i); },
      });
    }));

    $("card-host").textContent = p.url ? Model.hostOf(p.url) : "No web address — edit this portal";

    const user = $("c-user");
    user.textContent = p.username || "—";
    user.classList.toggle("empty", !p.username);
    const pass = $("c-pass");
    pass.textContent = !p.password ? "—" : state.revealed ? p.password : "••••••••••";
    pass.classList.toggle("empty", !p.password);
    $("btn-reveal").textContent = state.revealed ? "Hide" : "Show";
    $("btn-reveal").setAttribute("aria-pressed", String(state.revealed));
    $("btn-reveal").disabled = !p.password;
    $("btn-copy-user").disabled = !p.username;
    $("btn-copy-pass").disabled = !p.password;

    const open = $("btn-open");
    if (p.url) { open.setAttribute("href", p.url); open.removeAttribute("aria-disabled"); }
    else { open.removeAttribute("href"); open.setAttribute("aria-disabled", "true"); }

    const pill = $("btn-check");
    pill.textContent = checked ? "✓ Checked today" : "Not checked yet";
    pill.classList.toggle("on", checked);
    pill.setAttribute("aria-pressed", String(checked));

    const what = d.settings.copyOnOpen;
    $("open-note").textContent = what === "nothing" ? "" :
      "Opening copies the " + what + " — paste it into the portal's login.";

    const done = Model.countChecked(d, day);
    $("progress").textContent = done === n ? "All " + n + " checked today ✓" : done + " of " + n + " checked today";
    $("progress").classList.toggle("all", done === n);

    $("chk-embed").checked = d.settings.embed;
    $("embed").hidden = !(d.settings.embed && p.url);
    setFrame(d.settings.embed && p.url ? p.url : null);
  }

  function go(delta) {
    const n = state.data.portals.length;
    if (!n) return;
    state.index = Model.cycle(state.index, delta, n);
    state.revealed = false;
    renderViewer(delta);
  }

  function jump(i) {
    const delta = i - state.index;
    state.index = i;
    state.revealed = false;
    renderViewer(delta);
  }

  /* --------------------------------------------------------------- manage */

  function renderManage() {
    const d = state.data;
    const list = $("plist");
    list.replaceChildren.apply(list, d.portals.map(function (p, i) {
      return h("li", { class: "prow" },
        avatar(p),
        h("div", { class: "pinfo" },
          h("strong", {}, p.name),
          h("span", { class: "fine" }, (p.url ? Model.hostOf(p.url) : "no web address") + " · " + (p.username || "no username"))),
        h("div", { class: "pbtns" },
          h("button", { class: "small", type: "button", "aria-label": "Move " + p.name + " up", disabled: i === 0, onclick: function () { reorder(p.id, -1); } }, "↑"),
          h("button", { class: "small", type: "button", "aria-label": "Move " + p.name + " down", disabled: i === d.portals.length - 1, onclick: function () { reorder(p.id, 1); } }, "↓"),
          h("button", { class: "small", type: "button", "aria-label": "Edit " + p.name, onclick: function () { openForm(p.id); } }, "Edit"),
          h("button", { class: "small danger", type: "button", "aria-label": "Delete " + p.name, onclick: function () { removePortal(p.id); } }, "Delete")));
    }));
    $("sel-copy").value = d.settings.copyOnOpen;
  }

  function reorder(id, delta) {
    if (Model.move(state.data, id, delta)) { persist(); renderManage(); }
  }

  function removePortal(id) {
    const p = state.data.portals[Model.indexOfId(state.data, id)];
    if (!p || !confirm("Delete \"" + p.name + "\" and its saved login?")) return;
    Model.remove(state.data, id);
    state.index = Math.max(0, Math.min(state.index, state.data.portals.length - 1));
    if (state.editingId === id) closeForm();
    persist();
    renderManage();
  }

  function setFormReveal(on) {
    $("i-pass").type = on ? "text" : "password";
    $("btn-form-reveal").textContent = on ? "Hide" : "Show";
    $("btn-form-reveal").setAttribute("aria-pressed", String(on));
  }

  function openForm(id) {
    const p = id ? state.data.portals[Model.indexOfId(state.data, id)] : null;
    state.editingId = p ? p.id : null;
    $("f-portal-title").textContent = p ? "Edit " + p.name : "Add a portal";
    $("i-name").value = p ? p.name : "";
    $("i-url").value = p ? p.url : "";
    $("i-user").value = p ? p.username : "";
    $("i-pass").value = p ? p.password : "";
    $("e-portal").textContent = "";
    setFormReveal(false);
    $("f-portal").hidden = false;
    $("f-portal").scrollIntoView({ block: "nearest" });
    $("i-name").focus();
  }

  function closeForm() {
    state.editingId = null;
    $("f-portal").reset();
    setFormReveal(false);
    $("f-portal").hidden = true;
  }

  function saveForm(e) {
    e.preventDefault();
    const name = $("i-name").value.trim();
    const url = Model.normalizeUrl($("i-url").value);
    if (!name) { $("e-portal").textContent = "Give it a name."; return; }
    if (!url) {
      $("e-portal").textContent = "That doesn't look like a web address. Try something like canvas.yourschool.edu (web addresses only, with no login in them).";
      return;
    }
    const fields = { name: name, url: url, username: $("i-user").value.trim(), password: $("i-pass").value };
    const existing = state.editingId ? state.data.portals[Model.indexOfId(state.data, state.editingId)] : null;
    if (existing) {
      Object.assign(existing, fields);
    } else {
      state.data.portals.push(Object.assign({ id: Model.newId() }, fields));
      state.index = state.data.portals.length - 1;
    }
    persist();
    closeForm();
    renderManage();
    say(existing ? "Saved." : "Added " + name + ".");
  }

  /* -------------------------------------------------------- lock / unlock */

  function enterVault(session, data, startAt) {
    state.session = session;
    state.data = Model.sanitize(data);
    state.index = startAt === "first-unchecked" ? Model.firstUnchecked(state.data, today()) : 0;
    state.revealed = false;
    lastActive = Date.now();
    show("viewer");
    renderViewer(0);
    $(state.data.portals.length ? "btn-open" : "btn-first").focus();
  }

  function lock(message) {
    state.session = null;
    state.data = null;
    state.revealed = false;
    // Wipe what was drawn, so nothing readable sits in the hidden page.
    setFrame(null);
    ["c-user", "c-pass", "now-name", "card-host", "now-count"].forEach(function (id) { $(id).textContent = ""; });
    $("dots").replaceChildren();
    $("plist").replaceChildren();
    closeForm();
    $("i-unlock").value = "";
    $("e-unlock").textContent = "";
    show("locked", "i-unlock");
    if (message) say(message);
  }

  async function onSetup(e) {
    e.preventDefault();
    const a = $("i-setup-1").value;
    const b = $("i-setup-2").value;
    const err = $("e-setup");
    err.textContent = "";
    if (a.length < Vault.MIN_PASSPHRASE) { err.textContent = "Use at least " + Vault.MIN_PASSPHRASE + " characters."; return; }
    if (a !== b) { err.textContent = "Those two don't match."; return; }
    const btn = $("b-setup");
    btn.disabled = true;
    btn.textContent = "Creating…";
    try {
      const session = await Vault.create(a);
      state.session = session;
      state.data = Model.emptyData();
      await persist();
      if (!Vault.read(storage)) throw new Error("the browser didn't keep it");
      $("f-setup").reset();
      enterVault(session, Model.emptyData(), "top");
    } catch (ex) {
      state.session = null;
      state.data = null;
      err.textContent = "Couldn't create the vault: " + ex.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Create my vault";
    }
  }

  async function onUnlock(e) {
    e.preventDefault();
    const err = $("e-unlock");
    err.textContent = "";
    const btn = $("b-unlock");
    btn.disabled = true;
    btn.textContent = "Unlocking…";
    try {
      const stored = Vault.read(storage);
      if (!stored) { show("setup", "i-setup-1"); say("There's no vault on this device any more."); return; }
      const opened = await Vault.open(stored, $("i-unlock").value);
      $("i-unlock").value = "";
      enterVault(opened.session, opened.data, "first-unchecked");
    } catch (ex) {
      $("i-unlock").value = "";
      err.textContent = ex instanceof Vault.VaultError ? ex.message : "Couldn't unlock: " + ex.message;
      $("i-unlock").focus();
    } finally {
      btn.disabled = false;
      btn.textContent = "Unlock";
    }
  }

  async function onRestore(e) {
    e.preventDefault();
    const err = $("e-restore");
    err.textContent = "";
    const file = $("i-restore-file").files[0];
    if (!file) return;
    if (Vault.read(storage) && !confirm("This replaces the vault saved on this device. Continue?")) return;
    const btn = $("b-restore");
    btn.disabled = true;
    btn.textContent = "Restoring…";
    try {
      const envelope = Vault.parse(await file.text());
      const opened = await Vault.open(envelope, $("i-restore-pass").value);   // proves the passphrase first
      Vault.write(storage, envelope);
      $("f-restore").reset();
      enterVault(opened.session, opened.data, "first-unchecked");
      say("Restored " + state.data.portals.length + " portal" + (state.data.portals.length === 1 ? "" : "s") + ".");
    } catch (ex) {
      err.textContent = ex instanceof Vault.VaultError ? ex.message : "Couldn't restore: " + ex.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Restore";
    }
  }

  async function eraseAll() {
    if (!confirm("Erase every saved portal and login from this browser? This can't be undone (a backup file still works).")) return;
    await saveChain;                    // a save still in flight would put it all back
    Vault.clear(storage);
    state.session = null;
    state.data = null;
    lock();
    show("setup", "i-setup-1");
    say("Erased.");
  }

  async function exportBackup() {
    await saveChain;
    const text = Vault.read(storage);
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = h("a", { href: url, download: "college-portals-backup-" + Model.todayKey() + ".json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    say("Backup downloaded. It's encrypted with your passphrase.");
  }

  /* ----------------------------------------------------------------- wiring */

  function wire() {
    $("f-setup").addEventListener("submit", onSetup);
    $("f-unlock").addEventListener("submit", onUnlock);
    $("f-restore").addEventListener("submit", onRestore);
    $("btn-forgot").addEventListener("click", eraseAll);
    $("btn-erase").addEventListener("click", eraseAll);

    $("btn-lock").addEventListener("click", function () { lock(); });
    $("btn-manage").addEventListener("click", function () { renderManage(); closeForm(); show("manage"); });
    $("btn-manage-done").addEventListener("click", function () { closeForm(); show("viewer"); renderViewer(0); });

    $("btn-prev").addEventListener("click", function () { go(-1); });
    $("btn-next").addEventListener("click", function () { go(1); });

    $("btn-first").addEventListener("click", function () { renderManage(); show("manage"); openForm(null); });
    $("btn-add").addEventListener("click", function () { openForm(null); });
    $("f-portal").addEventListener("submit", saveForm);
    $("btn-form-cancel").addEventListener("click", closeForm);
    $("btn-form-reveal").addEventListener("click", function () { setFormReveal($("i-pass").type === "password"); });

    $("btn-copy-user").addEventListener("click", function () { copyAndSay(current().username, "username"); });
    $("btn-copy-pass").addEventListener("click", function () { copyAndSay(current().password, "password"); });
    $("btn-reveal").addEventListener("click", function () { state.revealed = !state.revealed; renderViewer(0); });

    $("btn-check").addEventListener("click", function () {
      const p = current();
      Model.setChecked(state.data, p.id, !Model.isChecked(state.data, p.id, today()), today());
      persist();
      renderViewer(0);
    });
    $("btn-done").addEventListener("click", function () {
      Model.setChecked(state.data, current().id, true, today());
      persist();
      go(1);
    });

    // A real link, so middle-click and "open in new tab" work. Copying has to
    // start inside this click, while the browser still counts it as a gesture.
    $("btn-open").addEventListener("click", function (e) {
      const p = current();
      if (!p.url) { e.preventDefault(); return; }
      const what = state.data.settings.copyOnOpen;
      if (what !== "nothing") copyAndSay(what === "password" ? p.password : p.username, what);
    });

    $("chk-embed").addEventListener("change", function () {
      state.data.settings.embed = $("chk-embed").checked;
      persist();
      renderViewer(0);
    });
    $("sel-copy").addEventListener("change", function () {
      state.data.settings.copyOnOpen = $("sel-copy").value;
      persist();
    });
    $("btn-export").addEventListener("click", exportBackup);

    document.addEventListener("keydown", function (e) {
      if (state.view !== "viewer" || !state.data || !state.data.portals.length) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });

    // Lock after a while away. Time spent in the portals' own tabs counts as
    // away, which is the point: this tab is the one holding the passwords.
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
      document.addEventListener(ev, function () { lastActive = Date.now(); }, { passive: true });
    });
    const checkIdle = function () {
      if (state.session && Date.now() - lastActive > AUTOLOCK_MS) lock("Locked after 30 minutes away.");
    };
    setInterval(checkIdle, 15000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) checkIdle(); });

    // Another tab changed the vault: this one is now looking at old data and
    // would overwrite the newer list on its next save.
    window.addEventListener("storage", function (e) {
      // key === null is localStorage.clear() in another tab.
      if ((e.key === Vault.STORAGE_KEY || e.key === null) && state.session) {
        lock("The portals changed in another tab — unlock again.");
      }
    });
  }

  function boot() {
    wire();
    if (!window.crypto || !crypto.subtle) {
      $("unsupported-why").textContent = "Encryption is only available on a secure connection. Open this page over https:// (or from localhost).";
      show("unsupported");
    } else if (!storage) {
      $("unsupported-why").textContent = "The browser is blocking local storage (private browsing, or site data turned off), so there's nowhere to keep the encrypted vault.";
      show("unsupported");
    } else if (Vault.read(storage)) {
      show("locked", "i-unlock");
    } else {
      show("setup", "i-setup-1");
    }
  }

  boot();
})();
