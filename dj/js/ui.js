/* The page: drop files in, press start, watch it think. */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  const mmss = function (s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const CAMELOT = [];
  for (let n = 1; n <= 12; n++) { CAMELOT.push(n + "A"); CAMELOT.push(n + "B"); }

  let nextId = 1;
  const loading = [];                       // placeholders for tracks being analysed
  let decodeCtx = null;
  let lastSpotify = null;                   // the playlist currently being matched

  const player = new Player({ onChange: changed });
  let pending = false;
  function changed() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; renderLists(); });
  }

  // ------------------------------------------------------------ loading audio

  function getDecodeCtx() {
    if (!decodeCtx) decodeCtx = new OfflineAudioContext(1, 1, 44100);
    return decodeCtx;
  }

  function peaksOf(buffer, n) {
    const ch = buffer.getChannelData(0), step = Math.max(1, Math.floor(ch.length / n));
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += 8) { const v = Math.abs(ch[j]); if (v > m) m = v; }
      out[i] = m;
    }
    return out;
  }

  async function addBuffer(name, artist, buffer) {
    const ph = { name: name, progress: 0 };
    loading.push(ph); changed();
    try {
      const channels = [];
      for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
      const analysis = await Analysis.analyze(Analysis.toMono(channels), buffer.sampleRate, {
        onProgress: function (p) { ph.progress = p; changed(); },
      });
      player.add({
        id: nextId++, title: name, artist: artist, buffer: buffer, analysis: analysis,
        peaks: peaksOf(buffer, 900), duration: buffer.duration, keyOverride: null, shiftBeats: 0,
      });
    } catch (err) {
      player.note("Could not analyse " + name + ": " + err.message);
    } finally {
      loading.splice(loading.indexOf(ph), 1); changed();
    }
  }

  async function addFiles(files) {
    for (const f of files) {
      const base = f.name.replace(/\.[^.]+$/, "");
      const parts = base.split(/\s+-\s+/);
      const artist = parts.length > 1 ? parts[0] : "", title = parts.length > 1 ? parts.slice(1).join(" - ") : base;
      try {
        const buf = await getDecodeCtx().decodeAudioData(await f.arrayBuffer());
        await addBuffer(title, artist, buf);
      } catch (err) {
        player.note("Could not read " + f.name + " — this browser can't decode it");
      }
    }
  }

  async function addDemos() {
    $("btn-demo").disabled = true;
    for (const d of Synth.DEMOS) {
      if (player.library.some(function (t) { return t.title === d.title; })) continue;
      const ph = { name: d.title + " (rendering)", progress: 0 };
      loading.push(ph); changed();
      await tick();
      const r = Synth.renderTrack(d);
      loading.splice(loading.indexOf(ph), 1);
      const buf = getDecodeCtx().createBuffer(1, r.samples.length, r.sampleRate);
      buf.copyToChannel(r.samples, 0);
      await addBuffer(d.title, d.artist, buf);
    }
    $("btn-demo").disabled = false;
  }

  // -------------------------------------------------------------- track list

  function statusOf(t) {
    const cur = player.cur && player.cur.track;
    if (cur === t) return player.ctx && player.cur.entry && player.ctx.currentTime < player.cur.entry.tStart ? "Mixing in next" : "Playing";
    const q = player.queue.indexOf(t);
    if (q >= 0) return q === 0 ? "Next" : "Queued #" + (q + 1);
    return player.history.indexOf(t) >= 0 ? "Played" : "Not queued";
  }

  function renderLists() {
    const cur = player.cur && player.cur.track;
    const rows = [];
    const order = [];
    if (cur) order.push(cur);
    player.queue.forEach(function (t) { if (order.indexOf(t) < 0) order.push(t); });
    player.library.forEach(function (t) { if (order.indexOf(t) < 0) order.push(t); });
    order.forEach(function (t, i) {
      const a = t.analysis, st = statusOf(t), queued = player.queue.indexOf(t) >= 0;
      const keySel = '<select data-act="key" data-id="' + t.id + '" title="Key — change it if the guess is wrong"><option value="">auto ' + a.key.camelot + '</option>' +
        CAMELOT.map(function (k) { return '<option' + (t.keyOverride === k ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select>";
      rows.push('<li class="trk' + (cur === t ? " now" : "") + '"><span class="n">' + (i + 1) + '</span>' +
        '<div class="t"><b>' + esc(t.title) + '</b><span>' + esc(t.artist || "Unknown artist") + " · " + mmss(t.duration) + " · " + st +
        ' · <span class="chip">' + a.bpm.toFixed(1) + ' BPM</span> <span class="chip">' + (t.keyOverride || a.key.camelot) + ' ' + esc(a.key.name) + '</span> <span class="chip">E' + a.energy + '</span> ' +
        '<span class="chip">drop @ bar ' + a.cues.firstDrop + '</span></span></div>' +
        '<div class="ctl">' + keySel +
        '<button data-act="shift" data-id="' + t.id + '" title="Nudge where bar 1 is, by one beat, if the downbeat guess is wrong">beat ' + (t.shiftBeats ? "+" + t.shiftBeats : "±0") + '</button>' +
        (queued ? '<button data-act="up" data-id="' + t.id + '">&uarr;</button><button data-act="down" data-id="' + t.id + '">&darr;</button><button data-act="next" data-id="' + t.id + '">Play next</button>' :
          (cur === t ? "" : '<button data-act="queue" data-id="' + t.id + '">Queue</button>')) +
        '<button data-act="del" data-id="' + t.id + '" title="Remove">&times;</button></div></li>');
    });
    loading.forEach(function (l) {
      rows.push('<li class="trk"><span class="n">&hellip;</span><div class="t"><b>' + esc(l.name) + '</b><span>analysing ' + Math.round(l.progress * 100) + '%</span></div><div class="prog"><i style="width:' + Math.round(l.progress * 100) + '%"></i></div></li>');
    });
    $("tracks").innerHTML = rows.join("") || '<li class="fine">Nothing loaded yet. Add the demo tracks to hear it straight away.</li>';

    $("log").innerHTML = player.log.map(function (l) { return "<li><b>" + mmss(l.t) + "</b>" + esc(l.text) + "</li>"; }).join("") || '<li>It will explain each choice here.</li>';

    const running = player.running;
    $("btn-go").innerHTML = running ? "&#9632; Stop the set" : "&#9654; Start the set";
    $("btn-go").classList.toggle("go", !running);
    $("btn-go").disabled = !running && !player.queue.length;
    $("btn-pause").disabled = !running;
    $("btn-pause").textContent = player.paused ? "Resume" : "Pause";
    $("btn-mix").disabled = !running;
    if (lastSpotify) renderMatches();
  }

  $("tracks").addEventListener("click", function (e) {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const t = player.library.find(function (x) { return x.id === +b.dataset.id; });
    if (!t) return;
    const q = player.queue, i = q.indexOf(t);
    const act = b.dataset.act;
    if (act === "del") player.remove(t);
    else if (act === "queue") q.push(t);
    else if (act === "next") { q.splice(i, 1); q.unshift(t); }
    else if (act === "up" && i > 0) { q.splice(i, 1); q.splice(i - 1, 0, t); }
    else if (act === "down" && i < q.length - 1) { q.splice(i, 1); q.splice(i + 1, 0, t); }
    else if (act === "shift") t.shiftBeats = (t.shiftBeats + 1) % 4;
    changed();
  });
  $("tracks").addEventListener("change", function (e) {
    const s = e.target.closest("select[data-act=key]");
    if (!s) return;
    const t = player.library.find(function (x) { return x.id === +s.dataset.id; });
    if (t) { t.keyOverride = s.value || null; changed(); }
  });

  // ----------------------------------------------------------------- decks

  const waveCache = new WeakMap();
  const SECTION_COLOR = { intro: "#2a2745", outro: "#2a2745", break: "#14121f", groove: "#3b3566", drop: "#5a2b6a" };

  function waveFor(track) {
    if (waveCache.has(track)) return waveCache.get(track);
    const c = document.createElement("canvas");
    c.width = 900; c.height = 64;
    const g = c.getContext("2d");
    const a = track.analysis;
    g.fillStyle = "#0f0d18"; g.fillRect(0, 0, 900, 64);
    a.sections.forEach(function (s) {
      g.fillStyle = SECTION_COLOR[s.type] || "#222";
      const x0 = (a.downbeat + s.start * a.barLen) / track.duration * 900, x1 = (a.downbeat + s.end * a.barLen) / track.duration * 900;
      g.fillRect(x0, 0, Math.max(1, x1 - x0), 64);
    });
    g.fillStyle = "#c9c4e8";
    const p = track.peaks, mid = 32;
    for (let i = 0; i < p.length; i++) { const h = Math.max(1, p[i] * 28); g.fillRect(i, mid - h, 1, h * 2); }
    waveCache.set(track, c);
    return c;
  }

  const deckState = {};

  function deckEl(label, d) {
    const el = $("deck-" + label);
    let st = deckState[label];
    if (!d) {
      if (st) { el.innerHTML = '<div class="empty">Deck ' + label + "</div>"; deckState[label] = null; el.classList.remove("audible"); }
      return;
    }
    if (!st || st.track !== d.track) {
      el.innerHTML = '<div class="deck-head"><span class="tag">' + label + '</span><span class="name">' + esc(d.track.title) + '</span></div>' +
        '<div class="deck-meta"><span>BPM <b data-k="bpm"></b></span><span>Key <b>' + (d.track.keyOverride || d.track.analysis.key.camelot) + '</b></span><span>Bar <b data-k="bar"></b></span><span data-k="sec"></span></div>' +
        '<canvas class="wave" width="900" height="64"></canvas>' +
        '<div class="eqs"><div class="eq"><i data-k="eqL"></i>LOW</div><div class="eq"><i data-k="eqM"></i>MID</div><div class="eq"><i data-k="eqH"></i>HIGH</div><div class="lvl"><i data-k="lvl"></i></div></div>';
      st = deckState[label] = { track: d.track, el: el, ctx: el.querySelector("canvas").getContext("2d"), k: {} };
      el.querySelectorAll("[data-k]").forEach(function (n) { st.k[n.dataset.k] = n; });
    }
    const a = d.track.analysis;
    st.k.bpm.textContent = d.started ? d.bpm.toFixed(1) : "—";
    const bar = Math.floor(d.bar) + 1;
    st.k.bar.textContent = d.started ? Math.max(1, bar) + " / " + a.bars : "cueing";
    const sec = d.started ? a.sections.find(function (s) { return d.bar >= s.start && d.bar < s.end; }) : null;
    st.k.sec.textContent = sec ? sec.type : "";
    const h = function (g) { return Math.max(4, Math.min(100, (g + 40) / 40 * 100)) + "%"; };
    st.k.eqL.style.setProperty("--h", h(d.eq.low)); st.k.eqM.style.setProperty("--h", h(d.eq.mid)); st.k.eqH.style.setProperty("--h", h(d.eq.high));
    st.k.lvl.style.setProperty("--w", Math.round(Math.min(1, d.level) * 100) + "%");
    el.classList.toggle("audible", d.audible);
    const g = st.ctx;
    g.clearRect(0, 0, 900, 64);
    g.drawImage(waveFor(d.track), 0, 0);
    const x = d.pos / d.track.duration * 900;
    g.fillStyle = "#fff"; g.fillRect(Math.max(0, Math.min(898, x)), 0, 2, 64);
  }

  // ----------------------------------------------------------- transition strip

  let preview = { at: 0, plan: null, key: "" };

  function frame() {
    requestAnimationFrame(frame);
    const snap = player.snapshot();
    if (!snap) {
      deckEl("A", null); deckEl("B", null);
      $("strip-title").textContent = player.running ? "Paused" : "Not playing"; $("strip-time").textContent = ""; $("strip-bar").style.width = "0";
      return;
    }
    ["A", "B"].forEach(function (label) {
      const mine = snap.decks.filter(function (d) { return d.label === label; });
      deckEl(label, mine[mine.length - 1] || null);
    });

    const now = snap.now;
    const active = snap.decks.map(function (d) { return d.voice; }).filter(function (v) { return v.entry && now < v.entry.tSwap + 4; })[0];
    if (active) {
      const e = active.entry, plan = e.plan;
      const first = now < e.tBegin;
      $("strip-title").textContent = (first ? "Coming up: " : "Mixing: ") + active.track.title + " — " + Brain.label(plan);
      $("strip-time").textContent = now < e.tSwap ? ("swap in " + mmss(e.tSwap - now) + (e.tBegin > now ? " · starts in " + mmss(e.tBegin - now) : "")) : "landed";
      $("strip-bar").style.width = Math.max(0, Math.min(1, (now - e.tBegin) / Math.max(0.1, e.tSwap - e.tBegin))) * 100 + "%";
      $("strip-why").innerHTML = plan.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    } else if (player.cur && player.queue[0]) {
      if (now - preview.at > 0.5 || preview.key !== player.queue[0].id + ":" + player.style) {
        preview.at = now; preview.key = player.queue[0].id + ":" + player.style;
        preview.plan = Brain.planTransition(Engine.infoOf(player.cur.track), Engine.infoOf(player.queue[0]), { entryBar: player.cur.entryBar, style: player.style });
      }
      const p = preview.plan, ts = player.cur.timeOfBar(p.swapBar);
      $("strip-title").textContent = "Next: " + player.queue[0].title + " — " + Brain.label(p);
      $("strip-time").textContent = "swap in " + mmss(ts - now);
      $("strip-bar").style.width = "0";
      $("strip-why").innerHTML = p.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    } else {
      $("strip-title").textContent = "Playing the last track"; $("strip-time").textContent = ""; $("strip-bar").style.width = "0"; $("strip-why").innerHTML = "";
    }
  }

  // --------------------------------------------------------------- controls

  $("btn-go").addEventListener("click", function () {
    if (player.running) player.stop();
    else { player.fx = $("chk-fx").checked; player.start(); }
    changed();
  });
  $("btn-pause").addEventListener("click", function () { player.togglePause(); });
  $("btn-mix").addEventListener("click", function () { player.mixNow(); });
  $("sel-style").addEventListener("change", function (e) { player.style = e.target.value; });
  $("sel-arc").addEventListener("change", function (e) { player.arc = e.target.value; });
  $("chk-endless").addEventListener("change", function (e) { player.endless = e.target.checked; });
  $("chk-fx").addEventListener("change", function (e) { player.setFx(e.target.checked); });
  $("rng-vol").addEventListener("input", function (e) { player.setVolume(+e.target.value); });
  $("btn-order").addEventListener("click", function () { player.autoOrder(); player.note("Queue re-ordered for key, tempo and energy (" + $("sel-arc").selectedOptions[0].text.toLowerCase() + ")"); });
  document.querySelectorAll("[data-fx]").forEach(function (b) { b.addEventListener("click", function () { player.perform(b.dataset.fx); }); });
  $("btn-about").addEventListener("click", function () {
    const open = $("about").hidden; $("about").hidden = !open; $("btn-about").setAttribute("aria-expanded", String(open));
  });
  $("btn-demo").addEventListener("click", addDemos);
  $("file-in").addEventListener("change", function (e) { addFiles(Array.from(e.target.files)); e.target.value = ""; });
  ["dragenter", "dragover"].forEach(function (ev) { $("drop").addEventListener(ev, function (e) { e.preventDefault(); $("drop").classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { $("drop").addEventListener(ev, function (e) { e.preventDefault(); $("drop").classList.remove("over"); }); });
  $("drop").addEventListener("drop", function (e) { addFiles(Array.from(e.dataTransfer.files).filter(function (f) { return /^audio\//.test(f.type) || /\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(f.name); })); });

  // ----------------------------------------------------------------- export

  function encodeWav(buffer) {
    const n = buffer.length, ch = 2, sr = buffer.sampleRate;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = function (o, s) { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVEfmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    w(36, "data"); out.setUint32(40, n * ch * 2, true);
    const L = buffer.getChannelData(0), R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
    let o = 44;
    for (let i = 0; i < n; i++) {
      out.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); o += 2;
      out.setInt16(o, Math.max(-1, Math.min(1, R[i])) * 32767, true); o += 2;
    }
    return new Blob([out.buffer], { type: "audio/wav" });
  }

  $("btn-export").addEventListener("click", async function () {
    const tracks = (player.running && player.cur ? [player.cur.track] : []).concat(player.queue);
    if (tracks.length < 2) { player.note("Queue at least two tracks to export a mix"); return; }
    const b = $("btn-export"), label = b.textContent;
    b.disabled = true; b.textContent = "Rendering…";
    try {
      await tick();
      const res = await Engine.renderSet(tracks, { style: player.style, fx: player.fx });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(encodeWav(res.buffer));
      a.download = "autopilot-dj-mix.wav";
      a.click();
      player.note("Exported " + tracks.length + " tracks, " + mmss(res.buffer.duration) + " — " + res.plans.map(Brain.label).join(", "));
    } catch (err) {
      player.note("Export failed: " + err.message);
    }
    b.disabled = false; b.textContent = label;
  });

  // ---------------------------------------------------------------- Spotify

  function renderMatches() {
    const locals = player.library.map(function (t) { return { track: t, title: t.title, artist: t.artist, duration: t.duration }; });
    const m = Spotify.matchTracks(lastSpotify.tracks, locals);
    lastSpotify.matches = m;
    const have = m.filter(function (x) { return x.local; }).length;
    $("sp-result").innerHTML =
      "<p><b>" + esc(lastSpotify.name) + "</b> — " + have + " of " + m.length + " tracks matched to your files.</p>" +
      '<div class="sp-row"><button id="sp-q1"' + (have ? "" : " disabled") + '>Queue matched, in playlist order</button><button id="sp-q2"' + (have ? "" : " disabled") + '>Queue matched, let the DJ order them</button></div>' +
      m.map(function (x) {
        const sp = x.spotify;
        return '<div class="match"><span class="' + (x.local ? "ok" : "no") + '">' + (x.local ? "✓" : "?") + "</span><span>" + esc(sp.artists.join(", ")) + " — " + esc(sp.title) + "</span><span>" +
          (x.local ? esc(x.local.track.title) : "drop this file in above") + "</span></div>";
      }).join("");
    const queue = function (order) {
      const cur = player.cur && player.cur.track;
      player.queue = lastSpotify.matches.filter(function (x) { return x.local && x.local.track !== cur; }).map(function (x) { return x.local.track; });
      if (order) player.autoOrder();
      player.note("Queued " + player.queue.length + " tracks from " + lastSpotify.name + (order ? ", ordered by the DJ" : ", in playlist order"));
      changed();
    };
    const q1 = $("sp-q1"), q2 = $("sp-q2");
    if (q1) q1.onclick = function () { queue(false); };
    if (q2) q2.onclick = function () { queue(true); };
  }

  function showSpotify(name, tracks) {
    lastSpotify = { name: name, tracks: tracks, matches: [] };
    renderMatches();
  }

  function spotifyUi() {
    const on = Spotify.connected();
    $("sp-lists").hidden = !on; $("sp-load").hidden = !on; $("sp-off").hidden = !on;
    $("sp-connect").hidden = on; $("sp-client").hidden = on;
    $("sp-client").value = Spotify.savedClientId();
    $("sp-redirect").textContent = "Spotify login needs your own app (developer.spotify.com/dashboard) with this exact redirect URI added: " + Spotify.redirectUri();
  }

  async function loadLists() {
    try {
      const lists = await Spotify.playlists();
      $("sp-lists").innerHTML = lists.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("");
    } catch (err) {
      player.note("Spotify: " + err.message); if (/40[13]/.test(err.message)) { Spotify.disconnect(); spotifyUi(); }
    }
  }

  $("sp-csv").addEventListener("change", async function (e) {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const tracks = Spotify.tracksFromCSV(await f.text());
    if (!tracks.length) { player.note("That CSV has no track names — export it with Exportify"); return; }
    showSpotify(f.name.replace(/\.csv$/i, ""), tracks);
  });
  $("sp-connect").addEventListener("click", function () {
    const id = $("sp-client").value.trim();
    if (!id) { player.note("Paste your Spotify app's Client ID first"); return; }
    Spotify.login(id);
  });
  $("sp-off").addEventListener("click", function () { Spotify.disconnect(); spotifyUi(); });
  $("sp-load").addEventListener("click", async function () {
    const sel = $("sp-lists");
    if (!sel.value) return;
    try { showSpotify(sel.selectedOptions[0].text, await Spotify.playlistTracks(sel.value)); }
    catch (err) { player.note("Spotify: " + err.message); }
  });

  Spotify.handleRedirect().then(function (did) { spotifyUi(); if (Spotify.connected()) loadLists(); if (did) player.note("Connected to Spotify"); })
    .catch(function (err) { spotifyUi(); player.note(err.message); });

  // test hook
  window.__dj = { player: player, addBuffer: addBuffer, addDemos: addDemos };

  renderLists();
  requestAnimationFrame(frame);
})();
