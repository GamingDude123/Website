/* The DJ's judgement: what to play next, and how to get there.
 *
 * Pure rules over analysis results — no audio. Two questions:
 *
 *   1. Which track follows this one? Harmonic fit (Camelot wheel), tempo
 *      distance, and where the energy should be going.
 *   2. How do we get into it? Pick one of three moves from what the two
 *      tracks' structures allow:
 *        bassSwap  – the incoming intro blends over the outgoing outro with its
 *                    low end held back, and the basslines swap on the one where
 *                    the incoming drop lands.
 *        dropSwap  – the outgoing breakdown builds (filter closing, roll,
 *                    riser) and the incoming drop lands where its own drop
 *                    would have. The move for tracks that will not blend.
 *        echoOut   – the outgoing track throws an echo and is cut on the
 *                    downbeat while the incoming starts at its own tempo. For
 *                    when the tempos are too far apart to match.
 *
 * Every decision comes back with its reasons in plain words.
 */

var Brain = (function () {
  "use strict";

  // In the page Settings is a global; under node it sits next to this file.
  const SET = typeof Settings !== "undefined" ? Settings : require("./settings.js");

  function parseCamelot(k) {
    const m = /^(\d{1,2})([AB])$/.exec(k || "");
    return m ? { n: +m[1], l: m[2] } : null;
  }

  function wheelDistance(a, b) {
    const d = Math.abs(a - b) % 12;
    return Math.min(d, 12 - d);
  }

  // How well two keys sit together, 0..1.
  function keyScore(ka, kb) {
    const a = parseCamelot(ka), b = parseCamelot(kb);
    if (!a || !b) return 0.5;
    const d = wheelDistance(a.n, b.n);
    if (a.l === b.l) {
      if (d === 0) return 1;
      if (d === 1) return 0.88;
      if (d === 2) return 0.55;        // the "energy boost"
      return 0.12;
    }
    if (d === 0) return 0.92;          // relative major/minor
    if (d === 1) return 0.4;
    return 0.1;
  }

  function keyNote(ka, kb) {
    const a = parseCamelot(ka), b = parseCamelot(kb);
    if (!a || !b) return "keys unknown";
    const d = wheelDistance(a.n, b.n);
    if (ka === kb) return "same key (" + ka + ")";
    if (d === 0) return "relative major/minor (" + ka + " to " + kb + ")";
    if (a.l === b.l && d === 1) return "neighbouring keys (" + ka + " to " + kb + ")";
    if (a.l === b.l && d === 2) return "energy-boost key change (" + ka + " to " + kb + ")";
    return "keys " + ka + " and " + kb + " clash";
  }

  function tempoGap(bpmA, bpmB) { return Math.abs(bpmB - bpmA) / bpmA; }

  function energyTarget(arc, i, n) {
    const t = n > 1 ? i / (n - 1) : 0;
    if (arc === "peak") return 8;
    if (arc === "warmup") return 4 + 4 * t;
    if (arc === "wave") return 6 + 2.5 * Math.sin(t * Math.PI * 3 - 0.5);
    return 5 + 4 * t;                     // build
  }

  // How good a follow-up `cand` is to `cur`, 0..1. What counts most, and how
  // much tempo difference is tolerated, come from the settings.
  function scoreNext(cur, cand, targetEnergy, settings) {
    const st = SET.sanitize(settings || SET.DEFAULTS);
    const w = SET.weights(st);
    const ks = keyScore(cur.key, cand.key);
    const gap = tempoGap(cur.bpm, cand.bpm);
    const tempo = Math.max(0, 1 - gap / Math.max(0.08, st.maxTempoGap / 100));
    const energy = 1 - Math.min(1, Math.abs(cand.energy - targetEnergy) / 5);
    // a strict DJ treats a key clash as disqualifying, not just unattractive
    const clash = st.keyStrictness === "strict" && ks < 0.55 ? 0.35 : 1;
    return (w.key * ks + w.tempo * tempo + w.energy * energy) * clash;
  }

  // Order a pool of tracks into a set: greedy, with one step of lookahead so it
  // does not paint itself into a corner. `items` are {key, bpm, energy}.
  function orderSet(items, opts) {
    opts = opts || {};
    const n = items.length;
    if (n < 3) return items.map(function (_, i) { return i; });
    const st = SET.sanitize(opts.settings || SET.DEFAULTS);
    const arc = opts.arc || st.arc;
    let start = opts.start;
    if (start == null) {
      // open with the track closest to the arc's starting energy, slowest first
      const t0 = energyTarget(arc, 0, n);
      start = 0;
      items.forEach(function (it, i) {
        if (Math.abs(it.energy - t0) + 0.02 * it.bpm < Math.abs(items[start].energy - t0) + 0.02 * items[start].bpm) start = i;
      });
    }
    const order = [start], left = items.map(function (_, i) { return i; }).filter(function (i) { return i !== start; });
    while (left.length) {
      const cur = items[order[order.length - 1]];
      const target = energyTarget(arc, order.length, n);
      let best = -1, bestScore = -Infinity;
      left.forEach(function (i) {
        let s = scoreNext(cur, items[i], target, st);
        const rest = left.filter(function (j) { return j !== i; });
        if (rest.length) s += 0.3 * Math.max.apply(null, rest.map(function (j) { return scoreNext(items[i], items[j], energyTarget(arc, order.length + 1, n), st); }));
        if (s > bestScore) { bestScore = s; best = i; }
      });
      order.push(best);
      left.splice(left.indexOf(best), 1);
    }
    return order;
  }

  const snapUp = function (b, n) { return Math.ceil(b / n) * n; };

  // out/inn are analysis results (plus .key as a Camelot string and .bpm).
  // opts: { entryBar (out track bar at which it came in), earliestSwap (out bar),
  //         style: 'mixed'|'smooth'|'club', now: bool, minPlay: bars, index }
  function planTransition(out, inn, opts) {
    opts = opts || {};
    const base = SET.sanitize(opts.settings || SET.DEFAULTS);
    const ksEarly = keyScore(out.key, inn.key);
    const tuned = SET.autoTune(out, inn, base, ksEarly);     // fills in "auto" and nudges flair / play time
    const st = tuned.settings;
    const style = opts.style || st.style;
    const floors = SET.keyFloors(st);
    const blendLimit = st.maxTempoGap / 100;
    const echoGap = Math.max(0.08, blendLimit);        // beyond this nothing is beatmatched
    const rand = SET.rng(out.title0 + "|" + inn.title0 + "|" + (opts.index || 0));
    const reasons = [];
    const gap = tempoGap(out.bpm, inn.bpm);
    const ks = keyScore(out.key, inn.key);
    const introBars = inn.cues.firstDrop;
    const outroStart = out.cues.outroStart;
    const entryBar = opts.entryBar || 0;
    const minSwap = Math.max(opts.earliestSwap || 0, entryBar + (opts.minPlay == null ? st.minPlay : opts.minPlay));
    const gapPct = (gap * 100).toFixed(1) + "%";

    function blendOption() {
      if (gap > blendLimit || ks < floors.blend) return null;
      if (introBars < 8) return null;
      let L = 0;
      // how long a blend may run: the setting caps it; "auto" lets close keys go long
      let wanted = st.blendBars === "auto" ? (ks >= 0.9 && style !== "club" ? [32, 16, 8] : [16, 8])
        : [32, 16, 8].filter(function (n) { return n <= st.blendBars; });
      // "mix now" has to start within a few bars, so it only ever uses a short blend
      if (opts.now) wanted = [8];
      let swap = 0;
      for (let i = 0; i < wanted.length && !L; i++) {
        const l = wanted[i];
        if (l > introBars) continue;
        let s;
        if (opts.now) s = snapUp(minSwap, 4);
        else {
          s = outroStart + l;
          // a long outro leaves tail after the swap; let the blend sit toward the end
          const spare = out.bars - s - 4;
          if (spare >= 8) s += Math.floor(spare / 8) * 8;
        }
        if (s - l < 0 || s > out.bars || s < minSwap) continue;
        L = l; swap = s;
      }
      return L ? { type: "bassSwap", blendBars: L, swapBar: swap, inLand: introBars, tail: Math.max(0, Math.min(4, out.bars - swap)) } : null;
    }

    function dropOption() {
      if (gap > echoGap || ks < floors.drop) return null;
      let swap = 0;
      if (opts.now) swap = snapUp(minSwap + 4, 4);
      else {
        const cands = out.cues.dropStarts.filter(function (x) { return x >= minSwap; });
        if (!cands.length) return null;
        swap = cands[cands.length - 1];
      }
      if (swap > out.bars) return null;
      return { type: "dropSwap", blendBars: 0, swapBar: swap, inLand: introBars, tail: 0 };
    }

    function echoOption() {
      let swap;
      if (opts.now) swap = snapUp(minSwap, 4);
      else {
        swap = Math.max(minSwap, outroStart < out.bars ? outroStart : out.bars - 8);
        swap = Math.min(snapUp(swap, 4), Math.floor(out.bars / 4) * 4);
      }
      return { type: "echoOut", blendBars: 0, swapBar: swap, inLand: 0, tail: 0 };
    }

    const blend = blendOption(), drop = dropOption();
    let pick = null;
    let switched = false;
    if (gap > echoGap) {
      pick = echoOption();
      reasons.push("tempos are " + gapPct + " apart, too far to beatmatch — echo out and start clean");
    } else if (!blend && !drop) {
      pick = echoOption();
      reasons.push(ks < 0.4 ? keyNote(out.key, inn.key) + " and the structures offer no safe overlap — echo out" : "no overlap or breakdown to land on — echo out");
    } else if (blend && drop) {
      // smoother by default: blend unless the incoming track is clearly bigger
      const base = style === "smooth" ? blend : style === "club" ? drop : (inn.energy >= out.energy + 2 ? drop : blend);
      // variety: now and then, take the move it would not normally take
      const chance = (style === "mixed" ? st.variety : st.variety / 2) / 100;
      switched = rand() < chance;
      pick = switched ? (base === blend ? drop : blend) : base;
    } else pick = blend || drop;

    if (pick.type === "bassSwap") {
      reasons.push(pick.blendBars + "-bar blend: " + inn.title0 + "'s intro rides over the outro, bass swaps where its drop lands");
      reasons.push(keyNote(out.key, inn.key) + ", tempo " + gapPct + " apart");
      if (switched) reasons.push("switching it up — variety is set to " + st.variety + "%");
    } else if (pick.type === "dropSwap") {
      if (switched) reasons.push("switching it up — variety is set to " + st.variety + "%");
      reasons.push("build into " + (opts.now ? "the next phrase" : "the last breakdown") + ", then " + inn.title0 + "'s drop lands on the one");
      reasons.push(blend ? (switched ? "a blend was possible too" : "the incoming track is much bigger, so the drop swap beats a quiet blend") :
        (gap > blendLimit ? "tempos are " + gapPct + " apart, over your " + st.maxTempoGap + "% blend limit" :
          ks < floors.blend ? "keys are too far apart to blend at '" + st.keyStrictness + "' strictness" :
            introBars < 8 ? "its intro is too short to blend" : "no clean outro to blend over"));
      reasons.push(keyNote(out.key, inn.key) + ", tempo " + gapPct + " apart");
    }

    tuned.notes.forEach(function (n) {
      // only the notes that bear on this move
      if (/bass swap/.test(n) && pick.type !== "bassSwap") return;
      reasons.push("auto: " + n);
    });
    const buildBars = pick.type === "bassSwap" ? 0 : (pick.type === "dropSwap" ? 8 : 2);
    const rise = inn.energy - out.energy;
    const isBlend = pick.type === "bassSwap", flair = st.flair;
    return {
      type: pick.type,
      swapBar: pick.swapBar,                       // out-track bar where the new one lands
      blendBars: pick.blendBars,                   // overlap before that, in bars
      startBar: pick.swapBar - pick.blendBars,     // out-track bar where the incoming starts playing
      inLandBar: pick.inLand,                      // in-track bar that lands on swapBar
      inStartBar: pick.inLand - pick.blendBars,
      buildBars: buildBars,
      tailBars: pick.tail,
      // effects: each has its own switch, and flair decides how showy it gets
      roll: st.rolls && !isBlend && style !== "smooth" && flair >= 50,
      riser: st.risers && (isBlend ? (rise >= 2 && flair >= 25) || flair >= 80 : flair >= 25),
      impact: st.impacts && (isBlend ? (rise >= 1 && flair >= 15) || flair >= 70 : flair >= 15),
      echoThrow: st.echoThrows && !isBlend && flair >= 30,
      crash: st.sweeps && pick.type === "dropSwap" && flair >= 70,
      downlifter: st.sweeps && pick.type === "echoOut" && flair >= 45,
      bassSwapMode: st.bassSwap,
      intensity: flair / 100,
      amounts: { echo: st.echoAmount, reverb: st.reverbAmount },
      switched: switched,
      keyScore: ks,
      tempoGap: gap,
      reasons: reasons,
    };
  }

  function label(plan) {
    return { bassSwap: "Bass swap", dropSwap: "Drop swap", echoOut: "Echo out" }[plan.type] +
      (plan.blendBars ? " · " + plan.blendBars + " bars" : "");
  }

  return {
    keyScore: keyScore,
    keyNote: keyNote,
    tempoGap: tempoGap,
    energyTarget: energyTarget,
    scoreNext: scoreNext,
    orderSet: orderSet,
    planTransition: planTransition,
    label: label,
    parseCamelot: parseCamelot,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Brain;
