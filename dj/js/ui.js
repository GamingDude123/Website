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

  function renderLists() {
    const cur = player.cur && player.cur.track;
    const rows = [], order = [];
    if (cur) order.push(cur);
    player.queue.forEach(function (t) { if (order.indexOf(t) < 0) order.push(t); });
    player.library.forEach(function (t) { if (order.indexOf(t) < 0) order.push(t); });
    order.forEach(function (t, i) {
      const a = t.analysis, queued = player.queue.indexOf(t) >= 0;
      const keySel = '<select data-act="key" data-id="' + t.id + '" title="Key — change it if the guess is wrong" aria-label="Key"><option value="">auto ' + a.key.camelot + '</option>' +
        CAMELOT.map(function (k) { return '<option' + (t.keyOverride === k ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select>";
      rows.push('<li class="trk' + (cur === t ? " now" : "") + '"><span class="n">' + (i + 1) + '</span>' +
        '<div class="t"><b>' + esc(t.title) + '</b><div class="sub"><span class="status">' + statusOf(t) + '</span>' +
        '<span>' + esc(t.artist || "Unknown artist") + '</span><span class="chip">' + a.bpm.toFixed(1) + ' BPM</span><span class="chip">' + (t.keyOverride || a.key.camelot) + ' · ' + esc(a.key.name) +
        '</span><span class="chip">E' + a.energy + '</span><span class="chip">' + mmss(t.duration) + '</span></div></div>' +
        '<canvas data-id="' + t.id + '" width="260" height="68"></canvas>' +
        '<div class="ctl">' + keySel +
        '<button data-act="shift" data-id="' + t.id + '" title="Nudge where bar 1 is by one beat, if the downbeat guess is wrong">beat ' + (t.shiftBeats ? "+" + t.shiftBeats : "±0") + '</button>' +
        (queued ? '<button data-act="up" data-id="' + t.id + '" aria-label="Move up">&uarr;</button><button data-act="down" data-id="' + t.id + '" aria-label="Move down">&darr;</button><button data-act="next" data-id="' + t.id + '">Next</button>' :
          (cur === t ? "" : '<button data-act="queue" data-id="' + t.id + '">Queue</button>')) +
        '<button class="x" data-act="del" data-id="' + t.id + '" title="Remove" aria-label="Remove">&times;</button></div></li>');
    });
    loading.forEach(function (l) {
      rows.push('<li class="trk"><span class="n">&hellip;</span><div class="t"><b>' + esc(l.name) + '</b><div class="sub"><span class="status">analysing ' + Math.round(l.progress * 100) + '%</span></div></div><div class="prog"><i style="width:' + Math.round(l.progress * 100) + '%"></i></div></li>');
    });
    $("tracks").innerHTML = rows.join("") || '<li class="empty-lib">Nothing loaded yet &mdash; add the demo tracks to hear it straight away.</li>';
    $("tracks").querySelectorAll("canvas[data-id]").forEach(function (c) {
      const t = player.library.find(function (x) { return x.id === +c.dataset.id; });
      if (t) c.getContext("2d").drawImage(waveFor(t), 0, 0, c.width, c.height);
    });

    $("log").innerHTML = player.log.map(function (l) { return "<li><b>" + mmss(l.t) + "</b>" + esc(l.text) + "</li>"; }).join("") || "<li>It will explain each choice here.</li>";

    const running = player.running;
    $("btn-go").innerHTML = running ? "&#9632; Stop the set" : "&#9654; Start the set";
    $("btn-go").classList.toggle("go", true);
    $("btn-go").classList.toggle("stop", running);
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
  const ACCENT = { A: "#ff2e88", B: "#26d9ff" };

  function eqRow(name) {
    return '<div class="eqr"><span>' + name + '</span><div class="t"><i data-k="eq' + name[0] + '"></i></div><em data-k="eqv' + name[0] + '"></em></div>';
  }

  function deckEl(label, d) {
    const el = $("deck-" + label);
    let st = deckState[label];
    if (!d) {
      if (st) { el.innerHTML = '<div class="empty"><b>' + label + "</b><span>Deck " + label + "</span></div>"; deckState[label] = null; el.classList.remove("audible"); }
      return;
    }
    const a = d.track.analysis;
    if (!st || st.track !== d.track) {
      el.innerHTML = '<div class="d-top"><span class="badge">' + label + '</span><div class="ti"><b>' + esc(d.track.title) + '</b><small>' + esc(d.track.artist || "Unknown artist") + '</small></div><span class="state" data-k="sec"></span></div>' +
        '<div class="read"><div><label>BPM</label><b class="big" data-k="bpm"></b></div><div><label>KEY</label><b>' + (d.track.keyOverride || a.key.camelot) + ' <small>' + esc(a.key.name) + '</small></b></div>' +
        '<div><label>BAR</label><b data-k="bar"></b></div><div><label>ENERGY</label><b>' + a.energy + '<small>/10</small></b></div></div>' +
        '<canvas class="zoom"></canvas><canvas class="over" width="900" height="68"></canvas>' +
        '<div class="eqs">' + eqRow("LOW") + eqRow("MID") + eqRow("HIGH") + '</div>';
      st = deckState[label] = { track: d.track, k: {}, zoom: el.querySelector("canvas.zoom"), over: el.querySelector("canvas.over") };
      el.querySelectorAll("[data-k]").forEach(function (n) { st.k[n.dataset.k] = n; });
    }
    st.k.bpm.textContent = d.started ? d.bpm.toFixed(1) : "—";
    st.k.bar.innerHTML = d.started ? Math.max(1, Math.floor(d.bar) + 1) + ' <small>/ ' + a.bars + '</small>' : "<small>cueing</small>";
    const sec = d.started ? a.sections.find(function (s) { return d.bar >= s.start && d.bar < s.end; }) : null;
    st.k.sec.textContent = sec ? sec.type : (d.started ? "" : "cueing");
    [["L", d.eq.low], ["M", d.eq.mid], ["H", d.eq.high]].forEach(function (e) {
      const g = e[1], kill = g < -30;
      st.k["eq" + e[0]].style.setProperty("--w", Math.max(3, Math.min(100, (g + 40) / 40 * 100)) + "%");
      st.k["eq" + e[0]].classList.toggle("kill", kill);
      st.k["eqv" + e[0]].textContent = kill ? "KILL" : (g > -0.5 ? "0" : g.toFixed(0)) + " dB";
      st.k["eqv" + e[0]].classList.toggle("kill", kill);
    });
    $("deck-" + label).classList.toggle("audible", d.audible);
    drawZoom(st.zoom, d.track, d.pos, ACCENT[label], label, d.started);
    const g = st.over.getContext("2d");
    g.clearRect(0, 0, 900, 68); g.drawImage(waveFor(d.track), 0, 0);
    const x = Math.max(0, Math.min(898, d.pos / d.track.duration * 900));
    g.fillStyle = "#fff"; g.fillRect(x, 0, 3, 68);
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

  function frame() {
    requestAnimationFrame(frame);
    drawMeter();
    const snap = player.snapshot();
    const knob = $("xf-knob"), bar = $("strip-bar");
    if (!snap) {
      deckEl("A", null); deckEl("B", null);
      $("strip-title").textContent = "Not playing"; $("strip-time").textContent = ""; $("strip-why").innerHTML = "";
      bar.style.width = "0"; knob.style.left = "0%";
      return;
    }
    ["A", "B"].forEach(function (label) {
      const mine = snap.decks.filter(function (d) { return d.label === label; });
      deckEl(label, mine[mine.length - 1] || null);
    });

    const now = snap.now;
    const active = snap.decks.map(function (d) { return d.voice; }).filter(function (v) { return v.entry && now < v.entry.tSwap + 4; })[0];
    const curLabel = player.cur ? player.cur.label : "A";
    if (active) {
      const e = active.entry, plan = e.plan;
      const first = now < e.tBegin;
      const into = active.label === "B";
      const p = Math.max(0, Math.min(1, (now - e.tBegin) / Math.max(0.1, e.tSwap - e.tBegin)));
      // the knob travels across a blend; for a swap it waits, then snaps on the downbeat
      const x = plan.type === "bassSwap" ? p : (now >= e.tSwap ? 1 : 0);
      knob.style.left = (into ? x : 1 - x) * 100 + "%";
      bar.style.width = (into ? x : 1 - x) * 100 + "%";
      $("strip-title").textContent = (first ? "Coming up · " : "Mixing · ") + Brain.label(plan) + " → " + active.track.title;
      $("strip-time").textContent = now < e.tSwap ? "Swap in " + mmss(e.tSwap - now) + (e.tBegin > now ? " · starts in " + mmss(e.tBegin - now) : "") : "Landed";
      $("strip-why").innerHTML = plan.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    } else if (player.cur && player.queue[0]) {
      knob.style.left = (curLabel === "B" ? 100 : 0) + "%"; bar.style.width = (curLabel === "B" ? 100 : 0) + "%";
      if (now - preview.at > 0.5 || preview.key !== player.queue[0].id + ":" + player.style) {
        preview.at = now; preview.key = player.queue[0].id + ":" + player.style;
        preview.plan = Brain.planTransition(Engine.infoOf(player.cur.track), Engine.infoOf(player.queue[0]), { entryBar: player.cur.entryBar, style: player.style });
      }
      const pl = preview.plan;
      $("strip-title").textContent = "Next · " + Brain.label(pl) + " → " + player.queue[0].title;
      $("strip-time").textContent = "Swap in " + mmss(player.cur.timeOfBar(pl.swapBar) - now);
      $("strip-why").innerHTML = pl.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    } else {
      knob.style.left = (curLabel === "B" ? 100 : 0) + "%"; bar.style.width = (curLabel === "B" ? 100 : 0) + "%";
      $("strip-title").textContent = "Playing the last track"; $("strip-time").textContent = ""; $("strip-why").innerHTML = "";
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
  $("seg-style").addEventListener("click", function (e) {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    player.style = b.dataset.v;
    this.querySelectorAll("button").forEach(function (x) { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
  });
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
    document.querySelector("details.spotify").open = true;
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
