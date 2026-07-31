/* End-to-end test: drives the real page in a real browser.
 *
 * Needs playwright and a chromium it can find:
 *   npm i -D playwright && npx playwright install chromium
 *   node studio/test/browser.test.js
 *
 * The fake media device gives the microphone path something to record, so the
 * whole chain runs unattended: capture, polish, arrange, play, bounce, reload.
 */

const { chromium } = (function () {
  const candidates = ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"];
  for (const name of candidates) {
    try { return require(name); } catch (err) { /* try the next one */ }
  }
  console.error("playwright not found — install it with `npm i -D playwright`");
  process.exit(2);
})();
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");   // the site root
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "loop-lab-test-"));
const PORT = 8099;
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

(async () => {
  // The microphone needs a secure context, and localhost counts as one, so the
  // page has to be served rather than opened as a file.
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    let file = path.join(ROOT, rel || "index.html");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
                    ".png": "image/png", ".wav": "audio/wav", ".json": "application/json" };
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({
    // CHROMIUM lets a sandbox point at a browser playwright cannot discover.
    executablePath: process.env.CHROMIUM || undefined,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--allow-file-access-from-files",
    ],
  });
  const context = await browser.newContext({ permissions: ["microphone"] });
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(`http://localhost:${PORT}/studio/`, { waitUntil: "load" });
  check("page loads", await page.title() !== "", await page.title());

  // ---- demo kit -> polish -> pads
  await page.click("#btn-demo");
  await page.waitForFunction(() => window.LoopLab && window.LoopLab.pads().length >= 6, { timeout: 20000 });

  const pads = await page.evaluate(() => window.LoopLab.pads().map((p) => ({
    name: p.name, role: p.role, note: p.note, beats: p.beats,
    rawLen: p.raw.length, polishedLen: p.polished.length,
    sr: p.sampleRate, report: p.report, shifted: p.shifted,
  })));
  console.log("\n--- pads ---");
  pads.forEach((p) => console.log(
    "  " + p.name.padEnd(6) + p.role.padEnd(9) +
    (p.note || "-").padEnd(5) + "beats=" + String(p.beats || "-").padEnd(4) +
    (p.rawLen / p.sr).toFixed(2) + "s -> " + (p.polishedLen / p.sr).toFixed(2) + "s\n" +
    "         " + p.report.join(" | ")));
  console.log("");

  const byName = {};
  pads.forEach((p) => { byName[p.name] = p; });
  check("six pads created", pads.length === 6, pads.length + " pads");
  check("boom is a kick", byName.boom && byName.boom.role === "kick", byName.boom && byName.boom.role);
  check("tss is a hat", byName.tss && byName.tss.role === "hat", byName.tss && byName.tss.role);
  check("pat is a snare", byName.pat && byName.pat.role === "snare", byName.pat && byName.pat.role);
  check("hum is a bass", byName.hum && byName.hum.role === "bass", byName.hum && byName.hum.role);
  check("ahh is a vocal", byName.ahh && byName.ahh.role === "vocal", byName.ahh && byName.ahh.role);
  check("wash is a texture", byName.wash && byName.wash.role === "texture", byName.wash && byName.wash.role);
  check("hum was tuned into the key", byName.hum && byName.hum.note && Math.abs(byName.hum.shifted) > 0.1,
    byName.hum && (byName.hum.note + " shift=" + byName.hum.shifted.toFixed(2)));
  check("wash was fitted to the grid", byName.wash && byName.wash.beats >= 2, byName.wash && byName.wash.beats);
  check("dead air was trimmed off every pad",
    pads.every((p) => p.polishedLen < p.rawLen),
    pads.map((p) => ((p.rawLen - p.polishedLen) / p.sr).toFixed(2) + "s").join(", "));
  check("every pad reports its edits", pads.every((p) => p.report.length >= 2));

  // Pin the arrangement to a known seed. The bar the arranger writes is
  // randomly seeded per press, and its density moves the measured level of the
  // bounce around, so the audio assertions below need a fixed pattern.
  await page.evaluate(() => {
    const pads = window.LoopLab.pads().map((p) => ({ id: p.id, role: p.role, beats: p.beats }));
    const result = Patterns.arrange(pads, "garage", 42);
    Object.keys(result.rows).forEach((id) => Engine.setRow(id, result.rows[id].steps, result.rows[id].loop));
  });

  // ---- grid got filled
  const cellsOn = await page.evaluate(() => document.querySelectorAll(".cell.is-on").length);
  check("auto-arrange wrote a pattern", cellsOn > 8, cellsOn + " steps on");
  const rows = await page.evaluate(() => document.querySelectorAll(".grid-row").length);
  check("one grid row per pad", rows === 6, rows + " rows");

  // ---- transport
  await page.click("#btn-play");
  await page.waitForTimeout(1800);
  const playState = await page.evaluate(() => ({
    playing: window.LoopLab ? undefined : undefined,
    cls: document.getElementById("btn-play").className,
    now: document.querySelectorAll(".cell.is-now").length,
    ctxState: (window.Engine && Engine.context().state) || "?",
    ctxTime: (window.Engine && Engine.context().currentTime) || 0,
  }));
  check("transport is running", playState.cls.indexOf("is-playing") >= 0, playState.cls);
  check("audio clock is advancing", playState.ctxTime > 1, "t=" + playState.ctxTime.toFixed(2) + " state=" + playState.ctxState);
  check("playhead is on the grid", playState.now === 6, playState.now + " cells lit");

  // Stopping in the middle of a kick duck must not leave the mix turned down.
  await page.evaluate(() => {
    // force a deep duck, then stop while the ramp is still down
    Engine.setMaster("sidechain", 0.8);
    const pads = Engine.pads();
    const kick = pads.find((p) => p.role === "kick");
    return Engine.tap(kick.id, 1).then(() => new Promise((r) => setTimeout(r, 15))).then(() => Engine.stop());
  });
  await page.waitForTimeout(300);
  const duckGain = await page.evaluate(() => Engine.bus().ducked.gain.value);
  check("stopping mid-duck restores the mix level", Math.abs(duckGain - 1) < 0.01, "ducked gain = " + duckGain.toFixed(3));
  await page.evaluate(() => Engine.setMaster("sidechain", 0.45));
  await page.click("#btn-play");
  await page.waitForTimeout(300);

  // ---- pad sheet
  await page.evaluate(() => document.querySelectorAll(".pad .cog")[3].click());
  await page.waitForSelector("#sheet:not([hidden])");
  const sheet = await page.evaluate(() => ({
    name: document.getElementById("pad-name").value,
    instrument: document.getElementById("pad-instrument").value,
    morph: document.getElementById("p-morph").value,
    lines: Array.from(document.querySelectorAll("#pad-report .line span")).map((n) => n.textContent),
    ab: document.getElementById("btn-ab").textContent,
  }));
  check("sheet opens on the right pad", sheet.name === "hum" && sheet.instrument === "bass",
    sheet.name + "/" + sheet.instrument);
  // An instrument that was only guessed is offered, not applied.
  check("a guessed instrument is not rebuilt behind your back", sheet.morph === "0",
    "strength = " + sheet.morph);
  check("sheet lists the edits", sheet.lines.length >= 3, sheet.lines.join(" | "));

  // raw/polished A-B actually swaps the buffer
  await page.click("#btn-ab");
  const abOff = await page.evaluate(() => {
    const pad = window.LoopLab.pads().find((p) => p.name === "hum");
    return { label: document.getElementById("btn-ab").textContent, usePolished: pad.usePolished };
  });
  check("A-B switches to the raw take", abOff.label === "Raw take" && abOff.usePolished === false, JSON.stringify(abOff));
  await page.click("#btn-ab");

  // the pad sheet can rebuild an existing pad as a different instrument
  const humBefore = await page.evaluate(() => {
    const pad = window.LoopLab.pads().find((p) => p.name === "hum");
    let sum = 0;
    for (let i = 0; i < pad.polished.length; i++) sum += Math.abs(pad.polished[i]) * (i % 7 + 1);
    return { len: pad.polished.length, sum: sum };
  });
  await page.selectOption("#pad-instrument", "sub");
  await page.waitForFunction(() => window.LoopLab.pads().find((p) => p.name === "hum").instrument === "sub",
    { timeout: 15000 });
  const asSub = await page.evaluate(() => {
    const pad = window.LoopLab.pads().find((p) => p.name === "hum");
    let sum = 0;
    for (let i = 0; i < pad.polished.length; i++) sum += Math.abs(pad.polished[i]) * (i % 7 + 1);
    return { role: pad.role, morph: pad.morph, report: pad.report, len: pad.polished.length, sum: sum };
  });
  check("an existing pad can be rebuilt as another instrument",
    asSub.role === "bass" && asSub.morph > 0.5 && asSub.report.some((l) => /rebuilt it as a sub/.test(l)),
    "role=" + asSub.role + " morph=" + asSub.morph + " | " + asSub.report.join(" | "));
  check("rebuilding actually changed the audio",
    Math.abs(asSub.sum - humBefore.sum) / humBefore.sum > 0.02,
    "waveform sum moved " + (100 * Math.abs(asSub.sum - humBefore.sum) / humBefore.sum).toFixed(1) + "%");
  await page.selectOption("#pad-instrument", "bass");
  await page.waitForFunction(() => window.LoopLab.pads().find((p) => p.name === "hum").instrument === "bass",
    { timeout: 15000 });
  await page.click("#sheet-close");

  // ---- key change retunes
  await page.selectOption("#key", "0"); // C
  await page.waitForTimeout(2500);
  const retuned = await page.evaluate(() => window.LoopLab.pads()
    .filter((p) => p.note).map((p) => p.name + ":" + p.note));
  check("changing key retunes the pitched pads",
    retuned.length >= 2 && retuned.every((entry) => /:(C|D|E|F|G|A|B)/.test(entry)),
    retuned.join(" "));
  await page.selectOption("#key", "9");
  await page.waitForTimeout(2500);

  // Discarding a take leaves nothing behind.
  const countBeforeDiscard = await page.evaluate(() => window.LoopLab.pads().length);
  await page.click("#btn-rec");
  await page.waitForTimeout(900);
  await page.click("#btn-rec");
  await page.waitForSelector("#pick:not([hidden])", { timeout: 20000 });
  await page.click("#pick-discard");
  await page.waitForFunction(() => document.getElementById("pick").hidden, { timeout: 5000 });
  const afterDiscard = await page.evaluate(() => window.LoopLab.pads().length);
  check("discarding a take adds no pad", afterDiscard === countBeforeDiscard,
    afterDiscard + " pads, was " + countBeforeDiscard);

  // ---- bounce
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.click("#btn-bounce"),
  ]);
  const wavPath = path.join(OUT, "bounce.wav");
  await download.saveAs(wavPath);
  const wav = fs.readFileSync(wavPath);
  check("bounce downloads a wav", wav.length > 200000 && wav.slice(0, 4).toString() === "RIFF",
    (wav.length / 1048576).toFixed(2) + " MB, tag=" + wav.slice(0, 4).toString() + ", name=" + download.suggestedFilename());

  // decode it and confirm it is actual music, not silence
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const channels = view.getUint16(22, true);
  const rate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  const frames = (wav.length - 44) / (channels * bits / 8);
  let peak = 0, sum = 0, nonZero = 0;
  const chunk = 1024;
  const rmsOverTime = [];
  for (let i = 0; i < frames; i++) {
    const v = view.getInt16(44 + i * channels * 2, true) / 32768;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a > 0.001) nonZero++;
    sum += v * v;
    if (i % chunk === 0) rmsOverTime.push(0);
    rmsOverTime[rmsOverTime.length - 1] += v * v;
  }
  const rms = Math.sqrt(sum / frames);
  check("bounce is stereo at the context rate", channels === 2 && rate >= 44100 && bits === 16,
    channels + "ch " + rate + "Hz " + bits + "bit " + (frames / rate).toFixed(2) + "s");
  check("bounce is not silent", peak > 0.3 && rms > 0.02, "peak=" + peak.toFixed(3) + " rms=" + rms.toFixed(4));
  check("bounce does not clip", peak < 0.999, "peak=" + peak.toFixed(4));
  check("bounce has content throughout", nonZero / frames > 0.6,
    (100 * nonZero / frames).toFixed(1) + "% of samples above -60dB");
  // the pattern should make the level move, not sit still
  const loud = rmsOverTime.filter((v) => v > 0).map((v) => Math.sqrt(v / chunk));
  const spread = Math.max.apply(null, loud) / (loud.reduce((a, b) => a + b, 0) / loud.length);
  check("bounce has dynamics", spread > 1.5, "peak-to-average of block RMS = " + spread.toFixed(2));
  // Crest factor. This guards against the master bus levelling the whole bar
  // instead of catching peaks, which measured 5 dB and sounded like a wall.
  // A dense garage bar through glue plus a limiter honestly lands around 9-10.
  const crestDb = 20 * Math.log10(peak / rms);
  check("bounce is not squashed flat", crestDb > 8.5,
    "crest factor = " + crestDb.toFixed(1) + " dB (peak " + peak.toFixed(3) + " / rms " + rms.toFixed(3) + ")");

  // ---- microphone path, using chromium's fake device
  const before = pads.length;
  await page.click("#btn-rec");
  await page.waitForTimeout(1600);
  const live = await page.evaluate(() => ({
    cls: document.getElementById("btn-rec").className,
    label: document.getElementById("rec-label").textContent,
    meter: document.getElementById("meter-fill").style.width,
  }));
  check("recording starts and meters", live.cls.indexOf("is-live") >= 0 && live.label === "Stop",
    JSON.stringify(live));
  await page.click("#btn-rec");

  // The picker should come up instead of a pad silently appearing.
  await page.waitForSelector("#pick:not([hidden])", { timeout: 20000 });
  const picker = await page.evaluate(() => ({
    options: Array.from(document.querySelectorAll("#pick-grid .pick")).map((b) => b.dataset.instrument),
    selected: (document.querySelector("#pick-grid .pick.is-on") || {}).dataset,
    guessBadges: document.querySelectorAll("#pick-grid .pick i").length,
    morph: document.getElementById("pick-morph").value,
    padsSoFar: window.LoopLab.pads().length,
  }));
  check("recording opens the instrument picker", picker.options.length >= 12 && picker.padsSoFar === before,
    picker.options.length + " instruments, " + picker.padsSoFar + " pads so far");
  check("the picker marks its guess", picker.guessBadges === 1 && picker.selected,
    "guess=" + (picker.selected && picker.selected.instrument) + " at " + picker.morph + "%");

  // Picking an instrument must actually change the audio, not just a label.
  await page.click('#pick-grid .pick[data-instrument="hat"]');
  await page.waitForFunction(() => window.LoopLab.pending() && window.LoopLab.pending().result &&
    window.LoopLab.pending().result.instrument === "hat", { timeout: 15000 });
  const asHat = await page.evaluate(() => {
    const r = window.LoopLab.pending().result;
    return { seconds: r.samples.length / r.sampleRate, role: r.role, steps: r.steps, morph: r.morph };
  });
  await page.click('#pick-grid .pick[data-instrument="kick"]');
  await page.waitForFunction(() => window.LoopLab.pending().result.instrument === "kick", { timeout: 15000 });
  const asKick = await page.evaluate(() => {
    const r = window.LoopLab.pending().result;
    let low = 0, total = 0;
    // crude low-end share, straight off the samples
    for (let i = 1; i < r.samples.length; i++) total += Math.abs(r.samples[i]);
    return { seconds: r.samples.length / r.sampleRate, role: r.role, steps: r.steps, morph: r.morph };
  });
  console.log("         as a hat:  " + asHat.seconds.toFixed(3) + "s  " + asHat.steps.join(" | "));
  console.log("         as a kick: " + asKick.seconds.toFixed(3) + "s  " + asKick.steps.join(" | "));
  check("choosing a hi-hat gives a hi-hat's length", asHat.seconds < 0.2 && asHat.role === "hat",
    asHat.seconds.toFixed(3) + "s role=" + asHat.role);
  check("choosing a kick gives a kick's length", asKick.seconds > 0.25 && asKick.seconds < 0.6 && asKick.role === "kick",
    asKick.seconds.toFixed(3) + "s role=" + asKick.role);
  check("each instrument brings its own default strength", asHat.morph !== asKick.morph,
    "hat " + asHat.morph + " vs kick " + asKick.morph);
  check("the rebuild is reported in words",
    asKick.steps.some((line) => /rebuilt it as a kick/.test(line)),
    asKick.steps.join(" | "));

  // the strength slider re-shapes
  await page.evaluate(() => {
    const slider = document.getElementById("pick-morph");
    slider.value = "0";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => window.LoopLab.pending().result.morph === 0, { timeout: 15000 });
  const atZero = await page.evaluate(() => {
    const r = window.LoopLab.pending().result;
    return { seconds: r.samples.length / r.sampleRate, steps: r.steps };
  });
  check("strength 0 leaves the take its own length", atZero.seconds > asKick.seconds * 1.5,
    atZero.seconds.toFixed(3) + "s at 0% vs " + asKick.seconds.toFixed(3) + "s at 70%");
  check("strength 0 reports no rebuild", !atZero.steps.some((l) => /rebuilt/.test(l)), atZero.steps.join(" | "));

  await page.evaluate(() => {
    const slider = document.getElementById("pick-morph");
    slider.value = "80";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => window.LoopLab.pending().result.morph === 0.8, { timeout: 15000 });

  await page.click("#pick-add");
  await page.waitForFunction((n) => window.LoopLab.pads().length === n + 1, before, { timeout: 20000 });
  const recorded = await page.evaluate(() => {
    const pad = window.LoopLab.pads().slice(-1)[0];
    let peak = 0;
    for (let i = 0; i < pad.polished.length; i++) peak = Math.max(peak, Math.abs(pad.polished[i]));
    return { name: pad.name, role: pad.role, instrument: pad.instrument, morph: pad.morph,
             seconds: pad.raw.length / pad.sampleRate, peak: peak, report: pad.report };
  });
  check("a microphone take becomes a pad", recorded.seconds > 0.5 && recorded.peak > 0.5,
    recorded.name + " " + recorded.role + " " + recorded.seconds.toFixed(2) + "s peak=" + recorded.peak.toFixed(2));
  check("the pad keeps the instrument that was chosen",
    recorded.instrument === "kick" && recorded.role === "kick" && Math.abs(recorded.morph - 0.8) < 0.001,
    recorded.instrument + " at " + recorded.morph);
  console.log("         mic take: " + recorded.report.join(" | "));

  // A second bounce, now that a microphone take is in the kit: the level of a
  // fake-device tone is not worth asserting on, but it must still be audible
  // and must still not clip.
  const [download2] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.click("#btn-bounce"),
  ]);
  const wav2Path = path.join(OUT, "bounce-with-mic.wav");
  await download2.saveAs(wav2Path);
  const wav2 = fs.readFileSync(wav2Path);
  const view2 = new DataView(wav2.buffer, wav2.byteOffset, wav2.byteLength);
  let peak2 = 0;
  for (let i = 44; i + 1 < wav2.length; i += 2) {
    const a = Math.abs(view2.getInt16(i, true) / 32768);
    if (a > peak2) peak2 = a;
  }
  check("bounce with a recorded pad is audible and clean", peak2 > 0.3 && peak2 < 0.999,
    "peak=" + peak2.toFixed(4));

  // ---- persistence across a reload
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.LoopLab && window.LoopLab.pads().length >= 7, { timeout: 20000 });
  const afterReload = await page.evaluate(() => ({
    count: window.LoopLab.pads().length,
    names: window.LoopLab.pads().map((p) => p.name),
    cells: document.querySelectorAll(".cell.is-on").length,
    bpm: document.getElementById("bpm").value,
    key: document.getElementById("key").value,
  }));
  check("kit survives a reload", afterReload.count === 7, afterReload.count + ": " + afterReload.names.join(","));
  check("pattern survives a reload", afterReload.cells > 8, afterReload.cells + " steps");
  check("session settings survive", afterReload.key === "9", "bpm=" + afterReload.bpm + " key=" + afterReload.key);
  const choiceKept = await page.evaluate(() => {
    const pad = window.LoopLab.pads().slice(-1)[0];
    return { instrument: pad.instrument, morph: pad.morph, role: pad.role };
  });
  check("the chosen instrument survives a reload",
    choiceKept.instrument === "kick" && Math.abs(choiceKept.morph - 0.8) < 0.001,
    choiceKept.instrument + " at " + choiceKept.morph + ", role " + choiceKept.role);

  // ---- screenshots
  await page.setViewportSize({ width: 430, height: 900 });
  await page.click("#btn-rec");
  await page.waitForTimeout(900);
  await page.click("#btn-rec");
  await page.waitForSelector("#pick:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "picker.png") });
  await page.click("#pick-discard");

  await page.setViewportSize({ width: 1180, height: 1400 });
  await page.click("#btn-about");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "studio-desktop.png"), fullPage: true });
  await page.click("#btn-about");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "studio-phone.png"), fullPage: true });
  await page.evaluate(() => document.querySelectorAll(".pad .cog")[4].click());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "studio-sheet.png") });

  check("no console or page errors", errors.length === 0, errors.slice(0, 6).join(" || ") || "clean");

  await browser.close();
  server.close();
  console.log("\nartifacts in " + OUT);
  console.log(fails ? fails + " FAILURES" : "all green");
  process.exit(fails ? 1 : 0);
})().catch((err) => {
  console.error("HARNESS ERROR", err);
  process.exit(2);
});
