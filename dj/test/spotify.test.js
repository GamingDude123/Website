/* The Spotify login and playlist path, against a stand-in Spotify.
 *
 * Real Spotify needs a real app and an interactive login, so this stands in
 * for accounts.spotify.com and api.spotify.com inside the browser and holds
 * our side of the conversation to the protocol: PKCE (the verifier we send
 * must hash to the challenge we sent), the `state` round trip, token refresh,
 * paging, and the playlist endpoint's rename (/items, falling back to /tracks).
 * It cannot prove Spotify itself accepts the requests.
 */
const { chromium } = (function () {
  for (const n of ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"]) { try { return require(n); } catch (e) { /* next */ } }
  console.error("playwright not found"); process.exit(2);
})();
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..", ".."), PORT = 8096;
let fails = 0;
const check = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + x : "")); if (!c) fails++; };
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

(async () => {
  const server = http.createServer((req, res) => {
    let f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  }).listen(PORT);
  const redirect = "http://localhost:" + PORT + "/dj/index.html";

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));

  // ---- the stand-in
  const seen = { authorize: null, tokens: [], api: [], itemsHits: 0 };
  let issued = 0;
  await ctx.route("https://accounts.spotify.com/authorize*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    seen.authorize = Object.fromEntries(q);
    const back = new URL(redirect); back.searchParams.set("code", "CODE123"); back.searchParams.set("state", seen.forceState || q.get("state"));
    route.fulfill({ status: 302, headers: { Location: back.toString() }, body: "" });
  });
  await ctx.route("https://accounts.spotify.com/api/token", (route) => {
    const body = Object.fromEntries(new URLSearchParams(route.request().postData()));
    seen.tokens.push(body);
    issued++;
    // first token is already expired, to force the refresh path
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ access_token: "TOKEN" + issued, expires_in: issued === 1 ? 1 : 3600, refresh_token: "REFRESH1", token_type: "Bearer" }) });
  });
  const track = (n, artist) => ({ track: { name: n, artists: [{ name: artist }], duration_ms: 200000 } });
  await ctx.route("https://api.spotify.com/**", (route) => {
    const url = new URL(route.request().url()), auth = route.request().headers()["authorization"];
    seen.api.push({ path: url.pathname, auth });
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (o, status) => route.fulfill({ status: status || 200, contentType: "application/json", headers: cors, body: JSON.stringify(o) });
    if (url.pathname === "/v1/me/playlists") {
      if (url.searchParams.get("offset") === "1") return json({ items: [{ id: "p2", name: "Second" }], next: null });
      return json({ items: [{ id: "p1", name: "Warm-up" }], next: "https://api.spotify.com/v1/me/playlists?limit=50&offset=1" });
    }
    if (url.pathname === "/v1/playlists/p1/items") { seen.itemsHits++; return json({ error: { status: 404 } }, 404); }   // the newer name is not live yet
    if (url.pathname === "/v1/playlists/p1/tracks") {
      if (url.searchParams.get("offset") === "2") return json({ items: [track("Levels", "Avicii")], next: null });
      return json({ items: [track("Strobe", "deadmau5"), null, track("Midnight Warehouse", "Demo Set")], next: "https://api.spotify.com/v1/playlists/p1/tracks?limit=100&offset=2" });
    }
    return json({ error: { status: 404 } }, 404);
  });

  await page.goto(redirect);
  check("redirect URI is shown for the dashboard", (await page.textContent("#sp-redirect")).includes(redirect));
  check("not connected at first", await page.isHidden("#sp-load"));
  await page.click("details.spotify summary");

  // ---- login
  await page.click("#sp-connect");
  check("connect without a Client ID does nothing", seen.authorize === null);
  await page.fill("#sp-client", "CLIENT_ID_X");
  await Promise.all([page.waitForURL(/dj\/index\.html$/), page.click("#sp-connect")]);
  await page.click("details.spotify summary");
  await page.waitForSelector("#sp-load:not([hidden])");
  const a = seen.authorize;
  check("authorize: client, redirect and scopes", a.client_id === "CLIENT_ID_X" && a.redirect_uri === redirect && a.response_type === "code" && /playlist-read-private/.test(a.scope), JSON.stringify({ c: a.client_id, r: a.redirect_uri }));
  check("authorize: PKCE with S256 and a state", a.code_challenge_method === "S256" && a.code_challenge.length >= 43 && a.state.length >= 16);
  const t0 = seen.tokens[0];
  check("token: authorization_code grant with our redirect and client", t0.grant_type === "authorization_code" && t0.code === "CODE123" && t0.redirect_uri === redirect && t0.client_id === "CLIENT_ID_X");
  check("token: the verifier hashes to the challenge we sent", b64url(crypto.createHash("sha256").update(t0.code_verifier).digest()) === a.code_challenge);
  check("url is cleaned after login", !/code=/.test(page.url()));
  check("token is not left in the URL or page", !(await page.content()).includes("TOKEN1"));

  // ---- playlists (token one is already expired -> refresh happens first)
  await page.waitForFunction(() => document.querySelectorAll("#sp-lists option").length === 2);
  check("playlists: both pages read", (await page.$$eval("#sp-lists option", (o) => o.map((x) => x.textContent))).join() === "Warm-up,Second");
  const refresh = seen.tokens[1];
  check("expired token triggers a refresh", refresh && refresh.grant_type === "refresh_token" && refresh.refresh_token === "REFRESH1" && refresh.client_id === "CLIENT_ID_X");
  check("api calls carry the refreshed token", seen.api.filter((c) => c.path === "/v1/me/playlists").every((c) => c.auth === "Bearer TOKEN2"));

  // ---- tracks: /items 404s, falls back to /tracks, follows paging, skips nulls
  await page.selectOption("#sp-lists", "p1");
  await page.click("#sp-load");
  await page.waitForSelector("#sp-result .match", { timeout: 8000 });
  check("tries /items first, then falls back to /tracks", seen.itemsHits === 1 && seen.api.some((c) => c.path === "/v1/playlists/p1/tracks"));
  const rows = await page.$$eval("#sp-result .match", (r) => r.map((x) => x.textContent));
  check("tracks: both pages, null entries skipped", rows.length === 3 && /Strobe/.test(rows[0]) && /Levels/.test(rows[2]), rows.length + " rows");
  check("the result opens itself", await page.$eval("details.spotify", (d) => d.open));

  // ---- disconnect clears everything
  await page.click("#sp-off");
  const left = await page.evaluate(() => ["sp_token", "sp_refresh", "sp_verifier", "sp_state"].filter((k) => localStorage.getItem(k)));
  check("disconnect clears stored credentials", left.length === 0, left.join());
  check("controls return to the login state", await page.isHidden("#sp-load") && await page.isVisible("#sp-connect"));

  // ---- a redirect with the wrong state is refused
  seen.forceState = "attacker";
  await page.click("details.spotify summary", { force: true }).catch(() => {});
  await page.evaluate(() => { document.querySelector("details.spotify").open = true; });
  await page.fill("#sp-client", "CLIENT_ID_X");
  await Promise.all([page.waitForURL(/dj\/index\.html$/), page.click("#sp-connect")]);
  await page.waitForFunction(() => /not started from this page/.test(document.getElementById("log").textContent));
  check("wrong state: login refused, no token exchanged", seen.tokens.length === 2 && await page.isHidden("#sp-load"), "token calls=" + seen.tokens.length);

  check("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close(); server.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
