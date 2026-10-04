/* SoundCloud, as far as SoundCloud allows.
 *
 * Like Spotify, SoundCloud audio cannot be mixed here: the page never gets the
 * stream (it plays inside SoundCloud's own player), and downloading it is not
 * something the terms allow. What the page *can* do, with no login, no app and
 * no key, is ask SoundCloud's official embedded player (its Widget API) which
 * tracks are in a playlist, a profile or a single link, and use that as the
 * setlist: match each entry to a file you already own, queue the matches in
 * order, and show a listen / buy / free-download link for the rest.
 *
 * The link and list parsing are pure and tested in node. The widget part talks
 * to the real service and was only exercised against a stand-in.
 */

var SoundCloud = (function () {
  "use strict";

  const WIDGET_API = "https://w.soundcloud.com/player/api.js";
  const WIDGET_SRC = "https://w.soundcloud.com/player/";

  // Only soundcloud.com links are ever handed to the player.
  function parseUrl(text) {
    let s = String(text || "").trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
    if (host !== "soundcloud.com" && host !== "on.soundcloud.com" && host !== "snd.sc") return null;
    if (u.pathname.length < 2) return null;
    return "https://" + host + u.pathname + u.search;      // a secret link's token lives in the path or query
  }

  function kindOf(url) {
    if (/\/sets\//.test(url)) return "playlist";
    if (/\/likes\/?($|\?)/.test(url)) return "likes";
    if (/^https:\/\/soundcloud\.com\/[^/]+\/?($|\?)/.test(url)) return "profile";
    return "track";
  }

  // "Artist - Title" is how most uploads are named; the uploader is often a label or a fan.
  function splitTitle(raw, user) {
    const t = String(raw || "").trim();
    const m = t.match(/^(.{2,60}?)\s+[-–—]\s+(.+)$/);
    if (m) return { title: m[2].trim(), artists: [m[1].trim()] };
    return { title: t, artists: user ? [user] : [] };
  }

  const https = function (u) { return typeof u === "string" && /^https:\/\//i.test(u) ? u : ""; };

  // One widget sound object -> the entry shape the matcher uses.
  function toEntry(s) {
    if (!s || !s.title) return null;
    const user = s.user && s.user.username ? String(s.user.username) : "";
    const parts = splitTitle(s.title, user);
    if (!parts.title) return null;
    return {
      title: parts.title, artists: parts.artists, durationMs: +s.duration || 0,
      url: https(s.permalink_url), buy: https(s.purchase_url), free: !!s.downloadable, source: "soundcloud",
    };
  }

  function entriesFromSounds(list) {
    return (Array.isArray(list) ? list : []).map(toEntry).filter(Boolean);
  }

  // A plain pasted list, one track per line: "Artist - Title", "1. Artist - Title" or just a title.
  function tracksFromText(text) {
    return String(text || "").split(/\r?\n/).map(function (line) {
      const t = line.replace(/^\s*(?:\d{1,3}\s*[.)\]:-]\s+|[-*•]\s+)/, "").trim();
      if (!t) return null;
      const p = splitTitle(t, "");
      return { title: p.title, artists: p.artists, durationMs: 0, url: "", buy: "", free: false, source: "list" };
    }).filter(function (x) { return x && x.title; });
  }

  // ---------------------------------------------------------------- widget

  let apiPromise = null;
  function loadApi() {
    if (typeof window !== "undefined" && window.SC && window.SC.Widget) return Promise.resolve(window.SC);
    if (!apiPromise) {
      apiPromise = new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = WIDGET_API; s.async = true;
        s.onload = function () {
          if (window.SC && window.SC.Widget) resolve(window.SC);
          else { apiPromise = null; reject(new Error("SoundCloud's player script loaded but did not start")); }
        };
        s.onerror = function () { apiPromise = null; reject(new Error("Could not reach SoundCloud — an ad blocker or the network may be stopping it. You can paste the track list instead.")); };
        document.head.appendChild(s);
      });
    }
    return apiPromise;
  }

  // Ask the (hidden) SoundCloud player for the sounds behind a link.
  async function fetchSounds(url, timeoutMs) {
    const SC = await loadApi();
    return new Promise(function (resolve, reject) {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true"); frame.tabIndex = -1; frame.title = "SoundCloud reader (hidden)";
      frame.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:166px;border:0;opacity:0;pointer-events:none";
      frame.src = WIDGET_SRC + "?" + new URLSearchParams({ url: url, auto_play: "false", hide_related: "true", show_comments: "false", visual: "false" });
      let done = false, timer = null, widget = null;
      const finish = function (err, val) {
        if (done) return;
        done = true; clearTimeout(timer);
        try { if (widget) { widget.unbind(SC.Widget.Events.READY); widget.unbind(SC.Widget.Events.ERROR); } } catch (e) { /* ignore */ }
        frame.remove();
        if (err) reject(err); else resolve(val);
      };
      timer = setTimeout(function () { finish(new Error("SoundCloud did not answer. Check the link is public (or a secret link) and try again, or paste the track list instead.")); }, timeoutMs || 20000);
      document.body.appendChild(frame);
      widget = SC.Widget(frame);
      widget.bind(SC.Widget.Events.READY, function () {
        widget.getSounds(function (list) {
          if (list && list.length) { finish(null, list); return; }
          widget.getCurrentSound(function (one) { if (one) finish(null, [one]); else finish(new Error("No tracks found at that link")); });
        });
      });
      widget.bind(SC.Widget.Events.ERROR, function () { finish(new Error("SoundCloud could not open that link")); });
    });
  }

  async function readLink(text) {
    const url = parseUrl(text);
    if (!url) throw new Error("That does not look like a soundcloud.com link");
    const sounds = await fetchSounds(url);
    return { url: url, kind: kindOf(url), tracks: entriesFromSounds(sounds) };
  }

  return { parseUrl: parseUrl, kindOf: kindOf, toEntry: toEntry, entriesFromSounds: entriesFromSounds, tracksFromText: tracksFromText, fetchSounds: fetchSounds, readLink: readLink };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SoundCloud;
