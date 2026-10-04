/* The DJ's judgement: what to play next, and how to get there.
 *
 * Pure rules over analysis results — no audio. Two questions:
 *
 *   1. Which track follows this one? Harmonic fit (Camelot wheel), tempo
 *      distance, and where the energy should be going.
 *   2. How do we get into it? Pick one of five moves from what the two
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
 *        brake     – the outgoing deck winds down like a stopped record over
 *                    its last beats and the incoming track lands on the one.
 *        spinback  – the outgoing deck is wound backwards, fast, as the
 *                    incoming track lands on the one.
 *      The last three need no key or tempo match, so a library of mixed
 *      keys and tempos still gets a varied set instead of one move repeated.
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
  // opts: { entryBar (out track bar at which it came in), earliestSwap (out bar), earliestStart (out bar),
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
    const rideBars = introBars === 0 ? 8 : introBars;      // no intro detected: its first eight bars are there to blend over
    const outroStart = out.cues.outroStart;
    const entryBar = opts.entryBar || 0;
    const minSwap = Math.max(opts.earliestSwap || 0, entryBar + (opts.minPlay == null ? st.minPlay : opts.minPlay));
    const gapPct = (gap * 100).toFixed(1) + "%";

    function blendOption() {
      if (gap > blendLimit || ks < floors.blend) return null;
      let L = 0;
      // how long a blend may run: the setting caps it; "auto" lets close keys go long
      let wanted = st.blendBars === "auto" ? (ks >= 0.9 && style !== "club" ? [32, 16, 8] : [16, 8])
        : [32, 16, 8].filter(function (n) { return n <= st.blendBars; });
      // "mix now" has to start within a few bars, so it only ever uses a short blend
      if (opts.now) wanted = [8];
      let swap = 0;
      for (let i = 0; i < wanted.length && !L; i++) {
        const l = wanted[i];
        if (l > rideBars) continue;
        let s;
        if (opts.now) s = snapUp(minSwap, 4);
        else {
          s = outroStart + l;
          // a long outro leaves tail after the swap; let the blend sit toward the end
          const spare = out.bars - s - 4;
          if (spare >= 8) s += Math.floor(spare / 8) * 8;
        }
        if (s - l < Math.max(0, opts.earliestStart || 0) || s > out.bars || s < minSwap) continue;
        L = l; swap = s;
      }
      return L ? { type: "bassSwap", blendBars: L, swapBar: swap, inLand: rideBars, tail: Math.max(0, Math.min(4, out.bars - swap)) } : null;
    }

    function dropOption() {
      if (ks < floors.drop) return null;
      let swap = 0;
      if (opts.now) swap = snapUp(minSwap + 4, 4);
      else {
        const cands = out.cues.dropStarts.filter(function (x) { return x >= minSwap; });
        if (cands.length) swap = cands[cands.length - 1];
        else {
          // no breakdown-and-drop to land on: cut on a phrase line near where the outro starts
          const near = Math.round(Math.min(outroStart, out.bars - 8) / 8) * 8;
          swap = Math.max(snapUp(minSwap, 8), near);
          if (swap > out.bars - 4) return null;
        }
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

    // The clean exits: no key or tempo match needed, so they are always possible.
    // Which one is picked is a weighted draw (the same pair always draws the same).
    const rise0 = inn.energy - out.energy;
    function exitOption(withDrop) {
      const flairK = st.flair / 100;
      const w = [["echoOut", 2]];
      // tempos too far apart to match do not rule out a drop: the new track just lands at its own tempo
      if (withDrop) w.push(["dropSwap", 3 * (style === "club" ? 1.8 : style === "smooth" ? 0.5 : 1)]);
      if (st.brakes) {
        w.push(["brake", style === "smooth" ? 0.5 : 2.2 * (0.5 + flairK) * (rise0 >= 2 ? 1.5 : 1)]);
        w.push(["spinback", style === "smooth" ? 0 : 1.6 * (0.4 + flairK) * (out.energy >= 8 ? 1.4 : 1)]);
      }
      if (st.tricks && style !== "smooth") w.push(["stutter", 1.7 * (0.5 + flairK)]);
      const total = w.reduce(function (t, x) { return t + x[1]; }, 0);
      let r = rand() * total, type = w[0][0];
      for (let i = 0; i < w.length; i++) { if (r < w[i][1]) { type = w[i][0]; break; } r -= w[i][1]; }
      if (type === "dropSwap") return withDrop;
      let swap;
      if (opts.now) swap = Math.min(snapUp(minSwap, 4), Math.max(Math.floor(out.bars / 4) * 4, minSwap));     // not past the end of the track, unless it already is
      else {
        swap = Math.max(minSwap, outroStart < out.bars ? outroStart : out.bars - 8);
        swap = Math.min(snapUp(swap, 4), Math.floor(out.bars / 4) * 4);
      }
      return { type: type, blendBars: 0, swapBar: swap, inLand: 0, tail: 0 };
    }
    const EXIT_NAME = { echoOut: "echo out", brake: "vinyl brake", spinback: "spinback", stutter: "stutter cut" };
    const fresh = gap > echoGap;                                  // beyond this the incoming track does not follow the outgoing tempo

    const blend = blendOption(), drop = dropOption();
    let pick = null;
    let switched = false;
    if (gap > echoGap) {
      pick = exitOption(drop);
      reasons.push("tempos are " + gapPct + " apart, too far to beatmatch — " + (pick.type === "dropSwap" ? "build and drop, with " + inn.title0 + " landing at its own tempo" : EXIT_NAME[pick.type] + " and start clean"));
    } else if (!blend && !drop) {
      pick = exitOption();
      reasons.push(ks < floors.drop ? keyNote(out.key, inn.key) + " is too far apart for '" + st.keyStrictness + "' key matching, and the structures offer no safe overlap — " + EXIT_NAME[pick.type] :
        "no overlap or breakdown to land on — " + EXIT_NAME[pick.type]);
    } else if (blend && drop) {
      // smoother by default: blend unless the incoming track is clearly bigger
      const base = style === "smooth" ? blend : style === "club" ? drop : (inn.energy >= out.energy + 2 ? drop : blend);
      // variety: now and then, take the move it would not normally take
      const chance = (style === "mixed" ? st.variety : st.variety / 2) / 100;
      switched = rand() < chance;
      pick = switched ? (base === blend ? drop : blend) : base;
    } else {
      // only one safe move is on offer; it is not the only move, so now and then
      // take a clean exit instead of repeating it
      const only = blend || drop;
      const keep = only === blend ? (style === "smooth" ? 0.92 : style === "club" ? 0.55 : 0.75) : (style === "club" ? 0.8 : style === "smooth" ? 0.35 : 0.55);
      if (rand() < keep) pick = only;
      else {
        pick = exitOption();
        reasons.push("a " + (only === blend ? "blend" : "drop swap") + " was possible, but this set keeps its moves varied — " + EXIT_NAME[pick.type]);
      }
    }

    if (pick.type === "bassSwap") {
      reasons.push(pick.blendBars + "-bar blend: " + (introBars === 0 ? "no intro was detected in " + inn.title0 + ", so its first eight bars ride over the outro and the bass swaps on its ninth" : inn.title0 + "'s intro rides over the outro, bass swaps where its drop lands"));
      reasons.push(keyNote(out.key, inn.key) + ", tempo " + gapPct + " apart");
      if (switched) reasons.push("switching it up — variety is set to " + st.variety + "%");
    } else if (pick.type === "dropSwap") {
      if (switched) reasons.push("switching it up — variety is set to " + st.variety + "%");
      reasons.push("build into " + (opts.now ? "the next phrase" : out.cues.dropStarts.length ? "the last breakdown" : "the next phrase line") + ", then " + inn.title0 + "'s drop lands on the one");
      reasons.push(blend ? (switched ? "a blend was possible too" : style === "club" ? "club style swaps on a drop rather than blending" : "the incoming track is much bigger, so the drop swap beats a quiet blend") :
        (gap > blendLimit ? "tempos are " + gapPct + " apart, over your " + st.maxTempoGap + "% blend limit" :
          ks < floors.blend ? "keys are too far apart to blend at '" + st.keyStrictness + "' strictness" :
            introBars < 8 ? "its intro is too short to blend" : "no clean outro to blend over"));
      reasons.push(keyNote(out.key, inn.key) + ", tempo " + gapPct + " apart");
    } else if (pick.type === "brake") {
      reasons.push("the deck winds down like a stopped record over its last two beats, then " + inn.title0 + " lands on the one");
    } else if (pick.type === "spinback") {
      reasons.push("the outgoing track is wound backwards, fast, as " + inn.title0 + " lands on the one");
    } else if (pick.type === "stutter") {
      reasons.push("the last two beats are chopped by a gate that speeds up, then " + inn.title0 + " lands on the one");
    }

    tuned.notes.forEach(function (n) {
      // only the notes that bear on this move
      if (/bass swap/.test(n) && pick.type !== "bassSwap") return;
      reasons.push("auto: " + n);
    });
    // Two voices at once is a mess: when the outgoing track has a centred vocal or lead in the
    // overlap and so does the intro riding over it, the outgoing one is taken out until the swap.
    let vox = null;
    if (pick.type === "bassSwap" && st.voxAuto && out.stereo !== false && inn.stereo !== false && out.lead && inn.lead) {
      const avg = function (arr, a, b) { let t = 0, n = 0; for (let i = Math.max(0, Math.floor(a)); i < Math.min(arr.length, Math.ceil(b)); i++) { t += arr[i]; n++; } return n ? t / n : 0; };
      const o = avg(out.lead, pick.swapBar - pick.blendBars, pick.swapBar), i = avg(inn.lead, pick.inLand - pick.blendBars, pick.inLand);
      if (o >= 0.5 && i >= 0.5) {
        vox = { out: "cut" };
        reasons.push("both tracks have a vocal or lead in the middle during the blend, so " + out.title0 + "'s is taken out until the swap");
      }
    }
    // The more creative blends. A mashup: the incoming vocal over an instrumental ending, its
    // instruments joining on the swap. A filter swap: the outgoing track closes down as the
    // incoming one opens up. (A blend that already takes a clashing vocal out is left alone.)
    let filter = false;
    if (pick.type === "bassSwap" && st.tricks && !vox) {
      let mash = false;
      if (st.voxAuto && out.stereo !== false && inn.stereo !== false && out.lead && inn.lead) {
        const avg2 = function (arr, a, b) { let t = 0, n = 0; for (let i = Math.max(0, Math.floor(a)); i < Math.min(arr.length, Math.ceil(b)); i++) { t += arr[i]; n++; } return n ? t / n : 0; };
        const o = avg2(out.lead, pick.swapBar - pick.blendBars, pick.swapBar), i = avg2(inn.lead, pick.inLand - pick.blendBars, pick.inLand);
        if (o < 0.35 && i >= 0.55 && rand() < 0.75) {
          mash = true;
          vox = { inn: "solo" };
          reasons.push(inn.title0 + "'s vocal comes in over the instrumental end of " + out.title0 + "; its instruments join on the swap");
        }
      }
      if (!mash && rand() < (style === "smooth" ? 0.12 : style === "club" ? 0.2 : Math.min(0.5, 0.15 + st.variety / 200))) {
        filter = true;
        reasons.push("a filter swap: " + out.title0 + " closes down as " + inn.title0 + " opens up");
      }
    }
    // sound effects dropped around the swap itself, by the level of automatic effects
    const extras = [];
    const LVL = { subtle: 0, lively: 1, wild: 2 }[st.autoFx];
    if (LVL >= 1 && st.fx) {
      const xr = SET.rng(out.title0 + "|x|" + inn.title0 + "|" + (opts.index || 0));
      if (pick.type === "bassSwap" && xr() < 0.5) extras.push({ kind: "swell" });
      if ((pick.type === "dropSwap" || pick.type === "echoOut") && xr() < 0.5) extras.push({ kind: "snare" });
      if (LVL === 2 && xr() < 0.45) extras.push({ kind: "zap" });
      if (LVL === 2 && pick.type === "bassSwap" && xr() < 0.15) extras.push({ kind: "siren" });
    }
    const buildBars = pick.type === "bassSwap" ? 0 : (pick.type === "dropSwap" ? 8 : pick.type === "echoOut" ? 2 : 1);
    const rise = inn.energy - out.energy;
    const isBlend = pick.type === "bassSwap", flair = st.flair;
    const winds = pick.type === "brake" || pick.type === "spinback";       // these have their own sound; no build, no echo
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
      roll: st.rolls && !isBlend && !winds && style !== "smooth" && flair >= 50,
      riser: st.risers && !winds && (isBlend ? (rise >= 2 && flair >= 25) || flair >= 80 : flair >= 25),
      // a blend still gets a hit where the basslines trade (softer when the energy does not rise)
      impact: st.impacts && (isBlend ? (rise >= 1 && flair >= 15) || flair >= 40 : flair >= 15),
      echoThrow: st.echoThrows && !isBlend && !winds && flair >= 30,
      crash: st.sweeps && pick.type === "dropSwap" && flair >= 70,
      downlifter: st.sweeps && (pick.type === "echoOut" ? flair >= 45 : isBlend && flair >= 55 && rise < 2),
      bassSwapMode: st.bassSwap,
      intensity: flair / 100,
      rise: rise,
      amounts: { echo: st.echoAmount, reverb: st.reverbAmount },
      switched: switched,
      vox: vox,
      filter: filter,
      extras: extras,
      keyScore: ks,
      tempoGap: gap,
      freshTempo: fresh,                           // the incoming track starts at its own tempo, not the outgoing one's
      reasons: reasons,
    };
  }

  // Sound effects the DJ drops into a track on its own, where the track's structure invites one.
  // Pure and deterministic (the same track at the same level always gets the same effects, so a
  // live set and an export match). Returns [{bar, kind, bars, gain}] for the whole track, sorted:
  // `bar` is where the effect starts, `bars` how long it runs (a hit is 0). Callers keep
  // only the part they are scheduling, and keep clear of transitions.
  //   subtle  a riser into each of the track's own drops and a hit on the drop
  //   lively  + a snare roll or reverse swell into the drop, soft hits on 16-bar phrase lines
  //   wild    + lasers and the odd siren, more of everything
  function planFx(info, level) {
    const LV = { subtle: 0, lively: 1, wild: 2 }[level];
    if (LV == null) return [];
    const cues = info.cues || {}, bars = info.bars || 0, secs = info.sections || [];
    const lastBar = Math.min(bars - 2, (cues.outroStart != null ? cues.outroStart : bars) - 2);   // the way out belongs to the transition
    const drops = (cues.dropStarts || []).slice();
    const out = [], busy = [];                    // [start, end) of what is already planned, to keep effects from piling up
    const free = function (a, b) { return busy.every(function (w) { return b <= w[0] || a >= w[1]; }); };
    // `with` = true: part of a combination planned on purpose (a snare roll under a riser, the hit that ends a build)
    const put = function (bar, kind, len, gain, withOthers) {
      const b = bar + Math.max(len, 0.25);
      if (bar < 4 || bar > lastBar || (!withOthers && !free(bar - 1, b))) return false;     // not in a track's first 4 bars, not in its way out, not on top of another
      out.push({ bar: bar, kind: kind, bars: len, gain: gain }); busy.push([bar, b]);
      return true;
    };
    const inType = function (b, types) { const sec = secs.filter(function (s) { return b >= s.start && b < s.end; })[0]; return !!sec && types.indexOf(sec.type) >= 0; };
    const R = function (bar, salt) { return SET.rng((info.title0 || "") + "|fx|" + salt + "|" + bar)(); };
    const gain = [0.8, 1, 1.1][LV];
    drops.forEach(function (d) {
      const rb = d >= 12 ? 4 : 2, v = R(d, "drop");
      // into the drop: a riser (always), plus more as it gets livelier; then the hit on the one
      let built;
      if (LV === 0 || v < 0.45) built = put(d - rb, "riser", rb, 0.55 * gain);
      else if (v < 0.75) { built = put(d - rb, "riser", rb, 0.5 * gain); if (built) put(d - 1, "snare", 1, 0.5 * gain, true); }
      else { built = put(d - 2, "swell", 2, 0.7 * gain); if (built) put(d - 1, "snare", 1, 0.45 * gain, true); }
      if (built) put(d, "impact", 0, 0.5 * gain, true);
    });
    if (LV >= 1) {
      for (let b = 16; b <= lastBar; b += 16) {
        if (drops.indexOf(b) >= 0) continue;
        if (inType(b, ["break", "intro", "outro"])) continue;
        const v = R(b, "phrase");
        if (v < (LV === 2 ? 0.7 : 0.4)) {
          if (R(b, "kind") < 0.45) { if (put(b - 1, "swell", 1, 0.6 * gain)) put(b, "impact", 0, 0.3 * gain, true); }
          else put(b, "crash", 0, 0.28 * gain);
        }
      }
    }
    if (LV === 2) {
      for (let b = 8; b <= lastBar; b += 8) {
        if (b % 16 === 0) continue;
        if (inType(b, ["break", "intro", "outro"])) continue;
        const v = R(b, "wild");
        if (v < 0.3) put(b + 3 / 4, "zap", 0, 0.5);                                       // on the last beat of a bar in the middle of a phrase
        else if (v < 0.4 && b % 32 === 8) put(b, "siren", 2, 0.4);
      }
    }
    return out.sort(function (a, b) { return a.bar - b.bar; });
  }

  function label(plan) {
    const name = plan.type === "bassSwap" ? (plan.vox && plan.vox.inn ? "Vocal mashup" : plan.filter ? "Filter swap" : "Bass swap") :
      { dropSwap: "Drop swap", echoOut: "Echo out", brake: "Vinyl brake", spinback: "Spinback", stutter: "Stutter cut" }[plan.type];
    return name +
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
    planFx: planFx,
    label: label,
    parseCamelot: parseCamelot,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Brain;
