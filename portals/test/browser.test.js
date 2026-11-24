/* End-to-end test: drives the real page in a real browser.
 *
 *   node portals/test/browser.test.js
 *
 * Serves the site on one local port and a pair of pretend college portals on
 * another (one of which forbids being framed, like most real ones), then walks
 * through everything: setting the passphrase, adding portals, the arrows, the
 * clipboard, checking off, embedding, locking, backup and restore.
 *
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
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");   // the site root
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "portals-test-"));
const SITE = 8097;
const PORTALS = 8098;
const SITE_URL = "http://localhost:" + SITE + "/portals/";

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

const CANVAS = { name: "Canvas", url: "http://127.0.0.1:" + PORTALS + "/canvas", user: "jsmith42", pass: "Canvas-pw-1!" };
const BANNER = { name: "Banner", url: "http://127.0.0.1:" + PORTALS + "/banner", user: "900123456", pass: "Banner-pw-2!" };
const LIBRARY = { name: "Library", url: "http://127.0.0.1:" + PORTALS + "/library", user: "jsmith", pass: "Library-pw-3!" };
const PASSPHRASE = "purple otter window 7";
const SECRETS = [CANVAS.pass, BANNER.pass, LIBRARY.pass, CANVAS.user, BANNER.user, PASSPHRASE];

function startServers() {
  const site = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    let file = path.join(ROOT, rel || "index.html");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  const portals = http.createServer((req, res) => {
    const name = req.url.split("?")[0].replace(/^\/+/, "");
    const headers = { "Content-Type": "text/html" };
    if (name === "library") headers["X-Frame-Options"] = "DENY";      // most real portals do this
    res.writeHead(200, headers).end("<!doctype html><title>" + name + "</title><body style='font:20px sans-serif;padding:30px'><h1>" + name + " login</h1>");
  });
  return Promise.all([
    new Promise((r) => site.listen(SITE, r)),
    new Promise((r) => portals.listen(PORTALS, r)),
  ]).then(() => [site, portals]);
}

const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
const visible = (page, sel) => page.isVisible(sel);
const names = (page) => page.$$eval(".prow strong", (els) => els.map((e) => e.textContent));
const clip = (page) => page.evaluate(() => navigator.clipboard.readText());

async function addPortal(page, p, first) {
  await page.click(first ? "#btn-first" : "#btn-add");
  await page.fill("#i-name", p.name);
  await page.fill("#i-url", p.url);
  await page.fill("#i-user", p.user);
  await page.fill("#i-pass", p.pass);
  await page.click("#f-portal button[type=submit]");
  await page.waitForSelector("#f-portal", { state: "hidden" });
}

async function unlock(page, pass) {
  await page.fill("#i-unlock", pass);
  await page.click("#b-unlock");
}

(async () => {
  const servers = await startServers();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1000, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const errors = [];
  const watch = (p) => {
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    // A portal that refuses to be framed makes the browser log this; that is the
    // expected behaviour, not a fault in the page.
    p.on("console", (m) => { if (m.type() === "error" && !/Refused to display .* in a frame/.test(m.text())) errors.push("console: " + m.text()); });
    p.on("dialog", (d) => d.accept());
  };
  watch(page);

  // ------------------------------------------------------------ first run
  await page.goto(SITE_URL, { waitUntil: "load" });
  check("title", (await page.title()) === "College Portals");
  check("first visit asks for a passphrase", await visible(page, "#v-setup"));
  check("nothing else is showing", !(await visible(page, "#v-viewer")) && !(await visible(page, "#v-locked")) && !(await visible(page, "#top-actions")));
  check("the page tells search engines to stay away", await page.$eval('meta[name=robots]', (m) => /noindex/.test(m.content)));
  check("the page forbids network requests", await page.$eval('meta[http-equiv="Content-Security-Policy"]', (m) => /connect-src 'none'/.test(m.content) && /form-action 'none'/.test(m.content)));

  await page.fill("#i-setup-1", "short");
  await page.fill("#i-setup-2", "short");
  await page.evaluate(() => document.getElementById("f-setup").dispatchEvent(new Event("submit", { cancelable: true })));
  check("a short passphrase is refused", /at least 8/.test(await text(page, "#e-setup")));
  await page.fill("#i-setup-1", PASSPHRASE);
  await page.fill("#i-setup-2", PASSPHRASE + "x");
  await page.click("#b-setup");
  check("mismatched passphrases are refused", /don't match/.test(await text(page, "#e-setup")));
  check("nothing was saved by the failed attempts", (await page.evaluate(() => localStorage.length)) === 0);

  await page.fill("#i-setup-2", PASSPHRASE);
  await page.click("#b-setup");
  await page.waitForSelector("#v-viewer:not([hidden])");
  check("vault created, empty state shown", await visible(page, "#empty") && !(await visible(page, "#carousel")));
  check("lock and manage buttons appear", await visible(page, "#btn-lock") && await visible(page, "#btn-manage"));
  const stored = await page.evaluate(() => localStorage.getItem("college-portals.vault"));
  check("an encrypted vault is in localStorage", !!stored && JSON.parse(stored).app === "college-portals");
  check("the passphrase is not stored", !stored.includes(PASSPHRASE));

  // ------------------------------------------------------- adding portals
  await page.click("#btn-first");
  check("Add a portal opens the form", await visible(page, "#f-portal") && await visible(page, "#v-manage"));

  await page.fill("#i-name", "Evil");
  await page.fill("#i-url", "javascript:alert(1)");
  await page.click("#f-portal button[type=submit]");
  check("a javascript: address is refused", /web address/.test(await text(page, "#e-portal")));
  await page.fill("#i-url", "https://user:pw@portal.edu");
  await page.click("#f-portal button[type=submit]");
  check("an address with a login in it is refused", /web address/.test(await text(page, "#e-portal")));
  check("nothing was added by those", (await names(page)).length === 0);
  await page.click("#btn-form-cancel");

  await addPortal(page, CANVAS);   // already in Manage from the empty-state button above
  await addPortal(page, BANNER);
  await addPortal(page, LIBRARY);
  check("three portals are listed in order", (await names(page)).join() === "Canvas,Banner,Library", (await names(page)).join());

  await page.click('button[aria-label="Move Library up"]');
  check("move up reorders", (await names(page)).join() === "Canvas,Library,Banner");
  await page.click('button[aria-label="Move Library down"]');
  check("move down reorders", (await names(page)).join() === "Canvas,Banner,Library");

  await page.click('button[aria-label="Edit Banner"]');
  check("edit fills the form", (await page.inputValue("#i-user")) === BANNER.user && (await page.inputValue("#i-pass")) === BANNER.pass);
  check("the password is hidden in the form until asked", (await page.getAttribute("#i-pass", "type")) === "password");
  await page.click("#btn-form-reveal");
  check("Show reveals it in the form", (await page.getAttribute("#i-pass", "type")) === "text");
  await page.fill("#i-name", "Banner (registration)");
  await page.click("#f-portal button[type=submit]");
  check("edit saves", (await names(page)).join() === "Canvas,Banner (registration),Library");
  await page.click('button[aria-label="Edit Banner (registration)"]');
  await page.fill("#i-name", "Banner");
  await page.click("#f-portal button[type=submit]");

  await page.screenshot({ path: path.join(OUT, "manage-desktop.png") });

  // ----------------------------------------------------- the arrows
  await page.click("#btn-manage-done");
  check("back to checking shows the portal just added", (await text(page, "#now-name")) === "Library" && (await text(page, "#now-count")) === "3 of 3");
  check("one dot per portal", (await page.$$(".dot")).length === 3);

  await page.click("#btn-next");
  check("next wraps from the last to the first", (await text(page, "#now-name")) === "Canvas" && (await text(page, "#now-count")) === "1 of 3");
  await page.click("#btn-prev");
  check("previous wraps from the first to the last", (await text(page, "#now-name")) === "Library");
  await page.click("#btn-prev");
  check("previous steps back", (await text(page, "#now-name")) === "Banner");
  await page.click("#btn-next");
  await page.click("#btn-next");
  check("next steps forward", (await text(page, "#now-name")) === "Canvas");
  await page.keyboard.press("ArrowRight");
  check("right arrow key goes next", (await text(page, "#now-name")) === "Banner");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  check("left arrow key goes back (and wraps)", (await text(page, "#now-name")) === "Library");
  await page.click(".dot:nth-child(2)");
  check("clicking a dot jumps to that portal", (await text(page, "#now-name")) === "Banner");
  await page.click("#btn-next");
  await page.click("#btn-next");   // Canvas

  // --------------------------------------------- the credentials card
  check("the card shows the username", (await text(page, "#c-user")) === CANVAS.user);
  check("the password starts hidden", !(await text(page, "#c-pass")).includes(CANVAS.pass) && (await text(page, "#btn-reveal")) === "Show");
  check("the page text has no password in it while hidden", !(await page.evaluate(() => document.body.innerText)).includes(CANVAS.pass));
  await page.click("#btn-reveal");
  check("Show reveals the password", (await text(page, "#c-pass")) === CANVAS.pass && (await text(page, "#btn-reveal")) === "Hide");
  await page.click("#btn-next");
  check("moving to another portal hides it again", !(await text(page, "#c-pass")).includes(BANNER.pass));
  await page.click("#btn-prev");

  await page.click("#btn-copy-user");
  check("Copy copies the username", (await clip(page)) === CANVAS.user);
  await page.click("#btn-copy-pass");
  check("Copy copies the password", (await clip(page)) === CANVAS.pass);

  // ------------------------------------------------------- opening
  check("Open is a real link to the portal", (await page.getAttribute("#btn-open", "href")) === CANVAS.url);
  check("it opens in a new tab and doesn't leak the opener or referrer", (await page.getAttribute("#btn-open", "target")) === "_blank" && /noopener/.test(await page.getAttribute("#btn-open", "rel")) && /noreferrer/.test(await page.getAttribute("#btn-open", "rel")));
  await page.evaluate(() => navigator.clipboard.writeText("something else"));
  const [popup] = await Promise.all([context.waitForEvent("page"), page.click("#btn-open")]);
  await popup.waitForLoadState();
  check("clicking Open opens the portal in a new tab", popup.url() === CANVAS.url, popup.url());
  check("…which shows the portal", (await popup.textContent("h1")) === "canvas login");
  await popup.close();
  check("…and copied the password", (await clip(page)) === CANVAS.pass);
  check("a toast said so", /Copied the password/.test(await text(page, "#status")));

  // ------------------------------------------------- checking things off
  check("nothing checked yet", (await text(page, "#progress")) === "0 of 3 checked today");
  await page.screenshot({ path: path.join(OUT, "viewer-desktop.png") });
  await page.click("#btn-done");
  check("Done moves on to the next portal", (await text(page, "#now-name")) === "Banner");
  check("…and counts the one just done", (await text(page, "#progress")) === "1 of 3 checked today");
  check("its dot is marked done", (await page.$$(".dot.done")).length === 1);
  await page.click("#btn-prev");
  check("the pill shows it as checked", /Checked today/.test(await text(page, "#btn-check")) && (await page.getAttribute("#btn-check", "aria-pressed")) === "true");
  await page.click("#btn-check");
  check("the pill un-checks it", (await text(page, "#progress")) === "0 of 3 checked today");
  await page.click("#btn-check");
  await page.click("#btn-next");
  await page.click("#btn-done");
  await page.click("#btn-done");
  check("checking everything says so", (await text(page, "#progress")) === "All 3 checked today ✓", await text(page, "#progress"));
  check("…and wraps around to the top", (await text(page, "#now-name")) === "Canvas");

  // --------------------------------------------------------- embedding
  check("the embed panel is off by default", !(await visible(page, "#embed")));
  await page.check("#chk-embed");
  await page.waitForSelector("#frame-box iframe");
  check("embedding shows the portal in a frame", (await page.getAttribute("#frame-box iframe", "src")) === CANVAS.url);
  const sandbox = await page.getAttribute("#frame-box iframe", "sandbox");
  check("the frame can't navigate this page away", !/allow-top-navigation/.test(sandbox), sandbox);
  check("the frame sends no referrer", (await page.getAttribute("#frame-box iframe", "referrerpolicy")) === "no-referrer");
  await page.$eval("#frame-box iframe", (f) => { f.dataset.same = "yes"; });
  await page.click("#btn-reveal");
  await page.click("#btn-reveal");
  check("redrawing the card doesn't reload the portal", (await page.$eval("#frame-box iframe", (f) => f.dataset.same)) === "yes");
  const framed = await (await page.$("#frame-box iframe")).contentFrame();
  check("the portal really loaded inside it", (await framed.textContent("h1")) === "canvas login");
  await page.click("#btn-next");
  check("the arrows move the frame to the next portal", (await page.getAttribute("#frame-box iframe", "src")) === BANNER.url);
  await page.click("#btn-next");
  await page.waitForTimeout(400);
  check("a portal that forbids framing still gets a frame, plus the hint to open it instead", (await page.getAttribute("#frame-box iframe", "src")) === LIBRARY.url && /refused to connect/.test(await text(page, "#embed")));
  await page.screenshot({ path: path.join(OUT, "viewer-embed-desktop.png") });

  // This site's own pages are never framed (a scripted same-origin frame could reach back).
  await page.click("#btn-manage");
  await page.click("#btn-add");
  await page.fill("#i-name", "Self");
  await page.fill("#i-url", SITE_URL);
  await page.click("#f-portal button[type=submit]");
  await page.click("#btn-manage-done");
  check("this site's own address isn't framed", (await text(page, "#now-name")) === "Self" && (await page.$$("#frame-box iframe")).length === 0);
  await page.click("#btn-manage");
  await page.click('button[aria-label="Delete Self"]');
  check("delete removes it (after confirming)", (await names(page)).join() === "Canvas,Banner,Library");
  await page.click("#btn-manage-done");
  await page.uncheck("#chk-embed");
  check("turning embedding off removes the frame", (await page.$$("#frame-box iframe")).length === 0);

  // --------------------------------------- what to copy when opening
  await page.click("#btn-manage");
  await page.selectOption("#sel-copy", "username");
  await page.click("#btn-manage-done");
  await page.evaluate(() => navigator.clipboard.writeText("sentinel"));
  const [p2] = await Promise.all([context.waitForEvent("page"), page.click("#btn-open")]);
  await p2.close();
  check("Open can copy the username instead", (await clip(page)) === (await text(page, "#c-user")));
  check("the note under the button follows the setting", /copies the username/.test(await text(page, "#open-note")));
  await page.click("#btn-manage");
  await page.selectOption("#sel-copy", "nothing");
  await page.click("#btn-manage-done");
  await page.evaluate(() => navigator.clipboard.writeText("sentinel"));
  const [p3] = await Promise.all([context.waitForEvent("page"), page.click("#btn-open")]);
  await p3.close();
  check("…or nothing at all", (await clip(page)) === "sentinel");
  await page.click("#btn-manage");
  await page.selectOption("#sel-copy", "password");
  await page.click("#btn-manage-done");

  // --------------------------------------------------------------- lock
  await page.click("#btn-lock");
  check("Lock shows the passphrase screen", await visible(page, "#v-locked") && !(await visible(page, "#v-viewer")));
  const afterLock = await page.evaluate(() => document.body.textContent + Array.from(document.querySelectorAll("input")).map((i) => i.value).join(""));
  check("locking wipes every secret out of the page", SECRETS.every((s) => !afterLock.includes(s)));
  check("locking doesn't wipe the vault", !!(await page.evaluate(() => localStorage.getItem("college-portals.vault"))));
  await page.screenshot({ path: path.join(OUT, "locked-desktop.png") });

  await unlock(page, "wrong passphrase here");
  await page.waitForFunction(() => document.getElementById("e-unlock").textContent.length > 0);
  check("a wrong passphrase is refused", /didn't unlock/.test(await text(page, "#e-unlock")) && await visible(page, "#v-locked"));
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");
  check("the right passphrase unlocks", (await text(page, "#now-name")) === "Canvas");

  // ---------------------------------------------------------- reload
  await page.reload({ waitUntil: "load" });
  check("a reload comes back locked, not set-up", await visible(page, "#v-locked") && !(await visible(page, "#v-setup")));
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");
  check("everything survived the reload", (await text(page, "#now-count")) === "1 of 3" && (await text(page, "#progress")) === "All 3 checked today ✓");

  // --------------------------------- starts on the first unchecked one
  // All three are checked and Canvas is showing. Un-check only Banner: the
  // page should now open on Banner, not on the top of the list.
  await page.click("#btn-next");
  check("(setup) on Banner", (await text(page, "#now-name")) === "Banner");
  await page.click("#btn-check");
  await page.click("#btn-lock");
  await page.reload({ waitUntil: "load" });
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");
  check("opens on the first portal not yet checked today", (await text(page, "#now-name")) === "Banner" && (await text(page, "#now-count")) === "2 of 3", await text(page, "#now-name"));
  // Now Banner done, Library un-checked: it should skip past the finished ones.
  await page.click("#btn-done");
  check("(setup) Done moved to Library", (await text(page, "#now-name")) === "Library");
  await page.click("#btn-check");
  await page.click("#btn-lock");
  await page.reload({ waitUntil: "load" });
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");
  check("…and skips the ones already done", (await text(page, "#now-name")) === "Library" && (await page.$$(".dot.done")).length === 2, await text(page, "#now-name"));

  // ------------------------------------------------------ auto-lock
  await page.evaluate(() => {
    const real = Date.now;
    Date.now = () => real() + 31 * 60 * 1000;                 // 31 minutes later
    document.dispatchEvent(new Event("visibilitychange"));    // as when you come back to the tab
  });
  await page.waitForSelector("#v-locked:not([hidden])");
  check("it locks itself after 30 minutes away", /30 minutes/.test(await text(page, "#status")));
  await page.reload({ waitUntil: "load" });
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");

  // ----------------------------------------------- another tab edits
  const other = await context.newPage();
  watch(other);
  await other.goto(SITE_URL, { waitUntil: "load" });
  await unlock(other, PASSPHRASE);
  await other.waitForSelector("#v-viewer:not([hidden])");
  await other.click("#btn-done");
  await page.waitForSelector("#v-locked:not([hidden])");
  check("a change in another tab locks this one rather than overwriting it later", /another tab/.test(await text(page, "#status")));
  await other.close();
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");

  // ------------------------------------------------- backup + restore
  await page.click("#btn-manage");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
  const backupPath = path.join(OUT, "backup.json");
  await download.saveAs(backupPath);
  const backup = fs.readFileSync(backupPath, "utf8");
  check("the backup has a sensible name", /^college-portals-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
  check("the backup is an encrypted envelope", JSON.parse(backup).app === "college-portals");
  check("the backup contains no secrets", SECRETS.every((s) => !backup.includes(s)) && !/Canvas|canvas|127\.0\.0\.1/.test(backup));
  await page.screenshot({ path: path.join(OUT, "manage-bottom-desktop.png"), fullPage: true });

  // A different device: a fresh browser profile.
  const ctx2 = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 1000, height: 900 } });
  const fresh = await ctx2.newPage();
  watch(fresh);
  await fresh.goto(SITE_URL, { waitUntil: "load" });
  check("a new device starts at set-up", await visible(fresh, "#v-setup") && await visible(fresh, "#v-restore"));
  await fresh.click("#v-restore summary");
  fs.writeFileSync(path.join(OUT, "junk.json"), '{"hello":"world"}');
  await fresh.setInputFiles("#i-restore-file", path.join(OUT, "junk.json"));
  await fresh.fill("#i-restore-pass", PASSPHRASE);
  await fresh.click("#b-restore");
  await fresh.waitForFunction(() => document.getElementById("e-restore").textContent.length > 0);
  check("restoring something that isn't a backup is refused", /isn't a portals backup/.test(await text(fresh, "#e-restore")));
  await fresh.setInputFiles("#i-restore-file", backupPath);
  await fresh.fill("#i-restore-pass", "not the passphrase");
  await fresh.click("#b-restore");
  await fresh.waitForFunction(() => /didn't unlock/.test(document.getElementById("e-restore").textContent));
  check("restoring with the wrong passphrase is refused", /didn't unlock/.test(await text(fresh, "#e-restore")) && await visible(fresh, "#v-setup"));
  check("…and saved nothing", (await fresh.evaluate(() => localStorage.length)) === 0);
  await fresh.fill("#i-restore-pass", PASSPHRASE);
  await fresh.click("#b-restore");
  await fresh.waitForSelector("#v-viewer:not([hidden])");
  check("the right passphrase restores all three portals", (await fresh.$$(".dot")).length === 3 && /Restored 3 portals/.test(await text(fresh, "#status")));
  await fresh.click("#btn-manage");
  check("…with their logins", (await names(fresh)).join() === "Canvas,Banner,Library");
  await fresh.click('button[aria-label="Edit Banner"]');
  check("…including the passwords", (await fresh.inputValue("#i-pass")) === BANNER.pass);
  await fresh.reload({ waitUntil: "load" });
  check("the restored vault survives a reload there too", await visible(fresh, "#v-locked"));
  await unlock(fresh, PASSPHRASE);
  await fresh.waitForSelector("#v-viewer:not([hidden])");

  // ----------------------------------------------------------- erase
  await fresh.click("#btn-manage");
  await fresh.click("#btn-erase");
  await fresh.waitForSelector("#v-setup:not([hidden])");
  check("erase returns to set-up", await visible(fresh, "#v-setup"));
  check("…and leaves nothing in the browser", (await fresh.evaluate(() => localStorage.length)) === 0);
  await ctx2.close();

  // ----------------------------------------------- phone-sized screenshots
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ["clipboard-read", "clipboard-write"] });
  const m = await phone.newPage();
  watch(m);
  await m.goto(SITE_URL, { waitUntil: "load" });
  await m.screenshot({ path: path.join(OUT, "setup-phone.png") });
  await m.click("#v-restore summary");
  await m.setInputFiles("#i-restore-file", backupPath);
  await m.fill("#i-restore-pass", PASSPHRASE);
  await m.click("#b-restore");
  await m.waitForSelector("#v-viewer:not([hidden])");
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(OUT, "viewer-phone.png") });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no sideways scrolling on a phone", overflow <= 0, overflow);
  await m.click("#btn-reveal");
  await m.click("#btn-manage");
  await m.screenshot({ path: path.join(OUT, "manage-phone.png"), fullPage: true });
  check("no sideways scrolling in Manage on a phone", (await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  await phone.close();

  // ---------------------------------------------------------------- done
  check("no page errors or console errors (including CSP violations)", errors.length === 0, errors.join(" | "));
  await browser.close();
  servers.forEach((s) => s.close());
  console.log("\nscreenshots: " + OUT);
  console.log(fails ? fails + " FAILED" : "all passed");
  process.exit(fails ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
