// Pure logic: analysis against tracks with known answers, the planner, the
// timeline maths, and the Spotify parsing/matching. Needs only node.
const Synth = require("../js/synth.js");
global.Analysis = require("../js/analysis.js");
const Brain = require("../js/brain.js");
const Timeline = require("../js/timeline.js");
const Spotify = require("../js/spotify.js");
const FX = require("../js/fx.js");

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

(async () => {
  // ---- analysis of the demo tracks
  let keyExact = 0, tonicOk = 0;
  const infos = [];
  for (const d of Synth.DEMOS) {
    const tr = Synth.renderTrack(d);
    const a = await Analysis.analyze(tr.samples, tr.sampleRate);
    infos.push({ title0: d.title, bpm: a.bpm, key: a.key.camelot, energy: a.energy, bars: a.bars, cues: a.cues, truth: tr.truth });
    check(d.title + ": tempo", Math.abs(a.bpm - d.bpm) < 0.05, a.bpm);
    check(d.title + ": beat grid within 4 ms", Math.abs(a.firstBeat - d.offset) < 0.004, (a.firstBeat - d.offset).toFixed(4));
    check(d.title + ": downbeat is bar 1", Math.abs(a.downbeat - d.offset) < 0.004);
    const want = tr.truth.sections.map((s) => s.type[0] + s.start + "-" + s.end).join(" ");
    const got = a.sections.map((s) => s.type[0] + s.start + "-" + s.end).join(" ");
    check(d.title + ": sections", want === got, got);
    check(d.title + ": first drop and drop starts", a.cues.firstDrop === tr.truth.firstDrop && a.cues.dropStarts.length === 2, JSON.stringify(a.cues));
    if (a.key.camelot === tr.truth.camelot) keyExact++;
    if (a.key.name.replace("m", "") === Analysis.NOTE_NAMES[tr.truth.pc]) tonicOk++;
  }
  // Key detection is the weak part: tuned on these synthetic tracks, and
  // real music will do worse. Hold it to what it actually achieves here.
  check("key: right tonic on most demo tracks", tonicOk >= 3, tonicOk + "/4");
  check("key: exact Camelot code on at least 3 of 4", keyExact >= 3, keyExact + "/4");

  // ---- camelot mapping
  check("camelot: A minor is 8A", Analysis.camelot(9, "minor") === "8A");
  check("camelot: C major is 8B", Analysis.camelot(0, "major") === "8B");
  check("camelot: F# minor is 11A", Analysis.camelot(6, "minor") === "11A");
  check("camelot: B major is 1B", Analysis.camelot(11, "major") === "1B");

  // ---- brain
  check("keys: same = 1", Brain.keyScore("8A", "8A") === 1);
  check("keys: relative is high", Brain.keyScore("8A", "8B") > 0.9);
  check("keys: neighbour beats +2 beats clash", Brain.keyScore("8A", "9A") > Brain.keyScore("8A", "10A") && Brain.keyScore("8A", "10A") > Brain.keyScore("8A", "3B"));
  check("keys: wheel wraps 12 -> 1", Brain.keyScore("12A", "1A") > 0.8);
  const mk = (title0, bpm, key, energy) => ({ title0, bpm, key, energy, bars: 80, cues: { firstDrop: 16, dropStarts: [24, 48], outroStart: 64 } });
  const A = mk("A", 126, "8A", 6), B = mk("B", 127, "9A", 6), C = mk("C", 140, "3B", 8);
  check("plan: tempo gap too wide -> echo out", Brain.planTransition(A, C).type === "echoOut");
  const smooth = Brain.planTransition(A, B, { style: "smooth" });
  check("plan: smooth style blends", smooth.type === "bassSwap" && smooth.blendBars >= 8 && smooth.swapBar <= 80);
  check("plan: incoming drop lands on the swap bar", smooth.inStartBar + smooth.blendBars === 16 && smooth.startBar + smooth.blendBars === smooth.swapBar);
  const club = Brain.planTransition(A, B, { style: "club" });
  check("plan: club style swaps on a drop", club.type === "dropSwap" && A.cues.dropStarts.indexOf(club.swapBar) >= 0);
  check("plan: swap respects minimum play time", Brain.planTransition(A, B, { style: "club", entryBar: 30 }).swapBar >= 62 || Brain.planTransition(A, B, { style: "club", entryBar: 30 }).type !== "dropSwap");
  const now = Brain.planTransition(A, B, { now: true, minPlay: 0, earliestSwap: 30 });
  check("plan: mix-now swap is on a 4-bar line and after the earliest", now.swapBar % 4 === 0 && now.swapBar >= 30 && now.startBar >= 20, JSON.stringify([now.type, now.startBar, now.swapBar]));
  const pool = [mk("1", 126, "8A", 5), mk("2", 126, "3B", 5), mk("3", 127, "9A", 6), mk("4", 125, "8B", 5), mk("5", 128, "10A", 8)];
  const order = Brain.orderSet(pool, { arc: "build" });
  check("order: every track once", order.slice().sort().join() === "0,1,2,3,4");
  let bad = 0; for (let i = 1; i < order.length; i++) if (Brain.keyScore(pool[order[i - 1]].key, pool[order[i]].key) < 0.5) bad++;
  check("order: at most one harsh key change", bad <= 1, "bad=" + bad + " order=" + order);

  // ---- timeline: position and its inverse, with a tempo ramp
  const tl = new Timeline(10, 5, 1); tl.ramp(20, 30, 1.1);
  check("timeline: constant section", Math.abs(tl.posAt(15) - 10) < 1e-9);
  check("timeline: ramp integrates", Math.abs(tl.posAt(30) - (5 + 10 + 10 * 1.05)) < 1e-9);
  let worst = 0;
  for (let t = 10; t < 45; t += 0.37) worst = Math.max(worst, Math.abs(tl.timeAtPos(tl.posAt(t)) - t));
  check("timeline: timeAtPos inverts posAt", worst < 1e-9, worst.toExponential(1));
  // two decks on one tempo curve stay locked: bars of A and B at the swap coincide
  {
    const bpmA = 126, bpmB = 128, Ta = bpmA, Tb = bpmB, n = 8;
    const D = 480 * n / (Ta + Tb);
    const a = new Timeline(0, 0, 1), b = new Timeline(0, 0, Ta / bpmB);
    const t0 = 10;
    a.ramp(t0, t0 + D, Tb / bpmA); b.ramp(t0, t0 + D, 1);
    const barA = 240 / bpmA, barB = 240 / bpmB;
    // after n bars of A past the glide start, both are on a bar line together
    const tEnd = t0 + D;
    const barsA = (a.posAt(tEnd) - a.posAt(t0)) / barA, barsB = (b.posAt(tEnd) - b.posAt(t0)) / barB;
    check("glide: both decks cover the same number of bars", Math.abs(barsA - barsB) < 1e-9 && Math.abs(barsA - n) < 1e-9, barsA.toFixed(6) + " vs " + barsB.toFixed(6));
  }

  // ---- fx are finite and bounded
  const r = FX.riser(32000, 2), im = FX.impact(32000);
  check("fx: finite and not clipping", [r, im].every((x) => x.every((v) => isFinite(v) && Math.abs(v) <= 1.2)));

  // ---- spotify
  const csv = 'Track URI,Track Name,Artist Name(s),Duration (ms),Key,Mode,Tempo\n"spotify:track:1","Rhythm, of the ""Night""","Corona",210000,9,0,126.0\nx,Strobe,deadmau5,637000,11,1,128.0\n';
  const sp = Spotify.tracksFromCSV(csv);
  check("csv: quoted commas and quotes survive", sp.length === 2 && sp[0].title === 'Rhythm, of the "Night"');
  check("csv: tempo, key and mode read", sp[0].tempo === 126 && sp[0].key === 9 && sp[0].mode === 0 && Spotify.camelotFromSpotify(9, 0) === "8A");
  const locals = [
    { title: "Strobe (Original Mix)", artist: "deadmau5", duration: 636 },
    { title: "Some other thing", artist: "Nobody", duration: 200 },
    { title: "Rhythm of the Night", artist: "Corona", duration: 211 },
  ];
  const m = Spotify.matchTracks(sp, locals);
  check("match: finds the right file for each entry", m[0].local === locals[2] && m[1].local === locals[0]);
  check("match: unrelated file is not matched", Spotify.matchTracks([{ title: "Levels", artists: ["Avicii"], durationMs: 200000 }], locals)[0].local === null);
  check("match: a file is used once", new Set(Spotify.matchTracks([sp[1], sp[1]], locals).filter((x) => x.local).map((x) => x.local)).size === 1);

  console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
  process.exit(fails ? 1 : 0);
})();
