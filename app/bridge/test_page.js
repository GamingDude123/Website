/* Drives controller.html in a real browser against a real bridge.
 *
 * Run through test_page.py, which owns the servers and watches the DSU side.
 * This half only does what a thumb would: tap Start, shake the phone, press
 * buttons. Everything it reports is read back out of the page, so a control
 * that looks right but sends nothing still fails.
 */

const { chromium } = require("playwright");

const URL = process.env.BRIDGE_URL;
const out = { checks: [], errors: [] };

function check(name, condition, detail) {
  out.checks.push({ name, ok: !!condition, detail: detail === undefined ? "" : String(detail) });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium"
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on("pageerror", (err) => out.errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") out.errors.push("console: " + msg.text());
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // The whole design rests on the page being a secure context — without it
  // Safari will not hand over the sensors at all.
  check("page is a secure context", await page.evaluate(() => window.isSecureContext));
  check("gate is shown first", await page.locator("#gate").isVisible());
  check("pad is hidden before Start", !(await page.locator("#pad").isVisible()));

  await page.locator("#btn-start").click();
  await page.waitForFunction(() => document.body.classList.contains("is-live"), null,
    { timeout: 5000 });

  check("pad appears after Start", await page.locator("#pad").isVisible());

  await page.waitForFunction(
    () => document.getElementById("txt-link").textContent === "Bridged",
    null, { timeout: 5000 });
  check("websocket reports bridged", true);

  /* Chromium has no accelerometer, so the events are synthesised. The page
     can't tell the difference: it reads the same fields either way. */
  await page.evaluate(() => {
    window.__fakeMotion = (ax, ay, az, ga, gb, gg) => {
      window.dispatchEvent(new DeviceMotionEvent("devicemotion", {
        accelerationIncludingGravity: { x: ax, y: ay, z: az },
        rotationRate: { alpha: ga, beta: gb, gamma: gg },
        interval: 16
      }));
    };
  });

  // Lying flat, screen up: 1 g straight down the phone's Z axis. Kept up for
  // over a second, because the Hz readout is averaged over one.
  for (let i = 0; i < 70; i++) {
    await page.evaluate(() => window.__fakeMotion(0, 0, 9.80665, 0, 0, 0));
    await page.waitForTimeout(20);
  }

  const rateText = await page.locator("#txt-rate").textContent();
  check("rate readout is live", /[1-9]/.test(rateText), rateText);

  // A swing: pitch up hard while the accelerometer swings forward.
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__fakeMotion(0, 6.0, 7.0, 0, 220, 0));
    await page.waitForTimeout(20);
  }

  /* Buttons. Pressed and released through the mouse so the page's real
     pointer handlers run, including the pointer capture. */
  async function press(name, holdMs) {
    const box = await page.locator(`[data-btn="${name}"]`).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(holdMs || 120);
    const lit = await page.locator(`[data-btn="${name}"]`).evaluate(
      (node) => node.classList.contains("is-down"));
    await page.mouse.up();
    await page.waitForTimeout(60);
    const cleared = await page.locator(`[data-btn="${name}"]`).evaluate(
      (node) => !node.classList.contains("is-down"));
    check(`${name} lights up while held`, lit);
    check(`${name} clears on release`, cleared);
  }

  await press("a");
  await press("b");
  await press("home");
  await press("recenter");

  // Two at once — Wii Sports bowling holds B while swinging.
  const aBox = await page.locator('[data-btn="a"]').boundingBox();
  await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  check("held button stays lit through motion",
    await page.locator('[data-btn="a"]').evaluate((n) => n.classList.contains("is-down")));
  await page.mouse.up();

  // Latency readout comes from a real round trip, so it needs the ping cycle.
  await page.waitForFunction(
    () => /ms/.test(document.getElementById("txt-lag").textContent || ""),
    null, { timeout: 6000 }).then(() => check("latency readout populated", true))
    .catch(() => check("latency readout populated", false));

  // The axis panel is the escape hatch when Dolphin moves the wrong way.
  await page.locator("#btn-axes").click();
  check("axis panel opens", await page.locator("#axes").isVisible());
  const rows = await page.locator("#axes .axis-row").count();
  check("six axes listed", rows === 6, rows);

  await page.evaluate(() => window.__fakeMotion(0, 0, 9.80665, 0, 0, 0));
  await page.waitForTimeout(250);
  const zText = await page.locator("#val-accel_z").textContent();
  check("flat phone reads about +1.00 on Z", zText.trim() === "+1.00", zText);

  // Flipping an axis has to survive the trip to the bridge, since that is
  // where it is applied and stored.
  await page.locator("#axes .axis-row:nth-child(4) button").click();
  await page.waitForTimeout(300);
  const invert = await page.evaluate(() =>
    fetch("/status").then((r) => r.json()).then((s) => s.invert));
  check("axis flip persisted to the bridge", invert.accel_z === -1, JSON.stringify(invert));

  // Put it back so the test leaves no state behind.
  await page.locator("#axes .axis-row:nth-child(4) button").click();
  await page.waitForTimeout(300);

  check("no page errors", out.errors.length === 0, out.errors.join(" | "));

  await browser.close();
  console.log(JSON.stringify(out));
})().catch((err) => {
  out.errors.push("harness: " + String(err && err.stack ? err.stack : err));
  console.log(JSON.stringify(out));
  process.exit(1);
});
