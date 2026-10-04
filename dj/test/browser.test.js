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

function makeWav(seconds, bpm) {
  const sr = 44100, n = sr * seconds, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  const beat = 60 / bpm; let seed = 1;
  for (let i = 0; i < n; i++) {
    const t = i / sr, tb = t % beat, tb2 = (t + beat / 2) % beat;
    let v = Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 9) * 0.8;
    seed = (seed * 1664525 + 1013904223) >>> 0; v += ((seed / 2147483648) - 1) * Math.exp(-tb2 * 60) * 0.25;
    buf.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32000, 44 + i * 2);
  }
  return buf;
}

// a stereo file: a four-on-the-floor kick in the middle, a sung-ish centred voice, a lead hard left and a pad hard right
function makeStereoWav(seconds, bpm) {
  const sr = 44100, n = sr * seconds, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  const beat = 60 / bpm; let seed = 1;
  for (let i = 0; i < n; i++) {
    const t = i / sr, tb = t % beat, tb2 = (t + beat / 2) % beat, bar = Math.floor(t / (4 * beat));
    const kick = Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 9) * 0.7;
    seed = (seed * 1664525 + 1013904223) >>> 0; const hat = ((seed / 2147483648) - 1) * Math.exp(-tb2 * 60) * 0.2;
    const voice = bar % 2 === 1 ? 0.22 * Math.sin(2 * Math.PI * (500 + 200 * Math.sin(2 * Math.PI * 0.8 * t)) * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t)) : 0;
    const l = kick + hat + voice + 0.12 * Math.sin(2 * Math.PI * 330 * t), r = kick + hat + voice + 0.12 * Math.sin(2 * Math.PI * 440 * t);
    buf.writeInt16LE(Math.max(-1, Math.min(1, l)) * 30000, 44 + i * 4); buf.writeInt16LE(Math.max(-1, Math.min(1, r)) * 30000, 46 + i * 4);
  }
  return buf;
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

  // ---- the library survives a refresh: the files themselves, the by-hand fixes and the queue order
  const ids = await page.evaluate(() => Object.fromEntries(window.__dj.player.library.map((t) => [t.title, t.id])));
  fs.writeFileSync(path.join(OUT, "Test Artist - Four On The Floor.wav"), makeWav(40, 124));
  await page.setInputFiles("#file-in", path.join(OUT, "Test Artist - Four On The Floor.wav"));
  await page.waitForFunction(() => window.__dj.player.library.length >= 5, null, { timeout: 60000 });
  await page.click('button[data-act=edit][data-id="' + ids["Chrome Hearts"] + '"]');
  await page.selectOption('select[data-act=key][data-id="' + ids["Chrome Hearts"] + '"]', "5A");
  await page.click('button[data-act=shift][data-id="' + ids["Chrome Hearts"] + '"]');
  await page.click('button[data-act=edit][data-id="' + ids["Neon Static"] + '"]');
  await page.click('button[data-act=next][data-id="' + ids["Neon Static"] + '"]');
  await page.waitForTimeout(400);
  check("the page says the files are kept", /saved in this browser/.test(await page.textContent("#lib-stat")), await page.textContent("#lib-stat"));
  await page.reload();
  await page.evaluate(() => window.__dj.restored);
  const back = await page.evaluate(() => { const p = window.__dj.player, byTitle = (n) => p.library.find((t) => t.title === n); const w = byTitle("Four On The Floor"), c = byTitle("Chrome Hearts");
    return { n: p.library.length, titles: p.library.map((t) => t.title), wav: w && { artist: w.artist, bpm: w.analysis.bpm, dur: w.duration, decoded: w.buffer.length > 0, peaks: w.peaks.length }, key: c && c.keyOverride, shift: c && c.shiftBeats, first: p.queue[0] && p.queue[0].title, queued: p.queue.length }; });
  check("after a refresh every file is back", back.n === 5 && back.wav && back.wav.decoded, JSON.stringify(back.titles));
  check("a file you added comes back with its artist, tempo and length", back.wav && back.wav.artist === "Test Artist" && Math.abs(back.wav.bpm - 124) < 1.5 && Math.abs(back.wav.dur - 40) < 0.1, JSON.stringify(back.wav));
  check("the key and downbeat fixes you made come back", back.key === "5A" && back.shift === 1, back.key + " / " + back.shift);
  check("the queue order comes back, and everything is queued", back.first === "Neon Static" && back.queued === 5, back.first + " / " + back.queued);
  check("the demos are restored without being added again", back.titles.filter((t) => t === "Midnight Warehouse").length === 1);
  const ids2 = await page.evaluate(() => Object.fromEntries(window.__dj.player.library.map((t) => [t.title, t.id])));
  await page.click('button[data-act=edit][data-id="' + ids2["Four On The Floor"] + '"]');
  await page.click('button[data-act=del][data-id="' + ids2["Four On The Floor"] + '"]');
  await page.click('button[data-act=edit][data-id="' + ids2["Chrome Hearts"] + '"]');
  await page.selectOption('select[data-act=key][data-id="' + ids2["Chrome Hearts"] + '"]', "");
  for (let i = 0; i < 3; i++) await page.click('button[data-act=shift][data-id="' + ids2["Chrome Hearts"] + '"]');
  await page.waitForTimeout(300);
  await page.reload();
  await page.evaluate(() => window.__dj.restored);
  const back2 = await page.evaluate(() => { const p = window.__dj.player, c = p.library.find((t) => t.title === "Chrome Hearts"); return { n: p.library.length, key: c.keyOverride, shift: c.shiftBeats }; });
  check("removing a track removes its saved copy, and edits are saved again", back2.n === 4 && back2.key === null && back2.shift === 0, JSON.stringify(back2));
  await page.click("#btn-clear"); await page.click("#btn-clear");
  await page.waitForTimeout(400);
  await page.reload();
  await page.evaluate(() => window.__dj.restored);
  check("Remove all really empties the saved library", (await page.evaluate(() => window.__dj.player.library.length)) === 0);
  await page.click("#btn-demo");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk .edit").length >= 4, null, { timeout: 120000 });

  // ---- long lists hide themselves: a long track list is not drawn (summary instead), auto-hide can be turned off,
  //      only a page of rows is drawn, edit controls exist only on the row being edited, and nothing redraws the list while files load
  await page.evaluate(() => { const p = window.__dj.player, base = p.library[0]; for (let i = 0; i < 8; i++) p.add(Object.assign({}, base, { id: 8000 + i, key: "fake-s" + i, title: "Sticky Track " + i, artist: "A" })); window.__dj.render(); });
  check("twelve tracks are shown, not hidden", (await page.locator("#tracks .trk").count()) === 12);
  const stickyId = await page.evaluate(() => window.__dj.player.library[2].id);
  await page.click('#tracks button[data-act=edit][data-id="' + stickyId + '"]');
  await page.waitForFunction(() => document.querySelectorAll("#tracks select[data-act=key]").length === 1, null, { timeout: 3000 });
  await page.evaluate(() => { const p = window.__dj.player; p.add(Object.assign({}, p.library[0], { id: 8100, key: "fake-s100", title: "Sticky Track 100", artist: "A" })); window.__dj.render(); });
  check("a 13th track does not collapse a list whose row is being edited", (await page.locator("#tracks .trk").count()) === 13 && (await page.locator("#tracks select[data-act=key]").count()) === 1);
  await page.click('#tracks button[data-act=edit][data-id="' + stickyId + '"]');
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); const p = window.__dj.player; p.library = p.library.filter((t) => !/^fake-s/.test(t.key)); p.queue = p.queue.filter((t) => !/^fake-s/.test(t.key)); window.__dj.render(); });
  const hide = await page.evaluate(() => {
    const p = window.__dj.player, base = p.library[0], R = {};
    for (let i = 0; i < 30; i++) p.add(Object.assign({}, base, { id: 5000 + i, key: "fake" + i, title: "Fake Track " + i, artist: "Artist " + (i % 7) }));
    window.__dj.render();
    R.rowsHidden = document.querySelectorAll("#tracks .trk").length;
    R.summary = document.getElementById("tracks-sum").textContent;
    R.button = document.getElementById("btn-hide").textContent;
    return R;
  });
  check("a long list starts hidden, with a summary instead of rows", hide.rowsHidden === 0 && /34 tracks hidden/.test(hide.summary) && /up next/.test(hide.summary) && hide.button === "Show tracks (34)", JSON.stringify(hide));
  check("nothing empty is left drawn while the list is hidden", !(await page.locator("#tracks-more").isVisible()) && !(await page.locator("#loading").isVisible()));
  await page.click("#btn-hide");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk").length === 34, null, { timeout: 3000 })
    .then(() => check("Show draws the rows", true), () => check("Show draws the rows", false));
  check("the button turns into Hide, and says whether the list is open", (await page.textContent("#btn-hide")) === "Hide tracks" && (await page.getAttribute("#btn-hide", "aria-expanded")) === "true");
  check("the edit controls are not built for every row", (await page.locator("#tracks select[data-act=key]").count()) === 0);
  const fid = await page.evaluate(() => window.__dj.player.library[5].id);
  await page.click('#tracks button[data-act=edit][data-id="' + fid + '"]');
  await page.waitForFunction(() => document.querySelectorAll("#tracks select[data-act=key]").length === 1, null, { timeout: 3000 })
    .then(() => check("opening a row builds just that row's controls", true), async () => check("opening a row builds just that row's controls", false, String(await page.locator("#tracks select[data-act=key]").count())));
  await page.click('#tracks button[data-act=edit][data-id="' + fid + '"]');
  await page.click("#btn-hide");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk").length === 0, null, { timeout: 3000 })
    .then(() => check("Hide removes the rows again", true), () => check("Hide removes the rows again", false));
  await page.evaluate(() => { const p = window.__dj.player; p.queue.unshift(Object.assign({}, p.library[0], { id: 8200, key: "fake-long", title: "Some_Artist_-_Some_Track_Title_(Original_Mix)_[Label_Records]_320kbps_www.downloadsite.com_extra_long_name.mp3", artist: "A" })); window.__dj.render(); });
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(250);
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, summary: document.getElementById("tracks-sum").textContent }));
  check("a long file name in the hidden-list summary does not widen the page", widths.scroll <= widths.inner + 1 && /…/.test(widths.summary), JSON.stringify(widths));
  await page.setViewportSize({ width: 1100, height: 1300 });
  await page.evaluate(() => { const p = window.__dj.player; p.queue = p.queue.filter((t) => t.key !== "fake-long"); window.__dj.render(); });
  await page.uncheck("#auto-hide");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk").length === 34, null, { timeout: 3000 })
    .then(() => check("with auto-hide off a long list is shown", true), () => check("with auto-hide off a long list is shown", false));
  check("the auto-hide choice is remembered", (await page.evaluate(() => JSON.parse(localStorage.getItem("autopilot-dj-view")).autoHide)) === false);
  await page.check("#auto-hide");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk").length === 0, null, { timeout: 3000 })
    .then(() => check("turning auto-hide back on hides it again", true), () => check("turning auto-hide back on hides it again", false));
  const big = await page.evaluate(async () => {
    const p = window.__dj.player, base = p.library[0], R = {};
    for (let i = 0; i < 270; i++) p.add(Object.assign({}, base, { id: 6000 + i, key: "fake-b" + i, title: "Bulk Track " + i, artist: "Artist " + (i % 30) }));
    const time = (fn, reps) => { const t0 = performance.now(); for (let i = 0; i < reps; i++) fn(); return (performance.now() - t0) / reps; };
    window.__dj.render();
    R.n = p.library.length;
    R.hiddenMs = time(() => { p.queue.push(p.queue.shift()); window.__dj.render(); }, 10);
    R.hiddenNodes = document.getElementById("tracks").getElementsByTagName("*").length;
    return R;
  });
  check("300 tracks: redrawing a hidden list is cheap and draws nothing", big.n >= 300 && big.hiddenNodes === 0 && big.hiddenMs < 5, JSON.stringify(big));
  await page.click("#btn-hide");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk").length === 60, null, { timeout: 3000 })
    .then(() => check("a shown long list draws one page of rows", true), async () => check("a shown long list draws one page of rows", false, String(await page.locator("#tracks .trk").count())));
  check("and offers the rest a page at a time", /Show 60 more \(\d+ not drawn\)/.test(await page.textContent("#tracks-more")), await page.textContent("#tracks-more"));
  // files arriving: a placeholder's progress must not touch the rows of a list that is SHOWN
  const arriving = await page.evaluate(async () => {
    let muts = 0; const mo = new MutationObserver((l) => { muts += l.length; }); mo.observe(document.getElementById("tracks"), { childList: true, subtree: true, attributes: true, characterData: true });
    const ph = { name: "Incoming.wav", progress: 0 }; window.__dj.loading.push(ph);
    for (let i = 1; i <= 20; i++) { ph.progress = i / 20; window.__dj.render(); }
    await new Promise((r) => setTimeout(r, 100));
    const R = { loadingRow: document.querySelectorAll("#loading .trk").length, rows: document.querySelectorAll("#tracks .trk").length, stopShown: !document.getElementById("btn-stop").hidden };
    window.__dj.loading.splice(window.__dj.loading.indexOf(ph), 1); window.__dj.render();
    mo.disconnect(); R.mutations = muts;
    return R;
  });
  check("files arriving show their progress without touching the rows of a shown list", arriving.loadingRow === 1 && arriving.rows === 60 && arriving.mutations === 0 && arriving.stopShown, JSON.stringify(arriving));
  await page.click("#tracks-more");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk").length === 120, null, { timeout: 3000 })
    .then(() => check("Show more draws the next page", true), () => check("Show more draws the next page", false));
  const shownCost = await page.evaluate(() => { const p = window.__dj.player, t0 = performance.now(); for (let i = 0; i < 10; i++) { p.queue.push(p.queue.shift()); window.__dj.render(); } return (performance.now() - t0) / 10; });
  check("even with 120 rows drawn a change redraws in a few milliseconds", shownCost < 25, shownCost.toFixed(1) + " ms");
  await page.click("#btn-hide");
  // a long Spotify list: counts and the queue buttons stay, the rows are hidden until asked for
  const longCsv = "Track Name,Artist Name(s),Duration (ms),Key,Mode,Tempo\n" + Array.from({ length: 130 }, (_, i) => i === 0 ? "Fake Track 3,Artist 3,150000,4,0,127" : "Song " + i + ",Someone " + (i % 9) + ",200000,0,1,120").join("\n") + "\n";
  fs.writeFileSync(path.join(OUT, "long.csv"), longCsv);
  await page.setInputFiles("#sp-csv", path.join(OUT, "long.csv"));
  await page.waitForSelector("#sp-q1");
  check("a long Spotify list starts hidden behind its counts", (await page.locator("#sp-result .match").count()) === 0 && /1 of 130/.test(await page.textContent("#sp-result p")) && /Show list \(130\)/.test(await page.textContent("#sp-result")), await page.textContent("#sp-result p"));
  await page.click('#sp-result button[data-act=toggle]');
  check("Show list draws a page of it", (await page.locator("#sp-result .match").count()) === 60);
  check("and offers the rest", /Show 60 more/.test(await page.textContent("#sp-result button[data-act=more]")));
  await page.click('#sp-result button[data-act=more]');
  check("Show more draws the next page of the Spotify list", (await page.locator("#sp-result .match").count()) === 120);
  await page.focus('#sp-result button[data-act=more]'); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll("#sp-result .match").length === 130, null, { timeout: 3000 });
  const heldFocus = await page.evaluate(() => ({ tag: document.activeElement.tagName, inside: document.getElementById("sp-result").contains(document.activeElement) }));
  check("when the last Show more is used from the keyboard focus moves to the list's own button, not the top of the page", heldFocus.inside, JSON.stringify(heldFocus));
  await page.click('#sp-result button[data-act=toggle]');
  check("Hide list takes the rows away again", (await page.locator("#sp-result .match").count()) === 0 && (await page.locator("#sp-q1").count()) === 1);
  await page.click("#sp-q1");
  const qt = await page.evaluate(() => window.__dj.player.queue.map((t) => t.title).join());
  check("the queue buttons work while the list is hidden", /^Fake Track \d+$/.test(qt), qt);        // (the stand-in tracks are near-identical, so which one matches is not the point)
  // tidy up the stand-in tracks
  await page.evaluate(() => { const p = window.__dj.player; const real = (t) => !/^fake/.test(t.key); p.library = p.library.filter(real); p.queue = p.library.slice(); p.onChange(); });
  await page.waitForTimeout(200);

  // ---- Remove all while files are still being added drops them; Stop adding keeps what is there; two batches at once lose
  //      nothing; and the library holds 50 tracks
  const many = [];
  for (let i = 0; i < 10; i++) { const f = path.join(OUT, "Batch Artist - Song " + i + ".wav"); fs.writeFileSync(f, makeWav(120, 118 + i)); many.push(f); }
  const settle = () => page.waitForFunction(() => !window.__dj.loading.length && document.getElementById("btn-stop").hidden, null, { timeout: 90000 });
  await page.click("#btn-clear"); await page.click("#btn-clear");
  await page.waitForFunction(() => window.__dj.player.library.length === 0, null, { timeout: 5000 });
  await page.setInputFiles("#file-in", many);
  await page.waitForFunction(() => window.__dj.player.library.length >= 1, null, { timeout: 60000 });
  const midway = await page.evaluate(() => ({ lib: window.__dj.player.library.length, clearEnabled: !document.getElementById("btn-clear").disabled, stopShown: !document.getElementById("btn-stop").hidden }));
  check("while files are still being added the Remove all and Stop adding buttons are there", midway.lib < 10 && midway.clearEnabled && midway.stopShown, JSON.stringify(midway));
  const csv20 = "Track Name,Artist Name(s),Duration (ms),Key,Mode,Tempo\n" + Array.from({ length: 20 }, (_, i) => "Batch Artist - Song " + i + ",Batch Artist," + 120000 + ",0,1,120").join("\n") + "\n";
  fs.writeFileSync(path.join(OUT, "arriving.csv"), csv20);
  await page.setInputFiles("#sp-csv", path.join(OUT, "arriving.csv"));
  await page.waitForSelector("#sp-q1");
  const during = await page.evaluate(() => ({ text: document.querySelector("#sp-result p").textContent, adding: !document.getElementById("btn-stop").hidden }));
  check("a Spotify list loaded while files are still arriving is counted straight away", /of 20 tracks/.test(during.text) && during.adding, JSON.stringify(during));
  await page.click("#btn-clear"); await page.click("#btn-clear");
  await page.waitForTimeout(5000);
  const dropped = await page.evaluate(async () => ({ lib: window.__dj.player.library.length, placeholders: document.querySelectorAll("#loading .trk").length, saved: (await window.__dj.store.all()).length, stopShown: !document.getElementById("btn-stop").hidden, hint: document.querySelectorAll("#tracks .empty-lib").length }));
  check("Remove all in the middle of adding drops the rest: nothing carries on, nothing is saved", dropped.lib === 0 && dropped.placeholders === 0 && dropped.saved === 0 && !dropped.stopShown, JSON.stringify(dropped));
  check("and the empty library says so", dropped.hint === 1);
  await page.setInputFiles("#file-in", many);
  await page.waitForFunction(() => window.__dj.player.library.length >= 2, null, { timeout: 60000 });
  await page.click("#btn-stop");
  await page.waitForTimeout(3000);
  const stoppedAdding = await page.evaluate(() => ({ lib: window.__dj.player.library.length, placeholders: document.querySelectorAll("#loading .trk").length, stopShown: !document.getElementById("btn-stop").hidden }));
  await page.waitForTimeout(2500);
  const stoppedLater = await page.evaluate(() => window.__dj.player.library.length);
  check("Stop adding keeps what was added and starts no more", stoppedAdding.lib >= 2 && stoppedAdding.lib < 10 && stoppedAdding.placeholders === 0 && !stoppedAdding.stopShown && stoppedLater === stoppedAdding.lib, JSON.stringify([stoppedAdding, stoppedLater]));
  await page.click("#btn-clear"); await page.click("#btn-clear");
  await page.waitForFunction(() => window.__dj.player.library.length === 0, null, { timeout: 5000 });
  const errsBefore = errors.length;
  await page.setInputFiles("#file-in", many.slice(0, 4));
  await page.waitForTimeout(150);
  await page.setInputFiles("#file-in", many.slice(4, 6));
  await page.waitForFunction(() => window.__dj.player.library.length === 6, null, { timeout: 90000 })
    .then(() => check("two batches added at once lose nothing", true), async () => check("two batches added at once lose nothing", false, String(await page.evaluate(() => window.__dj.player.library.length))));
  check("and raise no errors", errors.length === errsBefore, errors.slice(errsBefore).join(" | "));
  await settle();
  await page.click("#btn-clear"); await page.click("#btn-clear");
  await page.waitForFunction(() => window.__dj.player.library.length === 0, null, { timeout: 5000 });
  await page.evaluate(() => { const p = window.__dj.player; for (let i = 0; i < 48; i++) p.add({ id: 7000 + i, key: "fake-l" + i, title: "Limit Track " + i, artist: "A", buffer: { length: 10, numberOfChannels: 1, duration: 1 }, analysis: { bpm: 120, key: { camelot: "8A", name: "A" }, energy: 5, loudnessDb: -12, bars: 8, sections: [], cues: {} }, peaks: new Float32Array(4), fine: new Float32Array(4), duration: 1, keyOverride: null, shiftBeats: 0 }); });
  await page.setInputFiles("#file-in", many.slice(0, 4));
  await page.waitForFunction(() => window.__dj.player.library.length === 50, null, { timeout: 90000 });
  await settle();
  await page.waitForTimeout(300);
  const limited = await page.evaluate(() => ({ lib: window.__dj.player.library.length, note: window.__dj.player.log.map((l) => l.text).join(" | "), stat: document.getElementById("lib-stat").textContent }));
  check("the library holds 50 tracks and says why the rest were not added", limited.lib === 50 && /holds up to 50 tracks/.test(limited.note) && /\(the limit\)/.test(limited.stat), JSON.stringify([limited.lib, limited.stat]));
  await page.click("#btn-hide");                                                     // an explicit Show ...
  await page.click("#btn-clear"); await page.click("#btn-clear");                    // ... must not outlive Remove all
  await page.waitForFunction(() => window.__dj.player.library.length === 0, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  check("after Remove all the list is empty and says so, whatever Show or Hide was chosen before", (await page.locator("#tracks .empty-lib").count()) === 1 && (await page.locator("#tracks").isVisible()));
  await page.click("#btn-demo");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk .edit").length >= 4, null, { timeout: 120000 });
  check("and auto-hide works again afterwards (4 tracks are shown, not hidden)", (await page.locator("#tracks .trk").count()) === 4);

  // ---- the vocal tools on a real stereo file: it is recognised, the deck buttons work, a mono track is refused
  fs.writeFileSync(path.join(OUT, "Vox Artist - Stereo Vocal Test.wav"), makeStereoWav(40, 124));
  await page.click("#btn-clear"); await page.click("#btn-clear");
  await page.waitForFunction(() => window.__dj.player.library.length === 0, null, { timeout: 5000 });
  await page.setInputFiles("#file-in", path.join(OUT, "Vox Artist - Stereo Vocal Test.wav"));
  await page.waitForFunction(() => window.__dj.player.library.length === 1, null, { timeout: 60000 });
  const prof = await page.evaluate(() => { const a = window.__dj.player.library[0].analysis; return { stereo: a.stereo, width: a.width, bars: a.lead && a.lead.length, max: a.lead ? Math.max.apply(null, Array.from(a.lead)) : 0, min: a.lead ? Math.min.apply(null, Array.from(a.lead)) : 0 }; });
  check("a stereo file is recognised as stereo and gets a per-bar lead profile", prof.stereo === true && prof.width > 0.1 && prof.bars >= 10 && prof.max - prof.min > 0.2, JSON.stringify(prof));
  await page.click("#btn-go");
  await page.waitForFunction(() => window.__dj.player.ctx && window.__dj.player.ctx.currentTime > 1.5, null, { timeout: 15000 });
  check("the vocal buttons are on the deck and enabled for a stereo track", (await page.locator("#deck-A .vox button").count()) === 3 && (await page.locator('#deck-A .vox button[data-vox="cut"]').isEnabled()));
  await page.click('#deck-A .vox button[data-vox="cut"]');
  await page.waitForFunction(() => window.__dj.player.voices[0].voxMode === "cut", null, { timeout: 3000 })
    .then(() => check("No vocals switches the deck over", true), () => check("No vocals switches the deck over", false));
  await page.waitForTimeout(300);
  check("and the button shows it is on", (await page.getAttribute('#deck-A .vox button[data-vox="cut"]', "aria-pressed")) === "true" && (await page.getAttribute('#deck-A .vox button[data-vox="off"]', "aria-pressed")) === "false");
  await page.click('#deck-A .vox button[data-vox="solo"]');
  await page.waitForFunction(() => window.__dj.player.voices[0].voxMode === "solo", null, { timeout: 3000 })
    .then(() => check("Vocals only switches the deck over", true), () => check("Vocals only switches the deck over", false));
  await page.click('#deck-A .vox button[data-vox="off"]');
  await page.waitForFunction(() => window.__dj.player.voices[0].voxMode === "off", null, { timeout: 3000 })
    .then(() => check("Full puts it back", true), () => check("Full puts it back", false));
  await page.click("#btn-go");
  await page.waitForFunction(() => document.getElementById("btn-go").textContent.indexOf("Start") >= 0, null, { timeout: 5000 });
  await page.click("#btn-clear"); await page.click("#btn-clear");
  await page.waitForFunction(() => window.__dj.player.library.length === 0, null, { timeout: 5000 });
  await page.click("#btn-demo");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk .edit").length >= 4, null, { timeout: 120000 });

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
  // the demos come back by themselves after every reload
  await page.evaluate(() => window.__dj.restored);
  check("the demos are still there after all those reloads", (await page.evaluate(() => window.__dj.player.library.length)) === 4);

  // ---- the engine against a frequency-coded track: its pitch at time t says exactly where it is.
  //      Checks the DJ pause, the scrub, and the new ways out against an independent simulation.
  const osc = await page.evaluate(async () => {
    const sr = 44100, DUR = 40, F0 = 300, K = 40;                    // f(p) = F0 + 2K p
    const fOf = (p) => F0 + 2 * K * p;
    const analysis = { bpm: 120, beatLen: 0.5, barLen: 2, downbeat: 0, loudnessDb: -12, bars: 20, key: { camelot: "1A", name: "x" }, energy: 5, sections: [], cues: [] };
    const makeTrack = (ctx, silent) => {
      const buf = ctx.createBuffer(1, sr * DUR, sr), d = buf.getChannelData(0);
      if (silent === "tone") for (let i = 0; i < d.length; i++) d[i] = 0.12 * Math.sin(2 * Math.PI * 1000 * i / sr);
      else if (!silent) for (let i = 0; i < d.length; i++) { const p = i / sr; d[i] = 0.12 * Math.sin(2 * Math.PI * (F0 * p + K * p * p)); }
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
      // a click is a step larger than the signal itself could make: a sine of amplitude 0.12 at frequency f steps at most 0.12*2*pi*f/sr per sample
      let clicks = 0, worstClick = 0;
      for (let a = t0 + 0.02; a < 12.5; a += 0.01) {
        let fmax = 0; for (let q = a - 0.01; q < a + 0.02; q += 0.002) { const r = at(q); fmax = Math.max(fmax, fOf(Math.max(0, r[1])) * Math.abs(r[2])); }
        const bound = 0.12 * 2 * Math.PI * fmax / sr * 2.0 + 0.004;     // 2x for the compressor's make-up and a little slack
        let w = 0; for (let i = Math.floor((a + 0.006) * sr); i < Math.floor((a + 0.016) * sr); i++) w = Math.max(w, Math.abs(x[i] - x[i - 1]));
        if (w > bound) { clicks++; worstClick = Math.max(worstClick, w / bound); }
      }
      R.scrubClicks = { clicks: clicks, worstRatio: worstClick };
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
    // 3b. the creative moves: a filter swap closes A and opens B, and a stutter gates the last two beats
    const blendPlan = { type: "bassSwap", swapBar: 12, blendBars: 8, startBar: 4, inLandBar: 8, inStartBar: 0, buildBars: 0, tailBars: 4, roll: false, riser: false, impact: false, echoThrow: false, crash: false, downlifter: false,
      bassSwapMode: "hard", intensity: 0.6, amounts: { echo: 55, reverb: 45 }, rise: 0, freshTempo: false, reasons: [], extras: [] };
    async function blend(extra, aKind, bKind) {
      const ctx = new OfflineAudioContext(2, sr * 30, sr), m = new Engine.Mixer(ctx, { offline: true, fx: true, settings: Settings.make({ autoFx: "off", fx: true, auto: false }) });
      const A = m.firstVoice(makeTrack(ctx, aKind), 0.1, "A");
      const B = m.scheduleTransition(A, makeTrack(ctx, bKind), Object.assign({}, blendPlan, extra), "B");
      return { x: (await ctx.startRendering()).getChannelData(0), tStart: B.entry.tStart, tSwap: B.entry.tSwap, events: m.fxEvents.map((e) => e.kind + (e.auto ? "*" : "")) };
    }
    {
      const plain = await blend({}, false, true), filt = await blend({ filter: true }, false, true);
      const late = (r) => rms(r.x, r.tSwap - 2.5, r.tSwap - 0.5);
      R.filterA = { plain: late(plain), filter: late(filt) };                                   // A (a chirp, 1-2 kHz late on) against the closing low-pass
      const plainB = await blend({}, true, "tone"), filtB = await blend({ filter: true }, true, "tone");
      const early = (r) => rms(r.x, r.tStart + 0.08 * (r.tSwap - r.tStart), r.tStart + 0.14 * (r.tSwap - r.tStart));
      R.filterB = { plain: early(plainB), filter: early(filtB), late: rms(filtB.x, filtB.tSwap + 0.3, filtB.tSwap + 1.5), lateBase: rms(plainB.x, plainB.tSwap + 0.3, plainB.tSwap + 1.5), events: filt.events.join(",") };
    }
    {
      const st = await blend({ type: "stutter", swapBar: 12, blendBars: 0, startBar: 12, inLandBar: 0, inStartBar: 0, buildBars: 1, impact: false }, false, true);
      const beat = 0.5, t0 = st.tSwap - 2 * beat, hop = Math.floor(sr * 0.004), env = [];
      for (let i = Math.floor(t0 * sr); i < Math.floor((st.tSwap + 0.05) * sr); i += hop) { let e = 0; for (let j = 0; j < hop; j++) e += st.x[i + j] * st.x[i + j]; env.push(Math.sqrt(e / hop)); }
      const top = Math.max.apply(null, env); let gaps = 0, off = false;
      env.slice(0, Math.floor(2 * beat * sr / hop)).forEach((v) => { if (v < 0.15 * top) { if (!off) gaps++; off = true; } else off = false; });
      R.stutter = { gaps: gaps, before: rms(st.x, st.tSwap - 4, st.tSwap - 2.2), after: rms(st.x, st.tSwap + 1.5, st.tSwap + 3), events: st.events.join(",") };
    }
    {
      const ex = await blend({ extras: [{ kind: "swell" }, { kind: "zap" }, { kind: "snare" }, { kind: "siren" }] }, false, true);
      R.extras = { kinds: ex.events.join(","), peak: (() => { let m = 0; for (let i = 0; i < ex.x.length; i++) { const a = Math.abs(ex.x[i]); if (a > m) m = a; } return m; })() };
    }

    // 3c. the vocal tools, on a stereo mix whose parts are at known frequencies: a centred voice (700 Hz),
    //     a hard-left lead (330 Hz), a hard-right pad (440 Hz) and a centred bass (55 Hz)
    {
      const goertzel = (x, f, a, b) => { const w = 2 * Math.PI * f / sr; let re = 0, im = 0; for (let i = Math.floor(a * sr); i < Math.floor(b * sr); i++) { re += x[i] * Math.cos(w * i); im -= x[i] * Math.sin(w * i); } return Math.hypot(re, im) * 2 / ((b - a) * sr); };
      const db = (a, b) => 20 * Math.log10((a + 1e-9) / (b + 1e-9));
      const stereo = (ctx) => {
        const buf = ctx.createBuffer(2, sr * 40, sr), l = buf.getChannelData(0), r = buf.getChannelData(1);
        for (let i = 0; i < l.length; i++) { const t = i / sr, v = 0.12 * Math.sin(2 * Math.PI * 700 * t), b = 0.12 * Math.sin(2 * Math.PI * 55 * t); l[i] = v + b + 0.12 * Math.sin(2 * Math.PI * 330 * t); r[i] = v + b + 0.12 * Math.sin(2 * Math.PI * 440 * t); }
        return { title: "stereo", buffer: buf, duration: 40, shiftBeats: 0, analysis: Object.assign({}, analysis, { stereo: true }) };
      };
      async function voxRender(mode) {
        const ctx = new OfflineAudioContext(2, sr * 8, sr), m = new Engine.Mixer(ctx, { offline: true, fx: false });
        await m.init();
        const v = m.firstVoice(stereo(ctx), 0.1, "A");
        if (mode !== "off") v.setVox(0.5, mode, 0.05);
        const o = await ctx.startRendering();
        return { ok: m.voxOk, l: o.getChannelData(0), r: o.getChannelData(1), lat: m.voxLat };
      }
      const off = await voxRender("off"), cut = await voxRender("cut"), solo = await voxRender("solo");
      const m = (r) => ({ voice: goertzel(r.l, 700, 3, 6), lead: goertzel(r.l, 330, 3, 6), pad: goertzel(r.r, 440, 3, 6), bass: goertzel(r.l, 55, 3, 6), leadInR: goertzel(r.r, 330, 3, 6), padInL: goertzel(r.l, 440, 3, 6) });
      const o0 = m(off), c1 = m(cut), s1 = m(solo);
      R.vox = { ok: off.ok, latMs: off.lat * 1000,
        cut: { voice: db(c1.voice, o0.voice), lead: db(c1.lead, o0.lead), pad: db(c1.pad, o0.pad), bass: db(c1.bass, o0.bass), phantom: db(c1.leadInR, o0.leadInR + 1e-3) },
        solo: { voice: db(s1.voice, o0.voice), lead: db(s1.lead, o0.lead), pad: db(s1.pad, o0.pad), bass: db(s1.bass, o0.bass) } };
      // the stage delays every deck by the same amount and the effects by the same amount, so a hit still lands on its beat
      const ctx = new OfflineAudioContext(2, sr * 6, sr), mx = new Engine.Mixer(ctx, { offline: true, fx: false });
      await mx.init();
      const clk = ctx.createBuffer(2, sr * 8, sr); clk.getChannelData(0)[Math.floor(sr * 3)] = 1; clk.getChannelData(1)[Math.floor(sr * 3)] = 1;
      const track = { title: "click", buffer: clk, duration: 8, shiftBeats: 0, analysis: analysis };
      const vc = mx.firstVoice(track, 0.1, "A");
      const imp = ctx.createBuffer(1, 64, sr); imp.getChannelData(0)[0] = 1;
      const isrc = ctx.createBufferSource(); isrc.buffer = imp; isrc.connect(mx.fxGain); isrc.start(3.1 + 1);   // the same moment, a second later
      const o2 = (await ctx.startRendering()).getChannelData(0);
      const first = (a, b) => { let best = 0, at = 0; for (let i = Math.floor(a * sr); i < Math.floor(b * sr); i++) if (Math.abs(o2[i]) > best) { best = Math.abs(o2[i]); at = i; } return at / sr; };
      R.voxTiming = { deck: first(3.0, 3.3) - 3.1, fx: first(4.0, 4.3) - 4.1 };
      void vc;

      // in a blend: a mashup brings B in as vocals only and its instruments join at the swap; a clash takes A's vocal out
      const sil = (ctx2) => ({ title: "silence", buffer: ctx2.createBuffer(2, sr * 40, sr), duration: 40, shiftBeats: 0, analysis: Object.assign({}, analysis, { stereo: true }) });
      async function blendVox(extra, aTrack, bTrack) {
        const c2 = new OfflineAudioContext(2, sr * 30, sr), m2 = new Engine.Mixer(c2, { offline: true, fx: false, settings: Settings.make({ autoFx: "off", fx: false, auto: false }) });
        await m2.init();
        const A = m2.firstVoice(aTrack(c2), 0.1, "A");
        const B = m2.scheduleTransition(A, bTrack(c2), Object.assign({}, blendPlan, extra), "B");
        const o2b = (await c2.startRendering()).getChannelData(0);
        return { x: o2b, tStart: B.entry.tStart, tSwap: B.entry.tSwap };
      }
      const bp = (r, f, a, b) => goertzel(r.x, f, a, b);
      const mash = await blendVox({ vox: { inn: "solo" } }, sil, stereo);
      const mid = mash.tStart + 0.35 * (mash.tSwap - mash.tStart), after = mash.tSwap + 0.5;
      R.mashup = { voiceDuring: bp(mash, 700, mid, mid + 2), leadDuring: bp(mash, 330, mid, mid + 2), voiceAfter: bp(mash, 700, after, after + 2), leadAfter: bp(mash, 330, after, after + 2) };
      const plainB = await blendVox({}, sil, stereo);
      R.mashupPlain = { leadDuring: bp(plainB, 330, mid, mid + 2) };
      const clash = await blendVox({ vox: { out: "cut" } }, stereo, sil), noClash = await blendVox({}, stereo, sil);
      const late = clash.tStart + 0.7 * (clash.tSwap - clash.tStart);
      R.clash = { voice: db(bp(clash, 700, late, late + 2), bp(noClash, 700, late, late + 2)), lead: db(bp(clash, 330, late, late + 2), bp(noClash, 330, late, late + 2)) };
    }

    // 4. the pads by hand: a loop roll, a spinback and a vinyl brake each give the track back exactly on the beat
    async function playWith(fn) {
      const ctx = new OfflineAudioContext(2, sr * 10, sr), m = new Engine.Mixer(ctx, { offline: true, fx: false });
      const v = m.firstVoice(makeTrack(ctx), 0.1, "A"), info = fn(m, v);
      return { x: (await ctx.startRendering()).getChannelData(0), info: info };
    }
    const alignedAfter = (x, from) => { const ca = crossings(base, from, 9), cb = crossings(x, from, 9); let worst = 0, j = 0; for (let i = 0; i < ca.length; i++) { while (j + 1 < cb.length && Math.abs(cb[j + 1] - ca[i]) < Math.abs(cb[j] - ca[i])) j++; worst = Math.max(worst, Math.abs(cb[j] - ca[i])); } return worst * 1000; };
    const corr = (x, a, b, len) => { let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < len * sr; i++) { const p = x[Math.floor(a * sr) + i], q = x[Math.floor(b * sr) + i]; sab += p * q; saa += p * p; sbb += q * q; } return sab / Math.sqrt(saa * sbb + 1e-12); };
    {
      const r = await playWith((m, v) => m.rollNow(v, 4.1));
      R.roll = { aligned: alignedAfter(r.x, r.info + 0.3), repeat: corr(r.x, 4.12, 4.37, 0.2), baseRepeat: corr(base, 4.12, 4.37, 0.2), rmsAfter: rms(r.x, r.info + 0.3, r.info + 1.3), rmsBase: rms(base, r.info + 0.3, r.info + 1.3) };
    }
    {
      const r = await playWith((m, v) => m.spinbackNow(v, 4.1)), spin = 1.1, r0 = 3.2, r1 = 0.12, slope = (r0 - r1) / spin;
      let worstS = 0, rows = 0;
      for (let tau = 0.06; tau + 0.1 < 0.95; tau += 0.1) {
        const mid = tau + 0.05, rate = r0 - slope * mid, P = 4.0 - (r0 * mid - slope * mid * mid / 2), pred = fOf(P) * rate;
        worstS = Math.max(worstS, Math.abs(freqIn(r.x, 4.1 + tau + 0.006, 4.1 + tau + 0.106) - pred) / pred); rows++;
      }
      R.spinHand = { worst: worstS, rows: rows, aligned: alignedAfter(r.x, r.info + 0.3), rmsAfter: rms(r.x, r.info + 0.3, r.info + 1.3), rmsBase: rms(base, r.info + 0.3, r.info + 1.3) };
    }
    {
      const r = await playWith((m, v) => { const st = m.brake([v], 4.1, Engine.BRAKE, true); m.spinUp(st, 4.1 + Engine.BRAKE + 0.12, Engine.SPINUP); return 4.1 + Engine.BRAKE + 0.12 + Engine.SPINUP; });
      R.brakeHand = { aligned: alignedAfter(r.x, r.info + 0.3), rmsBefore: rms(r.x, 3.6, 4.0), rmsAtStop: rms(r.x, 4.1 + Engine.BRAKE - 0.01, 4.1 + Engine.BRAKE), rmsAfter: rms(r.x, r.info + 0.3, r.info + 1.3), rmsBase: rms(base, r.info + 0.3, r.info + 1.3) };
    }
    return R;
  });
  check("filter swap: the outgoing track is closed down by the swap (well below a plain blend)", osc.filterA.filter < 0.25 * osc.filterA.plain, JSON.stringify(osc.filterA));
  check("filter swap: the incoming track starts behind a high-pass and opens up, and is the same afterwards", osc.filterB.filter < 0.3 * osc.filterB.plain && Math.abs(osc.filterB.late - osc.filterB.lateBase) < 0.15 * osc.filterB.lateBase && /filter/.test(osc.filterB.events), JSON.stringify(osc.filterB));
  check("stutter cut: the last two beats are gated eight times, A is played normally before and gone after", osc.stutter.gaps === 8 && osc.stutter.after < 0.2 * osc.stutter.before && osc.stutter.before > 0.05, JSON.stringify(osc.stutter));
  check("effect extras around a swap: swell, snare, zap and siren all play and the mix does not clip", /swell/.test(osc.extras.kinds) && /snare/.test(osc.extras.kinds) && /zap/.test(osc.extras.kinds) && /siren/.test(osc.extras.kinds) && osc.extras.peak <= 1.0, JSON.stringify(osc.extras));
  check("vocal tools load, with a latency of 512 samples", osc.vox.ok && Math.abs(osc.vox.latMs - 512 / 44.1) < 0.01, JSON.stringify(osc.vox));
  check("no vocals: the centred voice is taken out (15 dB or more) and the panned instruments and the bass are left", osc.vox.ok && osc.vox.cut.voice < -15 && Math.abs(osc.vox.cut.lead) < 3 && Math.abs(osc.vox.cut.pad) < 3 && Math.abs(osc.vox.cut.bass) < 3, JSON.stringify(osc.vox.cut));
  check("no vocals: a hard-panned instrument does not appear, inverted, on the other side", osc.vox.cut.phantom < 3, osc.vox.cut.phantom && osc.vox.cut.phantom.toFixed(1) + " dB");
  check("vocals only: the voice stays, the instruments and the bass go (12 dB or more)", osc.vox.ok && osc.vox.solo.voice > -3 && osc.vox.solo.lead < -12 && osc.vox.solo.pad < -12 && osc.vox.solo.bass < -12, JSON.stringify(osc.vox.solo));
  check("mashup: the incoming track comes in as vocals only, and its instruments are back after the swap", osc.mashup.voiceDuring > 8 * osc.mashup.leadDuring && osc.mashup.leadAfter > 0.5 * osc.mashup.voiceAfter && osc.mashup.leadDuring < 0.2 * osc.mashupPlain.leadDuring, JSON.stringify([osc.mashup, osc.mashupPlain]));
  check("clashing vocals: the outgoing track's vocal is taken out of the blend and its instruments are not", osc.clash.voice < -12 && Math.abs(osc.clash.lead) < 4, JSON.stringify(osc.clash));
  check("the vocal stage delays decks and effects alike, so a hit still lands on its beat (within a millisecond)", Math.abs(osc.voxTiming.deck - osc.voxTiming.fx) < 0.001, JSON.stringify(osc.voxTiming));        // (both also carry the master compressor's look-ahead)
  check("roll pad: the roll repeats the beat, and the track is back on the beat afterwards", osc.roll.repeat > 0.85 && osc.roll.baseRepeat < 0.6 && osc.roll.aligned < 2.5 && osc.roll.rmsAfter > 0.9 * osc.roll.rmsBase, JSON.stringify(osc.roll));
  check("spinback pad: the track is wound backwards, fast and slowing, and is back on the beat afterwards", osc.spinHand.rows >= 6 && osc.spinHand.worst < 0.08 && osc.spinHand.aligned < 2.5 && osc.spinHand.rmsAfter > 0.9 * osc.spinHand.rmsBase, JSON.stringify(osc.spinHand));
  check("brake pad: the deck fades as it stops and is back on the beat afterwards, without a pause", osc.brakeHand.rmsAtStop < 0.05 * osc.brakeHand.rmsBefore && osc.brakeHand.aligned < 2.5 && osc.brakeHand.rmsAfter > 0.9 * osc.brakeHand.rmsBase, JSON.stringify(osc.brakeHand));
  check("pause: pitch falls as the platters slow, as modelled", osc.brakeErr < 0.05, "worst " + (osc.brakeErr * 100).toFixed(1) + "%");
  check("pause: the output fades out as it stops, and is back at full level after the spin-up", osc.rmsAtStop < 0.05 * osc.rmsBefore && osc.rmsAfter > 0.9 * osc.rmsBefore, [osc.rmsBefore, osc.rmsAtStop, osc.rmsAfter].map((x) => x.toFixed(3)).join(" / "));
  check("pause: after the spin-up the music is exactly where the plan expects it", osc.realignMs < 2.5, osc.realignMs.toFixed(2) + " ms");
  check("scrub: pitch follows the platter through stops, reversals and wobbles", osc.scrub.n > 60 && osc.scrub.median < 0.02 && osc.scrub.p90 < 0.06, JSON.stringify(osc.scrub));
  check("scrub: no clicks, even at the reversals (no step bigger than the signal allows)", osc.scrubClicks.clicks === 0, JSON.stringify(osc.scrubClicks));
  check("scrub: the deck's position bookkeeping matches an independent simulation", osc.scrubPosMs < 5, osc.scrubPosMs.toFixed(2) + " ms");
  check("scrub: back at normal speed after the release", osc.afterRelease < 0.03, (osc.afterRelease * 100).toFixed(1) + "%");
  check("brake exit: the outgoing deck winds down over its last two beats", osc.brake.rows >= 4 && osc.brake.worst < 0.08, JSON.stringify(osc.brake));
  check("brake exit: only a reverb tail is left once the next track lands, and it dies away", osc.brake.rmsAfter < 0.25 * osc.brake.rmsBefore && osc.brake.rmsLate < 0.005 && osc.brake.rmsBefore > 0.05, JSON.stringify(osc.brake));
  check("spinback exit: the last beat plays backwards, fast and slowing", osc.spin.rows >= 6 && osc.spin.worst < 0.08 && osc.spin.worst < osc.spin.closerToReverse * 0.6, JSON.stringify(osc.spin));
  check("spinback exit: nothing is left sounding afterwards", osc.spin.rmsAfter < 0.01);

  // a drop swap into a track too far off in tempo lands at its own tempo; one within reach glides over
  const fresh = await page.evaluate(() => {
    const lib = window.__dj.player.library, sr = 44100, S = Settings.make({ style: "club", variety: 0, auto: false, fx: false }), out = {};
    const base = Brain.planTransition(Engine.infoOf(lib[0]), Engine.infoOf(lib[3]), { entryBar: 0, settings: S, index: 1 });
    [true, false].forEach((flag) => {
      const mx = new Engine.Mixer(new OfflineAudioContext(2, sr, sr), { offline: true, settings: S });
      const A = mx.firstVoice(lib[0], 0.2, "A");
      const plan = Object.assign({}, base, { type: "dropSwap", blendBars: 0, startBar: base.swapBar, inLandBar: 0, inStartBar: 0, buildBars: 8, freshTempo: flag });
      const B = mx.scheduleTransition(A, lib[3], plan, "B");
      out[flag] = { r0: B.tl.nodes[0].r, nodes: B.tl.nodes.length, bpmA: lib[0].analysis.bpm, bpmB: lib[3].analysis.bpm };
    });
    return out;
  });
  check("freshTempo: the incoming deck starts at its own tempo, no glide", fresh.true.r0 === 1 && fresh.true.nodes === 1, JSON.stringify(fresh.true));
  check("within reach: the incoming deck starts at the outgoing tempo and settles over 16 bars", fresh.false.r0 !== 1 && fresh.false.nodes > 1, JSON.stringify(fresh.false));

  // automatic sound effects: counts grow with the level, none land inside a transition, and a rendered set stays clean
  const autoFx = await page.evaluate(async () => {
    const lib = window.__dj.player.library.slice(0, 4), sr = 44100, R = {};
    for (const level of ["off", "subtle", "lively", "wild"]) {
      const S = Settings.make({ autoFx: level, fx: true, auto: false });
      const mx = new Engine.Mixer(new OfflineAudioContext(2, sr, sr), { offline: true, settings: S });
      const set = mx.scheduleSet(lib, { settings: S });
      const auto = mx.fxEvents.filter((e) => e.auto);
      const windows = set.voices.filter((v) => v.entry).map((v) => [v.entry.tBegin - 0.5 * v.beatSec(v.entry.tSwap) * 4, v.entry.tSwap + v.beatSec(v.entry.tSwap) * 4]);
      R[level] = { n: auto.length, inside: auto.filter((e) => windows.some((w) => e.t0 >= w[0] && e.t0 <= w[1])).length, kinds: Array.from(new Set(auto.map((e) => e.kind))).join(",") };
    }
    const S = Settings.make({ autoFx: "wild", fx: true, auto: false });
    const out = await Engine.renderSet(lib.slice(0, 2), { settings: S });
    const x = out.buffer.getChannelData(0); let peak = 0, bad = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a !== a) bad++; if (a > peak) peak = a; }
    R.render = { peak: +peak.toFixed(3), bad: bad };
    return R;
  });
  check("auto fx: counts grow with the level and off is silent", autoFx.off.n === 0 && autoFx.subtle.n > 0 && autoFx.subtle.n < autoFx.lively.n && autoFx.lively.n < autoFx.wild.n, JSON.stringify(autoFx));
  check("auto fx: none sounds inside a transition", autoFx.subtle.inside === 0 && autoFx.lively.inside === 0 && autoFx.wild.inside === 0, JSON.stringify([autoFx.subtle.inside, autoFx.lively.inside, autoFx.wild.inside]));
  check("auto fx: a rendered set with Wild on has no NaN and does not clip", autoFx.render.bad === 0 && autoFx.render.peak <= 1.0, JSON.stringify(autoFx.render));

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
  check("the demos are mono, so the vocal buttons are off and say why", (await page.locator('#deck-A .vox button[data-vox="cut"]').isDisabled()) && /mono/.test(await page.getAttribute("#deck-A .vox", "title")));

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
  // the three deck pads, live: each lights while it acts, and the deck carries on at speed
  for (const pad of ["roll", "spin", "brake"]) {
    await page.click('.fxbar .pad[data-fx="' + pad + '"]');
    await page.waitForFunction((p) => document.querySelector('.fxbar .pad[data-fx="' + p + '"]').classList.contains("on"), pad, { timeout: 4000 })
      .then(() => check(pad + " pad: lights while it acts", true), () => check(pad + " pad: lights while it acts", false));
    await page.waitForFunction(() => !window.__dj.player.pausing, null, { timeout: 8000 });
    await page.waitForTimeout(2300);
  }
  const afterPads = await deckState();
  check("after Roll, Spinback and Brake the deck is back at normal speed", afterPads.rate > 0.9 && afterPads.rate < 1.1 && !afterPads.hand, JSON.stringify(afterPads));
  check("the deck pads are enabled again", (await page.locator('.fxbar .pad[data-fx="brake"]').isEnabled()) && (await page.locator('.fxbar .pad[data-fx="roll"]').isEnabled()));

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

  // ---- winding the deck past the point where the planned mix had to start must not strand the set
  await page.evaluate(() => { const p = window.__dj.player; if (!p.queue.length) p.queue = p.library.slice(0, 3); });
  await page.click("#btn-go");
  await page.waitForFunction(() => window.__dj.player.ctx && window.__dj.player.ctx.currentTime > 1.5, null, { timeout: 15000 });
  const wound = await page.evaluate(() => { const p = window.__dj.player; let n = 0; for (let i = 0; i < 40; i++) if (p.jump("A", 4)) n++; return { jumps: n, bar: p.snapshot().decks[0].bar }; });
  check("fast-forwarding by jumps gets near the end of the track", wound.jumps >= 8 && wound.bar > 50, JSON.stringify(wound));
  await page.waitForFunction(() => window.__dj.player.voices.length >= 2, null, { timeout: 12000 })
    .then(() => check("after winding past the planned mix, the set still gets a transition", true), () => check("after winding past the planned mix, the set still gets a transition", false));
  await page.click("#btn-go");
  await page.waitForFunction(() => document.getElementById("btn-go").textContent.indexOf("Start") >= 0, null, { timeout: 5000 });

  // ---- export
  await page.evaluate(() => { const p = window.__dj.player; p.queue = p.library.slice(0, 3); p.onChange(); });
  check("twelve effect pads are on show without opening anything, Roll, Brake and Spinback among them", (await page.locator(".fxbar .pad").count()) === 12 && (await page.locator(".fxbar .pad").first().isVisible()) && (await page.locator('.fxbar .pad[data-fx="roll"]').isVisible()) && (await page.locator('.fxbar .pad[data-fx="spin"]').isVisible()));
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
        'window.SC = { Widget: Object.assign(function (frame) { var empty = /empty/.test(frame.src); return { bind: function (ev, cb) { if (ev === "ready") setTimeout(cb, 20); }, unbind: function () {},' +
        ' getSounds: function (cb) { if (empty) { cb([]); return; } cb([{ title: "Midnight Warehouse", user: { username: "Demo" }, duration: 150000, permalink_url: "https://soundcloud.com/demo/mw" },' +
        ' { title: "Some Artist - Not In Library", user: { username: "Label" }, duration: 200000, permalink_url: "https://soundcloud.com/some/nil", purchase_url: "https://example.com/buy", downloadable: true },' +
        ' { title: "Bad Link", user: { username: "x" }, permalink_url: "javascript:alert(1)", purchase_url: "http://insecure.example" }]); },' +
        ' getCurrentSound: function (cb) { cb(null); } }; }, { Events: { READY: "ready", ERROR: "error" } }) };' });
    }
    return route.fulfill({ contentType: "text/html", body: "<html></html>" });
  });
  await page.click("details.soundcloud summary");
  await page.fill("#sc-link", "https://evil.example.com/steal");
  await page.click("#sc-read");
  check("soundcloud: a link that is not soundcloud.com is refused, in the card where it is seen", /does not look like a soundcloud\.com link/.test(await page.textContent("#sc-result")), await page.textContent("#sc-result"));
  await page.fill("#sc-link", "https://soundcloud.com/demo/sets/empty-set");
  await page.click("#sc-read");
  await page.waitForFunction(() => /had no tracks/.test(document.getElementById("sc-result").textContent), null, { timeout: 15000 })
    .then(() => check("soundcloud: an empty answer is explained in the card, after retrying", true), async () => check("soundcloud: an empty answer is explained in the card, after retrying", false, await page.textContent("#sc-result")));
  await page.fill("#sc-link", "https://soundcloud.com/demo/sets/my-set");
  await page.click("#sc-read");
  await page.waitForSelector("#sc-q1");
  check("soundcloud: reads the list and matches one of three", /1 of 3/.test(await page.textContent("#sc-result")), await page.textContent("#sc-result p"));
  const scHtml = await page.innerHTML("#sc-result");
  check("soundcloud: unmatched rows link out, only over https", /href="https:\/\/soundcloud\.com\/some\/nil"/.test(scHtml) && /href="https:\/\/example\.com\/buy"/.test(scHtml) && !/javascript:/.test(scHtml) && !/insecure\.example/.test(scHtml));
  await page.click("#sc-q1");
  const scq = await page.evaluate(() => window.__dj.player.queue.map((t) => t.title));
  check("soundcloud: matched file is queued", scq.join() === "Midnight Warehouse", scq.join());
  await page.evaluate(() => { document.querySelector("details.soundcloud details.paste").open = true; });      // (an error opens it by itself)
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
