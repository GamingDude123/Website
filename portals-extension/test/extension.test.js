/* End-to-end test: the real extension, loaded into a real Chromium.
 *
 *   node portals-extension/test/extension.test.js
 *
 * Serves some pretend applicant portals that behave like real ones: they refuse to
 * be framed (X-Frame-Options and CSP frame-ancestors), want a login, keep the
 * session in a SameSite=Lax cookie, hop between hosts, and draw their status late.
 * Then it drives the hub: framing them, signing in, picking the status, checking
 * them all, spotting a change, and drawing each card in its icon's colours.
 *
 * Needs playwright with a chromium that supports extensions (the full "chromium"
 * channel, which runs the new headless mode):
 *   npm i -D playwright && npx playwright install chromium
 * Screenshots are left in a temp directory, which it prints when it finishes.
 */

const { chromium } = (function () {
  const candidates = ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"];
  for (const name of candidates) {
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
const { PORT, BASE, TEST_PASSWORD, status, startServer } = require("./fakeportals.js");

const EXT = path.resolve(__dirname, "..");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "portals-ext-test-"));


let fails = 0;
const errors = [];   // page and console errors from the hub, shown if the run falls over
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let diagnose = async () => "";   // set once the hub exists: says where the frames are when a wait times out
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
const near = (hex, want, tol) => {
  const a = Portals && [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(want.slice(i, i + 2), 16));
  return a.every((v, i) => Math.abs(v - b[i]) <= tol);
};

// ------------------------------------------------------------------ static checks

{
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
  check("manifest v3", manifest.manifest_version === 3);
  check("it asks for exactly two permissions", JSON.stringify(manifest.permissions.slice().sort()) === JSON.stringify(["declarativeNetRequest", "storage"]), JSON.stringify(manifest.permissions));
  check("…and no cookies, history, tabs, scripting or web-request access", !["cookies", "history", "tabs", "scripting", "webRequest", "webRequestBlocking", "activeTab", "nativeMessaging", "downloads"].some((p) => (manifest.permissions || []).includes(p)));
  check("it reads web pages only, never browser pages", JSON.stringify(manifest.host_permissions) === JSON.stringify(["http://*/*", "https://*/*"]));
  check("one content script, and it is reader.js", manifest.content_scripts.length === 1 && JSON.stringify(manifest.content_scripts[0].js) === '["reader.js"]');
  check("nothing is exposed to web pages", !manifest.web_accessible_resources && !manifest.externally_connectable);

  const files = fs.readdirSync(EXT).filter((f) => /\.(js|html|css|json)$/.test(f));
  const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(EXT, f), "utf8")]));
  const code = (f) => src[f].replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");   // without comments
  const netApis = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts)/;
  check("the page-reading script and the background script make no network requests", !netApis.test(code("reader.js")) && !netApis.test(code("background.js")) && !netApis.test(code("portals.js")));
  const fetches = (code("hub.js").match(/\bfetch\s*\(/g) || []).length;
  check("the hub makes exactly two kinds of request (a portal's page and its icon); a new one fails this until reviewed", fetches === 2, fetches);
  check("no eval, Function(), document.write or HTML injection anywhere", files.every((f) => !/\b(eval\s*\(|new Function|document\.write|innerHTML|outerHTML|insertAdjacentHTML)/.test(code(f))));
  check("the hub page loads nothing from the network", !/(src|href)=["']https?:/.test(src["hub.html"]) && !/url\(\s*["']?https?:/.test(src["hub.css"]));
}

// ------------------------------------------------------------------ the download

const ZIP = path.resolve(EXT, "..", "portals-extension.zip");
{
  const r = spawnSync("python3", [path.join(EXT, "pack.py"), "--check"], { encoding: "utf8" });
  check("portals-extension.zip is up to date with the folder, and nothing is left out of it", r.status === 0, (r.stdout + r.stderr).trim());
}
// The extension is loaded from the unzipped download, so what people install is what gets tested.
const UNZIPPED = fs.mkdtempSync(path.join(os.tmpdir(), "portals-ext-unzipped-"));
spawnSync("python3", ["-m", "zipfile", "-e", ZIP, UNZIPPED]);
const LOAD = path.join(UNZIPPED, "portals-extension");
check("the zip unzips to a folder Chrome can load", fs.existsSync(path.join(LOAD, "manifest.json")) && fs.existsSync(path.join(LOAD, "hub.html")));

// ------------------------------------------------------------------------- the run

(async () => {
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "portals-ext-profile-"));
  // Keep Chrome's own password prompts (save, breach warnings) out of the test browser.
  fs.mkdirSync(path.join(profile, "Default"), { recursive: true });
  fs.writeFileSync(path.join(profile, "Default", "Preferences"), JSON.stringify({
    credentials_enable_service: false,
    credentials_enable_autosignin: false,
    profile: { password_manager_enabled: false, password_manager_leak_detection: false },
    safebrowsing: { enabled: false },
  }));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1100, height: 800 },
    args: ["--disable-extensions-except=" + LOAD, "--load-extension=" + LOAD],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  const id = sw.url().split("/")[2];
  check("the extension loads", /^[a-p]{32}$/.test(id), id);

  const hosts = new Set();
  ctx.on("request", (r) => {
    const u = new URL(r.url());
    if (/^https?:$/.test(u.protocol)) hosts.add(u.host);
  });
  const watch = (p) => {
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    p.on("console", (m) => {
      // Portals that refuse framing (or the baseline check below) make the browser log this on purpose.
      if (m.type() === "error" && !/Refused to display|Failed to load resource|favicon/.test(m.text())) errors.push("console: " + m.text());
    });
  };
  const swErrors = [];
  sw.on?.("console", (m) => { if (m.type() === "error") swErrors.push(m.text()); });

  // ---- baseline: a normal page can't frame these portals (so the hub is doing something)
  const ctl = await ctx.newPage();
  await ctl.route("http://ctl.test/", (r) => r.fulfill({ contentType: "text/html", body: '<iframe src="' + BASE + '/duke/login"></iframe>' }));
  await ctl.goto("http://ctl.test/");
  await sleep(800);
  check("control: an ordinary page is refused when it tries to frame a portal", ctl.frames().some((f) => f.url().startsWith("chrome-error:")), ctl.frames().map((f) => f.url()).join(" | "));
  await ctl.close();

  // ---- opening the hub
  async function openHub() {
    const [page] = await Promise.all([ctx.waitForEvent("page"), sw.evaluate(() => openHub())]);
    watch(page);
    await page.waitForLoadState("domcontentloaded");
    return page;
  }
  let hub = await openHub();
  check("the toolbar button opens the hub", hub.url() === "chrome-extension://" + id + "/hub.html", hub.url());
  await sw.evaluate(() => openHub());
  await sleep(600);
  check("pressing it again jumps to the open hub instead of opening another", ctx.pages().filter((p) => p.url().endsWith("/hub.html")).length === 1);
  const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getSessionRules());
  check("one framing rule exists, and it covers the hub's own tab only", rules.length === 1 && rules[0].condition.tabIds.length === 1 && rules[0].condition.resourceTypes.join() === "sub_frame" && !rules[0].condition.requestDomains, JSON.stringify(rules.map((r) => r.condition)));

  diagnose = async () => "\n  frames: " + hub.frames().map((f) => f.url()).join(" | ") + "\n  view: " + (await hub.evaluate(() => ["overview", "viewer", "editor"].filter((v) => !document.getElementById("v-" + v).hidden).join())) + "\n  frame src: " + (await hub.$eval("#frame", (f) => f.getAttribute("src")));
  const text = (sel) => hub.$eval(sel, (e) => e.textContent.trim());
  const vis = (sel) => hub.isVisible(sel);
  const stored = () => hub.evaluate(() => chrome.storage.local.get(["portals", "readings"]));
  const pframe = () => hub.frames().find((f) => f !== hub.mainFrame() && /^https?:/.test(f.url()));
  const cardText = (n) => hub.$eval(".card:nth-child(" + n + ")", (e) => e.innerText);
  const clickCard = (n) => hub.click(".card:nth-child(" + n + ") button");

  // ---- first run: type the list
  await hub.waitForSelector("#v-editor:not([hidden])");
  check("first run opens the editor", await vis("#v-editor") && (await hub.inputValue("#list")) === "");
  await hub.fill("#list", "Duke " + BASE + "/duke/\nJust a name\nEvil javascript:alert(1)");
  await hub.click("#btn-save");
  const err = await text("#e-list");
  check("bad lines are reported with their numbers and nothing is saved", /Line 2/.test(err) && /Line 3/.test(err) && !(await stored()).portals);
  await hub.fill("#list", [
    "Duke " + BASE + "/duke/",
    "Spa " + BASE + "/spa/",
    "Plain " + BASE + "/plain/",
    "Hop " + BASE + "/hop/",
    "Locked " + BASE + "/locked/ #00539b #ffb81c",
  ].join("\n"));
  await hub.click("#btn-save");
  await hub.waitForSelector("#v-overview:not([hidden])");
  check("five cards, none set up yet", (await hub.$$(".card")).length === 5 && (await cardText(1)).includes("Not set up yet"));

  // ---- each card takes its colours from its own icon
  await until(async () => (await stored()).portals.every((p) => p.colors), 20000, "colours");
  const portals = (await stored()).portals;
  const byName = Object.fromEntries(portals.map((p) => [p.name, p]));
  check("Duke: blue and gold, read from its SVG icon", near(byName.Duke.colors.primary, "#001a57", 12) && near(byName.Duke.colors.secondary, "#ffb81c", 12), JSON.stringify(byName.Duke.colors));
  check("Plain: crimson, read from its apple-touch-icon PNG", near(byName.Plain.colors.primary, "#c8102e", 20), JSON.stringify(byName.Plain.colors));
  check("Spa: purple, from /favicon.ico when the page names no icon", near(byName.Spa.colors.primary, "#4f2683", 12), JSON.stringify(byName.Spa.colors));
  check("Hop: no icon anywhere, so it is marked and falls back to the default blue", byName.Hop.colors.failed === true);
  check("Locked: the colours typed in the list are used as typed", byName.Locked.colors.primary === "#00539b" && byName.Locked.colors.secondary === "#ffb81c" && byName.Locked.colors.manual === true);
  const brand = (n) => hub.$eval(".card:nth-child(" + n + ")", (e) => [e.style.getPropertyValue("--brand"), e.style.getPropertyValue("--accent")]);
  const bd = await brand(1);
  check("Duke's card is drawn in them", bd[0] === Portals.brandFor(byName.Duke.colors).main && bd[1] === Portals.brandFor(byName.Duke.colors).accent && bd[0] !== bd[1], bd.join(" / "));
  check("a pale gold accent is darkened until it shows on white", Portals.contrast(bd[1], "#ffffff") >= 3);
  check("the card with no icon uses the default blue", (await brand(4))[0] === "#1a5fb4");

  // ---- the portal view: frames portals that forbid framing, and the arrows cycle
  await clickCard(1);
  await hub.waitForSelector("#v-viewer:not([hidden])");
  await until(() => pframe() && pframe().url().includes("/duke/login"), 10000, "duke login in frame");
  check("a portal that forbids framing shows up inside the hub", (await pframe().locator('input[type="password"]').count()) === 1);
  check("the header names it", (await text("#v-name")) === "Duke" && (await text("#v-count")) === "1 of 5");
  check("Check all is not offered while looking at a portal, since it would take over the frame", !(await vis("#btn-refresh")));
  check("Open in a tab is a real link that leaks nothing", (await hub.getAttribute("#btn-tab", "href")) === BASE + "/duke/" && (await hub.getAttribute("#btn-tab", "target")) === "_blank" && /noopener/.test(await hub.getAttribute("#btn-tab", "rel")));
  const sandbox = await hub.getAttribute("#frame", "sandbox");
  check("the frame can't navigate the hub away", !/allow-top-navigation/.test(sandbox), sandbox);

  await hub.click("#btn-next");
  check("the right arrow goes to the next portal", (await text("#v-name")) === "Spa" && (await text("#v-count")) === "2 of 5");
  await until(() => pframe() && pframe().url().includes("/spa/"), 10000, "spa in frame");
  await hub.click("#btn-prev");
  await hub.click("#btn-prev");
  check("the left arrow wraps from the first to the last", (await text("#v-name")) === "Locked" && (await text("#v-count")) === "5 of 5");
  await hub.click("#btn-next");
  check("…and the right arrow wraps back", (await text("#v-name")) === "Duke");
  await hub.click("#v-name");
  await hub.keyboard.press("ArrowRight");
  check("the arrow keys work too", (await text("#v-name")) === "Spa");
  await hub.keyboard.press("ArrowLeft");

  // ---- sign in inside the frame (the password manager's job in real life)
  await until(() => pframe() && pframe().url().includes("/duke/login"), 10000, "duke login again");
  await pframe().fill('input[name="u"]', "jack");
  await pframe().fill('input[name="p"]', TEST_PASSWORD);
  await pframe().click("#go");
  await until(async () => pframe() && pframe().url().includes("/duke/status") && (await pframe().locator("#appstatus").count()) === 1, 10000, "duke status page");
  check("signing in inside the frame works: the session cookie carries to the next page", (await pframe().textContent("#appstatus")) === "Under review");

  // ---- pick the status
  await hub.click("#btn-pick");
  check("picking shows instructions", await vis("#pick-help"));
  check("the portal page shows the picker banner", await pframe().evaluate(() => /Click the status/.test(document.documentElement.innerText)));
  await pframe().click("#appstatus");
  await until(async () => (await stored()).portals.find((p) => p.name === "Duke").selector, 5000, "picked selector");
  const duke = (await stored()).portals.find((p) => p.name === "Duke");
  check("the pick is remembered as a short, stable selector", duke.selector === "#appstatus", duke.selector);
  check("…and its words are read straight away", (await stored()).readings[duke.id].text === "Under review" && !(await vis("#pick-help")));
  check("the picker is gone from the portal page", !(await pframe().evaluate(() => /Click the status/.test(document.documentElement.innerText))));
  check("the viewer shows the status it read", /Under review/.test(await text("#v-note")));

  // Escape cancels picking and changes nothing, whether the key reaches the hub or the portal's page.
  await hub.click("#btn-pick");
  await hub.keyboard.press("Escape");
  await until(async () => !(await vis("#pick-help")), 5000, "pick cancelled from the hub");
  check("Escape in the hub cancels picking but stays on the portal", await vis("#v-viewer") && (await text("#v-name")) === "Duke");
  check("…and the banner leaves the portal page", await until(async () => !(await pframe().evaluate(() => /Click the status/.test(document.documentElement.innerText))), 5000).then(() => true).catch(() => false));
  await hub.click("#btn-pick");
  await pframe().evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  await until(async () => !(await vis("#pick-help")), 5000, "pick cancelled from the page");
  check("Escape on the portal's page cancels it too", (await stored()).portals.find((p) => p.name === "Duke").selector === "#appstatus" && await vis("#v-viewer"));
  await hub.click("#v-name");
  await hub.keyboard.press("Escape");
  await sleep(200);
  check("Escape with nothing being picked goes back to the overview", await vis("#v-overview") && !(await vis("#v-viewer")));
  await clickCard(1);
  await until(() => pframe() && pframe().url().includes("/duke/status"), 10000, "duke status again");

  // ---- set up the others the same way
  async function setUp(n, name, user, picker) {
    await hub.click("#btn-overview");
    await clickCard(n);
    await until(() => pframe() && pframe().url().includes("/" + name + "/"), 10000, name + " in frame");
    if (user) {
      await until(async () => pframe() && pframe().url().includes("/login") && (await pframe().locator("#go").count()) === 1, 10000, name + " login form");
      await pframe().fill('input[name="u"]', "jack");
      await pframe().fill('input[name="p"]', TEST_PASSWORD);
      await pframe().click("#go");
    }
    await until(async () => pframe() && pframe().url().includes("/status") && (await pframe().locator(picker).count()) === 1, 10000, name + " status page");
    await hub.click("#btn-pick");
    await pframe().click(picker);
    await until(async () => (await stored()).portals.find((p) => p.name === name[0].toUpperCase() + name.slice(1)).selector, 5000, name + " picked");
  }
  await setUp(2, "spa", true, "#appstatus");
  await setUp(3, "plain", true, "p.x-998877");
  await setUp(4, "hop", false, "#appstatus");
  const st = await stored();
  const sel = Object.fromEntries(st.portals.map((p) => [p.name, p.selector]));
  check("a late-drawn status is found once it appears", sel.Spa === "#appstatus" && st.readings[st.portals[1].id].text === "Application received");
  check("a status with no id gets a path that matches only it", sel.Plain === "p:nth-of-type(2)" && st.readings[st.portals[2].id].text === "Submitted", sel.Plain);
  check("a portal that redirects to another host works too", (await pframe().url()).startsWith("http://localhost:" + PORT + "/hop/status") && sel.Hop === "#appstatus" && st.readings[st.portals[3].id].text === "Waitlisted");

  // Locked is never signed in to. Give it a pick directly, as if picked on an earlier visit.
  await hub.evaluate(async () => {
    const d = await chrome.storage.local.get("portals");
    d.portals.find((p) => p.name === "Locked").selector = "#appstatus";
    await chrome.storage.local.set(d);
  });

  // ---- come back later: it checks every portal by itself, using the saved sessions
  await hub.close();
  check("closing the hub removes its framing rule", await until(async () => (await sw.evaluate(() => chrome.declarativeNetRequest.getSessionRules())).length === 0, 5000).then(() => true).catch(() => false));
  hub = await openHub();
  await until(async () => (await hub.$eval("#btn-refresh", (b) => b.textContent)) === "Checking…", 8000, "auto-check starting");
  check("opening the hub checks the portals by itself, in turn, saying so", (await cardText(1)).length > 0);
  await hub.screenshot({ path: path.join(OUT, "checking.png") });
  await until(async () => (await hub.$eval("#btn-refresh", (b) => b.textContent)) === "Check all", 60000, "auto-check finishing");
  const cards = [1, 2, 3, 4, 5];
  const ct = {};
  for (const n of cards) ct[n] = await cardText(n);
  check("Duke: signed in from the saved session, status read", /Under review/.test(ct[1]) && /Checked just now/.test(ct[1]), ct[1].replace(/\n/g, " | "));
  check("Spa: its late status was waited for", /Application received/.test(ct[2]) && /Checked just now/.test(ct[2]));
  check("Plain: read", /Submitted/.test(ct[3]));
  check("Hop: read, from the other host its status page is on", /Waitlisted/.test(ct[4]));
  check("Locked: not signed in, so it says so rather than guessing", /Sign in needed/.test(ct[5]) && !/Checked/.test(ct[5]), ct[5].replace(/\n/g, " | "));
  check("the portal is not left running in the background afterwards", (await hub.$eval("#frame", (f) => f.getAttribute("src"))) === "about:blank");

  const stage = (n) => hub.$eval(".card:nth-child(" + n + ")", (e) => ({ now: (e.querySelector("li.now") || {}).textContent || "", done: e.querySelectorAll("li.done").length }));
  check("the graphic: Duke is in review (two steps done, step three current)", JSON.stringify(await stage(1)) === JSON.stringify({ now: "In review", done: 2 }), JSON.stringify(await stage(1)));
  check("the graphic: Spa is at Received", JSON.stringify(await stage(2)) === JSON.stringify({ now: "Received", done: 1 }));
  check("the graphic: Plain is at Submitted", JSON.stringify(await stage(3)) === JSON.stringify({ now: "Submitted", done: 0 }));
  check("the graphic: Hop is a waitlist decision", (await hub.$eval(".card:nth-child(4) li.waitlisted", (e) => e.textContent)) === "Waitlisted");
  check("the graphic: Locked has no progress to show", (await hub.$$(".card:nth-child(5) li.now, .card:nth-child(5) li.done")).length === 0);
  await hub.screenshot({ path: path.join(OUT, "overview-1.png") });

  // ---- signing in happens in an ordinary tab (password managers don't fill forms shown inside another page)
  check("a college that needs a sign-in says what to do", /Sign in needed/.test(await cardText(5)) && /opens a tab/.test(await cardText(5)));
  check("…and its button says Sign in", (await hub.$eval(".card:nth-child(5) button", (b) => b.textContent)) === "Sign in");
  const readingsBefore = (await stored()).readings;
  const firstId = (await stored()).portals[0].id;
  const [tab] = await Promise.all([ctx.waitForEvent("page"), clickCard(5)]);
  await tab.waitForURL("**/locked/login");
  check("Sign in opens the college in an ordinary tab", /^https?:/.test(tab.url()) && !tab.url().startsWith("chrome-extension:"), tab.url());
  await tab.fill('input[name="u"]', "jack");
  await tab.fill('input[name="p"]', TEST_PASSWORD);
  await tab.click("#go");
  await tab.waitForURL("**/locked/status");
  await tab.close();
  // Coming back to the hub's tab (the browser fires this when you switch to it).
  await hub.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await until(async () => /Under review/.test(await cardText(5)) && !/Sign in needed/.test(await cardText(5)), 60000, "re-check after coming back");
  const locked2 = await cardText(5);
  check("coming back, the hub notices the sign-in and reads the status, without anyone pressing Check all", /Under review/.test(locked2) && /Checked just now/.test(locked2), locked2.replace(/\n/g, " | "));
  await until(async () => (await hub.$eval("#btn-refresh", (b) => b.textContent)) === "Check all", 60000, "re-check finishing");
  check("…and re-read only the college that was asking, not all of them", (await stored()).readings[firstId].tried === readingsBefore[firstId].tried);

  // ---- a change is spotted and shown
  status.duke = "Admitted";
  status.plain = "Under review";
  await hub.click("#btn-refresh");
  await until(async () => /Admitted/.test(await cardText(1)), 60000, "duke admitted");
  await until(async () => (await hub.$eval("#btn-refresh", (b) => b.textContent)) === "Check all", 60000, "second check finishing");
  const duke2 = await cardText(1);
  check("an admission decision lands on the last step, labelled and green", (await hub.$$(".card:nth-child(1) li.admitted")).length === 1 && (await hub.$eval(".card:nth-child(1) li.admitted", (e) => e.textContent)) === "Admitted");
  check("…with the portal's own words beside it", /Admitted/.test(duke2) && /Changed just now, was .Under review./.test(duke2), duke2.replace(/\n/g, " | "));
  check("a change from Submitted to Under review moves the graphic on", (await stage(3)).now === "In review");
  check("an unchanged portal says nothing about a change", !/Changed/.test(await cardText(2)));
  await hub.screenshot({ path: path.join(OUT, "overview-2.png") });

  // ---- noticing while you look
  status.spa = "Under review";
  await clickCard(2);
  await until(async () => /Under review/.test(await text("#v-note")), 15000, "passive read");
  check("looking at a portal notices a changed status without a check", (await stored()).readings[(await stored()).portals[1].id].text === "Under review");

  // ---- editing the list keeps what was set up
  await hub.click("#btn-edit");
  const box = await hub.inputValue("#list");
  check("the list box shows what you typed, colours included", box.split("\n").length === 5 && /Locked .*#00539b #ffb81c/.test(box), box);
  const before = (await stored()).portals;
  await hub.fill("#list", box.replace("Duke ", "Duke University ").split("\n").filter((l) => !l.startsWith("Locked")).join("\n"));
  await hub.click("#btn-save");
  await hub.waitForSelector("#v-overview:not([hidden])");
  const after = await stored();
  check("renaming keeps the pick, the reading and the colours", after.portals[0].id === before[0].id && after.portals[0].selector === "#appstatus" && after.portals[0].name === "Duke University" && !!after.portals[0].colors.primary && after.readings[before[0].id].text === "Admitted");
  check("removing a portal removes its saved reading too", after.portals.length === 4 && !(before[4].id in after.readings) && (await hub.$$(".card")).length === 4);

  // ---- a portal whose start page is not the page with the status: the pick remembers the page
  // "Deep" starts on a home page; the status is one click away. If checks loaded the start page the
  // status would never be found.
  await hub.click("#btn-edit");
  await hub.fill("#list", (await hub.inputValue("#list")) + "\nDeep " + BASE + "/deep/");
  await hub.click("#btn-save");
  await hub.waitForSelector(".card:nth-child(5)");
  const deepId = (await stored()).portals[4].id;
  await clickCard(5);
  await until(async () => pframe() && pframe().url().includes("/deep/login") && (await pframe().locator("#go").count()) === 1, 10000, "deep login form");
  await pframe().fill('input[name="u"]', "jack");
  await pframe().fill('input[name="p"]', TEST_PASSWORD);
  await pframe().click("#go");
  await until(async () => pframe() && pframe().url() === BASE + "/deep/" && (await pframe().locator("#go").count()) === 1, 10000, "deep home page");
  check("the start page of that portal has no status on it", (await pframe().locator("#appstatus").count()) === 0);
  await pframe().click("#go");        // the link to "Your application status"
  await until(async () => pframe() && pframe().url().endsWith("/deep/application/status") && (await pframe().locator("#appstatus").count()) === 1, 10000, "deep status page");
  await hub.click("#btn-pick");
  await pframe().click("#appstatus");
  await until(async () => (await stored()).portals[4].selector, 5000, "deep picked");
  const deep = (await stored()).portals[4];
  check("picking remembers the page it was on, not only where it started", deep.checkUrl === BASE + "/deep/application/status" && deep.url === BASE + "/deep/", JSON.stringify([deep.url, deep.checkUrl]));
  check("the card still shows the portal's own address, not the page it was picked on", (await hub.$eval(".card:nth-child(5) .fine", (e) => e.textContent)) === "127.0.0.1:" + PORT);
  await hub.click("#btn-start");
  await until(() => pframe() && pframe().url() === BASE + "/deep/", 10000, "back to the start page");
  check("the Start page button goes back to where it starts", pframe().url() === BASE + "/deep/");
  await hub.click("#btn-overview");
  await hub.click("#btn-refresh");
  await until(async () => (await hub.$eval("#btn-refresh", (b) => b.textContent)) === "Check all", 60000, "check all with the deep portal");
  const deepCard = await cardText(5);
  check("checking loads the remembered page, so the status is found", /Application complete/.test(deepCard) && /Checked just now/.test(deepCard) && !/Couldn't find/.test(deepCard), deepCard.replace(/\n/g, " | "));
  check("…and the card says Open, not Set up", /Open/.test(deepCard));
  await hub.click("#btn-edit");
  await hub.click("#btn-save");
  await hub.waitForSelector("#v-overview:not([hidden])");
  check("saving the list unchanged keeps the remembered page and the pick", (await stored()).portals[4].checkUrl === BASE + "/deep/application/status" && (await stored()).portals[4].selector === "#appstatus" && (await stored()).portals[4].id === deepId);

  // ---- a viewer screenshot, then clean up
  await clickCard(1);
  await until(() => pframe() && pframe().url().includes("/duke/status"), 10000, "duke status in viewer");
  await sleep(500);
  await hub.screenshot({ path: path.join(OUT, "viewer.png") });

  check("the hub only ever talked to the portals it was given", [...hosts].every((h) => ["127.0.0.1:" + PORT, "localhost:" + PORT, "ctl.test"].includes(h)), [...hosts].join(", "));
  check("no errors in the hub or the background script", errors.length === 0 && swErrors.length === 0, errors.concat(swErrors).join(" | "));

  await ctx.close();
  server.close();
  console.log("\nscreenshots: " + OUT);
  console.log(fails ? fails + " FAILED" : "all passed");
  process.exit(fails ? 1 : 0);
})().catch((err) => { console.error(err); if (errors.length) console.error("errors seen in the hub:\n  " + errors.join("\n  ")); process.exit(1); });
