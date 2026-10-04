/* Spotify, as far as Spotify allows.
 *
 * Spotify streams cannot be mixed: they are DRM-protected, the Web Playback
 * SDK exposes no audio to the page, and the audio-features/analysis endpoints
 * (tempo, key) are closed to new apps. So the booth cannot beatmatch, EQ or
 * effect a Spotify stream, and nothing here pretends otherwise.
 *
 * What it can do is use Spotify as the *playlist*: read one (through your own
 * app credentials, or an Exportify CSV with no login at all), and match each
 * entry to an audio file you already own and have dropped into the booth. The
 * matched files are queued in the playlist's order, or reordered by the DJ.
 *
 * The matching and CSV parts are pure and tested; the OAuth part needs a real
 * Spotify app and has not been exercised against the live service.
 */

var Spotify = (function () {
  "use strict";

  const SCOPES = "playlist-read-private playlist-read-collaborative user-library-read";

  // ------------------------------------------------------------- CSV import

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Exportify (and similar) CSVs: one row per track, tempo and key included.
  function tracksFromCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    const col = function (re) { return head.findIndex(function (h) { return re.test(h); }); };
    const iName = col(/^track name|^name$|^title$/), iArt = col(/^artist/), iDur = col(/^duration/);
    const iTempo = col(/^tempo|^bpm/), iKey = col(/^key$/), iMode = col(/^mode$/);
    if (iName < 0) return [];
    return rows.slice(1).map(function (r) {
      return {
        title: r[iName] || "",
        artists: iArt >= 0 ? (r[iArt] || "").split(/[;,]/).map(function (a) { return a.trim(); }).filter(Boolean) : [],
        durationMs: iDur >= 0 ? +r[iDur] || 0 : 0,
        tempo: iTempo >= 0 ? +r[iTempo] || 0 : 0,
        key: iKey >= 0 && r[iKey] !== "" ? +r[iKey] : null,
        mode: iMode >= 0 && r[iMode] !== "" ? +r[iMode] : null,
      };
    }).filter(function (t) { return t.title; });
  }

  // Spotify's key (pitch class, 0 = C) and mode (1 major, 0 minor) as Camelot.
  function camelotFromSpotify(key, mode) {
    if (key == null || key < 0 || mode == null) return null;
    return Analysis.camelot(key, mode === 1 ? "major" : "minor");
  }

  // -------------------------------------------------------------- matching

  function norm(s) {
    return (s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\.(mp3|wav|flac|m4a|aac|ogg)$/, "")
      .replace(/\((original|extended|radio)( mix| edit)?\)|\b(feat|ft)\.?\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  function tokens(s) { return norm(s).split(" ").filter(function (w) { return w.length > 1; }); }

  // How likely it is that `local` ({title, artist, duration}) is `sp`.
  // the score of one entry against one file, given the entry's tokens and the file's text already prepared
  function scoreOf(sp, tt, at, hay, local) {
    if (!tt.length) return 0;
    let hit = 0;
    for (let i = 0; i < tt.length; i++) if (hay.indexOf(" " + tt[i] + " ") >= 0) hit++;
    hit /= tt.length;
    let art = 0.5;
    if (at.length) { let a = 0; for (let i = 0; i < at.length; i++) if (hay.indexOf(" " + at[i] + " ") >= 0) a++; art = a / at.length; }
    let dur = 0.5;
    if (sp.durationMs && local.duration) dur = Math.abs(sp.durationMs / 1000 - local.duration) <= 6 ? 1 : 0;
    return 0.6 * hit + 0.3 * art + 0.1 * dur;
  }
  const hayOf = function (local) { return " " + norm((local.artist || "") + " " + (local.title || "")) + " "; };
  const artistTokens = function (sp) { return [].concat.apply([], sp.artists.map(tokens)); };

  function matchScore(sp, local) {
    return scoreOf(sp, tokens(sp.title), artistTokens(sp), hayOf(local), local);
  }

  // For each Spotify entry, the best unused local file above the threshold.
  // (The text of each file is prepared once, not once per entry: with a long list
  // and a big library the work is entries x files.)
  function matchTracks(spTracks, locals, threshold) {
    threshold = threshold == null ? 0.65 : threshold;
    const used = new Set(), hays = locals.map(hayOf);
    return spTracks.map(function (sp) {
      const tt = tokens(sp.title), at = artistTokens(sp);
      let best = null, bestScore = threshold;
      if (tt.length) {
        for (let j = 0; j < locals.length; j++) {
          if (used.has(locals[j])) continue;
          const s = scoreOf(sp, tt, at, hays[j], locals[j]);
          if (s > bestScore) { bestScore = s; best = locals[j]; }
        }
      }
      if (best) used.add(best);
      return { spotify: sp, local: best, score: best ? bestScore : 0 };
    });
  }

  // ------------------------------------------------------------------ OAuth

  function b64url(bytes) {
    let s = "";
    bytes.forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  const redirectUri = function () { return location.origin + location.pathname; };
  const get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

  async function login(clientId) {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    // `state` ties the redirect back to this tab's login attempt, so a
    // crafted link cannot sign the page in to someone else's account.
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    set("sp_verifier", verifier); set("sp_client", clientId); set("sp_state", state);
    location.href = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
      client_id: clientId, response_type: "code", redirect_uri: redirectUri(),
      scope: SCOPES, code_challenge_method: "S256", code_challenge: challenge, state: state,
    });
  }

  async function tokenRequest(params) {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params),
    });
    if (!r.ok) throw new Error("Spotify refused the login (" + r.status + ")");
    const j = await r.json();
    set("sp_token", j.access_token);
    set("sp_expires", String(Date.now() + j.expires_in * 1000 - 30000));
    if (j.refresh_token) set("sp_refresh", j.refresh_token);
  }

  // Call on page load: finishes a login if Spotify just redirected back.
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (q.get("error")) { history.replaceState(null, "", redirectUri()); throw new Error("Spotify: " + q.get("error")); }
    const code = q.get("code");
    if (!code || !get("sp_verifier")) return false;
    if (q.get("state") !== get("sp_state")) { history.replaceState(null, "", redirectUri()); throw new Error("Spotify login was not started from this page — try Connect again"); }
    await tokenRequest({ grant_type: "authorization_code", code: code, redirect_uri: redirectUri(), client_id: get("sp_client"), code_verifier: get("sp_verifier") });
    history.replaceState(null, "", redirectUri());
    return true;
  }

  async function token() {
    if (get("sp_token") && Date.now() < +get("sp_expires")) return get("sp_token");
    if (get("sp_refresh") && get("sp_client")) {
      await tokenRequest({ grant_type: "refresh_token", refresh_token: get("sp_refresh"), client_id: get("sp_client") });
      return get("sp_token");
    }
    return null;
  }

  async function api(path) {
    const t = await token();
    if (!t) throw new Error("Not connected to Spotify");
    const url = path.indexOf("http") === 0 ? path : "https://api.spotify.com/v1" + path;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + t } });
    if (!r.ok) {
      // Spotify explains refusals in the body; surface it rather than a bare code.
      let why = "";
      try { const j = await r.json(); why = (j.error && (j.error.message || j.error)) || j.error_description || ""; } catch (e) { /* no body */ }
      const e = new Error("Spotify " + r.status + (why ? ": " + why : ""));
      e.status = r.status;
      throw e;
    }
    return r.json();
  }

  async function playlists() {
    const out = [];
    let page = await api("/me/playlists?limit=50");
    for (;;) {
      out.push.apply(out, page.items.filter(Boolean));
      if (!page.next) break;
      page = await api(page.next);
    }
    return out.map(function (p) { return { id: p.id, name: p.name }; });
  }

  async function playlistTracks(id) {
    // Spotify has been renaming this endpoint; try the newer name first.
    let page;
    try { page = await api("/playlists/" + id + "/items?limit=100"); }
    catch (e) { page = await api("/playlists/" + id + "/tracks?limit=100"); }
    const out = [];
    for (;;) {
      page.items.forEach(function (it) {
        if (!it) return;                       // removed or unavailable tracks come back as null
        const t = it.track || it.item || it;
        if (t && t.name) out.push({ title: t.name, artists: (t.artists || []).map(function (a) { return a.name; }), durationMs: t.duration_ms || 0, tempo: 0, key: null, mode: null });
      });
      if (!page.next) break;
      page = await api(page.next);
    }
    return out;
  }

  // Plain words for the refusals a new Development Mode app actually runs into.
  function explain(err) {
    if (err.status === 403) {
      return "Spotify refused the request (403). For an app in Development Mode that usually means the Spotify account you logged in with is not listed under User Management for your app, or the app owner's Premium is not active. " +
        "Spotify said: " + err.message.replace(/^Spotify 403:? ?/, "") + ". Playlists you do not own or collaborate on are also refused.";
    }
    if (err.status === 401) return "Spotify says the login has expired — press Connect again.";
    if (err.status === 429) return "Spotify says to slow down — try again in a minute.";
    return err.message;
  }

  return {
    parseCSV: parseCSV, tracksFromCSV: tracksFromCSV, camelotFromSpotify: camelotFromSpotify,
    matchScore: matchScore, matchTracks: matchTracks, norm: norm,
    connected: function () { return !!get("sp_token") || !!get("sp_refresh"); },
    savedClientId: function () { return get("sp_client") || ""; },
    redirectUri: redirectUri, login: login, handleRedirect: handleRedirect,
    explain: explain, playlists: playlists, playlistTracks: playlistTracks,
    disconnect: function () { ["sp_token", "sp_expires", "sp_refresh", "sp_verifier", "sp_state"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ok */ } }); },
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Spotify;
