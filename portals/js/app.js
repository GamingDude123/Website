/* The page: a lock screen, the arrows, and one small add/edit form.
 *
 * Everything that came out of the vault is put on the page with textContent,
 * never innerHTML, so a portal called "<img onerror=...>" is just a funny name.
 */

(function () {
  "use strict";

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
    session: null,   // the key, while unlocked
    data: null,      // the decrypted portal list, while unlocked
    index: 0,
    revealed: false,
    editingId: null, // the portal in the form, or null when adding a new one
  };
  let saveChain = Promise.resolve();

  const VIEWS = ["unsupported", "setup", "locked", "viewer", "form"];

  function show(name, focusId) {
    VIEWS.forEach(function (v) { $("v-" + v).hidden = v !== name; });
    $("btn-lock").hidden = name !== "viewer" && name !== "form";
    if (focusId) $(focusId).focus();
  }

  function current() { return state.data.portals[state.index]; }

  /* A save is queued behind the last one so two quick changes can't land out of
   * order. */
  function persist() {
    const session = state.session;
    const snapshot = structuredClone(state.data);
    saveChain = saveChain.then(async function () {
      try { Vault.write(storage, await Vault.seal(session, snapshot)); }
      catch (err) { alert("Couldn't save that: " + err.message); }
    });
    return saveChain;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (err) { return false; }
  }

  /* Say "Copied" on the button itself instead of showing a pop-up. */
  function copyFrom(btn, text) {
    copyText(text).then(function (ok) {
      btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.textContent = ok ? "Copied ✓" : "Couldn't copy";
      clearTimeout(btn.timer);
      btn.timer = setTimeout(function () { btn.textContent = btn.dataset.label; }, 1500);
    });
  }

  /* ---------------------------------------------------------------- viewer */

  function render() {
    const n = state.data.portals.length;
    $("empty").hidden = n > 0;
    $("carousel").hidden = n === 0;
    if (!n) return;

    state.index = Math.min(state.index, n - 1);
    const p = current();
    $("now-name").textContent = p.name;
    $("now-count").textContent = (state.index + 1) + " of " + n;
    $("btn-prev").disabled = $("btn-next").disabled = n < 2;
    $("card-host").textContent = p.url ? Model.hostOf(p.url) : "No web address — tap Edit";

    $("c-user").textContent = p.username || "—";
    $("c-user").classList.toggle("empty", !p.username);
    const pass = $("btn-pass");
    pass.textContent = !p.password ? "—" : state.revealed ? p.password : "••••••••••";
    pass.disabled = !p.password;
    pass.classList.toggle("empty", !p.password);
    $("btn-copy-user").disabled = !p.username;
    $("btn-copy-pass").disabled = !p.password;

    const open = $("btn-open");
    if (p.url) { open.setAttribute("href", p.url); open.removeAttribute("aria-disabled"); }
    else { open.removeAttribute("href"); open.setAttribute("aria-disabled", "true"); }
    $("open-note").textContent = "Also copies your password — just paste it into the login.";
  }

  function go(delta) {
    const n = state.data.portals.length;
    if (n < 2) return;
    state.index = Model.cycle(state.index, delta, n);
    state.revealed = false;
    render();
  }

  /* ------------------------------------------------------------------ form */

  function setFormReveal(on) {
    $("i-pass").type = on ? "text" : "password";
    $("btn-form-reveal").textContent = on ? "Hide" : "Show";
    $("btn-form-reveal").setAttribute("aria-pressed", String(on));
  }

  function openForm(editing) {
    const p = editing ? current() : null;
    state.editingId = p ? p.id : null;
    $("form-title").textContent = p ? "Edit " + p.name : "Add a portal";
    $("i-name").value = p ? p.name : "";
    $("i-url").value = p ? p.url : "";
    $("i-user").value = p ? p.username : "";
    $("i-pass").value = p ? p.password : "";
    $("btn-delete").hidden = !p;
    $("e-portal").textContent = "";
    setFormReveal(false);
    show("form", "i-name");
  }

  function closeForm() {
    state.editingId = null;
    $("f-portal").reset();
    setFormReveal(false);
    show("viewer");
    render();
  }

  function saveForm(e) {
    e.preventDefault();
    const name = $("i-name").value.trim();
    const url = Model.normalizeUrl($("i-url").value);
    if (!name) { $("e-portal").textContent = "Give it a name."; return; }
    if (!url) {
      $("e-portal").textContent = "That doesn't look like a web address. Try something like canvas.yourschool.edu.";
      return;
    }
    const fields = { name: name, url: url, username: $("i-user").value.trim(), password: $("i-pass").value };
    if (state.editingId) {
      Object.assign(current(), fields);
    } else {
      state.data.portals.push(Object.assign({ id: Model.newId() }, fields));
      state.index = state.data.portals.length - 1;
    }
    state.revealed = false;
    persist();
    closeForm();
  }

  function deletePortal() {
    const p = current();
    if (!confirm("Delete \"" + p.name + "\" and its saved login?")) return;
    state.data.portals.splice(state.index, 1);
    state.index = Math.max(0, state.index - 1);
    state.revealed = false;
    persist();
    closeForm();
  }

  /* -------------------------------------------------------- lock / unlock */

  function enterVault(session, data) {
    state.session = session;
    state.data = Model.sanitize(data);
    state.index = 0;
    state.revealed = false;
    show("viewer");
    render();
    $(state.data.portals.length ? "btn-open" : "btn-first").focus();
  }

  function lock() {
    state.session = null;
    state.data = null;
    state.revealed = false;
    // Wipe what was drawn, so nothing readable sits in the hidden page.
    ["c-user", "btn-pass", "now-name", "card-host", "now-count"].forEach(function (id) { $(id).textContent = ""; });
    $("f-portal").reset();
    $("i-unlock").value = "";
    $("e-unlock").textContent = "";
    show("locked", "i-unlock");
  }

  async function onSetup(e) {
    e.preventDefault();
    const a = $("i-setup-1").value;
    const err = $("e-setup");
    err.textContent = "";
    if (a.length < Vault.MIN_PASSPHRASE) { err.textContent = "Use at least " + Vault.MIN_PASSPHRASE + " characters."; return; }
    if (a !== $("i-setup-2").value) { err.textContent = "Those two don't match."; return; }
    const btn = $("b-setup");
    btn.disabled = true;
    btn.textContent = "Creating…";
    try {
      state.session = await Vault.create(a);
      state.data = { v: 1, portals: [] };
      await persist();
      if (!Vault.read(storage)) throw new Error("the browser didn't keep it");
      $("f-setup").reset();
      enterVault(state.session, state.data);
    } catch (ex) {
      state.session = null;
      state.data = null;
      err.textContent = "Couldn't create it: " + ex.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Create";
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
      const opened = await Vault.open(Vault.read(storage), $("i-unlock").value);
      $("i-unlock").value = "";
      enterVault(opened.session, opened.data);
    } catch (ex) {
      $("i-unlock").value = "";
      err.textContent = ex instanceof Vault.VaultError ? ex.message : "Couldn't unlock: " + ex.message;
      $("i-unlock").focus();
    } finally {
      btn.disabled = false;
      btn.textContent = "Unlock";
    }
  }

  async function eraseAll() {
    if (!confirm("Erase every saved portal and login from this browser? This can't be undone.")) return;
    await saveChain;                    // a save still in flight would put it all back
    Vault.clear(storage);
    lock();
    show("setup", "i-setup-1");
  }

  /* ---------------------------------------------------------------- wiring */

  function wire() {
    $("f-setup").addEventListener("submit", onSetup);
    $("f-unlock").addEventListener("submit", onUnlock);
    $("btn-erase").addEventListener("click", eraseAll);
    $("btn-lock").addEventListener("click", lock);

    $("btn-prev").addEventListener("click", function () { go(-1); });
    $("btn-next").addEventListener("click", function () { go(1); });

    $("btn-pass").addEventListener("click", function () { state.revealed = !state.revealed; render(); });
    $("btn-copy-user").addEventListener("click", function () { copyFrom($("btn-copy-user"), current().username); });
    $("btn-copy-pass").addEventListener("click", function () { copyFrom($("btn-copy-pass"), current().password); });

    // A real link, so middle-click and "open in new tab" work. The copy has to
    // start inside this click, while the browser still counts it as a gesture.
    $("btn-open").addEventListener("click", function (e) {
      const p = current();
      if (!p.url) { e.preventDefault(); return; }
      if (!p.password) return;
      copyText(p.password).then(function (ok) {
        if (!ok) $("open-note").textContent = "Couldn't copy the password — tap it to show it.";
      });
    });

    $("btn-first").addEventListener("click", function () { openForm(false); });
    $("btn-add").addEventListener("click", function () { openForm(false); });
    $("btn-edit").addEventListener("click", function () { openForm(true); });
    $("f-portal").addEventListener("submit", saveForm);
    $("btn-form-cancel").addEventListener("click", closeForm);
    $("btn-delete").addEventListener("click", deletePortal);
    $("btn-form-reveal").addEventListener("click", function () { setFormReveal($("i-pass").type === "password"); });

    document.addEventListener("keydown", function (e) {
      if ($("v-viewer").hidden || !state.data || !state.data.portals.length) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });
  }

  function boot() {
    wire();
    if (!window.crypto || !crypto.subtle) {
      $("unsupported-why").textContent = "Encryption only works on a secure connection. Open this page over https:// (or from localhost).";
      show("unsupported");
    } else if (!storage) {
      $("unsupported-why").textContent = "The browser is blocking local storage (private browsing, or site data turned off), so there's nowhere to keep your logins.";
      show("unsupported");
    } else if (Vault.read(storage)) {
      show("locked", "i-unlock");
    } else {
      show("setup", "i-setup-1");
    }
  }

  boot();
})();
