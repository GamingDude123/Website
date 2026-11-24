/* End-to-end test: drives the real page in a real browser.
 *
 *   node portals/test/browser.test.js
 *
 * Serves the site on one local port and a pretend college portal on another,
 * then walks through it: choosing a passphrase, adding portals, the arrows and
 * their wrap-around, copying, opening, editing, deleting, locking, reloading.
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
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  const portals = http.createServer((req, res) => {
    const name = req.url.split("?")[0].replace(/^\/+/, "");
    res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>" + name + "</title><h1>" + name + " login</h1>");
  });
  return Promise.all([
    new Promise((r) => site.listen(SITE, r)),
    new Promise((r) => portals.listen(PORTALS, r)),
  ]).then(() => [site, portals]);
}

const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
const visible = (page, sel) => page.isVisible(sel);
const clip = (page) => page.evaluate(() => navigator.clipboard.readText());
const shown = (page) => page.evaluate(() => ["setup", "locked", "viewer", "form", "unsupported"].filter((v) => !document.getElementById("v-" + v).hidden));

async function addPortal(page, p, openWith) {
  await page.click(openWith);
  await page.fill("#i-name", p.name);
  await page.fill("#i-url", p.url);
  await page.fill("#i-user", p.user);
  await page.fill("#i-pass", p.pass);
  await page.click("#f-portal button[type=submit]");
  await page.waitForSelector("#v-viewer:not([hidden])");
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
    viewport: { width: 1000, height: 800 },
  });
  const page = await context.newPage();

  const errors = [];
  const watch = (p) => {
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    p.on("dialog", (d) => d.accept());
  };
  watch(page);

  // ------------------------------------------------------------ first run
  await page.goto(SITE_URL, { waitUntil: "load" });
  check("title", (await page.title()) === "College Portals");
  check("first visit asks for a passphrase and nothing else", (await shown(page)).join() === "setup");
  check("Lock isn't offered yet", !(await visible(page, "#btn-lock")));
  check("the page tells search engines to stay away", await page.$eval("meta[name=robots]", (m) => /noindex/.test(m.content)));
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
  check("vault created; empty page invites the first portal", await visible(page, "#empty") && !(await visible(page, "#carousel")) && await visible(page, "#btn-lock"));
  const stored = await page.evaluate(() => localStorage.getItem("college-portals.vault"));
  check("an encrypted vault is in localStorage", !!stored && JSON.parse(stored).app === "college-portals");
  check("the passphrase is not stored", !stored.includes(PASSPHRASE));

  // ------------------------------------------------------- adding portals
  await page.click("#btn-first");
  check("Add a portal opens the form", (await shown(page)).join() === "form" && !(await visible(page, "#btn-delete")));
  await page.fill("#i-name", "Evil");
  await page.fill("#i-url", "javascript:alert(1)");
  await page.click("#f-portal button[type=submit]");
  check("a javascript: address is refused", /web address/.test(await text(page, "#e-portal")));
  await page.fill("#i-url", "https://user:pw@portal.edu");
  await page.click("#f-portal button[type=submit]");
  check("an address with a login in it is refused", /web address/.test(await text(page, "#e-portal")));
  await page.click("#btn-form-cancel");
  check("Cancel goes back with nothing added", await visible(page, "#empty"));

  await addPortal(page, CANVAS, "#btn-first");
  check("one portal: shown, arrows switched off", (await text(page, "#now-name")) === "Canvas" && (await text(page, "#now-count")) === "1 of 1" && await page.isDisabled("#btn-next") && await page.isDisabled("#btn-prev"));
  await addPortal(page, BANNER, "#btn-add");
  await addPortal(page, LIBRARY, "#btn-add");
  check("a newly added portal is the one shown", (await text(page, "#now-name")) === "Library" && (await text(page, "#now-count")) === "3 of 3");

  // ----------------------------------------------------- the arrows
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
  check("left arrow key goes back, and wraps", (await text(page, "#now-name")) === "Library");
  await page.keyboard.press("ArrowRight");   // Canvas

  // --------------------------------------------- the credentials card
  check("the card shows the address and username", (await text(page, "#card-host")) === "127.0.0.1:" + PORTALS && (await text(page, "#c-user")) === CANVAS.user);
  check("the password starts hidden", !(await text(page, "#btn-pass")).includes(CANVAS.pass));
  check("the page text has no password while it's hidden", !(await page.evaluate(() => document.body.innerText)).includes(CANVAS.pass));
  await page.click("#btn-pass");
  check("tapping the dots shows the password", (await text(page, "#btn-pass")) === CANVAS.pass);
  await page.click("#btn-pass");
  check("tapping again hides it", !(await text(page, "#btn-pass")).includes(CANVAS.pass));
  await page.click("#btn-pass");
  await page.click("#btn-next");
  check("moving to another portal hides it again", !(await text(page, "#btn-pass")).includes(BANNER.pass));
  await page.click("#btn-prev");

  await page.click("#btn-copy-user");
  check("Copy copies the username", (await clip(page)) === CANVAS.user);
  check("…and the button says so", /Copied/.test(await text(page, "#btn-copy-user")));
  await page.click("#btn-copy-pass");
  check("Copy copies the password", (await clip(page)) === CANVAS.pass);

  // ------------------------------------------------------- opening
  check("Open is a real link to the portal", (await page.getAttribute("#btn-open", "href")) === CANVAS.url);
  const rel = await page.getAttribute("#btn-open", "rel");
  check("it opens in a new tab without leaking the opener or referrer", (await page.getAttribute("#btn-open", "target")) === "_blank" && /noopener/.test(rel) && /noreferrer/.test(rel));
  await page.evaluate(() => navigator.clipboard.writeText("something else"));
  const [popup] = await Promise.all([context.waitForEvent("page"), page.click("#btn-open")]);
  await popup.waitForLoadState();
  check("clicking Open opens the portal in a new tab", popup.url() === CANVAS.url && (await popup.textContent("h1")) === "canvas login", popup.url());
  await popup.close();
  check("…and copies the password", (await clip(page)) === CANVAS.pass);
  await page.screenshot({ path: path.join(OUT, "viewer-desktop.png") });

  // ----------------------------------------------- edit and delete
  await page.click("#btn-edit");
  check("Edit shows the form filled in, with Delete", (await shown(page)).join() === "form" && (await page.inputValue("#i-name")) === "Canvas" && (await page.inputValue("#i-pass")) === CANVAS.pass && await visible(page, "#btn-delete"));
  check("the password is hidden in the form until asked", (await page.getAttribute("#i-pass", "type")) === "password");
  await page.click("#btn-form-reveal");
  check("Show reveals it in the form", (await page.getAttribute("#i-pass", "type")) === "text");
  await page.fill("#i-name", "Canvas (courses)");
  await page.fill("#i-pass", "New-pw-9!");
  await page.click("#f-portal button[type=submit]");
  check("saving an edit updates the card", (await text(page, "#now-name")) === "Canvas (courses)" && (await text(page, "#now-count")) === "1 of 3");
  await page.click("#btn-copy-pass");
  check("…and the copied password", (await clip(page)) === "New-pw-9!");
  await page.click("#btn-edit");
  await page.fill("#i-name", "Canvas");
  await page.fill("#i-pass", CANVAS.pass);
  await page.click("#f-portal button[type=submit]");

  await page.click("#btn-next");           // Banner
  await page.click("#btn-edit");
  await page.click("#btn-delete");
  check("Delete removes it (after confirming)", (await text(page, "#now-count")).endsWith("of 2") && (await text(page, "#now-name")) !== "Banner");
  await page.click("#btn-next");
  await page.click("#btn-next");
  check("the two left still cycle", ["Canvas", "Library"].includes(await text(page, "#now-name")));

  // --------------------------------------------------------------- lock
  await page.click("#btn-lock");
  check("Lock shows only the passphrase screen", (await shown(page)).join() === "locked" && !(await visible(page, "#btn-lock")));
  const afterLock = await page.evaluate(() => document.body.textContent + Array.from(document.querySelectorAll("input")).map((i) => i.value).join(""));
  check("locking leaves no secret in the page", SECRETS.every((s) => !afterLock.includes(s)));
  check("locking doesn't delete the vault", !!(await page.evaluate(() => localStorage.getItem("college-portals.vault"))));
  await page.screenshot({ path: path.join(OUT, "locked-desktop.png") });

  await unlock(page, "wrong passphrase here");
  await page.waitForFunction(() => document.getElementById("e-unlock").textContent.length > 0);
  check("a wrong passphrase is refused", /didn't unlock/.test(await text(page, "#e-unlock")) && (await shown(page)).join() === "locked");
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");
  check("the right passphrase unlocks, back at the first portal", (await text(page, "#now-count")) === "1 of 2");

  // ---------------------------------------------------------- reload
  await page.reload({ waitUntil: "load" });
  check("a reload comes back locked, not set-up", (await shown(page)).join() === "locked");
  await unlock(page, PASSPHRASE);
  await page.waitForSelector("#v-viewer:not([hidden])");
  check("everything survived the reload", (await text(page, "#now-count")) === "1 of 2" && (await text(page, "#c-user")) === CANVAS.user);

  // ---------------------------------------------- forgot the passphrase
  await page.click("#btn-lock");
  await page.click("#btn-erase");
  await page.waitForSelector("#v-setup:not([hidden])");
  check("erasing returns to set-up and leaves nothing behind", (await shown(page).then((s) => s.join())) === "setup" && (await page.evaluate(() => localStorage.length)) === 0);

  // ----------------------------------------------- phone-sized screenshots
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const m = await phone.newPage();
  watch(m);
  await m.goto(SITE_URL, { waitUntil: "load" });
  await m.screenshot({ path: path.join(OUT, "setup-phone.png") });
  await m.fill("#i-setup-1", PASSPHRASE);
  await m.fill("#i-setup-2", PASSPHRASE);
  await m.click("#b-setup");
  await m.waitForSelector("#v-viewer:not([hidden])");
  await addPortal(m, CANVAS, "#btn-first");
  await addPortal(m, BANNER, "#btn-add");
  await m.click("#btn-prev");
  await m.click("#btn-pass");
  await m.screenshot({ path: path.join(OUT, "viewer-phone.png") });
  check("no sideways scrolling on a phone", (await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  await m.click("#btn-edit");
  await m.screenshot({ path: path.join(OUT, "form-phone.png") });
  check("no sideways scrolling in the form on a phone", (await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  await phone.close();

  // ---------------------------------------------------------------- done
  check("no page errors or console errors (including CSP violations)", errors.length === 0, errors.join(" | "));
  await browser.close();
  servers.forEach((s) => s.close());
  console.log("\nscreenshots: " + OUT);
  console.log(fails ? fails + " FAILED" : "all passed");
  process.exit(fails ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
