/* Pretend college portals, shared by the extension tests. They behave like real ones: they refuse
 * to be framed (X-Frame-Options and CSP frame-ancestors), want a login, keep the session in a
 * SameSite=Lax cookie, hop between hosts, draw their status late, and have icons of known colours.
 * `status` is mutable, so a test can change what a portal says.
 */

const http = require("http");
const zlib = require("zlib");

const PORT = 9201;
const BASE = "http://127.0.0.1:" + PORT;
// Not a famous one: Chrome shows a "this password was in a data breach" bubble for those after a
// login form is submitted, and in the test browser the bubble swallows every mouse and key event.
const TEST_PASSWORD = "plum-Harbor-4821-Kite";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h, fn) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) Buffer.from(fn(x, y)).copy(raw, y * (w * 4 + 1) + 1 + x * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const CRIMSON_PNG = png(32, 32, (x, y) => ((x - 16) ** 2 + (y - 16) ** 2 < 100 ? [255, 255, 255, 255] : [200, 16, 46, 255]));
const PURPLE_PNG = png(32, 32, () => [79, 38, 131, 255]);
const DUKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#001a57"/><rect y="40" width="64" height="24" fill="#ffb81c"/></svg>';

const status = { duke: "Under review", spa: "Application received", plain: "Submitted", hop: "Waitlisted", locked: "Under review", deep: "Application complete" };
const GATED = new Set(["duke", "spa", "plain", "locked", "deep"]);
const ICON_LINK = { duke: '<link rel="icon" href="/duke/icon.svg">', plain: '<link rel="apple-touch-icon" href="/plain/touch.png">' };

function startServer() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, BASE);
    const [name, sub] = u.pathname.split("/").filter(Boolean);
    const cookies = req.headers.cookie || "";
    const signedIn = cookies.includes("sid_" + name + "=ok");
    // Like most real portals: no framing, by both mechanisms.
    const base = { "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'" };
    const html = (body) => res.writeHead(200, Object.assign({ "Content-Type": "text/html" }, base)).end("<!doctype html><title>" + name + "</title>" + (ICON_LINK[name] || "") + body);
    const go = (to, extra) => res.writeHead(302, Object.assign({ Location: to }, base, extra)).end();

    if (u.pathname === "/favicon.ico") {
      // Only the 127.0.0.1 host has one, so a portal that ends up on "localhost" has none.
      if (req.headers.host.startsWith("127.0.0.1")) return res.writeHead(200, { "Content-Type": "image/x-icon" }).end(PURPLE_PNG);
      return res.writeHead(404).end();
    }
    if (u.pathname === "/duke/icon.svg") return res.writeHead(200, { "Content-Type": "image/svg+xml" }).end(DUKE_SVG);
    if (u.pathname === "/plain/touch.png") return res.writeHead(200, { "Content-Type": "image/png" }).end(CRIMSON_PNG);
    if (!(name in status)) return res.writeHead(404).end("not found");

    if (!sub && name === "deep") {
      // Starts on a home page with no status on it; the status is one click away.
      return signedIn ? html('<h1>Welcome</h1><p><a id="go" href="/deep/application/status">Your application status</a></p>') : go("/deep/login");
    }
    if (!sub) return name === "hop" ? go("http://localhost:" + PORT + "/hop/status") : go("/" + name + (signedIn ? "/status" : "/login"));
    if (name === "deep" && sub === "application") {
      if (!signedIn) return go("/deep/login");
      return html('<h1>Application</h1><p>Status: <b id="appstatus">' + status.deep + "</b></p>");
    }
    if (sub === "login") {
      if (req.method === "POST") { req.resume(); return req.on("end", () => go(name === "deep" ? "/deep/" : "/" + name + "/status", { "Set-Cookie": "sid_" + name + "=ok; Path=/; SameSite=Lax; Max-Age=3600" })); }
      return html('<h1>Sign in</h1><form method="post"><input name="u" aria-label="user"><input type="password" name="p" aria-label="password"><button id="go">Sign in</button></form>');
    }
    if (sub === "status") {
      if (GATED.has(name) && !signedIn) return go("/" + name + "/login");
      if (name === "spa") return html('<h1>Applicant portal</h1><div id="root"></div><script>setTimeout(function(){document.getElementById("root").innerHTML="<b id=appstatus>' + status.spa + '</b>"},700)</script>');
      if (name === "plain") return html('<div class="box"><p>Welcome back</p><p class="x-998877">' + status.plain + "</p></div>");
      return html('<h1>Applicant portal</h1><p>Application status: <b id="appstatus">' + status[name] + "</b></p>");
    }
    return res.writeHead(404).end();
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}


module.exports = { PORT, BASE, TEST_PASSWORD, status, startServer };
