// Pure logic: analysis against tracks with known answers, the planner, the
// timeline maths, and the Spotify parsing/matching. Needs only node.
const Synth = require("../js/synth.js");
global.Settings = require("../js/settings.js");
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

  // ---- settings: validation and presets
  {
    const S = Settings;
    const bad = S.sanitize({ style: "nonsense", flair: 9999, minPlay: "50", blendBars: "16", rolls: "yes", maxTempoGap: -4, wKey: NaN, junk: 1 });
    check("settings: junk is replaced, numbers clamped and snapped", bad.style === "mixed" && bad.flair === 100 && bad.minPlay === 52 && bad.blendBars === 16 && bad.rolls === true && bad.maxTempoGap === 1 && bad.wKey === 45 && !("junk" in bad), JSON.stringify(bad).slice(0, 120));
    check("settings: sanitising is idempotent", JSON.stringify(S.sanitize(bad)) === JSON.stringify(bad));
    check("settings: undefined and garbage give the defaults", JSON.stringify(S.sanitize()) === JSON.stringify(S.make()) && JSON.stringify(S.sanitize("x")) === JSON.stringify(S.make()));
    check("settings: every preset is valid and recognised as itself", Object.keys(S.PRESETS).every((id) => S.presetOf(S.applyPreset(id)) === id));
    check("settings: touching anything makes it custom", S.presetOf(S.make({ flair: 3 })) === "custom");
    check("settings: output toggles do not change which vibe it is", S.presetOf(S.make({ endless: false, fx: false, levelMatch: false, auto: false })) === "balanced");
    const w = S.weights(S.make({ wKey: 50, wTempo: 25, wEnergy: 25 }));
    check("settings: weights are normalised", Math.abs(w.key + w.tempo + w.energy - 1) < 1e-9 && w.key === 0.5);
    check("settings: all-zero weights fall back to sensible ones", Math.abs(S.weights(S.make({ wKey: 0, wTempo: 0, wEnergy: 0 })).key - 0.45) < 1e-9);
  }

  // ---- settings steer the planner
  {
    const mk2 = (title0, bpm, key, energy, firstDrop) => ({ title0, bpm, key, energy, bars: 80, cues: { firstDrop: firstDrop || 16, dropStarts: [24, 48], outroStart: 64 } });
    const P = (a, b, o) => Brain.planTransition(a, b, o);
    const SM = (o) => Settings.make(Object.assign({ style: "smooth", auto: false }, o));
    const x = mk2("X", 126, "8A", 6), y = mk2("Y", 127, "8A", 6);

    check("blend length: 8 is a cap, not a target", P(x, y, { settings: SM({ blendBars: 8 }) }).blendBars === 8);
    check("blend length: 16 caps at 16 even for the same key", P(x, y, { settings: SM({ blendBars: 16 }) }).blendBars === 16);
    check("blend length: auto goes long for the same key", P(x, y, { settings: SM({ blendBars: "auto" }) }).blendBars >= 16);
    check("blend length: cannot exceed what the intro allows", P(x, mk2("Z", 126, "8A", 6, 8), { settings: SM({ blendBars: 32 }) }).blendBars <= 8);

    const far = mk2("F", 131, "8A", 6);                      // 4% apart
    check("tempo tolerance: blends within the limit", P(x, far, { settings: SM({ maxTempoGap: 5 }) }).type === "bassSwap");
    check("tempo tolerance: refuses to blend past it", P(x, far, { settings: SM({ maxTempoGap: 3 }) }).type !== "bassSwap");

    const nb = mk2("N", 127, "10A", 6);                       // two steps on the wheel: 0.55
    check("key strictness: balanced blends a +2 key", P(x, nb, { settings: SM({ keyStrictness: "balanced" }) }).type === "bassSwap");
    check("key strictness: strict will not", P(x, nb, { settings: SM({ keyStrictness: "strict" }) }).type !== "bassSwap");
    const clash = mk2("C", 127, "3B", 6);
    check("key strictness: loose will blend a clash", P(x, clash, { settings: SM({ keyStrictness: "loose" }) }).type === "bassSwap");
    check("key strictness: balanced will not", P(x, clash, { settings: SM({ keyStrictness: "balanced" }) }).type !== "bassSwap");

    check("min play: a longer minimum pushes the move later or removes it", (() => {
      const short = P(x, y, { settings: SM({ style: "club", minPlay: 8 }) }), long = P(x, y, { settings: SM({ style: "club", minPlay: 64 }) });
      return short.swapBar <= long.swapBar || long.type !== "dropSwap";
    })());

    // variety is deterministic, and zero means never
    const flips = (v) => { let n = 0; for (let i = 0; i < 60; i++) if (P(mk2("A" + i, 126, "8A", 6), mk2("B" + i, 127, "8A", 6), { settings: SM({ style: "mixed", variety: v }), index: i }).switched) n++; return n; };
    check("variety 0 never switches", flips(0) === 0);
    check("variety 100 switches most of the time", flips(100) >= 45, flips(100) + "/60");
    check("variety is deterministic for the same pair", JSON.stringify(P(x, y, { settings: SM({ variety: 60 }), index: 3 })) === JSON.stringify(P(x, y, { settings: SM({ variety: 60 }), index: 3 })));

    // effects: switches and flair
    const big = mk2("Big", 127, "8A", 9), club = (o) => Settings.make(Object.assign({ style: "club", auto: false }, o));
    const hi = P(x, big, { settings: club({ flair: 100 }) }), lo = P(x, big, { settings: club({ flair: 10 }) });
    check("flair: high flair rolls, rises, hits and crashes", hi.type === "dropSwap" && hi.roll && hi.riser && hi.impact && hi.echoThrow && hi.crash);
    check("flair: low flair strips the lot", !lo.roll && !lo.riser && !lo.impact && !lo.echoThrow && !lo.crash, JSON.stringify([lo.roll, lo.riser, lo.impact, lo.echoThrow]));
    check("effects: each switch turns its own effect off", (() => {
      const p = P(x, big, { settings: club({ flair: 100, rolls: false, risers: false, impacts: false, echoThrows: false, sweeps: false }) });
      return !p.roll && !p.riser && !p.impact && !p.echoThrow && !p.crash;
    })());
    check("effects: the plan carries intensity and amounts to the mixer", hi.intensity === 1 && hi.amounts.echo === 55 && hi.amounts.reverb === 45);

    // auto-tune
    const same = mk2("S", 127, "8A", 9), near = mk2("Nr", 127, "9A", 3);
    const au = (t, o) => P(x, t, { settings: Settings.make(Object.assign({ style: "smooth" }, o)) });
    check("auto: same key and a clear lift gets a hard bass swap", au(same, {}).bassSwapMode === "hard");
    check("auto: otherwise it is soft", au(near, {}).bassSwapMode === "smooth" && au(mk2("Q", 127, "8A", 6), {}).bassSwapMode === "smooth");
    check("auto: a big incoming track gets more flair than a gentle one", au(same, {}).intensity > au(near, {}).intensity);
    check("auto: it explains itself", au(same, {}).reasons.some((r) => /^auto:/.test(r)));
    check("auto off: nothing nudged, 'auto' bass swap becomes hard", (() => { const p = au(near, { auto: false }); return p.bassSwapMode === "hard" && p.intensity === 0.6 && !p.reasons.some((r) => /^auto:/.test(r)); })());
    check("auto: an explicit bass swap choice is respected", au(near, { bassSwap: "hard" }).bassSwapMode === "hard" && au(same, { bassSwap: "smooth" }).bassSwapMode === "smooth");
    check("auto: gives a high-energy track less time, a low-energy one more", (() => {
      const hiE = mk2("H", 127, "8A", 9), loE = mk2("L", 127, "8A", 3);
      return Settings.autoTune(hiE, y, Settings.make({}), 1).settings.minPlay < 32 && Settings.autoTune(loE, y, Settings.make({}), 1).settings.minPlay > 32;
    })());

    // ordering follows the weights
    const items = [mk2("a", 126, "8A", 5), mk2("b", 126, "3B", 5), mk2("c", 133, "8A", 5), mk2("d", 127, "9A", 5)];
    const keyFirst = Brain.orderSet(items, { settings: Settings.make({ wKey: 100, wTempo: 0, wEnergy: 0, keyStrictness: "strict" }), start: 0 });
    check("ordering: a key-only DJ sees the key clash last", keyFirst[keyFirst.length - 1] === 1 || keyFirst[keyFirst.length - 1] === 2, keyFirst.join());
    const tempoFirst = Brain.orderSet(items, { settings: Settings.make({ wKey: 0, wTempo: 100, wEnergy: 0 }), start: 0 });
    check("ordering: a tempo-only DJ leaves the 133 BPM track last", tempoFirst[tempoFirst.length - 1] === 2, tempoFirst.join());

    // mix now: a short blend that starts a few bars away, never in the past
    const nowPlan = P(x, y, { now: true, minPlay: 0, earliestSwap: 30, settings: Settings.make({ style: "smooth" }) });
    check("mix now: blends are short and start no earlier than a few bars from now", nowPlan.type === "bassSwap" && nowPlan.blendBars === 8 && nowPlan.startBar >= 22, JSON.stringify([nowPlan.type, nowPlan.blendBars, nowPlan.startBar, nowPlan.swapBar]));
  }

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
  for (const [name, chans] of [["riser", FX.riser(44100, 3)], ["impact", FX.impact(44100)], ["crash", FX.crash(44100)], ["downlifter", FX.downlifter(44100, 2)]]) {
    check("fx " + name + ": finite and not clipping", chans.every((c) => c.every((v) => isFinite(v) && Math.abs(v) <= 0.95)));
  }
  {
    // the riser: builds smoothly, brightens as it goes, is wide, and leaves a gap for the hit
    const sr = 44100, [L, R] = FX.riser(sr, 4), n = L.length, W = Math.floor(n / 8);
    const rms = [], bright = [];
    for (let k = 0; k < 8; k++) {
      let e = 0, d = 0;
      for (let i = k * W + 1; i < (k + 1) * W; i++) { e += L[i] * L[i]; d += (L[i] - L[i - 1]) ** 2; }
      rms.push(Math.sqrt(e / W)); bright.push(Math.sqrt(d / (e + 1e-12)));
    }
    const rising = (a) => a.every((v, i) => i === 0 || v > a[i - 1]);
    check("riser: loudness rises every eighth", rising(rms), rms.map((v) => v.toFixed(3)).join(" "));
    check("riser: brightens every eighth (the filter sweeps up)", rising(bright), bright.map((v) => v.toFixed(2)).join(" "));
    check("riser: starts from silence", Math.max.apply(null, Array.from(L.slice(0, 441)).map(Math.abs)) < 0.01);
    check("riser: ends in a dip so the hit lands in a gap", Math.abs(L[n - 1]) < 0.005 && Math.abs(R[n - 1]) < 0.005);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num += L[i] * R[i]; da += L[i] * L[i]; db += R[i] * R[i]; }
    check("riser: wide stereo (channels uncorrelated)", Math.abs(num / Math.sqrt(da * db)) < 0.2);
    // a click is a jump at an edge: check the first and last few milliseconds
    const edge = Math.floor(sr * 0.003);
    let head = 0, tail = 0;
    for (let i = 1; i < edge; i++) head = Math.max(head, Math.abs(L[i] - L[i - 1]));
    for (let i = n - edge; i < n; i++) tail = Math.max(tail, Math.abs(L[i] - L[i - 1]));
    check("riser: no clicks at either end", head < 0.01 && tail < 0.05, "head=" + head.toFixed(4) + " tail=" + tail.toFixed(4));
  }
  {
    const imp = FX.impact(44100)[0];
    // the hit is low: nearly all its energy is below ~150 Hz worth of movement
    let e = 0, d = 0; for (let i = 1; i < 8820; i++) { e += imp[i] * imp[i]; d += (imp[i] - imp[i - 1]) ** 2; }
    check("impact: a low thump, not a click", Math.sqrt(d / e) < 0.25, Math.sqrt(d / e).toFixed(3));
  }

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

  // ---- review fixes
  {
    const O = mk("O", 126, "8A", 8), I9 = mk("I", 126.5, "8A", 9), I4 = mk("I", 127, "8A", 4);
    const quiet = Settings.make({ flair: 20, auto: true, style: "smooth" });
    const p = Brain.planTransition(O, I9, { settings: quiet });
    check("auto-tune: a low flair is not raised across an effect threshold", p.intensity < 0.25 && !p.riser, "intensity=" + p.intensity + " riser=" + p.riser);
    const down = Brain.planTransition(O, I4, { settings: Settings.make({ flair: 60, auto: true, style: "smooth" }) });
    check("auto-tune: still tones the show down for a gentle track", down.intensity < 0.6, "intensity=" + down.intensity);
    const clubQuiet = Brain.planTransition(O, I4, { settings: Settings.make({ style: "club", variety: 0, auto: false }) });
    check("log: club style does not claim the incoming track is bigger", clubQuiet.type === "dropSwap" && !clubQuiet.reasons.some((r) => /much bigger/.test(r)), clubQuiet.reasons.join(" | "));
    const strict = Brain.planTransition(mk("O", 124, "8A", 7), mk("I", 124.9, "9B", 7), { settings: Settings.make({ keyStrictness: "strict", auto: false }) });
    check("log: strict key matching is blamed for the echo out", strict.type === "echoOut" && /key matching/.test(strict.reasons.join(" ")), strict.reasons.join(" | "));
  }

  console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
  process.exit(fails ? 1 : 0);
})();
