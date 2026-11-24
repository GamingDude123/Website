/* The portal list itself: what a portal is, which ones have been checked today,
 * and how the arrows move.
 *
 * No DOM and no crypto in here, so all of it can be tested with plain node.
 */

var Model = (function () {
  "use strict";

  const COPY_CHOICES = ["password", "username", "nothing"];

  function emptyData() {
    return {
      v: 1,
      portals: [],
      settings: { embed: false, copyOnOpen: "password" },
      checked: { day: "", ids: [] },
    };
  }

  /* A portal address goes into an <a href> and an <iframe src>, so it has to be
   * a plain web address and nothing else: "javascript:..." in either would run
   * code on this page. Anything without a scheme is taken to be https. */
  function normalizeUrl(raw) {
    let s = String(raw == null ? "" : raw).trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) {
      // A scheme that is not http(s): javascript:, data:, file:, mailto: ...
      // "localhost:3000" is a host and a port, not a scheme, hence the lookahead.
      if (/^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i.test(s)) return null;
      s = "https://" + s.replace(/^\/+/, "");
    }
    let u;
    try { u = new URL(s); } catch (err) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname) return null;
    if (u.username || u.password) return null;   // a login in the address ends up in history and logs
    return u.href;
  }

  function hostOf(url) {
    try { return new URL(url).host; } catch (err) { return ""; }
  }

  function newId() {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return Array.from(b, function (x) { return x.toString(16).padStart(2, "0"); }).join("");
  }

  function text(x, max) {
    return typeof x === "string" ? x.slice(0, max) : "";
  }

  /* Whatever comes out of the vault is made to fit the shape the page expects
   * before anything touches it. The vault is authenticated, so this is for old
   * or hand-edited data rather than for an attacker. */
  function sanitize(raw) {
    const out = emptyData();
    if (!raw || typeof raw !== "object") return out;

    const seen = new Set();
    const list = Array.isArray(raw.portals) ? raw.portals : [];
    for (const p of list) {
      if (!p || typeof p !== "object") continue;
      let id = text(p.id, 64);
      if (!id || seen.has(id)) id = newId();
      seen.add(id);
      out.portals.push({
        id: id,
        name: text(p.name, 80).trim() || "Untitled portal",
        // Kept even when the address is bad (as ""), so nothing is silently
        // dropped; the page shows it as needing an address.
        url: normalizeUrl(p.url) || "",
        username: text(p.username, 200),
        password: text(p.password, 500),
      });
    }

    const s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    out.settings.embed = s.embed === true;
    out.settings.copyOnOpen = COPY_CHOICES.indexOf(s.copyOnOpen) >= 0 ? s.copyOnOpen : "password";

    const c = raw.checked && typeof raw.checked === "object" ? raw.checked : {};
    out.checked.day = text(c.day, 10);
    out.checked.ids = Array.isArray(c.ids) ? c.ids.filter(function (id) { return seen.has(id); }) : [];
    return out;
  }

  /* Local calendar day, not UTC: "today" should roll over at your midnight. */
  function todayKey(d) {
    d = d || new Date();
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function checkedIds(data, today) {
    return data.checked.day === today ? data.checked.ids : [];
  }

  function isChecked(data, id, today) {
    return checkedIds(data, today).indexOf(id) >= 0;
  }

  function countChecked(data, today) {
    const done = new Set(checkedIds(data, today));
    return data.portals.filter(function (p) { return done.has(p.id); }).length;
  }

  function setChecked(data, id, on, today) {
    const ids = checkedIds(data, today).filter(function (x) { return x !== id; });
    if (on) ids.push(id);
    data.checked = { day: today, ids: ids };
  }

  /* Where to start: the first portal not yet checked today, or the top of the
   * list when they are all done. */
  function firstUnchecked(data, today) {
    const done = new Set(checkedIds(data, today));
    const i = data.portals.findIndex(function (p) { return !done.has(p.id); });
    return i < 0 ? 0 : i;
  }

  /* The arrows wrap: past the last portal is the first, and back from the first
   * is the last. */
  function cycle(i, delta, n) {
    if (!n) return 0;
    return (((i + delta) % n) + n) % n;
  }

  function indexOfId(data, id) {
    return data.portals.findIndex(function (p) { return p.id === id; });
  }

  function move(data, id, delta) {
    const i = indexOfId(data, id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= data.portals.length) return false;
    const t = data.portals[i];
    data.portals[i] = data.portals[j];
    data.portals[j] = t;
    return true;
  }

  function remove(data, id) {
    data.portals = data.portals.filter(function (p) { return p.id !== id; });
    data.checked.ids = data.checked.ids.filter(function (x) { return x !== id; });
  }

  const Model = {
    COPY_CHOICES: COPY_CHOICES,
    emptyData: emptyData,
    normalizeUrl: normalizeUrl,
    hostOf: hostOf,
    newId: newId,
    sanitize: sanitize,
    todayKey: todayKey,
    isChecked: isChecked,
    countChecked: countChecked,
    setChecked: setChecked,
    firstUnchecked: firstUnchecked,
    cycle: cycle,
    indexOfId: indexOfId,
    move: move,
    remove: remove,
  };
  return Model;
})();

if (typeof module !== "undefined" && module.exports) module.exports = Model;
