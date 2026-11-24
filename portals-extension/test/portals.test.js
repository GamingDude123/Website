/* The logic that needs no browser: the list box, what a status means, addresses.
 *
 *   node portals-extension/test/portals.test.js
 */

const Portals = require(__dirname + "/../portals.js");

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

// ---- addresses: only web addresses may reach a frame or a link
const good = [
  ["canvas.school.edu", "https://canvas.school.edu/"],
  ["  apply.school.edu/status  ", "https://apply.school.edu/status"],
  ["https://my.school.edu/path?x=1#top", "https://my.school.edu/path?x=1#top"],
  ["HTTP://Portal.School.edu", "http://portal.school.edu/"],
  ["localhost:3000/app", "https://localhost:3000/app"],
  ["//sso.school.edu/login", "https://sso.school.edu/login"],
];
for (const [input, want] of good) check("accepts " + JSON.stringify(input), Portals.normalizeUrl(input) === want, Portals.normalizeUrl(input));
for (const input of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///etc/passwd",
  "mailto:a@b.co", "ftp://x.edu", "blob:https://x.y/u", "https://user:secret@portal.edu/", "https://", "", "   ", null, undefined]) {
  check("rejects " + JSON.stringify(input), Portals.normalizeUrl(input) === null);
}

// ---- arrows wrap
check("next from the middle", Portals.cycle(1, 1, 4) === 2);
check("next from the last wraps to the first", Portals.cycle(3, 1, 4) === 0);
check("back from the first wraps to the last", Portals.cycle(0, -1, 4) === 3);
check("one portal stays put", Portals.cycle(0, 1, 1) === 0 && Portals.cycle(0, -1, 1) === 0);
check("no portals doesn't blow up", Portals.cycle(0, 1, 0) === 0);

// ---- the list box
{
  const r = Portals.parseList("Duke apply.duke.edu\nUniversity of Michigan  admissions.umich.edu/status\n\n# a comment\nhttps://www.example.edu\nCanvas, canvas.school.edu\nOhio State - https://apply.osu.edu");
  check("parses name then address", r.errors.length === 0 && r.portals.length === 5, JSON.stringify(r.errors));
  check("names with spaces keep them", r.portals[1].name === "University of Michigan" && r.portals[1].url === "https://admissions.umich.edu/status");
  check("an address alone is named after its host", r.portals[2].name === "example.edu");
  check("a trailing comma or dash on the name is dropped", r.portals[3].name === "Canvas" && r.portals[4].name === "Ohio State");
  check("blank lines and # comments are skipped", r.portals.every((p) => p.name !== "a" && p.name !== "# a comment"));
  check("every portal gets an id and an empty selector", r.portals.every((p) => p.id.length === 16 && p.selector === ""));
}
{
  const bad = Portals.parseList("Duke apply.duke.edu\nJust a name\nEvil javascript:alert(1)\nCanvas canvas\nOk ok.school.edu");
  check("bad lines are reported with their line numbers", bad.errors.map((e) => e.line).join() === "2,3,4", JSON.stringify(bad.errors.map((e) => e.line)));
  check("good lines are still parsed", bad.portals.map((p) => p.name).join() === "Duke,Ok");
  check("a single word is not taken for an address", Portals.parseList("Canvas").errors.length === 1);
  check("localhost is accepted as an address", Portals.parseList("Local localhost:8080").errors.length === 0);
}
{
  const first = Portals.parseList("Duke apply.duke.edu\nMichigan umich.edu").portals;
  first[0].selector = "#status";
  const again = Portals.parseList("Duke (renamed) apply.duke.edu\nNew school.edu\nMichigan umich.edu", first);
  check("an unchanged address keeps its id and picked status", again.portals[0].id === first[0].id && again.portals[0].selector === "#status");
  check("…even when the name changes", again.portals[0].name === "Duke (renamed)");
  const placed = [Object.assign({}, first[0], { checkUrl: "https://apply.duke.edu/portal/status" })];
  check("the page a status was picked on is kept when the list is edited", Portals.parseList("Duke apply.duke.edu", placed).portals[0].checkUrl === "https://apply.duke.edu/portal/status");
  check("…and a portal with none has an empty one", Portals.parseList("Duke apply.duke.edu").portals[0].checkUrl === "");
  check("a new address gets a new id", again.portals[1].id !== first[0].id && again.portals[1].id !== first[1].id && again.portals[1].selector === "");
  check("the other known one is kept too", again.portals[2].id === first[1].id);
  const dup = Portals.parseList("A same.edu\nB same.edu", [first[0]]);
  check("two lines with one address don't share an id", dup.portals[0].id !== dup.portals[1].id);
  const round = Portals.parseList(Portals.formatList(first), first);
  check("formatting and parsing again changes nothing", round.errors.length === 0 && round.portals.map((p) => p.id + p.url).join() === first.map((p) => p.id + p.url).join());
  const paths = Portals.parseList("Duke http://127.0.0.1:9201/duke/\nStatus school.edu/apply/status/\nNoSlash school.edu/apply/status\nQuery school.edu/?a=1").portals;
  const pathsAgain = Portals.parseList(Portals.formatList(paths), paths);
  check("an address with a path keeps its trailing slash when shown for editing", Portals.formatList(paths).split("\n")[0] === "Duke http://127.0.0.1:9201/duke/" && Portals.formatList(paths).split("\n")[1] === "Status school.edu/apply/status/");
  check("…so editing the list never turns one portal into another", pathsAgain.portals.every((q, i) => q.id === paths[i].id && q.url === paths[i].url), pathsAgain.portals.map((q) => q.url).join(" "));
  check("formatted lines drop https:// and a bare host's slash", Portals.formatList([{ name: "Duke", url: "https://apply.duke.edu/" }]) === "Duke apply.duke.edu");
  check("…but keep http://", Portals.formatList([{ name: "L", url: "http://127.0.0.1:9/x" }]) === "L http://127.0.0.1:9/x");
  const many = Portals.parseList(Array.from({ length: 35 }, (_, i) => "P" + i + " p" + i + ".edu").join("\n"));
  check("more than " + Portals.MAX_PORTALS + " portals is refused", many.portals.length === Portals.MAX_PORTALS && many.errors.length === 5);
}

// ---- colours typed into the list
{
  const r = Portals.parseList("Duke apply.duke.edu #001A57\nMichigan umich.edu #00274c #ffcb05\nShort short.edu #0af\nPlain plain.edu");
  check("a typed colour is read", r.errors.length === 0 && r.portals[0].colors.primary === "#001a57" && r.portals[0].colors.secondary === null && r.portals[0].colors.manual === true);
  check("two typed colours are read", r.portals[1].colors.primary === "#00274c" && r.portals[1].colors.secondary === "#ffcb05");
  check("a short #rgb colour is expanded", r.portals[2].colors.primary === "#00aaff");
  check("no colour typed means none yet", r.portals[3].colors === null);
  check("the name and address are unaffected by the colours", r.portals[1].name === "Michigan" && r.portals[1].url === "https://umich.edu/");
  check("colours survive formatting and parsing again", Portals.parseList(Portals.formatList(r.portals), r.portals).portals.map((p) => JSON.stringify(p.colors)).join() === r.portals.map((p) => JSON.stringify(p.colors)).join());
  const known = [{ id: "a1", name: "Duke", url: "https://apply.duke.edu/", selector: "#s", colors: { primary: "#112233", secondary: null, auto: true } }];
  check("colours read from the icon are kept when the line is unchanged", Portals.parseList("Duke apply.duke.edu", known).portals[0].colors.primary === "#112233");
  check("a typed colour replaces a detected one", Portals.parseList("Duke apply.duke.edu #abcdef", known).portals[0].colors.primary === "#abcdef");
  const typed = [{ id: "a1", name: "Duke", url: "https://apply.duke.edu/", selector: "", colors: { primary: "#abcdef", secondary: null, manual: true } }];
  check("taking a typed colour off goes back to detecting it", Portals.parseList("Duke apply.duke.edu", typed).portals[0].colors === null);
}

// ---- reading a logo's colours from its pixels
function pixels(w, h, fn) {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    a.set(c, (y * w + x) * 4);
  }
  return a;
}
const WHITE = [255, 255, 255, 255], CLEAR = [0, 0, 0, 0], BLUE = [0, 39, 76, 255], GOLD = [255, 203, 5, 255], RED = [187, 0, 0, 255];
{
  const crest = Portals.pickPalette(pixels(32, 32, (x, y) => (y < 4 ? WHITE : x < 20 ? BLUE : GOLD)));
  check("a blue and gold crest gives blue, then gold", crest.primary === "#00274c" && crest.secondary === "#ffcb05", JSON.stringify(crest));
  const red = Portals.pickPalette(pixels(32, 32, (x, y) => (x > 6 && x < 26 ? RED : WHITE)));
  check("a red logo on white gives red and no second colour", red.primary === "#bb0000" && red.secondary === null, JSON.stringify(red));
  const clear = Portals.pickPalette(pixels(32, 32, (x) => (x < 16 ? CLEAR : RED)));
  check("transparent pixels are ignored", clear.primary === "#bb0000");
  const black = Portals.pickPalette(pixels(32, 32, (x) => (x < 10 ? [20, 20, 20, 255] : WHITE)));
  check("a black and white logo gives its black", black.primary === "#141414" && black.secondary === null, JSON.stringify(black));
  const none = Portals.pickPalette(pixels(16, 16, () => WHITE));
  check("a blank icon gives nothing", none.primary === null && none.secondary === null);
  check("an empty list of pixels gives nothing", Portals.pickPalette(new Uint8ClampedArray(0)).primary === null);
  const sliver = Portals.pickPalette(pixels(40, 40, (x, y) => (x === 0 && y < 2 ? GOLD : BLUE)));
  check("a speck of another colour isn't a second colour", sliver.primary === "#00274c" && sliver.secondary === null, JSON.stringify(sliver));
  const near = Portals.pickPalette(pixels(32, 32, (x) => (x < 16 ? [0, 39, 76, 255] : [0, 60, 110, 255])));
  check("two blues are one colour, not two", near.secondary === null, JSON.stringify(near));
}
// ---- colours that can be seen
{
  check("a dark blue is left alone", Portals.onWhite("#001a57") === "#001a57");
  const gold = Portals.onWhite("#ffcb05");
  check("a gold is darkened until it shows on white", gold !== "#ffcb05" && Portals.contrast(gold, "#ffffff") >= 3, gold + " " + Portals.contrast(gold, "#ffffff").toFixed(2));
  check("a pale yellow too", Portals.contrast(Portals.onWhite("#ffffaa"), "#ffffff") >= 3);
  check("white itself ends up visible", Portals.contrast(Portals.onWhite("#ffffff"), "#ffffff") >= 3);
  check("no colours means the default blue", Portals.brandFor(null).main === "#1a5fb4" && Portals.brandFor({ failed: true }).accent === "#1a5fb4");
  const b = Portals.brandFor({ primary: "#00274c", secondary: "#ffcb05" });
  check("two colours give a main and an accent", b.main === "#00274c" && b.accent !== b.main && Portals.contrast(b.accent, "#ffffff") >= 3);
  check("one colour is used for both", Portals.brandFor({ primary: "#bb0000", secondary: null }).accent === "#bb0000");
}

// ---- the college directory: a line can be just a name
const DIR = [
  { name: "Harvard University", aliases: ["Harvard"], url: "https://apply.harvard.edu/status", colors: ["#003478"] },
  { name: "Rice University", aliases: ["RU"], url: "https://apply.rice.edu/status", colors: ["#cc0000", "#2d2926"] },
  { name: "Yale University", aliases: ["Yale"], url: "https://apply.yale.edu/status.html", colors: ["#005a43"] },
];
{
  const r = Portals.parseList("Harvard University\nRU\n  yale  \nyale-UNIVERSITY", [], DIR);
  check("a known college needs only its name", r.errors.length === 0 && r.portals.length === 4, JSON.stringify(r.errors));
  check("…and gets its address from the directory", r.portals[0].url === "https://apply.harvard.edu/status" && r.portals[1].url === "https://apply.rice.edu/status");
  check("…its full name, whatever you typed", r.portals.map((p) => p.name).join() === "Harvard University,Rice University,Yale University,Yale University");
  check("…and its colours", r.portals[1].colors.primary === "#cc0000" && r.portals[1].colors.secondary === "#2d2926" && r.portals[0].colors.secondary === null);
  check("directory colours are not 'typed' ones", r.portals[0].colors.manual !== true && r.portals[0].colors.from === "directory");
  check("short names, abbreviations, case and punctuation all match", r.portals[2].name === "Yale University" && r.portals[3].name === "Yale University");
}
{
  const bc = Portals.parseList("Rice College", [], DIR);
  check("a college that is not in the directory is not mistaken for one that is", bc.portals.length === 0 && bc.errors.length === 1 && /don't know that college/.test(bc.errors[0].why), JSON.stringify(bc));
  check("part of a name doesn't match", Portals.parseList("Rice", [], DIR).portals.length === 0 && Portals.parseList("Harvard University of Waltham", [], DIR).portals.length === 0);
  check("without a directory a bare name is still an error, as before", Portals.parseList("Harvard University").errors.length === 1);
  check("findCollege finds by name or alias, and nothing for nonsense", Portals.findCollege("ru", DIR).name === "Rice University" && Portals.findCollege("", DIR) === null && Portals.findCollege("Duke", DIR) === null && Portals.findCollege("RU", []) === null && Portals.findCollege("RU", null) === null);
}
{
  const own = Portals.parseList("Harvard https://portal.example.edu/mine\nRice University #112233 #445566", [], DIR);
  check("an address you type wins over the directory's", own.portals[0].url === "https://portal.example.edu/mine" && own.errors.length === 0);
  check("…and the college keeps its directory colours", own.portals[0].colors.primary === "#003478");
  check("colours you type win over the directory's", own.portals[1].colors.primary === "#112233" && own.portals[1].colors.secondary === "#445566" && own.portals[1].colors.manual === true && own.portals[1].url === "https://apply.rice.edu/status");
  check("a college you type an address for that the directory doesn't know works as before", Portals.parseList("Duke apply.duke.edu", [], DIR).portals[0].url === "https://apply.duke.edu/");
}
{
  const r = Portals.parseList("Harvard University\nRice University\nHarvard https://portal.example.edu/mine\nDuke apply.duke.edu #001a57", [], DIR);
  const box = Portals.formatList(r.portals, DIR);
  check("the list box shows a known college as just its name", box.split("\n")[0] === "Harvard University" && box.split("\n")[1] === "Rice University", box);
  check("…and anything else with its address (and typed colours)", box.split("\n")[2] === "Harvard portal.example.edu/mine" && box.split("\n")[3] === "Duke apply.duke.edu #001a57", box);
  const again = Portals.parseList(box, r.portals, DIR);
  check("editing the list changes nothing, and every portal keeps its id", again.errors.length === 0 && again.portals.every((q, i) => q.id === r.portals[i].id && q.url === r.portals[i].url && q.name === r.portals[i].name), JSON.stringify(again.errors));
  const typedColors = Portals.parseList("Rice University #112233", [], DIR);
  check("a known college with typed colours is its name and the colours", Portals.formatList(typedColors.portals, DIR) === "Rice University #112233");
  check("without the directory the same list shows addresses, so nothing is lost", Portals.formatList(r.portals, []).split("\n")[0] === "Harvard University apply.harvard.edu/status");
}

// ---- what a status means: [text, stage, outcome, action needed]
const cases = [
  ["Submitted", 1, null, false],
  ["Application submitted", 1, null, false],
  ["Application received", 2, null, false],
  ["Application Complete", 2, null, false],
  ["All materials received", 2, null, false],
  ["Under review", 3, null, false],
  ["UNDER REVIEW.", 3, null, false],
  ["Your application is being reviewed by the admissions committee", 3, null, false],
  ["Application submitted and under review", 3, null, false],
  ["In Review", 3, null, false],
  ["Admitted", 4, "admitted", false],
  ["Congratulations! You've been admitted.", 4, "admitted", false],
  ["We are pleased to offer you admission", 4, "admitted", false],
  ["Decision: Not admitted", 4, "denied", false],
  ["We regret to inform you that we are unable to offer you admission", 4, "denied", false],
  ["Denied", 4, "denied", false],
  ["Waitlisted", 4, "waitlisted", false],
  ["You have been placed on the wait list", 4, "waitlisted", false],
  ["Deferred to regular decision", 4, "waitlisted", false],
  // the ones a careless matcher gets wrong
  ["Your application has not been submitted", 0, null, false],
  ["Not yet submitted", 0, null, false],
  ["Not yet under review", 0, null, false],
  ["Application incomplete", 0, null, true],
  ["Incomplete", 0, null, true],
  ["Submitted - missing transcript", 1, null, true],
  ["Action required: upload your transcript", 0, null, true],
  ["Your decision will be released on March 28", 0, null, false],
  ["Decisions", 0, null, false],
  ["Documents not received", 0, null, true],
  ["Not admitted", 4, "denied", false],
  ["", 0, null, false],
  ["Welcome back, Jack", 0, null, false],
];
for (const [text, stage, outcome, action] of cases) {
  const r = Portals.classify(text);
  check("reads " + JSON.stringify(text), r.stage === stage && r.outcome === outcome && r.action === action, JSON.stringify(r));
}
check("garbage in is harmless", Portals.classify(null).stage === 0 && Portals.classify(undefined).outcome === null && Portals.classify(12345).stage === 0);

// ---- how long ago
const T = 1_700_000_000_000;
check("just now", Portals.timeAgo(T - 10_000, T) === "just now");
check("minutes", Portals.timeAgo(T - 5 * 60_000, T) === "5 min ago");
check("hours", Portals.timeAgo(T - 3 * 3_600_000, T) === "3 h ago");
check("a day", Portals.timeAgo(T - 24 * 3_600_000, T) === "1 day ago");
check("days", Portals.timeAgo(T - 3 * 24 * 3_600_000, T) === "3 days ago");
check("a clock that's slightly behind doesn't go negative", Portals.timeAgo(T + 5000, T) === "just now");

check("ids are unique", new Set(Array.from({ length: 500 }, () => Portals.newId())).size === 500);

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
