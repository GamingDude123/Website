/* The parts of the hub that need no browser: reading the list you type, deciding
 * what a status means, how long ago something was.
 *
 * No DOM and no extension APIs in here, so it can be tested with plain node.
 */

var Portals = (function () {
  "use strict";

  const MAX_PORTALS = 30;

  /* A portal address goes into an <iframe src> and an <a href>, so it has to be a
   * plain web address and nothing else: "javascript:..." there would run code.
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

  /* The arrows wrap: past the last portal is the first, and back from the first
   * is the last. */
  function cycle(i, delta, n) {
    if (!n) return 0;
    return (((i + delta) % n) + n) % n;
  }

  /* ----------------------------------------------------------- the list box */

  function looksLikeHost(url) {
    const h = new URL(url).hostname;
    return h === "localhost" || h.indexOf(".") > 0;
  }

  function cleanName(s) {
    return s.replace(/^[\s,;:|\-–—]+|[\s,;:|\-–—]+$/g, "").slice(0, 60);
  }

  /* ------------------------------------------------------------------ colours */

  function expandHex(h) {
    h = h.toLowerCase();
    return h.length === 4 ? "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h;
  }

  function toRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function toHex(r, g, b) {
    return "#" + [r, g, b].map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join("");
  }

  function luminance(hex) {
    const f = toRgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* A school colour that can be seen on a white page: yellows and golds are
   * darkened until they have the 3:1 contrast that lines and shapes need. */
  function onWhite(hex) {
    let c = hex;
    for (let i = 0; i < 12 && contrast(c, "#ffffff") < 3; i++) {
      const rgb = toRgb(c);
      c = toHex(rgb[0] * 0.88, rgb[1] * 0.88, rgb[2] * 0.88);
    }
    return c;
  }

  const DEFAULT_COLOR = "#1a5fb4";

  /* The two colours a card is drawn in. */
  function brandFor(colors) {
    if (!colors || !colors.primary) return { main: DEFAULT_COLOR, accent: DEFAULT_COLOR };
    const main = onWhite(colors.primary);
    return { main: main, accent: colors.secondary ? onWhite(colors.secondary) : main };
  }

  /* The colours of a logo, from its pixels (RGBA, as canvas gives them): the most
   * prominent colour that isn't background white or grey, plus a second one if
   * the logo clearly has another (a blue and gold crest). A logo with nothing but
   * greys gives its darkest grey; one with no pixels gives nothing. */
  function pickPalette(px) {
    const bins = [];
    for (let k = 0; k < 12; k++) bins.push({ n: 0, w: 0, r: 0, g: 0, b: 0, hue: k * 30 + 15 });
    let grey = { n: 0, r: 0, g: 0, b: 0 };
    for (let i = 0; i + 3 < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
      if (a < 128) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (min > 235) continue;                                   // white background
      if (max - min < 28) {                                      // grey, black
        if (max < 150) { grey.n++; grey.r += r; grey.g += g; grey.b += b; }
        continue;
      }
      let hue;
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      hue = (hue * 60 + 360) % 360;
      const bin = bins[Math.floor(hue / 30) % 12];
      bin.n++; bin.r += r; bin.g += g; bin.b += b;
      bin.w += 0.35 + (max - min) / max;                         // vivid beats washed-out
    }
    const avg = function (o) { return toHex(o.r / o.n, o.g / o.n, o.b / o.n); };
    const ranked = bins.filter(function (x) { return x.n > 0; }).sort(function (x, y) { return y.w - x.w; });
    if (!ranked.length) return { primary: grey.n ? avg(grey) : null, secondary: null };
    const first = ranked[0];
    const second = ranked.slice(1).find(function (x) {
      const d = Math.abs(x.hue - first.hue);
      return Math.min(d, 360 - d) >= 45 && x.w >= first.w * 0.15;
    });
    return { primary: avg(first), secondary: second ? avg(second) : null };
  }

  /* ------------------------------------------------------- the college directory */

  /* Names are compared ignoring case, spacing and punctuation: "Yale
   * University", "yale university" and "Yale-University" are one name. Only whole names match, never part of one, so "Rice College"
   * can never be mistaken for "Rice University". */
  function nameKey(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  /* The directory is a list of { name, aliases, url, colors: [primary, secondary?] }
   * that ships inside the extension, so a line can be just a college's name. */
  function findCollege(name, directory) {
    const want = nameKey(name);
    if (!want || !directory) return null;
    return directory.find(function (c) {
      return [c.name].concat(c.aliases || []).some(function (n) { return nameKey(n) === want; });
    }) || null;
  }

  function collegeColors(c) {
    return c && c.colors && c.colors[0] ? { primary: c.colors[0], secondary: c.colors[1] || null, from: "directory" } : null;
  }

  /* One portal per line. Any of these:
   *   Yale University                        a college the extension knows
   *   Duke apply.duke.edu                    a name and a web address
   *   Duke apply.duke.edu #001a57 #ffffff    ...and the colours to draw it in
   * A known college can also be given an address of your own, which wins, and keeps
   * its colours. Portals already known keep their id (and so their picked status,
   * last reading and detected colours) when their address is unchanged. */
  function parseList(text, existing, directory) {
    const portals = [];
    const errors = [];
    const used = new Set();
    String(text == null ? "" : text).split(/\r?\n/).forEach(function (raw, i) {
      let line = raw.trim();
      if (!line || line[0] === "#") return;
      const hexes = [];
      for (let m; hexes.length < 2 && (m = /^(.*\S)\s+(#(?:[0-9a-f]{6}|[0-9a-f]{3}))$/i.exec(line));) {
        hexes.unshift(expandHex(m[2]));
        line = m[1];
      }

      // An address typed on the line (last word, or the whole line), if it is one.
      const m = /^(.*\S)\s+(\S+)$/.exec(line);
      let url = Portals.normalizeUrl(m ? m[2] : line);
      let name = m ? cleanName(m[1]) : "";
      if (url && !looksLikeHost(url)) url = null;

      let college = null;
      if (url) {
        college = findCollege(name, directory);
      } else {
        college = findCollege(line, directory);
        if (college) { url = Portals.normalizeUrl(college.url); name = college.name; }
      }
      if (!url) {
        errors.push({ line: i + 1, text: line, why: "I don't know that college. Put its name, then its web address, like: Duke apply.duke.edu" });
        return;
      }
      if (portals.length >= MAX_PORTALS) {
        errors.push({ line: i + 1, text: line, why: "That's more than " + MAX_PORTALS + " portals." });
        return;
      }

      const prev = (existing || []).find(function (p) { return p.url === url && !used.has(p.id); });
      if (prev) used.add(prev.id);
      let colors = null;
      if (hexes.length) colors = { primary: hexes[0], secondary: hexes[1] || null, manual: true };
      else if (collegeColors(college)) colors = collegeColors(college);
      // Taking a typed colour off a line goes back to the one read from the icon.
      else if (prev && prev.colors && !prev.colors.manual) colors = prev.colors;
      portals.push({
        id: prev ? prev.id : newId(),
        name: name || hostOf(url).replace(/^www\./, ""),
        url: url,
        selector: prev ? prev.selector : "",
        checkUrl: prev && prev.checkUrl ? prev.checkUrl : "",
        colors: colors,
      });
    });
    return { portals: portals, errors: errors };
  }

  /* An address as it appears in the box: no https://, and a bare host loses its
   * slash. A trailing slash after a path is part of the address ("/duke/" and
   * "/duke" can be different pages), so it stays, or editing the list would
   * quietly turn one portal into another. */
  function shown(url) {
    const s = url.replace(/^https:\/\//, "");
    return /^[^/]+\/$/.test(s) ? s.slice(0, -1) : s;
  }

  /* The list as it appears in the box. A college the extension knows, at its own
   * address, is just its name; anything else shows its address too; and a colour
   * you typed is kept. */
  function formatList(portals, directory) {
    return portals.map(function (p) {
      const typed = p.colors && p.colors.manual ? " " + p.colors.primary + (p.colors.secondary ? " " + p.colors.secondary : "") : "";
      const c = findCollege(p.name, directory);
      if (c && Portals.normalizeUrl(c.url) === p.url) return p.name + typed;
      return p.name + " " + shown(p.url) + typed;
    }).join("\n");
  }

  /* ------------------------------------------------------- what a status means */

  /* Turn the words a portal shows into a place on the four-step graphic:
   *   1 Submitted  2 Received  3 In review  4 Decision (admitted / not / waitlisted)
   * and whether it is asking you to do something. It reads only the words you
   * picked, never the whole page, and the page always shows those words next to
   * the graphic, so a status this doesn't understand is shown as-is rather than
   * guessed at. Negatives are checked before positives: "not admitted" must not
   * be read as admitted, and "not yet under review" is not in review. */
  function classify(raw) {
    const t = " " + String(raw == null ? "" : raw).toLowerCase()
      .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
    const has = function (re) { return re.test(t); };

    let outcome = null;
    if (has(/ (denied|rejected|not admitted|not been admitted|unable to (offer|admit)|cannot (offer|admit)|regret to inform|we regret|not offered) /)) outcome = "denied";
    else if (has(/ (wait ?list(ed)?|deferred|deferral) /)) outcome = "waitlisted";
    else if (has(/ (admitted|congratulations|offer of admission|admission offer|pleased to (offer|admit)|accepted (to|into)) /)) outcome = "admitted";

    let stage = 0;
    if (outcome) stage = 4;
    else if (has(/ (under review|in review|being reviewed|review in progress|reviewing|in committee|committee review|ready for review|under evaluation) /) &&
             !has(/ (not|no) (yet )?(under |in )?(review|reviewed) /)) stage = 3;
    else if (has(/ (received|complete|completed|all materials|verified|processing|processed|in process) /) &&
             !has(/ (incomplete|missing|not (yet )?(received|complete|completed|verified)) /)) stage = 2;
    else if (has(/ (submitted|applied|application sent) /) &&
             !has(/ (not (yet )?submitted|not been submitted|unsubmitted) /)) stage = 1;

    const action = !outcome && has(/ (incomplete|missing|action required|action needed|outstanding|pending documents|pending items|not yet received|not received|please submit|please upload|please complete|needs your attention|additional information needed) /);

    return { stage: stage, outcome: outcome, action: action };
  }

  function timeAgo(then, now) {
    const s = Math.max(0, Math.round((now - then) / 1000));
    if (s < 45) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + " h ago";
    const d = Math.round(h / 24);
    return d + (d === 1 ? " day ago" : " days ago");
  }

  const Portals = {
    MAX_PORTALS: MAX_PORTALS,
    normalizeUrl: normalizeUrl,
    hostOf: hostOf,
    newId: newId,
    cycle: cycle,
    findCollege: findCollege,
    parseList: parseList,
    formatList: formatList,
    pickPalette: pickPalette,
    brandFor: brandFor,
    onWhite: onWhite,
    contrast: contrast,
    classify: classify,
    timeAgo: timeAgo,
  };
  return Portals;
})();

if (typeof module !== "undefined" && module.exports) module.exports = Portals;
