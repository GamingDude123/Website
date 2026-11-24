/* The portal list: what counts as a safe address, how the arrows wrap, and
 * making whatever comes out of the vault fit the shape the page expects.
 *
 * No DOM and no crypto in here, so it can be tested with plain node.
 */

var Model = (function () {
  "use strict";

  /* A portal address goes into an <a href>, so it has to be a plain web address
   * and nothing else: "javascript:..." there would run code on this page.
   * Anything without a scheme is taken to be https. */
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

  /* The vault is authenticated, so this is for old or hand-edited data rather
   * than an attacker. A portal with a bad address is kept, with the address
   * blanked, so nothing is silently lost. */
  function sanitize(raw) {
    const out = { v: 1, portals: [] };
    const list = raw && Array.isArray(raw.portals) ? raw.portals : [];
    const seen = new Set();
    for (const p of list) {
      if (!p || typeof p !== "object") continue;
      let id = text(p.id, 64);
      if (!id || seen.has(id)) id = newId();
      seen.add(id);
      out.portals.push({
        id: id,
        name: text(p.name, 80).trim() || "Untitled portal",
        url: normalizeUrl(p.url) || "",
        username: text(p.username, 200),
        password: text(p.password, 500),
      });
    }
    return out;
  }

  /* The arrows wrap: past the last portal is the first, and back from the first
   * is the last. */
  function cycle(i, delta, n) {
    if (!n) return 0;
    return (((i + delta) % n) + n) % n;
  }

  const Model = {
    normalizeUrl: normalizeUrl,
    hostOf: hostOf,
    newId: newId,
    sanitize: sanitize,
    cycle: cycle,
  };
  return Model;
})();

if (typeof module !== "undefined" && module.exports) module.exports = Model;
