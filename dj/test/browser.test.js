/* End-to-end: the real page in a real browser.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node dj/test/browser.test.js
 *
 * Renders mixes offline and holds them to measurements — no clipping, the
 * low end does not double during a bass swap, the two decks' beats line up —
 * then drives the live page: add the demos, start, mix now, watch it land.
 */

const { chromium } = (function () {
  for (const name of ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(name); } catch (err) { /* next */ }
  }
  console.error("playwright not found — install it with `npm i -D playwright`");
  process.exit(2);
})();
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "autopilot-dj-test-"));
const PORT = 8098;
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    let file = path.join(ROOT, rel || "index.html");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || "")) return;   // web fonts are optional; the page falls back to system fonts
    errors.push(m.text());
  });
  await page.goto("http://localhost:" + PORT + "/dj/index.html");

  check("page loads with the track list empty", (await page.locator("#tracks .trk").count()) === 0);

  // ---- demo tracks load and are analysed
  await page.click("#btn-demo");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk .edit").length >= 4, null, { timeout: 120000 });
  const rows = await page.$$eval("#tracks .trk", (els) => els.map((e) => e.textContent));
  check("four demo tracks analysed", rows.length === 4, rows.length);
  check("BPM and key shown on every row", rows.every((r) => /\d+ BPM/.test(r) && /\d+[AB]/.test(r)));
  check("track and memory counter", /4 tracks · \d+ MB in memory/.test(await page.textContent("#lib-stat")), await page.textContent("#lib-stat"));

  // ---- offline mix measurements
  const m = await page.evaluate(async () => {
    const tracks = window.__dj.player.library.slice(0, 2);       // Midnight Warehouse -> Chrome Hearts
    const sr = 44100;
    function lowpass(x, fc) { const a = 1 - Math.exp(-2 * Math.PI * fc / sr), y = new Float32Array(x.length); let s = 0; for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); y[i] = s; } return y; }
    function rms(x, a, b) { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / Math.max(1, b - a)); }

    let SETTINGS = Settings.make({ style: "smooth", bassSwap: "hard", fx: false });
    async function render(mute) {
      const probe = new OfflineAudioContext(2, sr, sr);
      const pm = new Engine.Mixer(probe, { offline: true, settings: SETTINGS }); const plan0 = pm.scheduleSet(tracks, { settings: SETTINGS });
      const ctx = new OfflineAudioContext(2, Math.ceil((plan0.end + 3) * sr), sr);
      const mx = new Engine.Mixer(ctx, { offline: true, settings: SETTINGS });
      const set = mx.scheduleSet(tracks, { settings: SETTINGS });
      if (mute != null) { const v = set.voices[mute]; v.fader.gain.cancelScheduledValues(0); v.fader.gain.setValueAtTime(0, 0); }
      const buf = await ctx.startRendering();
      return { buf, set };
    }
    const full = await render(null);
    const plan = full.set.plans[0], B = full.set.voices[1], tStart = B.entry.tStart, tSwap = B.entry.tSwap;
    const L = full.buf.getChannelData(0);
    let peak = 0, nan = 0; for (let i = 0; i < L.length; i++) { const v = Math.abs(L[i]); if (v !== v) nan++; if (v > peak) peak = v; }

    // low end per bar: before the blend, during it, after the swap
    const low = lowpass(L, 140), bar = (tSwap - tStart) / plan.blendBars;
    const barRms = (t) => rms(low, Math.round(t * sr), Math.round((t + bar) * sr));
    const before = barRms(tStart - bar), during = [];
    for (let b = 0; b < plan.blendBars - 1; b++) during.push(barRms(tStart + b * bar));
    const afterB = barRms(tSwap + 0.2 * bar);

    // beat lock: cross-correlate the onset envelopes of each deck on its own
    const aSolo = (await render(1)).buf.getChannelData(0), bSolo = (await render(0)).buf.getChannelData(0);
    function onsetEnv(x, a, b) {
      const lp = lowpass(x, 1500), hop = 44, n = Math.floor((b - a) / hop), env = new Float32Array(n);
      for (let i = 0; i < n; i++) { let e = 0; for (let j = 0; j < hop; j++) { const h = x[a + i * hop + j] - lp[a + i * hop + j]; e += h * h; } env[i] = Math.sqrt(e / hop); }
      const o = new Float32Array(n); for (let i = 1; i < n; i++) o[i] = Math.max(0, env[i] - env[i - 1]);
      return o;
    }
    const wa = Math.round((tStart + 2 * bar) * sr), wb = Math.round((tSwap - 2 * bar) * sr);
    const ea = onsetEnv(aSolo, wa, wb), eb = onsetEnv(bSolo, wa, wb);
    let bestLag = 0, best = -1, atZero = 0;
    for (let lag = -40; lag <= 40; lag++) {                         // 1 ms steps
      const k = Math.round(lag * sr / 1000 / 44); let s = 0;
      for (let i = 50; i < ea.length - 50; i++) s += ea[i] * eb[i + k];
      if (lag === 0) atZero = s;
      if (s > best) { best = s; bestLag = lag; }
    }
    // the incoming deck starts silent: the first bar of the blend is far quieter than the last
    const bsRms = (t0) => rms(bSolo, Math.round(t0 * sr), Math.round((t0 + bar) * sr));
    const bFirst = bsRms(tStart), bLast = bsRms(tSwap - bar);
    // negative control: slip one deck by ~30 ms and the same measurement must see it
    const slip = 30, eb2 = new Float32Array(eb.length);
    for (let i = slip; i < eb.length; i++) eb2[i] = eb[i - slip];     // 44-sample hop ≈ 1 ms per frame
    let slipLag = 0, slipBest = -1;
    for (let lag = -40; lag <= 40; lag++) {
      const k = Math.round(lag * sr / 1000 / 44); let s = 0;
      for (let i = 50; i < ea.length - 50; i++) s += ea[i] * eb2[i + k];
      if (s > slipBest) { slipBest = s; slipLag = lag; }
    }
    // the same blend with a soft bass swap: lows crossfade over two beats
    SETTINGS = Settings.make({ style: "smooth", bassSwap: "smooth", fx: false });
    const soft = await render(null), sp = soft.set.plans[0], sB = soft.set.voices[1];
    const SL = soft.buf.getChannelData(0), slow = lowpass(SL, 140), sbar = (sB.entry.tSwap - sB.entry.tStart) / sp.blendBars;
    const sRms = (t) => rms(slow, Math.round(t * sr), Math.round((t + sbar) * sr));
    const softDuring = []; for (let b = 0; b < sp.blendBars; b++) softDuring.push(sRms(sB.entry.tStart + b * sbar));
    let sPeak = 0, sNan = 0; for (let i = 0; i < SL.length; i++) { const v = Math.abs(SL[i]); if (v !== v) sNan++; if (v > sPeak) sPeak = v; }
    // and the bass must not fall into a hole while the two lines trade: compare the
    // low band at the same point in the beat, a beat at a time, across the swap
    const beatSec = 60 / sB.tempoAt(sB.entry.tSwap), quarter = beatSec / 4, worst = [];
    for (let ph = 0; ph < 4; ph++) {
      const lvl = (k) => { const t = sB.entry.tSwap + k * beatSec + ph * quarter; return rms(slow, Math.round(t * sr), Math.round((t + quarter) * sr)); };
      const pre = (lvl(-4) + lvl(-3) + lvl(-2)) / 3;
      for (let k = -1; k <= 1; k++) worst.push(lvl(k) / pre);
    }
        return { peak, nan, before, during, afterB, bestLag, slipLag, bFirst, bLast, plan: plan.type, L: plan.blendBars, dur: full.buf.duration,
      soft: { mode: sp.bassSwapMode, peak: sPeak, nan: sNan, baseline: sRms(sB.entry.tStart - sbar), max: Math.max.apply(null, softDuring), minRatio: Math.min.apply(null, worst) } };
  });
  check("offline mix: no NaN, no clipping", m.nan === 0 && m.peak < 1, "peak=" + m.peak.toFixed(3));
  check("offline mix: plan is a bass swap", m.plan === "bassSwap", m.plan + " " + m.L + " bars");
  const maxDuring = Math.max.apply(null, m.during);
  check("bass swap: low end never doubles during the blend", maxDuring < m.before * 1.35, "before=" + m.before.toFixed(4) + " max during=" + maxDuring.toFixed(4));
  check("bass swap: low end comes back after the swap", m.afterB > m.before * 0.5, "after=" + m.afterB.toFixed(4));
  check("soft bass swap: planned as soft, no NaN, no clipping", m.soft.mode === "smooth" && m.soft.nan === 0 && m.soft.peak < 1, "peak=" + m.soft.peak.toFixed(3));
  check("soft bass swap: low end never doubles", m.soft.max < m.soft.baseline * 1.35, "baseline=" + m.soft.baseline.toFixed(4) + " max=" + m.soft.max.toFixed(4));
  check("soft bass swap: the bass never falls into a hole while the lines trade (within 3 dB of before)", m.soft.minRatio > 0.7, "lowest = " + (20 * Math.log10(m.soft.minRatio)).toFixed(1) + " dB vs before");
  check("blend: the incoming deck comes in from silence (first bar under a fifth of the last)", m.bFirst < 0.2 * m.bLast, "first=" + m.bFirst.toFixed(4) + " last=" + m.bLast.toFixed(4));
  check("beat lock: decks' onsets line up within 4 ms", Math.abs(m.bestLag) <= 4, "lag=" + m.bestLag + " ms");

  check("beat lock: the same test sees a 30 ms slip", Math.abs(Math.abs(m.slipLag) - 30) <= 4, "lag=" + m.slipLag + " ms");

  // ---- a tempo glide that is still settling when the next blend is planned
  // (a drop swap settles the new deck over 16 bars; "Mix now" can start a blend inside that)
  const glide = await page.evaluate(() => {
    const P = AudioParam.prototype, store = new WeakMap(), orig = { set: P.setValueAtTime, ramp: P.linearRampToValueAtTime, cancel: P.cancelScheduledValues };
    const rec = (p) => { let e = store.get(p); if (!e) { e = []; store.set(p, e); } return e; };
    P.setValueAtTime = function (v, t) { rec(this).push({ k: "set", v, t }); return orig.set.call(this, v, t); };
    P.linearRampToValueAtTime = function (v, t) { rec(this).push({ k: "ramp", v, t }); return orig.ramp.call(this, v, t); };
    P.cancelScheduledValues = function (t) { store.set(this, rec(this).filter((e) => e.t >= t ? false : true)); return orig.cancel.call(this, t); };
    // what the audio param does at time t, per the Web Audio rules
    function valueAt(ev, t, v0) {
      const sorted = ev.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map((x) => x.e);
      let pv = v0, pt = 0;
      for (const e of sorted) {
        if (e.t <= t) { pv = e.v; pt = e.t; continue; }
        return e.k === "ramp" ? pv + (e.v - pv) * (t - pt) / (e.t - pt) : pv;
      }
      return pv;
    }
    try {
      const lib = window.__dj.player.library, sr = 44100;
      const club = Settings.make({ style: "club", variety: 0, auto: false, flair: 60, fx: false });
      const smooth = Settings.make({ style: "smooth", auto: false, fx: false });
      let found = null;
      for (const a of lib) for (const b of lib) for (const c of lib) {
        if (found || a === b || b === c) continue;
        const ctx = new OfflineAudioContext(2, sr, sr);
        const mx = new Engine.Mixer(ctx, { offline: true, settings: club });
        const A = mx.firstVoice(a, 0.2, "A");
        const p1 = Brain.planTransition(Engine.infoOf(a), Engine.infoOf(b), { entryBar: A.entryBar, settings: club, index: 1 });
        if (p1.type !== "dropSwap") continue;
        const B = mx.scheduleTransition(A, b, p1, "B");
        const tNow = B.entry.tSwap + 5;
        const p2 = Brain.planTransition(Engine.infoOf(b), Engine.infoOf(c), { entryBar: B.entryBar, settings: smooth, index: 2, now: true, minPlay: 0, earliestSwap: Math.ceil(B.barAt(tNow)) + 10 });
        if (p2.type !== "bassSwap" || B.timeOfBar(p2.startBar) < tNow + 0.3) continue;
        const settleEnd = B.tl.nodes[B.tl.nodes.length - 1].t;
        if (B.timeOfBar(p2.startBar) > settleEnd) continue;                 // must start inside the settle
        const initial = new Map([[A, A.tl.nodes[0].r], [B, B.tl.nodes[0].r]]);
        const C = mx.scheduleTransition(B, c, p2, "A");
        initial.set(C, C.tl.nodes[0].r);
        let worst = 0;
        [A, B, C].forEach((v) => {
          const ev = rec(v.src.playbackRate), t0 = v.tl.nodes[0].t, t1 = C.entry.tSwap + 2;
          for (let t = t0; t <= t1; t += 0.25) worst = Math.max(worst, Math.abs(valueAt(ev, t, initial.get(v)) - v.tl.rateAt(t)));
        });
        found = { worst, names: [a.title, b.title, c.title], blend: p2.blendBars };
      }
      return found || { none: true };
    } finally { P.setValueAtTime = orig.set; P.linearRampToValueAtTime = orig.ramp; P.cancelScheduledValues = orig.cancel; }
  });
  check("tempo glide: found a blend that starts while the deck is still settling", !glide.none, JSON.stringify(glide));
  check("tempo glide: the audio's playback rate follows the timeline the planner used", !glide.none && glide.worst < 1e-6, glide.none ? "" : "worst difference " + glide.worst.toExponential(2));

  // ---- exporting a set that is already playing seeds the choices like the live one
  const seeded = await page.evaluate(() => {
    const lib = window.__dj.player.library.slice(0, 2), sr = 44100;
    const S = Settings.make({ style: "mixed", variety: 60, auto: false, fx: false });
    let same = 0, total = 0;
    for (let off = 0; off < 12; off++) {
      const mx = new Engine.Mixer(new OfflineAudioContext(2, sr, sr), { offline: true, settings: S });
      const got = mx.scheduleSet(lib, { settings: S, index0: off }).plans[0];
      const want = Brain.planTransition(Engine.infoOf(lib[0]), Engine.infoOf(lib[1]), { entryBar: 0, settings: S, index: 1 + off });
      total++; if (got.type === want.type && got.swapBar === want.swapBar && got.blendBars === want.blendBars) same++;
    }
    return { same, total };
  });
  check("export: the seeded choices follow the live set's position", seeded.same === seeded.total, seeded.same + "/" + seeded.total);

  // ---- vibes and settings
  const chips = await page.$$eval("#vibes .chip-btn", (b) => b.map((x) => x.textContent));
  check("vibe chips present", chips.length === 6 && chips.indexOf("Warehouse") >= 0, chips.join(", "));
  check("default vibe is 'Let the AI decide'", (await page.getAttribute("#vibes .chip-btn[aria-pressed=true]", "data-vibe")) === "balanced");
  await page.click('#vibes [data-vibe="warehouse"]');
  const wh = await page.evaluate(() => window.__dj.player.settings);
  check("picking a vibe applies it", wh.style === "club" && wh.flair === 80 && wh.arc === "wave", JSON.stringify([wh.style, wh.flair, wh.arc]));
  check("the vibe hint updates", /Drop swaps/.test(await page.textContent("#vibe-hint")));
  await page.click("details#tune summary");
  await page.click('#tune-body button[data-k="bassSwap"][data-i="2"]');
  const afterSeg = await page.evaluate(() => window.__dj.player.settings.bassSwap);
  check("a segmented control changes a setting", afterSeg === "smooth");
  check("changing a setting makes the vibe Custom", (await page.textContent("#vibes")).indexOf("Custom") >= 0);
  await page.fill("#s-flair", "35");
  check("a slider changes a setting and shows its value", (await page.evaluate(() => window.__dj.player.settings.flair)) === 35 && /35%/.test(await page.textContent("#o-flair")));
  await page.uncheck('#tune-body input[data-k="rolls"]');
  check("a switch changes a setting", (await page.evaluate(() => window.__dj.player.settings.rolls)) === false);
  await page.reload();
  const kept = await page.evaluate(() => window.__dj.player.settings);
  check("settings survive a reload", kept.bassSwap === "smooth" && kept.flair === 35 && kept.rolls === false && kept.style === "club", JSON.stringify([kept.bassSwap, kept.flair, kept.rolls]));
  await page.evaluate(() => localStorage.setItem("autopilot-dj-settings", '{"style":"banana","flair":"lots","minPlay":99999}'));
  await page.reload();
  const sane = await page.evaluate(() => window.__dj.player.settings);
  check("a corrupt saved copy cannot break the page", sane.style === "mixed" && sane.flair === 60 && sane.minPlay === 128);
  await page.click("details#tune summary");
  await page.click("#tune-reset");
  check("back-to-defaults resets", (await page.evaluate(() => window.__dj.player.settings.flair)) === 60);
  // the demos were lost with the reload; bring them back for the live part
  await page.click("#btn-demo");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk .edit").length >= 4, null, { timeout: 120000 });

  // ---- the engine against a frequency-coded track: its pitch at time t says exactly where it is.
  //      Checks the DJ pause, the scrub, and the new ways out against an independent simulation.
  const osc = await page.evaluate(async () => {
    const sr = 44100, DUR = 40, F0 = 300, K = 40;                    // f(p) = F0 + 2K p
    const fOf = (p) => F0 + 2 * K * p;
    const analysis = { bpm: 120, beatLen: 0.5, barLen: 2, downbeat: 0, loudnessDb: -12, bars: 20, key: { camelot: "1A", name: "x" }, energy: 5, sections: [], cues: [] };
    const makeTrack = (ctx, silent) => {
      const buf = ctx.createBuffer(1, sr * DUR, sr), d = buf.getChannelData(0);
      if (!silent) for (let i = 0; i < d.length; i++) { const p = i / sr; d[i] = 0.12 * Math.sin(2 * Math.PI * (F0 * p + K * p * p)); }
      return { title: silent ? "silence" : "chirp", buffer: buf, duration: DUR, shiftBeats: 0, analysis: analysis };
    };
    const crossings = (x, t0, t1) => { const r = []; for (let i = Math.max(1, Math.floor(t0 * sr)); i < Math.min(x.length, Math.floor(t1 * sr)); i++) if (x[i - 1] < 0 && x[i] >= 0) r.push((i - 1 + (-x[i - 1]) / (x[i] - x[i - 1])) / sr); return r; };
    const freqIn = (x, a, b) => { const c = crossings(x, a, b); return c.length >= 3 ? (c.length - 1) / (c[c.length - 1] - c[0]) : 0; };
    const rms = (x, a, b) => { let e = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.floor(b * sr); i++) { e += x[i] * x[i]; n++; } return Math.sqrt(e / Math.max(1, n)); };
    const R = {};

    // 1. pause: brake then spin-up, with no gap, against an uninterrupted render
    async function render(withPause) {
      const ctx = new OfflineAudioContext(2, sr * 10, sr), m = new Engine.Mixer(ctx, { offline: true, fx: false });
      const v = m.firstVoice(makeTrack(ctx), 0.1, "A");
      if (withPause) { const st = m.brake([v], 3.0, Engine.BRAKE); m.spinUp(st, 3.0 + Engine.BRAKE, Engine.SPINUP); }
      return (await ctx.startRendering()).getChannelData(0);
    }
    const base = await render(false), paused = await render(true), T = Engine.BRAKE, S = Engine.SPINUP;
    let worstBrake = 0;
    for (let k = 0; k < 6; k++) {
      const a = 3.0 + 0.01 + k * 0.13, b = a + 0.12, mid = (a + b) / 2, rate = 1 - (mid - 3.0) / T;
      const P = 2.9 + (mid - 3.0) - (mid - 3.0) * (mid - 3.0) / (2 * T), pred = fOf(P) * rate;
      worstBrake = Math.max(worstBrake, Math.abs(freqIn(paused, a, b) - pred) / Math.max(pred, 250));
    }
    R.brakeErr = worstBrake;
    R.rmsBefore = rms(paused, 2.5, 2.9); R.rmsAtStop = rms(paused, 3.0 + T - 0.03, 3.0 + T); R.rmsAfter = rms(paused, 6, 7);
    const ca = crossings(base, 3.0 + T + S + 0.3, 9), cb = crossings(paused, 3.0 + T + S + 0.3, 9);
    let worst = 0, j = 0;
    for (let i = 0; i < ca.length; i++) { while (j + 1 < cb.length && Math.abs(cb[j + 1] - ca[i]) < Math.abs(cb[j] - ca[i])) j++; worst = Math.max(worst, Math.abs(cb[j] - ca[i])); }
    R.realignMs = worst * 1000;

    // 2. scripted scrub (forward, still, backwards, wobbling through zero, backwards again, release)
    {
      const ctx = new OfflineAudioContext(2, sr * 16, sr), m = new Engine.Mixer(ctx, { offline: true, fx: false });
      const v = m.firstVoice(makeTrack(ctx), 0.1, "A"), t0 = 2.0, sess = new Turntable.Session(v, t0), cmds = [];
      for (let t = t0; t < 3.0; t += 0.016) cmds.push([t, 2.0, 0.05]);
      for (let t = 3.0; t < 3.5; t += 0.016) cmds.push([t, 0, 0.05]);
      for (let t = 3.5; t < 5.0; t += 0.016) cmds.push([t, -1.5, 0.05]);
      for (let t = 5.0; t < 8.0; t += 0.016) cmds.push([t, 2.2 * Math.sin(2 * Math.PI * 0.8 * (t - 5)) - 0.2, 0.04]);
      for (let t = 8.0; t < 8.6; t += 0.016) cmds.push([t, -3, 0.05]);
      cmds.forEach((c) => sess.setRate(c[0], c[1], c[2]));
      sess.end(8.6, 0.2); sess.finish();
      const dt = 0.0005, traj = [], events = cmds.map((c) => ({ t: c[0], v: c[1], g: c[2] })).concat([{ t: 8.6, v: 1, g: 0.2 }]);
      let pos = t0 - 0.1, vel = 1, ci = 0, target = null, vStart = 0, tStart = 0;
      for (let tt = t0; tt < 13; tt += dt) {
        while (ci < events.length && events[ci].t <= tt) { target = events[ci]; vStart = vel; tStart = target.t; ci++; }
        if (target) vel = target.t + target.g > tt ? vStart + (target.v - vStart) * (tt - tStart) / target.g : target.v;
        pos += vel * dt; traj.push([tt, pos, vel]);
      }
      const at = (t) => traj[Math.min(traj.length - 1, Math.max(0, Math.round((t - t0) / dt)))];
      const x = (await ctx.startRendering()).getChannelData(0), errs = [];
      for (let a = t0 + 0.05; a < 12; a += 0.1) {
        let minV = 1e9, sum = 0, n = 0;
        for (let q = a - 0.03; q < a + 0.13; q += 0.002) minV = Math.min(minV, Math.abs(at(q)[2]));
        for (let q = a; q < a + 0.1; q += 0.002) { const r = at(q); sum += fOf(r[1]) * Math.abs(r[2]); n++; }
        const pred = sum / n;
        if (minV < 0.25 || pred < 200) continue;
        errs.push(Math.abs(freqIn(x, a + 0.006, a + 0.106) - pred) / pred);
      }
      errs.sort((p, q) => p - q);
      R.scrub = { n: errs.length, median: errs[Math.floor(errs.length / 2)], p90: errs[Math.floor(errs.length * 0.9)] };
      R.scrubPosMs = Math.abs(v.tl.posAt(12) - at(12)[1]) * 1000;
      R.afterRelease = Math.abs(freqIn(x, 10.0 + 0.006, 10.106) - fOf(at(10.05)[1])) / fOf(at(10.05)[1]);
    }

    // 3. the new ways out, played over a silent incoming track so only the outgoing deck is heard
    const basePlan = { swapBar: 6, blendBars: 0, startBar: 6, inLandBar: 0, inStartBar: 0, buildBars: 1, tailBars: 0, roll: false, riser: false, impact: false, echoThrow: false, crash: false, downlifter: false,
      bassSwapMode: "hard", intensity: 0.6, amounts: { echo: 55, reverb: 45 }, rise: 0, freshTempo: true, reasons: [] };
    async function exit(type) {
      const ctx = new OfflineAudioContext(2, sr * 16, sr), m = new Engine.Mixer(ctx, { offline: true, fx: false });
      const A = m.firstVoice(makeTrack(ctx), 0.1, "A");
      const B = m.scheduleTransition(A, makeTrack(ctx, true), Object.assign({ type: type }, basePlan), "B");
      return { x: (await ctx.startRendering()).getChannelData(0), tSwap: B.entry.tSwap };
    }
    {
      const e = await exit("brake"), ts = e.tSwap, tb = ts - 1.0;           // two beats at 120 bpm
      let worstB = 0, rows = 0;
      for (let a = tb + 0.04; a + 0.12 < ts - 0.1; a += 0.1) {
        const mid = a + 0.06, rate = 1 - (1 - 0.03) * (mid - tb) / 1.0;
        const P = (tb - 0.1) + (mid - tb) - (1 - 0.03) * (mid - tb) * (mid - tb) / 2;
        const pred = fOf(P) * rate;
        if (pred < 150) continue;
        worstB = Math.max(worstB, Math.abs(freqIn(e.x, a + 0.006, a + 0.126) - pred) / pred); rows++;
      }
      R.brake = { worst: worstB, rows: rows, rmsBefore: rms(e.x, tb - 0.4, tb - 0.05), rmsAfter: rms(e.x, ts + 0.1, ts + 1.5), rmsLate: rms(e.x, ts + 2.5, ts + 3.8) };
    }
    {
      const e = await exit("spinback"), ts = e.tSwap, spin = 1.1, r0 = 3.2, r1 = 0.12, slope = (r0 - r1) / spin;
      let worstS = 0, rows = 0, fwdWorst = 0;
      for (let tau = 0.06; tau + 0.1 < 0.95; tau += 0.1) {
        const mid = tau + 0.05, rate = r0 - slope * mid, P = (ts - 0.1) - (r0 * mid - slope * mid * mid / 2);
        const pred = fOf(P) * rate, fwd = fOf((ts - 0.1) + (r0 * mid - slope * mid * mid / 2)) * rate;
        const meas = freqIn(e.x, ts + tau + 0.006, ts + tau + 0.106);
        worstS = Math.max(worstS, Math.abs(meas - pred) / pred);
        fwdWorst = Math.max(fwdWorst, Math.abs(meas - fwd) / fwd); rows++;
      }
      R.spin = { worst: worstS, closerToReverse: fwdWorst, rows: rows, rmsAfter: rms(e.x, ts + 1.4, ts + 2.5) };
    }
    return R;
  });
  check("pause: pitch falls as the platters slow, as modelled", osc.brakeErr < 0.05, "worst " + (osc.brakeErr * 100).toFixed(1) + "%");
  check("pause: the output fades out as it stops, and is back at full level after the spin-up", osc.rmsAtStop < 0.05 * osc.rmsBefore && osc.rmsAfter > 0.9 * osc.rmsBefore, [osc.rmsBefore, osc.rmsAtStop, osc.rmsAfter].map((x) => x.toFixed(3)).join(" / "));
  check("pause: after the spin-up the music is exactly where the plan expects it", osc.realignMs < 2.5, osc.realignMs.toFixed(2) + " ms");
  check("scrub: pitch follows the platter through stops, reversals and wobbles", osc.scrub.n > 60 && osc.scrub.median < 0.02 && osc.scrub.p90 < 0.06, JSON.stringify(osc.scrub));
  check("scrub: the deck's position bookkeeping matches an independent simulation", osc.scrubPosMs < 5, osc.scrubPosMs.toFixed(2) + " ms");
  check("scrub: back at normal speed after the release", osc.afterRelease < 0.03, (osc.afterRelease * 100).toFixed(1) + "%");
  check("brake exit: the outgoing deck winds down over its last two beats", osc.brake.rows >= 4 && osc.brake.worst < 0.08, JSON.stringify(osc.brake));
  check("brake exit: only a reverb tail is left once the next track lands, and it dies away", osc.brake.rmsAfter < 0.25 * osc.brake.rmsBefore && osc.brake.rmsLate < 0.005 && osc.brake.rmsBefore > 0.05, JSON.stringify(osc.brake));
  check("spinback exit: the last beat plays backwards, fast and slowing", osc.spin.rows >= 6 && osc.spin.worst < 0.08 && osc.spin.worst < osc.spin.closerToReverse * 0.6, JSON.stringify(osc.spin));
  check("spinback exit: nothing is left sounding afterwards", osc.spin.rmsAfter < 0.01);

  // the new moves with real tracks: no clipping, no NaN, the incoming track is heard
  const moves = await page.evaluate(async () => {
    const lib = window.__dj.player.library, sr = 44100, out = {};
    for (const type of ["brake", "spinback", "echoOut", "dropSwap"]) {
      const S = Settings.make({ fx: true, flair: 70, auto: false });
      const probe = new OfflineAudioContext(2, sr, sr), pm = new Engine.Mixer(probe, { offline: true, settings: S });
      const plan0 = Brain.planTransition(Engine.infoOf(lib[0]), Engine.infoOf(lib[1]), { entryBar: 0, settings: S, index: 1 });
      const plan = Object.assign({}, plan0, { type: type, blendBars: 0, startBar: plan0.swapBar, inLandBar: 0, inStartBar: 0, buildBars: type === "dropSwap" ? 8 : 1, freshTempo: true });
      const A0 = pm.firstVoice(lib[0], 0.2, "A"), B0 = pm.scheduleTransition(A0, lib[1], plan, "B");
      const len = Math.ceil((B0.entry.tSwap + 6) * sr), ctx = new OfflineAudioContext(2, len, sr), m = new Engine.Mixer(ctx, { offline: true, settings: S });
      const A = m.firstVoice(lib[0], 0.2, "A"), B = m.scheduleTransition(A, lib[1], plan, "B");
      const x = (await ctx.startRendering()).getChannelData(0);
      let peak = 0, bad = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a !== a) bad++; if (a > peak) peak = a; }
      const rms = (a, b) => { let e = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.floor(b * sr); i++) { e += x[i] * x[i]; n++; } return Math.sqrt(e / Math.max(1, n)); };
      out[type] = { peak: +peak.toFixed(3), bad: bad, incoming: +rms(B.entry.tSwap + 2, B.entry.tSwap + 5).toFixed(3), events: m.fxEvents.map((e) => e.kind).join(",") };
    }
    return out;
  });
  Object.keys(moves).forEach((t) => check("move " + t + ": clean render, incoming track heard", moves[t].bad === 0 && moves[t].peak <= 1.0 && moves[t].incoming > 0.03, JSON.stringify(moves[t])));

  // ---- live page
  await page.click("#btn-go");
  await page.waitForFunction(() => window.__dj.player.ctx && window.__dj.player.ctx.currentTime > 2, null, { timeout: 15000 });
  check("clock is running", true);
  check("deck A shows the opening track", /Midnight Warehouse/.test(await page.textContent("#deck-A")) || /Warehouse|Chrome|Basement|Neon/.test(await page.textContent("#deck-A")));
  const t0 = await page.evaluate(() => window.__dj.player.ctx.currentTime);
  await page.waitForTimeout(1500);
  const t1 = await page.evaluate(() => window.__dj.player.ctx.currentTime);
  check("audio clock advances in real time", t1 - t0 > 1.2 && t1 - t0 < 2.0, (t1 - t0).toFixed(2));
  const posOk = await page.evaluate(() => { const s = window.__dj.player.snapshot(); return s.decks[0].pos > 1 && s.decks[0].bar > 0; });
  check("deck position tracks the clock", posOk);

  // ---- turntables: platter, hold-to-rewind, bar jumps, dragging the waveform
  const deckState = () => page.evaluate(() => { const p = window.__dj.player, s = p.snapshot(), d = s.decks.find((x) => x.voice === p.cur); return { pos: d.pos, rate: d.rate, hand: s.hand, bar: d.bar }; });
  check("each deck has a platter, four transport buttons and a draggable waveform", (await page.locator("#deck-A .platter").count()) === 1 && (await page.locator("#deck-A .xport button").count()) === 4 && (await page.locator("#deck-A canvas.zoom").count()) === 1);
  const ang0 = await page.evaluate(() => document.querySelector("#deck-A .vinyl").style.transform);
  await page.waitForTimeout(300);
  const ang1 = await page.evaluate(() => document.querySelector("#deck-A .vinyl").style.transform);
  check("the platter turns with the track", ang0 !== ang1 && /rotate/.test(ang1), ang0 + " -> " + ang1);
  const j0 = (await deckState()).pos;
  await page.click("#deck-A button[data-act=fwd4]"); await page.click("#deck-A button[data-act=fwd4]"); await page.waitForTimeout(250);
  const j1 = (await deckState()).pos;
  check("forward 4 bars, twice, jumps about 15 seconds", j1 - j0 > 14 && j1 - j0 < 17, (j1 - j0).toFixed(2));
  await page.click("#deck-A button[data-act=back4]"); await page.waitForTimeout(250);
  const j2 = (await deckState()).pos;
  check("back 4 bars goes back about 7.6 seconds, on the beat", j1 - j2 > 7 && j1 - j2 < 8.4, (j1 - j2).toFixed(2));
  const pb = await page.locator("#deck-A .platter").boundingBox();
  const cx = pb.x + pb.width / 2, cy = pb.y + pb.height / 2, Rr = pb.width * 0.4;
  await page.mouse.move(cx + Rr, cy); await page.mouse.down();
  const held = await deckState();
  const p0 = held.pos;
  for (let i = 1; i <= 40; i++) { const a = i * 0.12; await page.mouse.move(cx + Rr * Math.cos(a), cy + Rr * Math.sin(a)); await page.waitForTimeout(16); }
  const mid = await deckState();
  check("a hand on the platter takes the deck", held.hand && mid.hand);
  check("dragging the platter clockwise moves the track forward by what was turned", mid.pos - p0 > 0.8 && mid.pos - p0 < 2.2, (mid.pos - p0).toFixed(2) + " s for 275 degrees");
  await page.screenshot({ path: path.join(OUT, "scrubbing.png"), clip: { x: 0, y: 150, width: 1100, height: 540 } });
  await page.mouse.up(); await page.waitForTimeout(700);
  const rel = await deckState();
  check("letting go spins it back to normal speed", !rel.hand && rel.rate > 0.9 && rel.rate < 1.1, JSON.stringify(rel));
  await page.mouse.move(cx + Rr, cy); await page.mouse.down();
  const q0 = (await deckState()).pos;
  for (let i = 1; i <= 40; i++) { const a = -i * 0.12; await page.mouse.move(cx + Rr * Math.cos(a), cy + Rr * Math.sin(a)); await page.waitForTimeout(16); }
  const q1 = (await deckState()).pos;
  await page.mouse.up(); await page.waitForTimeout(500);
  check("dragging counter-clockwise runs the track backwards", q1 - q0 < -0.8, (q1 - q0).toFixed(2));
  const rb = await page.locator("#deck-A button[data-act=rew]").boundingBox();
  const r0 = (await deckState()).pos;
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2); await page.mouse.down(); await page.waitForTimeout(800);
  const rm = await deckState();
  await page.mouse.up(); await page.waitForTimeout(500);
  check("holding rewind winds the track back, fast", rm.pos < r0 - 1.5 && rm.rate < -2, "from " + r0.toFixed(1) + " to " + rm.pos.toFixed(1) + " at " + rm.rate.toFixed(1) + "x");
  const zb = await page.locator("#deck-A canvas.zoom").boundingBox();
  const s0 = (await deckState()).pos;
  await page.mouse.move(zb.x + zb.width * 0.7, zb.y + zb.height / 2); await page.mouse.down();
  for (let i = 1; i <= 30; i++) { await page.mouse.move(zb.x + zb.width * (0.7 - i * 0.01), zb.y + zb.height / 2); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(500);
  check("dragging the waveform left moves the track forward", (await deckState()).pos - s0 > 4, ((await deckState()).pos - s0).toFixed(1));
  const k0 = (await deckState()).pos;
  await page.focus("#deck-A .platter"); await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  const k1 = (await deckState()).pos;
  check("the platter takes the keyboard too: right arrow jumps a bar", k1 - k0 > 1.6 && k1 - k0 < 2.7, (k1 - k0).toFixed(2));
  check("no hand is left on the deck", !(await deckState()).hand);

  await page.click("#btn-mix");
  await page.waitForFunction(() => window.__dj.player.voices.length >= 2, null, { timeout: 5000 });
  check("mix now schedules a transition", true);
  await page.waitForFunction(() => document.querySelectorAll(".fxbar .plan, .fxbar .on").length > 0, null, { timeout: 6000 })
    .then(() => check("effects: the lamps show what the mix has lined up", true), () => check("effects: the lamps show what the mix has lined up", false));
  await page.click('.fxbar .pad[data-fx="impact"]');
  await page.waitForFunction(() => document.querySelector('.fxbar .pad[data-fx="impact"]').classList.contains("on"), null, { timeout: 3000 })
    .then(() => check("effects: a pad lights while its effect sounds", true), () => check("effects: a pad lights while its effect sounds", false));
  await page.waitForFunction(() => / into /.test(document.getElementById("log").textContent), null, { timeout: 5000 });
  check("the thinking log explains it", /into/.test(await page.textContent("#log li")), (await page.textContent("#log li")).slice(0, 140));
  await page.waitForFunction(() => /Mixing/.test(document.getElementById("strip-title").textContent), null, { timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, "mixing.png") });
  check("strip reports the mix in progress", true);
  const locked = await page.evaluate(() => { const p = window.__dj.player; return { a: p.grab("A"), b: p.grab("B"), lock: p.snapshot().lock }; });
  check("the decks are locked while the mix runs", !locked.a && !locked.b && /Locked while the mix is running/.test(locked.lock), JSON.stringify(locked));
  await page.click("#btn-pause");
  await page.waitForFunction(() => window.__dj.player.ctx.state === "suspended", null, { timeout: 4000 });
  await page.click("#btn-pause");
  await page.waitForFunction(() => window.__dj.player.ctx.state === "running" && !window.__dj.player.paused, null, { timeout: 4000 });
  check("pausing in the middle of a mix and resuming carries on", true);
  await page.waitForFunction(() => { const p = window.__dj.player, s = p.snapshot(); return s && p.cur.entry && s.now > p.cur.entry.tSwap + 1; }, null, { timeout: 90000 });
  const landed = await page.evaluate(() => { const p = window.__dj.player, s = p.snapshot(); const d = s.decks.filter((x) => x.voice === p.cur)[0]; return { bar: d.bar, level: d.level, bpm: d.bpm, title: p.cur.track.title }; });
  check("incoming deck is playing after the swap", landed.bar > 0 && landed.level > 0.9, JSON.stringify(landed));
  await page.screenshot({ path: path.join(OUT, "landed.png") });

  // ---- pause like a DJ: the platters wind down, then the clock stops; resume spins them back up
  await page.click("#btn-pause");
  await page.waitForTimeout(300);
  const braking = await page.evaluate(() => { const p = window.__dj.player, s = p.snapshot(), d = s.decks.find((x) => x.voice === p.cur); return { paused: p.paused, label: document.getElementById("btn-pause").textContent, state: p.ctx.state, rate: d.rate }; });
  check("pause: the button flips straight away and the deck is still turning, slower, while it brakes", braking.paused && braking.label === "Resume" && braking.state === "running" && braking.rate > 0.02 && braking.rate < 0.95, JSON.stringify(braking));
  await page.waitForFunction(() => window.__dj.player.ctx.state === "suspended", null, { timeout: 4000 });
  const stopped = await page.evaluate(() => { const p = window.__dj.player, s = p.snapshot(), d = s.decks.find((x) => x.voice === p.cur); return { rate: d.rate, pos: d.pos, now: s.now }; });
  await page.waitForTimeout(400);
  const stopped2 = await page.evaluate(() => { const p = window.__dj.player, s = p.snapshot(), d = s.decks.find((x) => x.voice === p.cur); return { rate: d.rate, pos: d.pos, now: s.now }; });
  check("pause: the clock is frozen and the platter is at rest", stopped.rate === 0 && stopped2.pos === stopped.pos && stopped2.now === stopped.now, JSON.stringify([stopped, stopped2]));
  const refused = await page.evaluate(() => { const p = window.__dj.player; return { a: p.grab("A"), b: p.grab("B"), lock: p.snapshot().lock }; });
  check("pause: the decks refuse a hand while paused", !refused.a && !refused.b && refused.lock === "Paused", JSON.stringify(refused));
  await page.click("#btn-pause");
  await page.waitForFunction(() => window.__dj.player.ctx.state === "running" && !window.__dj.player.paused, null, { timeout: 4000 });
  await page.waitForTimeout(900);
  const resumed = await page.evaluate(() => { const p = window.__dj.player, s = p.snapshot(), d = s.decks.find((x) => x.voice === p.cur); return { rate: d.rate, pos: d.pos, pausing: p.pausing }; });
  check("resume: back at full speed after the spin-up", resumed.rate > 0.85 && resumed.rate < 1.15 && !resumed.pausing, JSON.stringify(resumed));
  await page.click("#btn-pause"); await page.click("#btn-pause");                    // a double press during the brake is remembered, not lost
  await page.waitForFunction(() => !window.__dj.player.paused && !window.__dj.player.pausing && window.__dj.player.ctx.state === "running", null, { timeout: 6000 });
  check("pause: pressing it twice quickly ends up playing", true);
  await page.click("#btn-go");
  await page.waitForFunction(() => document.getElementById("btn-go").textContent.indexOf("Start") >= 0, null, { timeout: 5000 })
    .then(() => check("stop returns to idle", true), () => check("stop returns to idle", false));

  // ---- export
  check("six effect pads are on show without opening anything", (await page.locator(".fxbar .pad").count()) === 6 && await page.locator(".fxbar .pad").first().isVisible());
  await page.click("details.perform summary");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.click("#btn-export")]);
  const file = path.join(OUT, "mix.wav");
  await download.saveAs(file);
  const size = fs.statSync(file).size;
  check("exported WAV is a real file", size > 5e6 && fs.readFileSync(file).slice(0, 4).toString() === "RIFF", Math.round(size / 1e6) + " MB");

  // ---- spotify csv import
  const csv = 'Track Name,Artist Name(s),Duration (ms),Key,Mode,Tempo\nChrome Hearts,Demo Set,150000,4,0,127\nNeon Static,Demo Set,160000,7,1,128\nNot Here,Someone,200000,0,1,120\n';
  fs.writeFileSync(path.join(OUT, "pl.csv"), csv);
  await page.setInputFiles("#sp-csv", path.join(OUT, "pl.csv"));
  await page.waitForSelector("#sp-q1");
  check("spotify csv: matches two of three", /2 of 3/.test(await page.textContent("#sp-result")), (await page.textContent("#sp-result p")));
  await page.click("#sp-q1");
  const qn = await page.evaluate(() => window.__dj.player.queue.map((t) => t.title));
  check("spotify csv: queued in playlist order", qn.join() === "Chrome Hearts,Neon Static", qn.join());

  // ---- soundcloud: the real widget is unreachable from the sandbox, so a stand-in answers
  await page.route("https://w.soundcloud.com/**", (route) => {
    if (/api\.js/.test(route.request().url())) {
      return route.fulfill({ contentType: "application/javascript", body:
        'window.SC = { Widget: Object.assign(function () { return { bind: function (ev, cb) { if (ev === "ready") setTimeout(cb, 20); }, unbind: function () {},' +
        ' getSounds: function (cb) { cb([{ title: "Midnight Warehouse", user: { username: "Demo" }, duration: 150000, permalink_url: "https://soundcloud.com/demo/mw" },' +
        ' { title: "Some Artist - Not In Library", user: { username: "Label" }, duration: 200000, permalink_url: "https://soundcloud.com/some/nil", purchase_url: "https://example.com/buy", downloadable: true },' +
        ' { title: "Bad Link", user: { username: "x" }, permalink_url: "javascript:alert(1)", purchase_url: "http://insecure.example" }]); },' +
        ' getCurrentSound: function (cb) { cb(null); } }; }, { Events: { READY: "ready", ERROR: "error" } }) };' });
    }
    return route.fulfill({ contentType: "text/html", body: "<html></html>" });
  });
  await page.click("details.soundcloud summary");
  await page.fill("#sc-link", "https://evil.example.com/steal");
  await page.click("#sc-read");
  check("soundcloud: a link that is not soundcloud.com is refused", /soundcloud\.com link/.test(await page.textContent("#log")) || (await page.evaluate(() => window.__dj.player.log.map((l) => l.text).join("|"))).includes("does not look like"));
  await page.fill("#sc-link", "https://soundcloud.com/demo/sets/my-set");
  await page.click("#sc-read");
  await page.waitForSelector("#sc-q1");
  check("soundcloud: reads the list and matches one of three", /1 of 3/.test(await page.textContent("#sc-result")), await page.textContent("#sc-result p"));
  const scHtml = await page.innerHTML("#sc-result");
  check("soundcloud: unmatched rows link out, only over https", /href="https:\/\/soundcloud\.com\/some\/nil"/.test(scHtml) && /href="https:\/\/example\.com\/buy"/.test(scHtml) && !/javascript:/.test(scHtml) && !/insecure\.example/.test(scHtml));
  await page.click("#sc-q1");
  const scq = await page.evaluate(() => window.__dj.player.queue.map((t) => t.title));
  check("soundcloud: matched file is queued", scq.join() === "Midnight Warehouse", scq.join());
  await page.click("details.soundcloud details.paste summary");
  await page.fill("#sc-paste", "1. Chrome Hearts\nNeon Static\n");
  await page.click("#sc-paste-go");
  check("soundcloud: a pasted list works without the widget", /2 of 2/.test(await page.textContent("#sc-result")), await page.textContent("#sc-result p"));

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.screenshot({ path: path.join(OUT, "final.png"), fullPage: true });
  console.log("\nscreenshots and wav in " + OUT);
  await browser.close(); server.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
