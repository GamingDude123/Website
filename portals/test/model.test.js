/* The portal list: address safety, wrap-around arrows, "checked today".
 *
 *   node portals/test/model.test.js
 */

const Model = require(__dirname + "/../js/model.js");

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

// ---- addresses: only web addresses may reach an href or an iframe src
const good = [
  ["canvas.school.edu", "https://canvas.school.edu/"],
  ["  canvas.school.edu/login  ", "https://canvas.school.edu/login"],
  ["https://my.school.edu/path?x=1#top", "https://my.school.edu/path?x=1#top"],
  ["HTTP://Portal.School.edu", "http://portal.school.edu/"],
  ["localhost:3000/app", "https://localhost:3000/app"],
  ["//sso.school.edu/login", "https://sso.school.edu/login"],
];
for (const [input, want] of good) {
  check("accepts " + JSON.stringify(input), Model.normalizeUrl(input) === want, Model.normalizeUrl(input));
}
const bad = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "  javascript:alert(document.cookie)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "mailto:a@b.co",
  "ftp://files.school.edu",
  "blob:https://x.y/uuid",
  "https://user:secret@portal.school.edu/",
  "https://",
  "http://",
  "",
  "   ",
  null,
  undefined,
];
for (const input of bad) {
  check("rejects " + JSON.stringify(input), Model.normalizeUrl(input) === null, String(Model.normalizeUrl(input)));
}

// ---- arrows wrap in both directions
check("next from the middle", Model.cycle(1, 1, 4) === 2);
check("next from the last wraps to the first", Model.cycle(3, 1, 4) === 0);
check("back from the first wraps to the last", Model.cycle(0, -1, 4) === 3);
check("a single portal stays put", Model.cycle(0, 1, 1) === 0 && Model.cycle(0, -1, 1) === 0);
check("no portals does not blow up", Model.cycle(0, 1, 0) === 0);
check("walking forward n times comes back to the start", (() => { let i = 2; for (let k = 0; k < 5; k++) i = Model.cycle(i, 1, 5); return i === 2; })());

// ---- checked today
function sample() {
  const d = Model.emptyData();
  for (const n of ["Canvas", "Banner", "Library"]) d.portals.push({ id: n.toLowerCase(), name: n, url: "https://x.edu/", username: "", password: "" });
  return d;
}
const MON = "2026-11-23", TUE = "2026-11-24";
{
  const d = sample();
  check("nothing is checked at first", Model.countChecked(d, MON) === 0);
  check("start at the top when nothing is checked", Model.firstUnchecked(d, MON) === 0);
  Model.setChecked(d, "canvas", true, MON);
  check("checking one counts it", Model.isChecked(d, "canvas", MON) && Model.countChecked(d, MON) === 1);
  check("starts on the first unchecked one", Model.firstUnchecked(d, MON) === 1);
  Model.setChecked(d, "banner", true, MON);
  Model.setChecked(d, "library", true, MON);
  check("all checked", Model.countChecked(d, MON) === 3);
  check("start at the top when everything is checked", Model.firstUnchecked(d, MON) === 0);
  check("a new day starts clean", Model.countChecked(d, TUE) === 0 && !Model.isChecked(d, "canvas", TUE));
  Model.setChecked(d, "banner", true, TUE);
  check("checking on a new day replaces yesterday's list", Model.countChecked(d, TUE) === 1 && d.checked.day === TUE);
  Model.setChecked(d, "banner", false, TUE);
  check("unchecking works", Model.countChecked(d, TUE) === 0);
  Model.setChecked(d, "banner", true, TUE);
  Model.setChecked(d, "banner", true, TUE);
  check("checking twice does not double count", d.checked.ids.length === 1);
}
check("todayKey is the local calendar day", Model.todayKey(new Date(2026, 0, 5, 23, 59)) === "2026-01-05");
check("todayKey pads month and day", Model.todayKey(new Date(2026, 8, 3)) === "2026-09-03");

// ---- reorder and delete
{
  const d = sample();
  check("move down", Model.move(d, "canvas", 1) && d.portals.map((p) => p.id).join() === "banner,canvas,library");
  check("move up", Model.move(d, "library", -1) && d.portals.map((p) => p.id).join() === "banner,library,canvas");
  check("can't move the first one up", Model.move(d, "banner", -1) === false);
  check("can't move the last one down", Model.move(d, "canvas", 1) === false);
  check("unknown id is a no-op", Model.move(d, "nope", 1) === false);
  Model.setChecked(d, "library", true, MON);
  Model.remove(d, "library");
  check("delete removes the portal and its checked mark", d.portals.length === 2 && d.checked.ids.length === 0);
}

// ---- whatever the vault hands back is made safe to use
{
  const dirty = Model.sanitize({
    portals: [
      null, 7, "x",
      { id: "p1", name: "  Canvas  ", url: "canvas.school.edu", username: "me", password: "pw" },
      { id: "p1", name: "Duplicate id", url: "https://b.edu", username: 5, password: {} },
      { id: "p3", name: "", url: "javascript:alert(1)", username: "", password: "" },
      { id: "p4", name: "x".repeat(500), url: "https://ok.edu", username: "u".repeat(999), password: "p".repeat(999) },
    ],
    settings: { embed: "yes", copyOnOpen: "everything" },
    checked: { day: 20261124, ids: ["p1", "ghost", 4] },
  });
  check("junk entries are dropped", dirty.portals.length === 4, dirty.portals.length);
  check("names are trimmed", dirty.portals[0].name === "Canvas");
  check("addresses are normalised", dirty.portals[0].url === "https://canvas.school.edu/");
  check("duplicate ids are made unique", new Set(dirty.portals.map((p) => p.id)).size === 4);
  check("non-string fields become empty strings", dirty.portals[1].username === "" && dirty.portals[1].password === "");
  check("a javascript: address is blanked, not kept", dirty.portals[2].url === "");
  check("an empty name gets a placeholder", dirty.portals[2].name === "Untitled portal");
  check("overlong fields are cut", dirty.portals[3].name.length === 80 && dirty.portals[3].username.length === 200 && dirty.portals[3].password.length === 500);
  check("settings fall back to safe defaults", dirty.settings.embed === false && dirty.settings.copyOnOpen === "password");
  check("a non-string day is dropped", dirty.checked.day === "");
  check("checked ids for portals that don't exist are dropped", dirty.checked.ids.join() === "p1");
  check("garbage in gives an empty list", Model.sanitize(null).portals.length === 0 && Model.sanitize("x").portals.length === 0);
}

check("ids are unique", new Set(Array.from({ length: 500 }, () => Model.newId())).size === 500);
check("hostOf", Model.hostOf("https://canvas.school.edu/a/b") === "canvas.school.edu" && Model.hostOf("nope") === "");

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
