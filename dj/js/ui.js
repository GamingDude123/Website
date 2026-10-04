/* The page: drop files in, press start, watch it think. */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  const mmss = function (s) { if (!isFinite(s)) return "–:––"; s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const CAMELOT = [];
  for (let n = 1; n <= 12; n++) { CAMELOT.push(n + "A"); CAMELOT.push(n + "B"); }

  let nextId = 1;
  const loading = [];                       // placeholders for tracks being analysed
  let decodeCtx = null;

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

  const FINE = 100;                          // peaks per second for the zoomed waveform
  function finePeaks(buffer) {
    const ch = buffer.getChannelData(0), n = Math.ceil(buffer.duration * FINE), step = buffer.sampleRate / FINE;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = Math.floor(i * step), e = Math.min(ch.length, Math.floor((i + 1) * step)); j < e; j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; }
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
        peaks: peaksOf(buffer, 900), fine: finePeaks(buffer), duration: buffer.duration, keyOverride: null, shiftBeats: 0,
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
    if (q >= 0) return q === 0 ? "Up next" : "Queued #" + (q + 1);
    return player.history.indexOf(t) >= 0 ? "Played" : "Not queued";
  }

  let lastTracksHtml = "";
  const openRows = new Set();               // tracks whose edit controls are showing

  function renderLists() {
    const cur = player.cur && player.cur.track;
    const rows = [], order = [];
    if (cur) order.push(cur);
    player.queue.forEach(function (t) { if (order.indexOf(t) < 0) order.push(t); });
    player.library.forEach(function (t) { if (order.indexOf(t) < 0) order.push(t); });
    order.forEach(function (t, i) {
      const a = t.analysis, queued = player.queue.indexOf(t) >= 0;
      const keySel = '<select data-act="key" data-id="' + t.id + '" title="Key — change it if the guess is wrong" aria-label="Key"><option value="">key: auto ' + a.key.camelot + '</option>' +
        CAMELOT.map(function (k) { return '<option' + (t.keyOverride === k ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select>";
      const open = openRows.has(t.id);
      rows.push('<li class="trk' + (cur === t ? " now" : "") + (open ? " open" : "") + '"><span class="n">' + (i + 1) + '</span>' +
        '<div class="t"><b>' + esc(t.title) + '</b><div class="sub"><span>' + esc(t.artist || "Unknown artist") + '</span><span>' + a.bpm.toFixed(0) + ' BPM</span><span>' + (t.keyOverride || a.key.camelot) + '</span><span>' + mmss(t.duration) + '</span><span class="status">' + statusOf(t) + '</span></div></div>' +
        '<button class="edit" data-act="edit" data-id="' + t.id + '" aria-expanded="' + open + '" aria-controls="ctl-' + t.id + '" aria-label="' + (open ? "Done editing " : "Edit ") + esc(t.title) + '">' + (open ? "Done" : "Edit") + '</button>' +
        '<div class="ctl" id="ctl-' + t.id + '">' + keySel +
        '<button data-act="shift" data-id="' + t.id + '" title="Nudge where bar 1 is by one beat, if the downbeat guess is wrong">downbeat ' + (t.shiftBeats ? "+" + t.shiftBeats : "±0") + '</button>' +
        (queued ? '<button data-act="up" data-id="' + t.id + '" aria-label="Move up">&uarr;</button><button data-act="down" data-id="' + t.id + '" aria-label="Move down">&darr;</button><button data-act="next" data-id="' + t.id + '" aria-label="Play ' + esc(t.title) + ' next">Play next</button>' :
          (cur === t ? "" : '<button data-act="queue" data-id="' + t.id + '" aria-label="Queue ' + esc(t.title) + '">Queue</button>')) +
        '<button data-act="del" data-id="' + t.id + '" aria-label="Remove ' + esc(t.title) + '">Remove</button></div></li>');
    });
    loading.forEach(function (l) {
      rows.push('<li class="trk"><span class="n">&hellip;</span><div class="t"><b>' + esc(l.name) + '</b><div class="sub"><span class="status">analysing ' + Math.round(l.progress * 100) + '%</span></div></div><div class="prog"><i style="width:' + Math.round(l.progress * 100) + '%"></i></div></li>');
    });
    const html = rows.join("") || '<li class="empty-lib">Nothing here yet &mdash; add the demo tracks to hear it straight away.</li>';
    if (html !== lastTracksHtml) {
      // the player redraws every 200 ms; only touch the DOM when the list really changed,
      // and keep keyboard focus on the same control if it did
      const f = document.activeElement, fa = f && $("tracks").contains(f) && f.dataset ? { act: f.dataset.act, id: f.dataset.id } : null;
      $("tracks").innerHTML = html; lastTracksHtml = html;
      if (fa && fa.act) { const again = $("tracks").querySelector('[data-act="' + fa.act + '"][data-id="' + fa.id + '"]'); if (again) again.focus(); }
    }

    $("log").innerHTML = player.log.map(function (l) { return "<li><b>" + mmss(l.t) + "</b>" + esc(l.text) + "</li>"; }).join("") || "<li>It will explain each choice here.</li>";

    // memory is the only real limit on how many tracks fit: a decoded track is raw audio
    let bytes = 0;
    player.library.forEach(function (t) { bytes += t.buffer.length * t.buffer.numberOfChannels * 4; });
    const mb = Math.round(bytes / 1048576), n = player.library.length;
    $("lib-stat").textContent = n ? n + (n === 1 ? " track" : " tracks") + " · " + mb + " MB in memory" + (mb > 1500 ? " — heavy; remove a few if the page slows" : "") : "";
    $("lib-stat").classList.toggle("warn", mb > 1500);

    const running = player.running;
    $("btn-go").innerHTML = running ? "&#9632; Stop the set" : "&#9654; Start the set";
    $("btn-go").classList.toggle("stop", running);
    $("btn-go").disabled = !running && !player.queue.length;
    $("btn-pause").disabled = !running;
    $("btn-pause").textContent = player.paused ? "Resume" : "Pause";
    $("btn-mix").disabled = !running;
    renderMatches("spotify"); renderMatches("soundcloud");
  }

  $("tracks").addEventListener("click", function (e) {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const t = player.library.find(function (x) { return x.id === +b.dataset.id; });
    if (!t) return;
    const q = player.queue, i = q.indexOf(t);
    const act = b.dataset.act;
    if (act === "edit") { if (openRows.has(t.id)) openRows.delete(t.id); else openRows.add(t.id); }
    else if (act === "del") player.remove(t);
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

  const SECTION_COLOR = { intro: "#2b2850", outro: "#2b2850", break: "#12101c", groove: "#3b3566", drop: "#5b2b78" };
  const waveCache = new WeakMap();

  // the whole track at a glance: sections behind, peaks in front
  function waveFor(track) {
    if (waveCache.has(track)) return waveCache.get(track);
    const c = document.createElement("canvas");
    c.width = 900; c.height = 68;
    const g = c.getContext("2d");
    const a = track.analysis;
    g.fillStyle = "#0a0812"; g.fillRect(0, 0, 900, 68);
    a.sections.forEach(function (s) {
      g.fillStyle = SECTION_COLOR[s.type] || "#222";
      const x0 = (a.downbeat + s.start * a.barLen) / track.duration * 900, x1 = (a.downbeat + s.end * a.barLen) / track.duration * 900;
      g.fillRect(x0, 0, Math.max(1, x1 - x0), 68);
    });
    g.fillStyle = "rgba(235,232,255,.85)";
    const p = track.peaks;
    for (let i = 0; i < p.length; i++) { const h = Math.max(1, p[i] * 30); g.fillRect(i, 34 - h, 1, h * 2); }
    waveCache.set(track, c);
    return c;
  }

  // keep a canvas's backing store matched to its on-screen size
  function fit(c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (w && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
    return dpr;
  }

  const ZOOM_BARS = 6;                       // bars either side of the playhead... total window = 2x

  // the scrolling waveform: beat grid, bar numbers, playhead in the middle
  function drawZoom(canvas, track, pos, color, label, playing) {
    const dpr = fit(canvas), W = canvas.width, H = canvas.height, g = canvas.getContext("2d");
    const a = Engine.gridOf(track), half = ZOOM_BARS * a.barLen, spp = (2 * half) / W;
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0d0a18"); bg.addColorStop(1, "#08060f");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const t0 = pos - half;
    // sections as a faint band under everything
    track.analysis.sections.forEach(function (s) {
      const x0 = ((a.downbeat + s.start * a.barLen) - t0) / spp, x1 = ((a.downbeat + s.end * a.barLen) - t0) / spp;
      if (x1 < 0 || x0 > W) return;
      g.fillStyle = s.type === "drop" ? "rgba(166,77,255,.16)" : s.type === "break" ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.05)";
      g.fillRect(Math.max(0, x0), 0, Math.min(W, x1) - Math.max(0, x0), H);
    });
    // peaks
    const fine = track.fine, mid = H / 2;
    for (let x = 0; x < W; x += 2) {
      const i = Math.floor((t0 + x * spp) * FINE);
      let v = 0;
      if (i >= 0 && i < fine.length) v = fine[i];
      if (!v) continue;
      const h = Math.max(1, Math.min(1, v) * (H * 0.46));
      g.fillStyle = x < W / 2 ? color : "rgba(235,232,255,.78)";
      g.globalAlpha = x < W / 2 ? 0.95 : 1;
      g.fillRect(x, mid - h, Math.max(1, dpr), h * 2);
    }
    g.globalAlpha = 1;
    // beat grid: every beat faint, every bar brighter and numbered
    const firstBeat = Math.ceil((t0 - a.downbeat) / a.beatLen);
    g.font = (10 * dpr) + "px system-ui, sans-serif"; g.textBaseline = "top";
    for (let k = firstBeat; ; k++) {
      const t = a.downbeat + k * a.beatLen, x = (t - t0) / spp;
      if (x > W) break;
      if (x < 0) continue;
      const isBar = ((k % 4) + 4) % 4 === 0, bar = Math.round(k / 4);
      g.fillStyle = isBar ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.1)";
      g.fillRect(Math.round(x), isBar ? 0 : H * 0.72, Math.max(1, dpr), isBar ? H : H * 0.28);
      if (isBar && bar >= 0 && bar % 4 === 0) { g.fillStyle = "rgba(255,255,255,.55)"; g.fillText(String(bar + 1), x + 4 * dpr, 3 * dpr); }
    }
    // playhead
    g.fillStyle = "#fff"; g.shadowColor = color; g.shadowBlur = 8 * dpr;
    g.fillRect(W / 2 - dpr, 0, 2 * dpr, H); g.shadowBlur = 0;
    if (!playing) { g.fillStyle = "rgba(7,6,13,.55)"; g.fillRect(0, 0, W, H); }
    void label;
  }

  const deckState = {};
  const ACCENT = { A: "#ff9ad5", B: "#8fe6ff" };

  function eqRow(name) {
    return '<div class="eqr"><span>' + name + '</span><div class="t"><i data-k="eq' + name[0] + '"></i></div></div>';
  }

  const ICON = {
    back4: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 6l-8 6 8 6zM11 6l-7 6 7 6z"/></svg>',
    rew: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6l-8 6 8 6zM21 6l-8 6 8 6z"/></svg>',
    ff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6l8 6-8 6zM3 6l8 6-8 6z"/></svg>',
    fwd4: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M5 6l8 6-8 6zM13 6l7 6-7 6z"/></svg>',
  };
  const XPORT = [
    ["back4", "Back 4 bars", "Jump back 4 bars"],
    ["rew", "Rewind", "Hold to rewind"],
    ["ff", "Fast-forward", "Hold to fast-forward"],
    ["fwd4", "Forward 4 bars", "Jump forward 4 bars"],
  ];

  function deckEl(label, d, snap) {
    const el = $("deck-" + label);
    let st = deckState[label];
    if (!d) {
      if (st) { el.innerHTML = '<div class="empty"><b>' + label + "</b></div>"; deckState[label] = null; el.classList.remove("audible", "paused", "handed"); }
      return;
    }
    const a = d.track.analysis;
    if (!st || st.track !== d.track) {
      el.innerHTML = '<div class="d-top"><span class="badge">' + label + '</span><div class="ti"><b>' + esc(d.track.title) + '</b><small>' + esc(d.track.artist || "Unknown artist") + '</small></div><span class="state" data-k="sec"></span></div>' +
        '<div class="tt-row">' +
          '<div class="tt" data-k="tt">' +
            '<div class="platter" data-k="platter" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Deck ' + label + ' turntable — drag to scrub, left and right arrows jump a bar">' +
              '<div class="vinyl" data-k="vinyl"><i class="strobe"></i><i class="sheen"></i><div class="lab"><b>' + label + '</b></div><span class="mark"></span></div>' +
            '</div>' +
            '<i class="arm" data-k="arm"></i>' +
          '</div>' +
          '<div class="tt-side">' +
            '<div class="read"><div><b class="big" data-k="bpm"></b><small>BPM</small></div><div><b>' + (d.track.keyOverride || a.key.camelot) + '</b><small>' + esc(a.key.name) + '</small></div></div>' +
            '<div class="xport" role="group" aria-label="Deck ' + label + ' transport">' +
              XPORT.map(function (x) { return '<button data-act="' + x[0] + '" aria-label="' + x[1] + '" title="' + x[2] + '">' + ICON[x[0]] + '</button>'; }).join("") +
            '</div>' +
            '<small class="tt-note" data-k="note" aria-live="polite"></small>' +
          '</div>' +
        '</div>' +
        '<canvas class="zoom" title="Drag the waveform to move through the track"></canvas>' +
        '<div class="eqs">' + eqRow("LOW") + eqRow("MID") + eqRow("HIGH") + '</div>';
      st = deckState[label] = { track: d.track, k: {}, zoom: el.querySelector("canvas.zoom"), pct: -1 };
      el.querySelectorAll("[data-k]").forEach(function (n) { st.k[n.dataset.k] = n; });
    }
    st.k.bpm.textContent = d.started ? d.bpm.toFixed(1) : "—";
    const handed = snap.hand && d.touch;
    const sec = d.started ? a.sections.find(function (s) { return d.bar >= s.start && d.bar < s.end; }) : null;
    st.k.sec.textContent = handed ? "in hand" : snap.paused && d.started ? "paused" : sec ? sec.type : (d.started ? "" : "cueing");
    [["L", d.eq.low], ["M", d.eq.mid], ["H", d.eq.high]].forEach(function (e) {
      const g = e[1];
      st.k["eq" + e[0]].style.setProperty("--w", Math.max(3, Math.min(100, (g + 40) / 40 * 100)) + "%");
      st.k["eq" + e[0]].classList.toggle("kill", g < -30);
    });
    el.classList.toggle("audible", d.audible);
    el.classList.toggle("paused", snap.paused && d.started);
    el.classList.toggle("handed", !!handed);

    // the platter turns with the track: 200° for every second of it, so it speeds up,
    // slows to a halt and runs backwards exactly as the sound does
    const pos = d.started ? d.pos : d.voice.tl.offset;
    st.k.vinyl.style.transform = "rotate(" + Turntable.angleOf(pos).toFixed(1) + "deg)";
    const frac = Math.max(0, Math.min(1, pos / d.track.buffer.duration));
    st.k.arm.style.setProperty("--sweep", (frac * 16).toFixed(1) + "deg");
    st.k.arm.classList.toggle("lifted", !d.started || (snap.paused && !snap.pausing));
    st.k.tt.classList.toggle("locked", !d.touch);
    st.k.platter.tabIndex = d.touch ? 0 : -1;
    const pct = Math.round(frac * 100);
    if (pct !== st.pct) {
      st.pct = pct;
      st.k.platter.setAttribute("aria-valuenow", pct);
      st.k.platter.setAttribute("aria-valuetext", "bar " + Math.max(1, Math.floor(d.bar) + 1) + ", " + pct + " percent");
    }
    if (!d.touch && snap.lock) st.k.platter.title = snap.lock; else st.k.platter.removeAttribute("title");
    drawZoom(st.zoom, d.track, pos, ACCENT[label], label, d.started);
  }

  // A line under the transport for a couple of seconds: why the deck would not move.
  const noteTimers = {};
  function deckNote(label, text) {
    const st = deckState[label];
    if (!st) return;
    st.k.note.textContent = text;
    clearTimeout(noteTimers[label]);
    noteTimers[label] = setTimeout(function () { st.k.note.textContent = ""; }, 2600);
  }

  // ---------------------------------------------------------- hands on the decks
  //
  // Dragging the platter (or the waveform), or holding rewind / fast-forward,
  // takes a deck from the mixer for as long as the hand is on it. Whatever the
  // hand is doing becomes a speed, sent to the engine as it changes; keeping
  // still holds the record, and letting go spins it back up to normal.

  let hold = null;                            // the one hand that is down: {kind, label, ...}

  function lockNote(label) {
    const s = player.snapshot();
    deckNote(label, (s && s.lock) || "Start the set to use the decks");
  }

  function pointAngle(e, el) {
    const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    return { deg: Math.atan2(dy, dx) * 180 / Math.PI, r: Math.hypot(dx, dy) };
  }

  function startDrag(label, kind, e, el) {
    if (hold) return;
    if (!player.grab(label)) { lockNote(label); return; }
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    hold = { kind: kind, label: label, el: el, id: e.pointerId, x: e.clientX, ang: kind === "platter" ? pointAngle(e, el).deg : 0, at: performance.now(), v: 0, still: false, secPerPx: 0 };
    if (kind === "strip") {
      const track = deckState[label].track;
      hold.secPerPx = (2 * ZOOM_BARS * Engine.gridOf(track).barLen) / Math.max(1, el.clientWidth);
    }
    player.scrub(0, 0.03);                                   // a hand on the record stops it
    el.classList.add("grabbing");
  }

  function moveDrag(e) {
    if (!hold || hold.kind === "search" || e.pointerId !== hold.id) return;
    const now = performance.now(), dt = (now - hold.at) / 1000;
    let seconds = 0;
    if (hold.kind === "platter") {
      const p = pointAngle(e, hold.el);
      if (p.r < 10) return;                                  // too close to the spindle to read an angle
      let d = p.deg - hold.ang;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      hold.ang = p.deg;
      seconds = d / Turntable.DEG_PER_SEC;
    } else {
      seconds = -(e.clientX - hold.x) * hold.secPerPx;      // drag the waveform left and the track moves forward
      hold.x = e.clientX;
    }
    hold.at = now;
    const v = Turntable.rateFromDrag(seconds, dt);
    hold.v = 0.5 * hold.v + 0.5 * v;                         // pointer events arrive in bursts; smooth them a little
    hold.still = false;
    player.scrub(hold.v, 0.035);
  }

  function endHold() {
    if (!hold) return;
    if (hold.el) hold.el.classList.remove("grabbing");
    hold.el && hold.el.classList.remove("held");
    hold = null;
    player.letGo(false);
  }

  function startSearch(label, dir, el) {
    if (hold) return;
    if (!player.grab(label)) { lockNote(label); return; }
    hold = { kind: "search", label: label, el: el, dir: dir, at: performance.now() };
    el.classList.add("held");
    player.scrub(dir * Turntable.searchRate(0), 0.15);
  }

  // called every frame: a still hand holds the record; a held search winds on
  function tickHold() {
    if (!hold) return;
    if (!player.session) { hold.el && hold.el.classList.remove("grabbing", "held"); hold = null; return; }   // the set stopped or paused under it
    const now = performance.now();
    if (hold.kind === "search") player.scrub(hold.dir * Turntable.searchRate((now - hold.at) / 1000), 0.12);
    else if (!hold.still && now - hold.at > 50) { hold.still = true; hold.v = 0; player.scrub(0, 0.04); }
  }

  ["A", "B"].forEach(function (label) {
    const el = $("deck-" + label);
    el.dataset.label = label;
    el.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return;
      const btn = e.target.closest("button[data-act]");
      if (btn) {
        if (btn.dataset.act === "rew" || btn.dataset.act === "ff") startSearch(label, btn.dataset.act === "ff" ? 1 : -1, btn);
        return;
      }
      const plat = e.target.closest(".platter");
      if (plat) { startDrag(label, "platter", e, plat); return; }
      const strip = e.target.closest("canvas.zoom");
      if (strip) startDrag(label, "strip", e, strip);
    });
    el.addEventListener("pointermove", moveDrag);
    el.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-act]");
      if (!btn || e.detail === 0) return;                    // keyboard "clicks" are handled below
      if (btn.dataset.act === "back4" || btn.dataset.act === "fwd4") jump(label, btn.dataset.act === "fwd4" ? 4 : -4);
    });
    el.addEventListener("keydown", function (e) {
      const btn = e.target.closest("button[data-act]");
      if (btn && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        if (e.repeat) return;
        const act = btn.dataset.act;
        if (act === "rew" || act === "ff") startSearch(label, act === "ff" ? 1 : -1, btn);
        else jump(label, act === "fwd4" ? 4 : -4);
      } else if (e.target.closest(".platter") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        jump(label, (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 4 : 1));
      }
    });
    el.addEventListener("keyup", function (e) {
      if (hold && hold.kind === "search" && (e.key === "Enter" || e.key === " ")) endHold();
    });
    el.addEventListener("blur", function (e) { if (hold && hold.kind === "search" && e.target === hold.el) endHold(); }, true);
  });
  window.addEventListener("pointerup", endHold);
  window.addEventListener("pointercancel", endHold);

  function jump(label, bars) {
    if (!player.jump(label, bars)) lockNote(label);
  }

  // ----------------------------------------------------- mixer column + meter

  let preview = { at: 0, plan: null, key: "" };
  let peakHold = 0;

  function drawMeter() {
    const c = $("meter");
    const dpr = fit(c), W = c.width, H = c.height, g = c.getContext("2d");
    g.clearRect(0, 0, W, H);
    let level = 0;
    if (player.mixer && !player.paused) {
      const buf = new Uint8Array(player.mixer.analyser.fftSize);
      player.mixer.analyser.getByteTimeDomainData(buf);
      let e = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; e += v * v; }
      level = Math.min(1, Math.sqrt(e / buf.length) * 2.6);
    }
    peakHold = Math.max(level, peakHold - 0.012);
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#5dff9a"); grad.addColorStop(0.7, "#ffc23d"); grad.addColorStop(1, "#ff4d4d");
    g.fillStyle = grad;
    const segs = 28, sw = W / segs;
    for (let i = 0; i < segs; i++) { if (i / segs < level) g.fillRect(i * sw + dpr, 2 * dpr, sw - 2 * dpr, H - 4 * dpr); }
    g.fillStyle = "#fff"; g.fillRect(Math.min(W - 2 * dpr, peakHold * W), 0, 2 * dpr, H);
  }

  // The effects strip: a lamp is lit while that effect sounds, outlined while the
  // transition that is lined up (or the one being previewed) will use it.
  const LAMPS = Array.prototype.slice.call(document.querySelectorAll("[data-lamp]"));
  let pulseTimer = 0, hitWas = false;
  function plannedFx(plan, settings) {
    const o = {};
    if (!plan) return o;
    if (settings.fx) {
      if (plan.riser) o.riser = 1;
      if (plan.roll) o.roll = 1;
      if (plan.impact) o.hit = 1;
      if (plan.echoThrow) o.echo = 1;
      if (plan.crash) o.crash = 1;
      if (plan.downlifter) o.down = 1;
    }
    if (plan.type === "dropSwap" || plan.type === "echoOut" || plan.type === "bassSwap") o.filter = 1;
    if (plan.type === "bassSwap") o.echo = 1;
    if (plan.type === "brake") o.brake = 1;
    if (plan.type === "spinback") o.spin = 1;
    return o;
  }
  function showFx(snap) {
    const fx = snap.fx || {}, planned = {};
    if (!Object.keys(fx).some(function (k) { return fx[k] === "plan" || fx[k] === "on"; }) && player.queue[0] && preview.plan) Object.assign(planned, plannedFx(preview.plan, player.settings));
    LAMPS.forEach(function (el) {
      const k = el.dataset.lamp, st = fx[k] === "on" ? "on" : (fx[k] === "plan" || planned[k]) ? "plan" : "";
      el.classList.toggle("on", st === "on");
      el.classList.toggle("plan", st === "plan");
    });
    const hit = fx.hit === "on" || fx.crash === "on" || fx.brake === "on" || fx.spin === "on";
    if (hit && !hitWas) {
      const b = document.querySelector(".booth");
      b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
      clearTimeout(pulseTimer); pulseTimer = setTimeout(function () { b.classList.remove("pulse"); }, 600);
    }
    hitWas = hit;
  }

  function frame() {
    requestAnimationFrame(frame);
    drawMeter();
    tickHold();
    const snap = player.snapshot();
    const knob = $("xf-knob"), bar = $("strip-bar");
    if (!snap) {
      deckEl("A", null); deckEl("B", null);
      hold = null;
      LAMPS.forEach(function (el) { el.classList.remove("on", "plan"); });
      $("strip-title").textContent = "Not playing"; $("strip-time").textContent = ""; $("strip-why").innerHTML = "";
      bar.style.width = "0"; knob.style.left = "0%";
      return;
    }
    ["A", "B"].forEach(function (label) {
      const mine = snap.decks.filter(function (d) { return d.label === label; });
      deckEl(label, mine[mine.length - 1] || null, snap);
    });

    const now = snap.now;
    showFx(snap);
    const active = snap.decks.map(function (d) { return d.voice; }).filter(function (v) { return v.entry && now < v.entry.tSwap + 4; })[0];
    const curLabel = player.cur ? player.cur.label : "A";
    if (active) {
      const e = active.entry, plan = e.plan;
      const first = now < e.tBegin;
      const into = active.label === "B";
      const p = Math.max(0, Math.min(1, (now - e.tBegin) / Math.max(0.1, e.tSwap - e.tBegin)));
      // the knob follows how loud the incoming deck really is: it travels across a blend
      // (B is silent while it is still on the old side); for a swap it waits, then snaps
      const x = plan.type === "bassSwap" ? Engine.fadeIn(p) : (now >= e.tSwap ? 1 : 0);
      knob.style.left = (into ? x : 1 - x) * 100 + "%";
      bar.style.width = (into ? x : 1 - x) * 100 + "%";
      $("strip-title").textContent = (first ? "Coming up · " : "Mixing · ") + Brain.label(plan) + " → " + active.track.title;
      $("strip-time").textContent = now < e.tSwap ? "Swap in " + mmss(e.tSwap - now) + (e.tBegin > now ? " · starts in " + mmss(e.tBegin - now) : "") : "Landed";
      $("strip-why").innerHTML = plan.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    } else if (player.cur && player.queue[0]) {
      knob.style.left = (curLabel === "B" ? 100 : 0) + "%"; bar.style.width = (curLabel === "B" ? 100 : 0) + "%";
      if (now - preview.at > 0.5 || preview.key !== player.queue[0].id + ":" + JSON.stringify(player.settings)) {
        preview.at = now; preview.key = player.queue[0].id + ":" + JSON.stringify(player.settings);
        preview.plan = Brain.planTransition(Engine.infoOf(player.cur.track), Engine.infoOf(player.queue[0]), { entryBar: player.cur.entryBar, settings: player.settings, index: player.history.length });
      }
      const pl = preview.plan;
      $("strip-title").textContent = "Next · " + Brain.label(pl) + " → " + player.queue[0].title;
      $("strip-time").textContent = snap.hand ? "Waiting for you to let go" : snap.paused ? "Paused" : "Swap in " + mmss(player.cur.timeOfBar(pl.swapBar) - now);
      $("strip-why").innerHTML = pl.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    } else {
      knob.style.left = (curLabel === "B" ? 100 : 0) + "%"; bar.style.width = (curLabel === "B" ? 100 : 0) + "%";
      $("strip-title").textContent = "Playing the last track"; $("strip-time").textContent = ""; $("strip-why").innerHTML = "";
    }
  }

  // --------------------------------------------------------------- controls

  $("btn-go").addEventListener("click", function () {
    if (player.running) player.stop(); else player.start();
    changed();
  });
  $("btn-pause").addEventListener("click", function () { player.togglePause(); });
  $("btn-mix").addEventListener("click", function () { player.mixNow(); });
  $("rng-vol").addEventListener("input", function (e) { player.setVolume(+e.target.value); });
  $("btn-order").addEventListener("click", function () { player.autoOrder(); player.note("Queue re-ordered for key, tempo and energy (" + player.settings.arc + " arc)"); });
  document.querySelectorAll("[data-fx]").forEach(function (b) { b.addEventListener("click", function () { player.perform(b.dataset.fx); }); });

  // ------------------------------------------------------------ vibe + settings

  const SETTINGS_KEY = "autopilot-dj-settings";
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(player.settings)); } catch (e) { /* private mode */ } }
  function loadSettings() {
    try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) player.setSettings(JSON.parse(raw)); } catch (e) { /* ignore a bad copy */ }
  }

  const PCT = "%";
  const TUNE = [
    { group: "Auto-tune", items: [
      { key: "auto", type: "toggle", label: "Adapt to every pair of tracks", hint: "Decides anything left on Auto, and nudges flair and play time to suit each handover." },
    ] },
    { group: "Moves", items: [
      { key: "style", type: "seg", label: "Style", options: [["mixed", "Mixed"], ["smooth", "Smooth"], ["club", "Club"]], hint: "Mixed blends unless a much bigger track is coming. Smooth always prefers a blend. Club prefers swapping on a drop." },
      { key: "blendBars", type: "seg", label: "Blend length", options: [["auto", "Auto"], [8, "8 bars"], [16, "16"], [32, "32"]], hint: "The longest a blend may run." },
      { key: "bassSwap", type: "seg", label: "Bass swap", options: [["auto", "Auto"], ["hard", "Hard"], ["smooth", "Soft"]], hint: "Hard trades the basslines on the one. Soft crossfades them over two beats." },
      { key: "minPlay", type: "range", label: "Play each track for at least", unit: " bars", hint: "Before the next handover may begin." },
      { key: "variety", type: "range", label: "Variety", unit: PCT, hint: "How often it takes the move it normally wouldn\u2019t." },
      { key: "brakes", type: "toggle", label: "Vinyl brakes & spinbacks", hint: "Ways out that need no matching key or tempo: the deck winds down or is spun backwards as the next track lands." },
    ] },
    { group: "Taste", items: [
      { key: "arc", type: "seg", label: "Energy over the set", options: [["build", "Build up"], ["wave", "Waves"], ["peak", "Stay high"], ["warmup", "Warm-up"]] },
      { key: "keyStrictness", type: "seg", label: "Key matching", options: [["strict", "Strict"], ["balanced", "Balanced"], ["loose", "Loose"]], hint: "Strict only blends neighbouring keys. Loose will try anything." },
      { key: "maxTempoGap", type: "range", label: "Beatmatch up to", unit: PCT, hint: "Further apart than this it won\u2019t blend. Bigger gaps shift pitch more." },
      { key: "wKey", type: "range", label: "Pick next track by key", unit: PCT },
      { key: "wTempo", type: "range", label: "Pick next track by tempo", unit: PCT },
      { key: "wEnergy", type: "range", label: "Pick next track by energy", unit: PCT },
    ] },
    { group: "Effects", items: [
      { key: "fx", type: "toggle", label: "Effects on" },
      { key: "flair", type: "range", label: "Flair", unit: PCT, hint: "How showy the builds get. Low is just the blend." },
      { key: "echoAmount", type: "range", label: "Echo", unit: PCT },
      { key: "reverbAmount", type: "range", label: "Reverb tails", unit: PCT },
      { key: "risers", type: "toggle", label: "Risers" },
      { key: "impacts", type: "toggle", label: "Sub hits" },
      { key: "sweeps", type: "toggle", label: "Soft crashes & downlifters" },
      { key: "rolls", type: "toggle", label: "Loop rolls" },
      { key: "echoThrows", type: "toggle", label: "Echo throws" },
    ] },
    { group: "Output", items: [
      { key: "levelMatch", type: "toggle", label: "Match track loudness" },
      { key: "endless", type: "toggle", label: "Keep going when the queue runs out" },
    ] },
  ];

  function buildTune() {
    $("tune-body").innerHTML = TUNE.map(function (g) {
      return '<div class="tgroup"><h3>' + g.group + '</h3><div class="tgrid">' + g.items.map(function (it) {
        const hint = it.hint ? '<span class="hint">' + it.hint + "</span>" : "";
        if (it.type === "toggle") return '<div class="ctrl"><label class="sw"><span>' + it.label + '</span><input type="checkbox" data-k="' + it.key + '"><i></i></label>' + hint + "</div>";
        if (it.type === "range") {
          const r = Settings.RANGES[it.key];
          return '<div class="ctrl"><label for="s-' + it.key + '">' + it.label + ' <output id="o-' + it.key + '"></output></label><input type="range" id="s-' + it.key + '" data-k="' + it.key + '" min="' + r[0] + '" max="' + r[1] + '" step="' + r[2] + '">' + hint + "</div>";
        }
        return '<div class="ctrl"><span class="lbl" id="l-' + it.key + '">' + it.label + '</span><div class="seg" role="group" aria-labelledby="l-' + it.key + '">' +
          it.options.map(function (o, i) { return '<button type="button" data-k="' + it.key + '" data-i="' + i + '">' + o[1] + "</button>"; }).join("") + "</div>" + hint + "</div>";
      }).join("") + "</div></div>";
    }).join("") + '<div class="tune-foot"><button class="soft" id="tune-reset">Back to defaults</button></div>';
  }

  function syncTune() {
    const s = player.settings, items = {};
    TUNE.forEach(function (g) { g.items.forEach(function (it) { items[it.key] = it; }); });
    $("tune-body").querySelectorAll("[data-k]").forEach(function (n) {
      const it = items[n.dataset.k];
      if (n.type === "checkbox") n.checked = !!s[it.key];
      else if (n.type === "range") { n.value = s[it.key]; $("o-" + it.key).textContent = s[it.key] + it.unit; }
      else n.setAttribute("aria-pressed", String(it.options[+n.dataset.i][0] === s[it.key]));
    });
  }

  function renderVibes() {
    const id = Settings.presetOf(player.settings);
    const ids = ["balanced", "sunrise", "smooth", "open", "warehouse", "mainstage"];
    $("vibes").innerHTML = ids.map(function (k) {
      return '<button type="button" class="chip-btn" data-vibe="' + k + '" aria-pressed="' + (k === id) + '">' + Settings.PRESETS[k].label + "</button>";
    }).join("") + (id === "custom" ? '<button type="button" class="chip-btn" aria-pressed="true" disabled>Custom</button>' : "");
    $("vibe-hint").textContent = id === "custom" ? "Your own mix — tuned below." : Settings.PRESETS[id].hint;
  }

  function commit(next, why) {
    player.setSettings(next);
    saveSettings(); syncTune(); renderVibes();
    if (why) player.note(why);
  }

  $("vibes").addEventListener("click", function (e) {
    const b = e.target.closest("button[data-vibe]");
    if (!b) return;
    const keep = {}; ["endless", "fx", "levelMatch"].concat(b.dataset.vibe === "balanced" ? [] : ["auto"]).forEach(function (k) { keep[k] = player.settings[k]; });
    const next = Object.assign(Settings.applyPreset(b.dataset.vibe), keep);
    if (b.dataset.vibe === "balanced") next.auto = true;
    commit(next, "Vibe: " + Settings.describe(next));
    const again = $("vibes").querySelector('[data-vibe="' + b.dataset.vibe + '"]');       // the chips were redrawn
    if (again) again.focus();
  });
  $("tune-body").addEventListener("click", function (e) {
    const reset = e.target.closest("#tune-reset");
    if (reset) { commit(Settings.make(), "Settings back to defaults"); return; }
    const b = e.target.closest("button[data-k]");
    if (!b) return;
    let opt;
    TUNE.forEach(function (g) { g.items.forEach(function (it) { if (it.key === b.dataset.k) opt = it.options[+b.dataset.i][0]; }); });
    commit(Object.assign({}, player.settings, { [b.dataset.k]: opt }));
  });
  $("tune-body").addEventListener("input", function (e) {
    const n = e.target.closest("input[type=range]");
    if (n) commit(Object.assign({}, player.settings, { [n.dataset.k]: +n.value }));
  });
  $("tune-body").addEventListener("change", function (e) {
    const n = e.target.closest("input[type=checkbox]");
    if (n) commit(Object.assign({}, player.settings, { [n.dataset.k]: n.checked }));
  });

  loadSettings();
  buildTune(); syncTune(); renderVibes();

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
      const res = await Engine.renderSet(tracks, { settings: player.settings, index0: player.running && player.cur ? player.history.length - 1 : 0 });
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

  // A playlist-like list (from Spotify or SoundCloud) matched against the files in the booth.
  const LISTS = {
    spotify: { el: "sp-result", q: "sp", card: "details.spotify", from: "Spotify" },
    soundcloud: { el: "sc-result", q: "sc", card: "details.soundcloud", from: "SoundCloud" },
  };
  const lists = { spotify: null, soundcloud: null };           // the list currently being matched, per source

  const safeLink = function (u) { return typeof u === "string" && /^https:\/\//i.test(u) ? u : ""; };

  function renderMatches(kind) {
    const L = lists[kind], cfg = LISTS[kind];
    if (!L) return;
    const locals = player.library.map(function (t) { return { track: t, title: t.title, artist: t.artist, duration: t.duration }; });
    const m = Spotify.matchTracks(L.tracks, locals);
    L.matches = m;
    const have = m.filter(function (x) { return x.local; }).length;
    $(cfg.el).innerHTML =
      "<p><b>" + esc(L.name) + "</b> — " + have + " of " + m.length + " tracks matched to your files.</p>" +
      '<div class="sp-row"><button id="' + cfg.q + '-q1"' + (have ? "" : " disabled") + '>Queue matched, in list order</button><button id="' + cfg.q + '-q2"' + (have ? "" : " disabled") + '>Queue matched, let the DJ order them</button></div>' +
      m.map(function (x) {
        const sp = x.spotify;
        let links = "";
        if (!x.local) {
          if (safeLink(sp.url)) links += ' <a href="' + esc(safeLink(sp.url)) + '" target="_blank" rel="noopener noreferrer">listen</a>';
          if (safeLink(sp.buy)) links += ' <a href="' + esc(safeLink(sp.buy)) + '" target="_blank" rel="noopener noreferrer">buy</a>';
          else if (sp.free && safeLink(sp.url)) links += " <em>(free download offered on the page)</em>";
        }
        return '<div class="match"><span class="' + (x.local ? "ok" : "no") + '">' + (x.local ? "✓" : "?") + "</span><span>" + esc(sp.artists.join(", ")) + (sp.artists.length ? " — " : "") + esc(sp.title) + "</span><span>" +
          (x.local ? esc(x.local.track.title) : "drop this file in above" + links) + "</span></div>";
      }).join("");
    const queue = function (order) {
      const cur = player.cur && player.cur.track;
      player.queue = L.matches.filter(function (x) { return x.local && x.local.track !== cur; }).map(function (x) { return x.local.track; });
      if (order) player.autoOrder();
      player.note("Queued " + player.queue.length + " tracks from " + L.name + (order ? ", ordered by the DJ" : ", in list order"));
      changed();
    };
    const q1 = $(cfg.q + "-q1"), q2 = $(cfg.q + "-q2");
    if (q1) q1.onclick = function () { queue(false); };
    if (q2) q2.onclick = function () { queue(true); };
  }

  function showList(kind, name, tracks) {
    lists[kind] = { name: name, tracks: tracks, matches: [] };
    document.querySelector(LISTS[kind].card).open = true;
    renderMatches(kind);
  }
  const showSpotify = function (name, tracks) { showList("spotify", name, tracks); };

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
      player.note(Spotify.explain(err));
      if (err.status === 401) { Spotify.disconnect(); spotifyUi(); }          // expired; a 403 is a refusal, not a reason to log out
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
    catch (err) { player.note(Spotify.explain(err)); }
  });

  Spotify.handleRedirect().then(function (did) { spotifyUi(); if (Spotify.connected()) loadLists(); if (did) player.note("Connected to Spotify"); })
    .catch(function (err) { spotifyUi(); player.note(err.message); });


  // -------------------------------------------------------------- SoundCloud

  function scBusy(on) {
    $("sc-read").disabled = on; $("sc-paste-go").disabled = on;
    $("sc-read").textContent = on ? "Reading…" : "Read link";
  }
  $("sc-read").addEventListener("click", async function () {
    const link = $("sc-link").value.trim();
    if (!link) { player.note("Paste a SoundCloud link first"); return; }
    scBusy(true);
    try {
      const r = await SoundCloud.readLink(link);
      if (!r.tracks.length) { player.note("SoundCloud had no tracks at that link"); }
      else showList("soundcloud", { playlist: "SoundCloud playlist", likes: "SoundCloud likes", profile: "SoundCloud profile", track: "SoundCloud track" }[r.kind], r.tracks);
    } catch (err) { player.note(err.message); }
    scBusy(false);
  });
  $("sc-link").addEventListener("keydown", function (e) { if (e.key === "Enter") $("sc-read").click(); });
  $("sc-paste-go").addEventListener("click", function () {
    const tracks = SoundCloud.tracksFromText($("sc-paste").value);
    if (!tracks.length) { player.note("Paste one track per line, like “Artist - Title”"); return; }
    showList("soundcloud", "Pasted list", tracks);
  });

  // test hook
  window.__dj = { player: player, addBuffer: addBuffer, addDemos: addDemos };

  renderLists();
  requestAnimationFrame(frame);
})();
