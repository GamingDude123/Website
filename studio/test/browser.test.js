/* End-to-end test: drives the real page in a real browser.
 *
 * Needs playwright and a chromium it can find:
 *   npm i -D playwright && npx playwright install chromium
 *   node studio/test/browser.test.js
 *
 * The fake media device gives the microphone path something to record, so the
 * whole instrument runs unattended: hold a pad to record, tap pads to play,
 * capture a performance into the loop, chop, bounce, reload.
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
let PORT = 0;   // assigned by the OS, so a stale server cannot block a run
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

/* Press and hold a pad for real, so the code under test sees the same pointer
 * sequence a finger produces. */
async function holdPad(page, slot, ms) {
  const box = await page.locator(`.pad[data-slot="${slot}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function tapPad(page, slot) {
  const box = await page.locator(`.pad[data-slot="${slot}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(30);
  await page.mouse.up();
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
  await new Promise((r) => server.listen(0, r));
  PORT = server.address().port;

  const browser = await chromium.launch({
    // CHROMIUM lets a sandbox point at a browser playwright cannot discover.
    executablePath: process.env.CHROMIUM || undefined,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    permissions: ["microphone"],
    viewport: { width: 420, height: 880 },
  });
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(`http://localhost:${PORT}/studio/`, { waitUntil: "load" });

  // ---- the pad grid is the page
  const layout = await page.evaluate(() => {
    const pads = document.querySelectorAll(".pad");
    const first = pads[0].getBoundingClientRect();
    const grid = document.getElementById("grid").getBoundingClientRect();
    return {
      count: pads.length,
      padPx: Math.round(first.width) + "x" + Math.round(first.height),
      smallestSide: Math.min(first.width, first.height),
      gridShare: grid.height / window.innerHeight,
      scrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
      empty: document.querySelectorAll(".pad.is-empty").length,
    };
  });
  check("sixteen pads", layout.count === 16, layout.count + " pads at " + layout.padPx);
  check("pads are thumb-sized", layout.smallestSide >= 44, layout.smallestSide.toFixed(0) + "px on the short side");
  check("the grid owns the screen", layout.gridShare > 0.5,
    (100 * layout.gridShare).toFixed(0) + "% of the viewport height");
  check("nothing scrolls", !layout.scrolls);
  check("empty pads invite a recording", layout.empty === 16, layout.empty + " empty");

  // ---- hold an empty pad to record into it, with no dialog in the way
  await holdPad(page, 0, 900);
  await page.waitForFunction(() => window.LoopLab.padAt(0), { timeout: 20000 });
  const recorded = await page.evaluate(() => {
    const pad = window.LoopLab.padAt(0);
    let peak = 0;
    for (let i = 0; i < pad.polished.length; i++) peak = Math.max(peak, Math.abs(pad.polished[i]));
    return {
      role: pad.role, name: pad.name, seconds: pad.raw.length / pad.sampleRate, peak: peak,
      report: pad.report,
      dialogs: document.querySelectorAll(".sheet:not([hidden])").length,
      steps: (Engine.rows()[pad.id] || { steps: [] }).steps.filter(Boolean).length,
    };
  });
  check("holding an empty pad records into it", recorded.seconds > 0.4 && recorded.peak > 0.4,
    recorded.name + " " + recorded.seconds.toFixed(2) + "s peak=" + recorded.peak.toFixed(2));
  check("no dialog interrupts the recording", recorded.dialogs === 0, recorded.dialogs + " sheets open");
  check("a new sound is given a part to play", recorded.steps > 0, recorded.steps + " steps");
  console.log("         " + recorded.report.join(" | "));

  // ---- tapping a full pad plays it and does not open anything
  await tapPad(page, 0);
  const afterTap = await page.evaluate(() => ({
    dialogs: document.querySelectorAll(".sheet:not([hidden])").length,
    pads: window.LoopLab.pads().length,
  }));
  check("a tap plays without opening anything", afterTap.dialogs === 0 && afterTap.pads === 1,
    afterTap.dialogs + " sheets, " + afterTap.pads + " pads");

  // ---- holding a full pad opens its editor
  await holdPad(page, 0, 700);
  await page.waitForSelector("#editor:not([hidden])", { timeout: 5000 });
  const editor = await page.evaluate(() => ({
    name: document.getElementById("pad-name").value,
    instrument: document.getElementById("pad-instrument").value,
    morph: document.getElementById("p-morph").value,
    lines: document.querySelectorAll("#pad-report .line").length,
  }));
  check("holding a full pad opens it", editor.lines >= 2 && editor.name.length > 0,
    editor.name + " / " + editor.instrument + " at " + editor.morph + "%");

  // ---- rebuilding as another instrument, from the editor
  await page.selectOption("#pad-instrument", "hat");
  await page.waitForFunction(() => window.LoopLab.padAt(0).instrument === "hat", { timeout: 15000 });
  const asHat = await page.evaluate(() => {
    const pad = window.LoopLab.padAt(0);
    return { role: pad.role, seconds: pad.polished.length / pad.sampleRate, report: pad.report };
  });
  check("a pad can be rebuilt as a hi-hat", asHat.role === "hat" && asHat.seconds < 0.2,
    asHat.seconds.toFixed(3) + "s, role " + asHat.role);
  await page.selectOption("#pad-instrument", "kick");
  await page.waitForFunction(() => window.LoopLab.padAt(0).instrument === "kick", { timeout: 15000 });
  const asKick = await page.evaluate(() => {
    const pad = window.LoopLab.padAt(0);
    return { role: pad.role, seconds: pad.polished.length / pad.sampleRate, report: pad.report };
  });
  check("and as a kick", asKick.role === "kick" && asKick.seconds > 0.25 && asKick.seconds < 0.7,
    asKick.seconds.toFixed(3) + "s, role " + asKick.role);
  const renamed = await page.evaluate(() => window.LoopLab.padAt(0).name);
  check("a pad nobody named follows its instrument", /kick/.test(renamed), renamed);
  console.log("         " + asKick.report.join(" | "));
  await page.click("#editor-close");

  // ---- fill a few more pads, quickly, one after another
  for (const slot of [1, 2, 3]) await holdPad(page, slot, 700);
  await page.waitForFunction(() => window.LoopLab.pads().length === 4, { timeout: 30000 });
  check("recording into pad after pad keeps working", true, "4 pads");

  // ---- performance capture
  await page.evaluate(() => {
    // start from an empty bar so the test is measuring what was played
    window.LoopLab.pads().forEach((p) => Engine.setRow(p.id, new Array(16).fill(0), false));
  });
  await page.click("#btn-cap");
  await page.waitForFunction(() => Engine.isPlaying() && window.LoopLab.ui.capturing, { timeout: 10000 });
  check("arming the loop starts it", true, "playing and capturing");

  // play four hits, spread across a bar
  const stepMs = await page.evaluate(() => Engine.stepDuration() * 1000);
  for (const slot of [0, 1, 2, 3]) {
    await tapPad(page, slot);
    await page.waitForTimeout(stepMs * 3);
  }
  const captured = await page.evaluate(() => {
    const rows = Engine.rows();
    return window.LoopLab.pads().map((p) => ({
      slot: p.slot,
      on: (rows[p.id] || { steps: [] }).steps.reduce((n, v, i) => v ? n.concat(i) : n, []),
    }));
  });
  const totalCaptured = captured.reduce((n, r) => n + r.on.length, 0);
  check("tapping pads writes them into the loop", totalCaptured >= 4,
    captured.map((r) => "pad" + r.slot + "@" + (r.on.join(",") || "-")).join(" "));
  check("each tap lands on its own pad's row", captured.every((r) => r.on.length >= 1),
    captured.filter((r) => !r.on.length).length + " pads got nothing");

  await page.click("#btn-cap");
  const capOff = await page.evaluate(() => ({ capturing: window.LoopLab.ui.capturing, playing: Engine.isPlaying() }));
  check("disarming stops capturing but keeps playing", !capOff.capturing && capOff.playing, JSON.stringify(capOff));

  // ---- the playhead is visible on the deck
  await page.waitForTimeout(400);
  const lit = await page.evaluate(() => document.querySelectorAll(".steps i.is-now").length);
  check("the step lights follow the transport", lit === 1, lit + " lit");

  // ---- FX are held, not toggled
  const filterOpen = await page.evaluate(() => Engine.bus().sweep.frequency.value);
  await page.locator("#fx-filter").hover();
  await page.mouse.down();
  await page.waitForTimeout(320);
  const filterHeld = await page.evaluate(() => Engine.bus().sweep.frequency.value);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const filterReleased = await page.evaluate(() => Engine.bus().sweep.frequency.value);
  check("FILTER closes while held and opens on release",
    filterHeld < filterOpen * 0.2 && filterReleased > filterHeld * 4,
    "open=" + filterOpen.toFixed(0) + "Hz held=" + filterHeld.toFixed(0) + "Hz back=" + filterReleased.toFixed(0) + "Hz");

  await tapPad(page, 0);
  await page.locator("#fx-roll").hover();
  await page.mouse.down();
  await page.waitForTimeout(500);
  const rolling = await page.evaluate(() => document.getElementById("fx-roll").classList.contains("is-on"));
  await page.mouse.up();
  await page.waitForTimeout(100);
  const rolled = await page.evaluate(() => document.getElementById("fx-roll").classList.contains("is-on"));
  check("ROLL runs while held and stops on release", rolling && !rolled, "held=" + rolling + " after=" + rolled);

  // ---- MIC mode records over a pad that already has a sound, keeping its part
  await page.evaluate(() => {
    const pad = window.LoopLab.padAt(1);
    Engine.setRow(pad.id, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], false);
  });
  const before = await page.evaluate(() => {
    const pad = window.LoopLab.padAt(1);
    return { id: pad.id, steps: (Engine.rows()[pad.id] || { steps: [] }).steps.slice() };
  });
  await page.click("#btn-mic");
  await holdPad(page, 1, 800);
  await page.waitForFunction((id) => window.LoopLab.padAt(1) && window.LoopLab.padAt(1).id !== id,
    before.id, { timeout: 20000 });
  const after = await page.evaluate(() => {
    const pad = window.LoopLab.padAt(1);
    return { id: pad.id, steps: (Engine.rows()[pad.id] || { steps: [] }).steps, count: window.LoopLab.pads().length };
  });
  check("MIC mode records over a full pad", after.id !== before.id && after.count === 4,
    after.count + " pads, slot 1 replaced");
  check("the replaced pad keeps its part",
    JSON.stringify(after.steps) === JSON.stringify(before.steps),
    before.steps.filter(Boolean).length + " steps -> " + after.steps.filter(Boolean).length);
  await page.click("#btn-mic");

  // ---- chop a take across the empty pads
  const chopped = await page.evaluate(() => {
    const pad = window.LoopLab.padAt(0);
    const beforeCount = window.LoopLab.pads().length;
    window.LoopLab.chop(pad);
    return { before: beforeCount, after: window.LoopLab.pads().length };
  });
  check("chop fills the empty pads with slices", chopped.after > chopped.before,
    chopped.before + " -> " + chopped.after + " pads");

  // ---- bounce
  await page.click("#btn-settings");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.click("#btn-bounce"),
  ]);
  const wavPath = path.join(OUT, "bounce.wav");
  await download.saveAs(wavPath);
  const wav = fs.readFileSync(wavPath);
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let peak = 0;
  let sum = 0;
  const frames = (wav.length - 44) / 4;
  for (let i = 0; i < frames; i++) {
    const v = view.getInt16(44 + i * 4, true) / 32768;
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  const rms = Math.sqrt(sum / frames);
  check("bounce downloads a wav", wav.slice(0, 4).toString() === "RIFF" && wav.length > 200000,
    (wav.length / 1048576).toFixed(2) + " MB, " + download.suggestedFilename());
  check("bounce is audible and does not clip", peak > 0.3 && peak < 0.999,
    "peak=" + peak.toFixed(3) + " rms=" + rms.toFixed(3));
  check("bounce is not squashed flat", 20 * Math.log10(peak / rms) > 8,
    "crest factor " + (20 * Math.log10(peak / rms)).toFixed(1) + " dB");

  // ---- survives a reload
  await page.waitForTimeout(1200);
  const kitBefore = await page.evaluate(() => window.LoopLab.pads().map((p) => p.slot + ":" + p.name).join(" "));
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.LoopLab && window.LoopLab.pads().length > 0, { timeout: 20000 });
  await page.waitForTimeout(600);
  const kitAfter = await page.evaluate(() => ({
    kit: window.LoopLab.pads().map((p) => p.slot + ":" + p.name).join(" "),
    steps: Object.values(Engine.rows()).reduce((n, r) => n + r.steps.filter(Boolean).length, 0),
    instrument: window.LoopLab.padAt(0) && window.LoopLab.padAt(0).instrument,
  }));
  check("the kit comes back where it was", kitAfter.kit === kitBefore, kitAfter.kit);
  check("the pattern comes back", kitAfter.steps > 0, kitAfter.steps + " steps");
  check("the chosen instrument comes back", kitAfter.instrument === "kick", kitAfter.instrument);

  // ---- screenshots
  await page.screenshot({ path: path.join(OUT, "phone.png") });
  await page.evaluate(() => window.LoopLab.openEditor(0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "editor.png") });
  await page.click("#editor-close");
  await page.setViewportSize({ width: 1100, height: 820 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "desktop.png") });

  check("no console or page errors", errors.length === 0, errors.slice(0, 5).join(" || ") || "clean");

  await browser.close();
  server.close();
  console.log("\nartifacts in " + OUT);
  console.log(fails ? fails + " FAILURES" : "all green");
  process.exit(fails ? 1 : 0);
})().catch((err) => {
  console.error("HARNESS ERROR", err);
  process.exit(2);
});
