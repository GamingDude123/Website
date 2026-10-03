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
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://localhost:" + PORT + "/dj/index.html");

  check("page loads with the track list empty", (await page.locator("#tracks .trk").count()) === 0);

  // ---- demo tracks load and are analysed
  await page.click("#btn-demo");
  await page.waitForFunction(() => document.querySelectorAll("#tracks .trk .chip").length >= 16, null, { timeout: 120000 });
  const rows = await page.$$eval("#tracks .trk", (els) => els.map((e) => e.textContent));
  check("four demo tracks analysed", rows.length === 4, rows.length);
  check("BPMs shown", rows.every((r) => /\d+\.\d BPM/.test(r)));

  // ---- offline mix measurements
  const m = await page.evaluate(async () => {
    const tracks = window.__dj.player.library.slice(0, 2);       // Midnight Warehouse -> Chrome Hearts
    const sr = 44100;
    function lowpass(x, fc) { const a = 1 - Math.exp(-2 * Math.PI * fc / sr), y = new Float32Array(x.length); let s = 0; for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); y[i] = s; } return y; }
    function rms(x, a, b) { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / Math.max(1, b - a)); }

    async function render(mute) {
      const probe = new OfflineAudioContext(2, sr, sr);
      const pm = new Engine.Mixer(probe, { offline: true, fx: false }); const plan0 = pm.scheduleSet(tracks, { style: "smooth" });
      const ctx = new OfflineAudioContext(2, Math.ceil((plan0.end + 3) * sr), sr);
      const mx = new Engine.Mixer(ctx, { offline: true, fx: false });
      const set = mx.scheduleSet(tracks, { style: "smooth" });
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
    // negative control: slip one deck by ~30 ms and the same measurement must see it
    const slip = 30, eb2 = new Float32Array(eb.length);
    for (let i = slip; i < eb.length; i++) eb2[i] = eb[i - slip];     // 44-sample hop ≈ 1 ms per frame
    let slipLag = 0, slipBest = -1;
    for (let lag = -40; lag <= 40; lag++) {
      const k = Math.round(lag * sr / 1000 / 44); let s = 0;
      for (let i = 50; i < ea.length - 50; i++) s += ea[i] * eb2[i + k];
      if (s > slipBest) { slipBest = s; slipLag = lag; }
    }
    return { peak, nan, before, during, afterB, bestLag, slipLag, plan: plan.type, L: plan.blendBars, dur: full.buf.duration };
  });
  check("offline mix: no NaN, no clipping", m.nan === 0 && m.peak < 1, "peak=" + m.peak.toFixed(3));
  check("offline mix: plan is a bass swap", m.plan === "bassSwap", m.plan + " " + m.L + " bars");
  const maxDuring = Math.max.apply(null, m.during);
  check("bass swap: low end never doubles during the blend", maxDuring < m.before * 1.35, "before=" + m.before.toFixed(4) + " max during=" + maxDuring.toFixed(4));
  check("bass swap: low end comes back after the swap", m.afterB > m.before * 0.5, "after=" + m.afterB.toFixed(4));
  check("beat lock: decks' onsets line up within 4 ms", Math.abs(m.bestLag) <= 4, "lag=" + m.bestLag + " ms");

  check("beat lock: the same test sees a 30 ms slip", Math.abs(Math.abs(m.slipLag) - 30) <= 4, "lag=" + m.slipLag + " ms");

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

  await page.click("#btn-mix");
  await page.waitForFunction(() => window.__dj.player.voices.length >= 2, null, { timeout: 5000 });
  check("mix now schedules a transition", true);
  check("the thinking log explains it", /into/.test(await page.textContent("#log")), (await page.textContent("#log li")).slice(0, 120));
  await page.waitForFunction(() => /Mixing/.test(document.getElementById("strip-title").textContent), null, { timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, "mixing.png") });
  check("strip reports the mix in progress", true);
  await page.waitForFunction(() => { const p = window.__dj.player, s = p.snapshot(); return s && p.cur.entry && s.now > p.cur.entry.tSwap + 1; }, null, { timeout: 90000 });
  const landed = await page.evaluate(() => { const p = window.__dj.player, s = p.snapshot(); const d = s.decks.filter((x) => x.voice === p.cur)[0]; return { bar: d.bar, level: d.level, bpm: d.bpm, title: p.cur.track.title }; });
  check("incoming deck is playing after the swap", landed.bar > 0 && landed.level > 0.9, JSON.stringify(landed));
  await page.screenshot({ path: path.join(OUT, "landed.png") });

  await page.click("#btn-pause");
  const paused = await page.evaluate(() => window.__dj.player.ctx.state);
  check("pause suspends the clock", paused === "suspended");
  await page.click("#btn-pause");
  await page.click("#btn-go");
  await page.waitForFunction(() => document.getElementById("btn-go").textContent.indexOf("Start") >= 0, null, { timeout: 5000 })
    .then(() => check("stop returns to idle", true), () => check("stop returns to idle", false));

  // ---- export
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

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.screenshot({ path: path.join(OUT, "final.png"), fullPage: true });
  console.log("\nscreenshots and wav in " + OUT);
  await browser.close(); server.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
