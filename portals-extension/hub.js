/* The hub: every portal's status as a card, and one frame to look at any portal
 * in without leaving the page.
 *
 * Your password manager does the signing in, inside that frame, as on any other
 * page. This file keeps only the list (names and addresses), where each status
 * is on the page, and the last words each portal showed. No passwords, and
 * nothing leaves the browser except two kinds of request, both to a portal you
 * listed: loading the portal itself, and fetching its icon to find its colours.
 */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };

  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    for (let i = 2; i < arguments.length; i++) el.append(arguments[i]);
    return el;
  }

  const STAGES = ["Submitted", "Received", "In review", "Decision"];
  const OUTCOME = { admitted: "Admitted", denied: "Not admitted", waitlisted: "Waitlisted" };
  const STALE_MS = 15 * 60 * 1000;            // a portal is looked at again once its last look is older than this
  const WATCH_MS = 60 * 1000;                 // how often an open hub asks whether anything is due
  const READ_TIMEOUT_MS = 45 * 1000;          // give each portal this long to show its status
  const RECENT_MS = 7 * 24 * 60 * 60 * 1000;  // how long "changed" is worth mentioning
  const RETRY_ICON_MS = 24 * 60 * 60 * 1000;

  const frame = $("frame");
  const s = {
    tabId: 0,
    portals: [],      // { id, name, url, selector, colors }
    readings: {},     // id -> { text, at, prev, changedAt, state: ok|login|missing, tried }
    view: "overview",
    current: 0,
    picking: false,
    checking: false,
    abort: false,
    read: null,       // the check in progress: { taskId, selector, finish }
    seq: 0,
    busy: new Set(),  // ids being checked right now
    guided: false,    // walking through setting up each college in turn
    saved: "",        // what was just picked, shown while guided
    seeded: false,    // the starter list has been put in once (never again, even if you delete it all)
  };

  /* The colleges the extension already knows, and the list it starts with. Both come from
   * files that are empty in the public download and filled in for a particular person. */
  const directory = typeof COLLEGES !== "undefined" ? COLLEGES : [];
  const starter = typeof STARTER === "string" ? STARTER : "";

  /* ------------------------------------------------------------------ storage */

  function clean(p) {
    if (!p || typeof p !== "object") return null;
    const url = Portals.normalizeUrl(p.url);
    if (!url) return null;
    const c = p.colors && typeof p.colors === "object" ? p.colors : null;
    return {
      id: String(p.id || Portals.newId()),
      name: String(p.name || Portals.hostOf(url)).slice(0, 60),
      url: url,
      selector: typeof p.selector === "string" ? p.selector.slice(0, 500) : "",
      checkUrl: Portals.normalizeUrl(p.checkUrl) || "",
      colors: c && (typeof c.primary === "string" || c.failed) ? c : null,
    };
  }

  async function load() {
    const d = await chrome.storage.local.get(["portals", "readings", "seeded"]);
    s.seeded = d.seeded === true;
    s.portals = (Array.isArray(d.portals) ? d.portals : []).map(clean).filter(Boolean);
    s.readings = d.readings && typeof d.readings === "object" ? d.readings : {};
  }

  const savePortals = function () { s.seeded = true; return chrome.storage.local.set({ portals: s.portals, seeded: true }); };
  const saveReadings = function () { return chrome.storage.local.set({ readings: s.readings }); };

  /* Lets portals be shown in the frame by switching off the headers that forbid
   * it. The rule is tied to this tab, so it covers every page the frame visits
   * (a login, a redirect, the next page) and nothing anywhere else. */
  async function allowFraming() {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [s.tabId],
      addRules: [{
        id: s.tabId,
        priority: 1,
        action: { type: "modifyHeaders", responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          { header: "content-security-policy", operation: "remove" },
        ] },
        condition: { tabIds: [s.tabId], resourceTypes: ["sub_frame"] },
      }],
    });
  }

  /* ------------------------------------------------------------------ readings */

  function applyReading(id, text) {
    const old = s.readings[id] || {};
    const now = Date.now();
    const next = { text: text, at: now, tried: now, state: "ok", prev: old.prev, changedAt: old.changedAt };
    if (old.text && old.text !== text) { next.prev = old.text; next.changedAt = now; }
    s.readings[id] = next;
    saveReadings();
  }

  function markFailed(id, state) {
    const old = s.readings[id] || {};
    s.readings[id] = Object.assign({}, old, { state: state, tried: Date.now() });
    saveReadings();
  }

  /* What a content script in the portal's frame is told when it asks. */
  function task() {
    if (s.picking) return { mode: "pick" };
    if (s.read) return { mode: "read", selector: s.read.selector, taskId: s.read.taskId };
    // Looking at a portal whose status is known: note it if it shows up.
    const p = s.view === "viewer" ? s.portals[s.current] : null;
    if (p && p.selector) return { mode: "read", selector: p.selector, taskId: 0 };
    return { mode: "idle" };
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
    if (!sender.tab || sender.tab.id !== s.tabId || !msg) return;   // only this hub's own frame
    if (msg.type === "hello") {
      reply(task());
    } else if (msg.type === "result") {
      if (s.read && msg.taskId === s.read.taskId) {
        if (msg.text) s.read.finish({ text: msg.text });
        else if (msg.login) s.read.finish({ login: true });
        // Otherwise it may be a page on the way to the right one; keep waiting.
      } else if (msg.taskId === 0 && s.view === "viewer" && msg.text && s.portals[s.current]) {
        applyReading(s.portals[s.current].id, msg.text);
        renderViewer();
      }
    } else if (msg.type === "picked") {
      onPicked(msg);
    } else if (msg.type === "pick-cancelled") {
      stopPicking();
    }
  });

  function readOne(p) {
    return new Promise(function (resolve) {
      const taskId = ++s.seq;
      const finish = function (result) {
        clearTimeout(timer);
        if (s.read && s.read.taskId === taskId) s.read = null;
        resolve(result);
      };
      const timer = setTimeout(function () { finish({ missing: true }); }, READ_TIMEOUT_MS);
      s.read = { taskId: taskId, selector: p.selector, finish: finish };
      frame.src = pageOf(p);
    });
  }

  async function checkAll(only) {
    if (s.checking) return;
    s.checking = true;
    s.abort = false;
    renderOverview();
    for (const p of s.portals.slice()) {
      if (s.abort) break;
      if (!p.selector) continue;
      if (typeof only === "function" && !only(p)) continue;
      s.busy.add(p.id);
      renderOverview();
      const r = await readOne(p);
      s.busy.delete(p.id);
      if (r.aborted) break;
      if (r.text) applyReading(p.id, r.text);
      else markFailed(p.id, r.login ? "login" : "missing");
      renderOverview();
    }
    s.busy.clear();
    s.checking = false;
    if (s.view === "overview") frame.src = "about:blank";    // don't leave a portal running unseen
    renderOverview();
  }

  function abortChecks() {
    s.abort = true;
    if (s.read) s.read.finish({ aborted: true });
  }

  /* ------------------------------------------------------------------- colours */

  async function pixelsOf(url) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error("no icon");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = href;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 64, 64);
      return ctx.getImageData(0, 0, 64, 64).data;
    } finally {
      URL.revokeObjectURL(href);
    }
  }

  /* The college's colours, from the icon its own site names (or /favicon.ico). */
  async function detectColors(url) {
    const res = await fetch(url, { credentials: "omit" });
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");   // inert: nothing in it runs or loads
    const links = Array.prototype.slice.call(doc.querySelectorAll("link[rel~='apple-touch-icon'], link[rel~='icon'], link[rel='shortcut icon']"));
    const size = function (l) { return parseInt((l.getAttribute("sizes") || "0").split("x")[0], 10) || 0; };
    links.sort(function (a, b) {
      const ta = /apple-touch-icon/.test(a.getAttribute("rel")) ? 1 : 0;
      const tb = /apple-touch-icon/.test(b.getAttribute("rel")) ? 1 : 0;
      return tb - ta || size(b) - size(a);
    });
    const urls = [];
    links.forEach(function (l) {
      try { urls.push(new URL(l.getAttribute("href"), res.url).href); } catch (err) { /* skip */ }
    });
    urls.push(new URL("/favicon.ico", res.url).href);
    for (const u of urls.slice(0, 4)) {
      try {
        const palette = Portals.pickPalette(await pixelsOf(u));
        if (palette.primary) return { primary: palette.primary, secondary: palette.secondary, auto: true };
      } catch (err) { /* try the next one */ }
    }
    throw new Error("no usable icon");
  }

  async function findColors() {
    for (const p of s.portals.slice()) {
      const c = p.colors;
      if (c && (c.primary || (c.failed && Date.now() - c.at < RETRY_ICON_MS))) continue;
      try { p.colors = await detectColors(p.url); }
      catch (err) { p.colors = { failed: true, at: Date.now() }; }
      await savePortals();
      if (s.view === "overview") renderOverview();
    }
  }

  /* ------------------------------------------------------------------ overview */

  function stepper(info, dim) {
    const ol = h("ol", { class: "steps" + (dim ? " dim" : "") });
    STAGES.forEach(function (label, k) {
      const n = k + 1;
      let cls = n < info.stage ? "done" : n === info.stage ? "now" : "";
      if (n === 4 && info.outcome) { cls = "now " + info.outcome; label = OUTCOME[info.outcome]; }
      ol.append(h("li", { class: cls }, h("span", { class: "dot" }), label));
    });
    return ol;
  }

  function card(p, i) {
    const r = s.readings[p.id] || {};
    const info = r.text ? Portals.classify(r.text) : { stage: 0, outcome: null, action: false };
    const failed = r.state === "login" || r.state === "missing";
    const el = h("article", { class: "card" },
      h("div", { class: "card-head" }, h("strong", {}, p.name), h("span", { class: "fine" }, Portals.hostOf(p.url))));
    const brand = Portals.brandFor(p.colors);
    el.style.setProperty("--brand", brand.main);
    el.style.setProperty("--accent", brand.accent);

    el.append(stepper(info, failed));
    if (r.text) el.append(h("p", { class: "said" }, r.text));
    if (info.action) el.append(h("span", { class: "pill" }, "Action needed"));

    let note = null;
    if (s.busy.has(p.id)) note = h("p", { class: "note" }, "Checking…");
    else if (!p.selector) note = h("p", { class: "note" }, "Not set up yet. Open it and pick the status.");
    else if (r.state === "login") note = h("p", { class: "note warn" }, "Sign in needed" + (r.text ? " — showing the last status" : "") + ". Click Sign in (it opens a tab, where your password manager works), then come back.");
    else if (r.state === "missing") note = h("p", { class: "note warn" }, "Couldn't find the status on the page. Open it and pick it again.");
    else if (r.at) note = h("p", { class: "note" }, "Checked " + Portals.timeAgo(r.at, Date.now()));
    if (note) el.append(note);
    if (r.prev && r.changedAt && Date.now() - r.changedAt < RECENT_MS && !failed) {
      el.append(h("p", { class: "note changed" }, "Changed " + Portals.timeAgo(r.changedAt, Date.now()) + ", was “" + r.prev + "”"));
    }

    const signIn = p.selector && r.state === "login";
    const label = !p.selector ? "Set up" : signIn ? "Sign in" : r.state === "missing" ? "Pick again" : "Open";
    // Signing in happens in an ordinary tab: password managers don't fill sign-in forms shown inside
    // another page. The hub shares that tab's sign-in and re-checks when you come back.
    el.append(h("button", { type: "button", onclick: function () { if (signIn) chrome.tabs.create({ url: pageOf(p) }); else openViewer(i); } }, label));
    return el;
  }

  /* The page to load for a college: the one its status was picked on, or else its start page.
   * Many portals start somewhere that isn't the status page (a menu, a home page), so the pick
   * remembers where you actually were. */
  function pageOf(p) { return p.checkUrl || p.url; }

  /* Indexes of the colleges whose status hasn't been picked yet. */
  function unconfigured() {
    return s.portals.map(function (p, i) { return p.selector ? -1 : i; }).filter(function (i) { return i >= 0; });
  }

  function renderOverview() {
    $("cards").replaceChildren.apply($("cards"), s.portals.map(card));
    $("empty").hidden = s.portals.length > 0;
    const todo = unconfigured().length;
    $("setup-banner").hidden = !(todo && s.portals.length);
    $("setup-text").textContent = todo === s.portals.length
      ? "Next, set up each college. For each one: sign in, go to the page that shows your application status, and click it. About a minute each, and only once."
      : todo + " of " + s.portals.length + " colleges still need setting up.";
    $("btn-refresh").hidden = s.view !== "overview" || !s.portals.length;
    $("btn-refresh").disabled = s.checking;
    $("btn-refresh").textContent = s.checking ? "Checking…" : "Check all";
  }

  /* -------------------------------------------------------------------- viewer */

  function renderViewer() {
    const p = s.portals[s.current];
    if (!p) return;
    $("v-name").textContent = p.name;
    $("v-count").textContent = (s.current + 1) + " of " + s.portals.length;
    $("btn-prev").disabled = $("btn-next").disabled = s.portals.length < 2;
    $("btn-tab").setAttribute("href", pageOf(p));
    $("btn-start").hidden = !(p.checkUrl && p.checkUrl !== p.url);
    $("btn-tab").classList.toggle("main", s.guided && !p.selector);   // the first thing to do while setting up
    $("btn-pick").textContent = p.selector ? "Pick the status again" : "Pick the status";
    const r = s.readings[p.id];
    const note = $("v-note");
    note.hidden = !(r && r.text);
    if (r && r.text) note.textContent = "Status: “" + r.text + "”";
    $("pick-help").hidden = !s.picking;
    $("guide").hidden = !s.guided;
    if (s.guided) {
      $("guide-text").textContent = (s.saved ? s.saved + " " : "") + "Setting up " + p.name + " (" + unconfigured().length + " left). " +
        "1. Click Open in a tab and sign in there (your password manager works in a tab). " +
        "2. Come back here: the page reloads, signed in. " +
        "3. Go to the page that shows your application status, click Pick the status, and click those words.";
    }
  }

  function show(view) {
    s.view = view;
    ["overview", "viewer", "editor"].forEach(function (v) { $("v-" + v).hidden = v !== view; });
    $("btn-edit").hidden = view === "editor";
    // Checking uses the shared frame, so it is only offered when nobody is looking at it.
    $("btn-refresh").hidden = view !== "overview" || !s.portals.length;
    $("frame-box").className = view === "viewer" ? "shown" : "parked";
  }

  function openViewer(i) {
    abortChecks();
    stopPicking();
    s.current = i;
    show("viewer");
    renderViewer();
    frame.src = pageOf(s.portals[i]);
  }

  function showOverview() {
    abortChecks();
    stopPicking();
    s.guided = false;
    s.saved = "";
    frame.src = "about:blank";
    show("overview");
    renderOverview();
    maybeCheck();
  }

  /* Walk through the colleges that still need setting up, one after another. */
  function startSetup() {
    const todo = unconfigured();
    if (!todo.length) return;
    s.guided = true;
    s.saved = "";
    openViewer(todo[0]);
  }

  /* On to the next college after this one that needs it; none left ends the walk-through.
   * (Ones you skipped stay undone and are not come back to, so skipping can't loop.) */
  function nextSetup() {
    const next = unconfigured().find(function (i) { return i > s.current; });
    if (next === undefined) showOverview();
    else openViewer(next);
  }

  /* ------------------------------------------------------------------- picking */

  async function startPicking() {
    s.picking = true;
    renderViewer();
    try {
      await chrome.tabs.sendMessage(s.tabId, { type: "pick" });
    } catch (err) {
      // Nothing in the frame to answer: the page isn't up yet (or the portal won't load).
      s.picking = false;
      renderViewer();
      $("v-note").hidden = false;
      $("v-note").textContent = "The page isn't ready yet. Wait for it to finish loading, then try again.";
    }
  }

  function stopPicking() {
    if (!s.picking) return;
    s.picking = false;
    chrome.tabs.sendMessage(s.tabId, { type: "cancel-pick" }).catch(function () { /* page already gone */ });
    if (s.view === "viewer") renderViewer();
  }

  function onPicked(msg) {
    const p = s.portals[s.current];
    if (!s.picking || !p || typeof msg.selector !== "string" || !msg.selector || msg.selector.length > 500) return;
    s.picking = false;
    p.selector = msg.selector;
    const here = Portals.normalizeUrl(msg.href);
    if (here) p.checkUrl = here;
    savePortals();
    applyReading(p.id, String(msg.text || "").slice(0, 200));
    if (s.guided) { s.saved = "Saved " + p.name + "."; nextSetup(); return; }
    renderViewer();
  }

  /* -------------------------------------------------------------------- editor */

  function openEditor() {
    abortChecks();
    stopPicking();
    frame.src = "about:blank";
    $("list").value = Portals.formatList(s.portals, directory);
    $("e-list").textContent = "";
    show("editor");
    $("list").focus();
  }

  async function saveEditor() {
    const result = Portals.parseList($("list").value, s.portals, directory);
    if (result.errors.length) {
      $("e-list").textContent = result.errors.map(function (e) { return "Line " + e.line + ": " + e.text + "\n    " + e.why; }).join("\n");
      return;
    }
    s.portals = result.portals;
    const keep = new Set(s.portals.map(function (p) { return p.id; }));
    Object.keys(s.readings).forEach(function (id) { if (!keep.has(id)) delete s.readings[id]; });
    await Promise.all([savePortals(), saveReadings()]);
    showOverview();
    findColors();
  }

  /* -------------------------------------------------------------------- wiring */

  function step(delta) {
    s.saved = "";
    if (s.portals.length > 1) openViewer(Portals.cycle(s.current, delta, s.portals.length));
  }

  function wire() {
    $("btn-refresh").addEventListener("click", function () { checkAll(); });
    $("btn-edit").addEventListener("click", openEditor);
    $("btn-save").addEventListener("click", saveEditor);
    $("btn-cancel").addEventListener("click", showOverview);
    $("btn-overview").addEventListener("click", showOverview);
    $("btn-prev").addEventListener("click", function () { step(-1); });
    $("btn-next").addEventListener("click", function () { step(1); });
    $("btn-pick").addEventListener("click", startPicking);
    $("btn-pick-cancel").addEventListener("click", stopPicking);
    $("btn-start").addEventListener("click", function () { stopPicking(); frame.src = s.portals[s.current].url; });
    $("btn-setup").addEventListener("click", startSetup);
    $("btn-skip").addEventListener("click", function () { s.saved = ""; nextSetup(); });
    $("btn-stop-setup").addEventListener("click", showOverview);

    document.addEventListener("keydown", function (e) {
      if (s.view !== "viewer" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "Escape") { if (s.picking) stopPicking(); else showOverview(); }
    });
  }

  /* Whether any set-up portal hasn't been looked at lately. */
  function due() {
    const now = Date.now();
    return s.portals.some(function (p) {
      const r = s.readings[p.id];
      return p.selector && (!r || !r.tried || now - r.tried > STALE_MS);
    });
  }

  /* Keeps the cards fresh while the hub is open. It never takes over the frame while you are
   * looking at a portal; it waits until you are back at the overview. */
  /* The hub is back in front, usually after signing in in another tab. Re-read the colleges that were
   * asking for a sign-in, and reload the page being set up so it shows signed in. This uses tab
   * switching, not window focus: clicking inside the portal's frame also moves window focus, and
   * reloading the frame under someone's hands would lose their place. */
  let hiddenAt = 0;
  function cameBack() {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (Date.now() - hiddenAt < 3000) return;                 // a flicker, not a visit to another tab
    if (s.view === "viewer") {
      const p = s.portals[s.current];
      if (p && s.guided && !s.picking && !p.selector) frame.src = pageOf(p);
      return;
    }
    if (s.view === "overview" && !s.checking) {
      const asked = function (p) { const r = s.readings[p.id]; return !!(p.selector && r && r.state === "login"); };
      if (s.portals.some(asked)) checkAll(asked);
      else maybeCheck();
    }
  }

  function maybeCheck() {
    if (s.view === "overview" && !s.checking && due()) checkAll();
  }

  async function init() {
    wire();
    s.tabId = (await chrome.tabs.getCurrent()).id;
    await allowFraming();
    await load();
    // The very first time, start from the list this copy of the extension came with.
    if (!s.portals.length && !s.seeded && starter.trim()) {
      s.portals = Portals.parseList(starter, [], directory).portals;
      await savePortals();
    }
    if (!s.portals.length) { openEditor(); return; }
    show("overview");
    renderOverview();
    findColors();
    maybeCheck();
    setInterval(maybeCheck, WATCH_MS);
    document.addEventListener("visibilitychange", cameBack);
  }

  init();
})();
