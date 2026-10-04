/* What the DJ is like: every knob the planner and the mixer read.
 *
 * One flat object, validated here so a stale or hand-edited saved copy can
 * never feed nonsense to the planner. Pure, so it runs in node.
 */

var Settings = (function () {
  "use strict";

  const DEFAULTS = {
    // the moves
    style: "mixed",            // mixed | smooth | club
    blendBars: "auto",         // auto | 8 | 16 | 32 — how long a blend may run
    bassSwap: "auto",          // auto (hard for same key, soft otherwise) | hard (on the one) | smooth (two-beat crossfade of the lows)
    minPlay: 32,               // bars a track plays before the next move may start
    variety: 30,               // 0-100 — how often it picks the move it would not normally pick

    // taste
    arc: "build",              // build | wave | peak | warmup
    keyStrictness: "balanced", // strict | balanced | loose
    maxTempoGap: 5,            // percent — beyond this it will not beatmatch a blend
    wKey: 45, wTempo: 35, wEnergy: 20,   // what matters when choosing the next track

    // effects
    flair: 60,                 // 0-100 — how showy the builds are
    rolls: true, risers: true, impacts: true, echoThrows: true,
    brakes: true,              // vinyl brakes and spinbacks as ways out
    sweeps: true,              // soft crashes and downlifters
    echoAmount: 55,            // 0-100
    reverbAmount: 45,          // 0-100

    // let the DJ adapt flair and play time to each pair of tracks, and decide
    // whatever is left on "auto" (blend length, bass swap)
    auto: true,

    // output
    levelMatch: true,
    endless: true,
    fx: true,                  // master switch for risers and hits
  };

  const PRESETS = {
    balanced: { label: "Let the AI decide", hint: "Adapts every move to the pair of tracks", values: {} },
    warehouse: {
      label: "Warehouse", hint: "Drop swaps, rolls, peaks and valleys",
      values: { style: "club", blendBars: 16, bassSwap: "hard", minPlay: 48, variety: 40, arc: "wave", maxTempoGap: 6, flair: 80, rolls: true, risers: true, impacts: true, echoThrows: true, echoAmount: 60 },
    },
    mainstage: {
      label: "Main stage", hint: "Short, loud, everything on",
      values: { style: "club", blendBars: 8, bassSwap: "hard", minPlay: 32, variety: 25, arc: "peak", flair: 100, rolls: true, risers: true, impacts: true, echoThrows: true, echoAmount: 70, reverbAmount: 60 },
    },
    smooth: {
      label: "Late night", hint: "Long blends, strict keys, few effects",
      values: { style: "smooth", blendBars: 32, bassSwap: "smooth", minPlay: 64, variety: 10, arc: "build", keyStrictness: "strict", maxTempoGap: 3, flair: 20, rolls: false, impacts: false, echoAmount: 40, reverbAmount: 50 },
    },
    sunrise: {
      label: "Sunrise", hint: "Warm-up that slowly lifts, gentle effects",
      values: { style: "smooth", blendBars: 32, bassSwap: "smooth", minPlay: 56, variety: 20, arc: "warmup", keyStrictness: "strict", maxTempoGap: 4, flair: 35, rolls: false, impacts: false, echoAmount: 45, reverbAmount: 55 },
    },
    open: {
      label: "Open format", hint: "Anything goes, lots of surprises",
      values: { style: "mixed", blendBars: "auto", minPlay: 24, variety: 75, arc: "wave", keyStrictness: "loose", maxTempoGap: 8, wKey: 15, wTempo: 40, wEnergy: 45, flair: 70 },
    },
  };

  const ENUMS = {
    style: ["mixed", "smooth", "club"],
    bassSwap: ["auto", "hard", "smooth"],
    arc: ["build", "wave", "peak", "warmup"],
    keyStrictness: ["strict", "balanced", "loose"],
  };
  const RANGES = {
    minPlay: [8, 128, 4], variety: [0, 100, 1], maxTempoGap: [1, 10, 0.5],
    wKey: [0, 100, 1], wTempo: [0, 100, 1], wEnergy: [0, 100, 1],
    flair: [0, 100, 1], echoAmount: [0, 100, 1], reverbAmount: [0, 100, 1],
  };
  const BOOLS = ["rolls", "risers", "impacts", "echoThrows", "brakes", "sweeps", "auto", "levelMatch", "endless", "fx"];

  function num(v, lo, hi, step, fallback) {
    v = typeof v === "string" ? parseFloat(v) : v;
    if (typeof v !== "number" || !isFinite(v)) return fallback;
    v = Math.min(hi, Math.max(lo, v));
    return Math.round(v / step) * step;
  }

  // Take anything — undefined, a saved JSON blob, half a preset — and return a
  // complete, in-range settings object.
  function sanitize(input) {
    const src = input && typeof input === "object" ? input : {};
    const out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      const d = DEFAULTS[k], v = src[k];
      if (ENUMS[k]) out[k] = ENUMS[k].indexOf(v) >= 0 ? v : d;
      else if (RANGES[k]) out[k] = num(v, RANGES[k][0], RANGES[k][1], RANGES[k][2], d);
      else if (BOOLS.indexOf(k) >= 0) out[k] = typeof v === "boolean" ? v : d;
      else if (k === "blendBars") out[k] = (v === 8 || v === 16 || v === 32) ? v : (v === "8" || v === "16" || v === "32" ? +v : "auto");
      else out[k] = d;
    });
    return out;
  }

  function make(overrides) { return sanitize(Object.assign({}, DEFAULTS, overrides)); }

  function applyPreset(id) {
    const p = PRESETS[id];
    return make(p ? p.values : {});
  }

  // Which preset these settings are exactly, or "custom". Output toggles that
  // are not part of a personality (endless, fx, level match) are ignored.
  const PERSONALITY = Object.keys(DEFAULTS).filter(function (k) { return ["endless", "fx", "levelMatch", "auto"].indexOf(k) < 0; });
  function presetOf(s) {
    for (const id of Object.keys(PRESETS)) {
      const p = make(PRESETS[id].values);
      if (PERSONALITY.every(function (k) { return p[k] === s[k]; })) return id;
    }
    return "custom";
  }

  // The key score each kind of move needs, by strictness.
  function keyFloors(s) {
    // a drop swap overlaps the two tracks for an instant, so only a strict DJ minds the key there
    return { strict: { blend: 0.85, drop: 0.55 }, balanced: { blend: 0.55, drop: 0 }, loose: { blend: 0, drop: 0 } }[s.keyStrictness];
  }

  // Normalised scoring weights for choosing the next track (sum to 1).
  function weights(s) {
    const t = s.wKey + s.wTempo + s.wEnergy;
    if (t <= 0) return { key: 0.45, tempo: 0.35, energy: 0.2 };
    return { key: s.wKey / t, tempo: s.wTempo / t, energy: s.wEnergy / t };
  }

  // Small deterministic generator: the same pair of tracks at the same point
  // in the set always gets the same "random" choice, so a preview matches what
  // is later scheduled and an export matches the live set.
  function rng(seedText) {
    let h = 2166136261;
    for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // the flair levels at which the planner starts using an effect (see brain.js)
  const FLAIR_GATES = [15, 25, 30, 45, 50, 70, 80];
  const snap4 = function (n) { return Math.max(8, Math.round(n / 4) * 4); };

  // Per-transition adaptation. The user's settings are the baseline and the
  // limits; this only fills in what they left on "auto" and nudges flair and
  // play time to suit the pair of tracks. Returns the effective settings and,
  // in plain words, what it changed. With auto off, "auto" just means the
  // plain default and nothing is nudged.
  function autoTune(out, inn, s, ks) {
    const eff = Object.assign({}, s), notes = [];
    const punchy = ks >= 0.9 && inn.energy >= out.energy + 2;    // same key and a clear lift: hit it on the one
    if (s.bassSwap === "auto") eff.bassSwap = s.auto && !punchy ? "smooth" : "hard";
    if (!s.auto) return { settings: eff, notes: [] };
    if (s.bassSwap === "auto") notes.push(punchy ? "hard bass swap on the one — same key and the energy lifts" : "soft two-beat bass swap for a smoother handover");
    let flair = Math.max(0, Math.min(100, Math.round(s.flair * (0.6 + 0.08 * inn.energy))));
    // it may tone the show down, or turn it up within the same band, but never
    // far enough to bring in an effect the flair setting leaves out
    const gate = FLAIR_GATES.filter(function (g) { return g > s.flair; })[0];
    if (gate != null && flair >= gate) flair = gate - 1;
    if (flair !== s.flair) { eff.flair = flair; notes.push("flair " + flair + "% — " + (inn.energy >= 7 ? "a big track is coming in" : inn.energy <= 4 ? "a gentle track is coming in" : "a mid-energy track is coming in")); }
    const play = snap4(s.minPlay * (out.energy >= 8 ? 0.75 : out.energy <= 4 ? 1.25 : 1));
    if (play !== s.minPlay) { eff.minPlay = play; notes.push("lets this one play " + play + " bars — " + (out.energy >= 8 ? "peak track, keep it moving" : "slower track, give it room")); }
    return { settings: eff, notes: notes };
  }

  // The current settings in plain words, for the log.
  function describe(s) {
    const id = presetOf(s);
    return (id === "custom" ? "Custom" : PRESETS[id].label) + ": " +
      { mixed: "mixed moves", smooth: "smooth blends", club: "drop swaps" }[s.style] + ", " +
      (s.blendBars === "auto" ? "blends as long as the tracks allow" : s.blendBars + "-bar blends") + ", " +
      "tracks play ≥" + s.minPlay + " bars, keys " + s.keyStrictness + ", tempo within " + s.maxTempoGap + "%, flair " + s.flair + "%";
  }

  return { DEFAULTS: DEFAULTS, PRESETS: PRESETS, ENUMS: ENUMS, RANGES: RANGES, sanitize: sanitize, make: make, applyPreset: applyPreset, presetOf: presetOf, keyFloors: keyFloors, weights: weights, rng: rng, autoTune: autoTune, describe: describe };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Settings;
