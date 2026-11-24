/* End-to-end test of a personal copy of the extension: one that knows some colleges by name and
 * starts with a list. Uses made-up colleges (fixtures/example-colleges.json) pointing at the
 * pretend portals, built with the same `pack.py --personal` that builds a real person's copy.
 *
 *   node portals-extension/test/personal.test.js
 *
 * Covers: seeding the list on first open (and never again), a list of just names, the guided
 * walk-through that sets up each college in turn, everything surviving a reopen, and the cards
 * refreshing by themselves.
 */

const { chromium } = (function () {
  for (const name of ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(name); } catch (err) { /* try the next one */ }
  }
  console.error("playwright not found — install it with `npm i -D playwright`");
  process.exit(2);
})();
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const Portals = require("../portals.js");
const { PORT, TEST_PASSWORD, status, startServer } = require("./fakeportals.js");

const EXT = path.resolve(__dirname, "..");
const PACK = path.join(EXT, "pack.py");
const FIXTURE = path.join(__dirname, "fixtures", "example-colleges.json");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "portals-personal-test-"));

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let diagnose = async () => "";
async function until(fn, ms, what) {
  const end = Date.now() + (ms || 15000);
  for (;;) {
    let v;
    try { v = await fn(); } catch (err) { v = false; }
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out waiting for " + (what || fn.toString()) + (await diagnose().catch(() => "")));
    await sleep(100);
  }
}
const errors = [];

// ------------------------------------------------------------------ building a personal copy

const pack = (args) => spawnSync("python3", [PACK].concat(args), { encoding: "utf8" });
{
  const zip = path.join(OUT, "mine.zip");
  const r = pack(["--personal", FIXTURE, "--out", zip]);
  check("a personal copy builds", r.status === 0 && fs.existsSync(zip), (r.stdout + r.stderr).trim());

  const dir = path.join(OUT, "unzipped");
  spawnSync("python3", ["-m", "zipfile", "-e", zip, dir]);
  const colleges = fs.readFileSync(path.join(dir, "portals-extension", "colleges.js"), "utf8");
  const starter = fs.readFileSync(path.join(dir, "portals-extension", "starter.js"), "utf8");
  check("it carries the colleges and the starter list", /Alpha College/.test(colleges) && /Beta University/.test(colleges) && /Alpha College\\nBeta University\\nGamma Institute/.test(starter), starter.trim());
  check("the public files in the repo are untouched and empty", /var COLLEGES = \[\];/.test(fs.readFileSync(path.join(EXT, "colleges.js"), "utf8")) && /var STARTER = "";/.test(fs.readFileSync(path.join(EXT, "starter.js"), "utf8")));
  check("the public zip doesn't contain them", pack(["--check"]).status === 0);

  const bad = {
    "an address that isn't a web address": { colleges: [{ name: "X", url: "javascript:alert(1)", colors: [] }] },
    "a colour that isn't one": { colleges: [{ name: "X", url: "https://x.edu", colors: ["red"] }] },
    "no colleges": { colleges: [] },
    "a starter name that isn't a college": { colleges: [{ name: "X", url: "https://x.edu", colors: [] }], starter: ["Y"] },
    "a college with no name": { colleges: [{ name: " ", url: "https://x.edu", colors: [] }] },
  };
  for (const [what, data] of Object.entries(bad)) {
    const f = path.join(OUT, "bad.json");
    fs.writeFileSync(f, JSON.stringify(data));
    const rr = pack(["--personal", f, "--out", path.join(OUT, "bad.zip")]);
    check("building refuses " + what, rr.status !== 0 && !!(rr.stderr || rr.stdout).trim(), (rr.stderr || rr.stdout).trim().slice(0, 80));
  }
  fs.rmSync(path.join(OUT, "bad.zip"), { force: true });
}
const LOAD = path.join(OUT, "unzipped", "portals-extension");

// ------------------------------------------------------------------------- the run

(async () => {
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "portals-personal-profile-"));
  fs.mkdirSync(path.join(profile, "Default"), { recursive: true });
  fs.writeFileSync(path.join(profile, "Default", "Preferences"), JSON.stringify({
    credentials_enable_service: false, credentials_enable_autosignin: false,
    profile: { password_manager_enabled: false, password_manager_leak_detection: false },
    safebrowsing: { enabled: false },
  }));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true, viewport: { width: 1100, height: 800 },
    args: ["--disable-extensions-except=" + LOAD, "--load-extension=" + LOAD],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");

  const watch = (p) => {
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/Refused to display|Failed to load resource|favicon/.test(m.text())) errors.push("console: " + m.text()); });
  };
  async function openHub() {
    const [page] = await Promise.all([ctx.waitForEvent("page"), sw.evaluate(() => openHub())]);
    watch(page);
    await page.waitForLoadState("domcontentloaded");
    return page;
  }
  let hub = await openHub();
  const text = (sel) => hub.$eval(sel, (e) => e.textContent.trim());
  const vis = (sel) => hub.isVisible(sel);
  const stored = () => hub.evaluate(() => chrome.storage.local.get(["portals", "readings", "seeded"]));
  const pframe = () => hub.frames().find((f) => f !== hub.mainFrame() && /^https?:/.test(f.url()));
  const cardText = (n) => hub.$eval(".card:nth-child(" + n + ")", (e) => e.innerText);
  const brand = (n) => hub.$eval(".card:nth-child(" + n + ")", (e) => e.style.getPropertyValue("--brand"));
  diagnose = async () => "\n  frames: " + hub.frames().map((f) => f.url()).join(" | ") + "\n  guide: " + (await hub.$eval("#guide-text", (e) => e.textContent).catch(() => "?"));

  // ---- first open: the list is already there, from names alone
  await hub.waitForSelector(".card:nth-child(3)");
  check("the first time it opens the list is already in, with no editing", !(await vis("#v-editor")) && (await hub.$$(".card")).length === 3);
  check("the cards are the colleges, by their full names, in order", (await hub.$$eval(".card strong", (els) => els.map((e) => e.textContent))).join() === "Alpha College,Beta University,Gamma Institute");
  check("each is at the address the directory gave it", (await hub.$$eval(".card .fine", (els) => els.map((e) => e.textContent))).every((h) => h === "127.0.0.1:" + PORT));
  const st0 = await stored();
  check("the addresses were filled in from the directory, not typed", st0.portals.map((p) => p.url).join() === ["http://127.0.0.1:9201/duke/", "http://127.0.0.1:9201/spa/", "http://127.0.0.1:9201/plain/"].join());
  check("each card has its own colours from the directory", (await brand(1)) === "#0b6e4f" && (await brand(2)) === "#4f2683" && (await brand(3)) === "#c8102e", [await brand(1), await brand(2), await brand(3)].join(" "));
  await sleep(1500);
  const st1 = await stored();
  check("the directory's colours are kept, not replaced by what the icons say", st1.portals[0].colors.from === "directory" && st1.portals[0].colors.primary === "#0b6e4f" && !st1.portals[0].colors.auto);
  check("it was saved the first time, and marked so it is never put in again", st1.seeded === true && st1.portals.length === 3);

  // ---- the list box shows names only
  await hub.click("#btn-edit");
  check("the list box is just the names", (await hub.inputValue("#list")) === "Alpha College\nBeta University\nGamma Institute", await hub.inputValue("#list"));
  await hub.fill("#list", "alpha\nbt\nSomewhere Unknown");
  await hub.click("#btn-save");
  check("a name it doesn't know is refused, with its line", /Line 3/.test(await text("#e-list")) && /don't know that college/.test(await text("#e-list")));
  check("…and nothing is lost by that", (await stored()).portals.length === 3);
  await hub.fill("#list", "alpha\nBT\nGamma http://127.0.0.1:9201/hop/");
  await hub.click("#btn-save");
  await hub.waitForSelector("#v-overview:not([hidden])");
  const st2 = await stored();
  check("short names and abbreviations work, and what you typed is not what's kept", st2.portals.map((p) => p.name).join() === "Alpha College,Beta University,Gamma");
  check("an address typed for a known college is used", st2.portals[2].url === "http://127.0.0.1:9201/hop/");
  check("…and it keeps the college's colours", st2.portals[2].colors.primary === "#c8102e");
  check("the same ids as before: editing doesn't throw away what was set up", st2.portals[0].id === st0.portals[0].id && st2.portals[1].id === st0.portals[1].id);

  // ---- guided setup: sign in, click the status, on to the next
  check("the page says what to do next", await vis("#setup-banner") && /set up each college/.test(await text("#setup-text")));
  await hub.click("#btn-setup");
  await hub.waitForSelector("#v-viewer:not([hidden])");
  check("it starts on the first college, with instructions", (await text("#v-name")) === "Alpha College" && await vis("#guide") && /Setting up Alpha College \(3 left\)/.test(await text("#guide-text")), await text("#guide-text"));
  await until(async () => pframe() && pframe().url().includes("/duke/login") && (await pframe().locator("#go").count()) === 1, 10000, "alpha login form");
  await pframe().fill('input[name="u"]', "jack");
  await pframe().fill('input[name="p"]', TEST_PASSWORD);
  await pframe().click("#go");
  await until(async () => pframe() && pframe().url().includes("/duke/status") && (await pframe().locator("#appstatus").count()) === 1, 10000, "alpha status page");
  await hub.click("#btn-pick");
  await pframe().click("#appstatus");
  await until(async () => (await text("#v-name")) === "Beta University", 8000, "advance to the second college");
  check("picking a status saves it and moves straight on to the next college", /Saved Alpha College\./.test(await text("#guide-text")) && /Setting up Beta University \(2 left\)/.test(await text("#guide-text")), await text("#guide-text"));
  check("…the first one is saved", (await stored()).portals[0].selector === "#appstatus");

  await hub.click("#btn-skip");
  await until(async () => (await text("#v-name")) === "Gamma", 8000, "skip to the third");
  check("Skip moves on without saving, leaving that one still to do", (await stored()).portals[1].selector === "" && /Setting up Gamma \(2 left\)/.test(await text("#guide-text")), await text("#guide-text"));
  await until(async () => pframe() && pframe().url().includes("/hop/status") && (await pframe().locator("#appstatus").count()) === 1, 10000, "gamma status page");
  await hub.click("#btn-pick");
  await pframe().click("#appstatus");
  await until(async () => await vis("#v-overview"), 8000, "setup finishing at the overview");
  check("after the last one the walk-through ends at the overview", !(await vis("#v-viewer")) && !(await vis("#guide")));
  check("the colleges set up show their status as a graphic", (await hub.$eval(".card:nth-child(1) li.now", (e) => e.textContent)) === "In review" && (await hub.$eval(".card:nth-child(3) li.waitlisted", (e) => e.textContent)) === "Waitlisted");
  check("the one that was skipped is still waiting, and the page says so", /1 of 3 colleges still need setting up/.test(await text("#setup-text")) && /Not set up yet/.test(await cardText(2)));

  await hub.click("#btn-setup");
  await hub.waitForSelector("#v-viewer:not([hidden])");
  check("Start setup picks up the one left", (await text("#v-name")) === "Beta University" && /\(1 left\)/.test(await text("#guide-text")));
  await hub.click("#btn-stop-setup");
  check("Stop setup goes back to the overview", await vis("#v-overview") && !(await vis("#guide")) && await vis("#setup-banner"));

  // ---- saved each time
  await hub.click("#btn-edit");
  await hub.fill("#list", (await hub.inputValue("#list")).split("\n").filter((l) => !/^Beta/.test(l)).join("\n"));
  await hub.click("#btn-save");
  await hub.waitForSelector("#v-overview:not([hidden])");
  check("deleting a college from the list works", (await hub.$$(".card")).length === 2 && !(await vis("#setup-banner")));
  const before = await stored();
  await hub.close();
  hub = await openHub();
  await hub.waitForSelector(".card:nth-child(2)");
  const after = await stored();
  check("reopening keeps the list, what was set up, and the last readings", after.portals.length === 2 && after.portals[0].selector === "#appstatus" && after.readings[after.portals[0].id].text === "Under review" && JSON.stringify(after.portals) === JSON.stringify(before.portals));
  check("…and it does not put the starter list back", (await hub.$$(".card")).length === 2 && after.seeded === true);
  check("the cards show the saved status straight away", /Under review/.test(await cardText(1)) && /Waitlisted/.test(await cardText(2)));

  // ---- it updates by itself
  await hub.clock.install();
  await hub.reload();
  await hub.waitForSelector(".card:nth-child(2)");
  await sleep(500);
  const idle = (await stored()).readings;
  check("a hub that was just checked doesn't start checking again", !(await text("#btn-refresh")).startsWith("Checking"));
  status.duke = "Admitted";
  await sleep(2500);
  check("negative control: the portal changed, but it isn't looked at again until it is due", /Under review/.test(await cardText(1)) && !/Admitted/.test(await cardText(1)), (await cardText(1)).replace(/\n/g, " | "));
  await hub.clock.setSystemTime(new Date(Date.now() + 16 * 60 * 1000));
  await hub.clock.fastForward(61 * 1000);
  await until(async () => /Admitted/.test(await cardText(1)), 60000, "automatic refresh");
  check("sixteen minutes later it checks again by itself and shows the change", /Admitted/.test(await cardText(1)) && /Changed .*was .Under review./.test(await cardText(1)), (await cardText(1)).replace(/\n/g, " | "));
  const refreshed = (await stored()).readings;
  const idKey = Object.keys(idle)[0];
  check("the time it was last checked moved on", refreshed[idKey].tried > idle[idKey].tried);
  await hub.screenshot({ path: path.join(OUT, "personal-overview.png") });

  check("no errors in the hub or the background script", errors.length === 0, errors.join(" | "));
  await ctx.close();
  server.close();
  console.log("\nscreenshots: " + OUT);
  console.log(fails ? fails + " FAILED" : "all passed");
  process.exit(fails ? 1 : 0);
})().catch((err) => { console.error(err); if (errors.length) console.error("errors seen:\n  " + errors.join("\n  ")); process.exit(1); });
