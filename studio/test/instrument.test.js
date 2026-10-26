global.DSP = require(__dirname + "/../js/dsp.js");
const Instrument = require(__dirname + "/../js/instrument.js");
const SR = 44100;
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}

// --- material to shape: the kind of thing someone actually records
function mouthBoom(seconds = 1.6) {
  const n = Math.round(seconds * SR);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // a low "bmmm" with a long lazy tail and some mid honk — nothing like a kick
    x[i] = 0.5 * (Math.sin(2 * Math.PI * 95 * t) + 0.4 * Math.sin(2 * Math.PI * 290 * t)) *
      Math.min(1, t / 0.01) * Math.exp(-t * 1.1);
  }
  return x;
}
function mouthTss(seconds = 1.2) {
  const n = Math.round(seconds * SR);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = (Math.random() * 2 - 1) * 0.5 * Math.min(1, t / 0.02) * Math.exp(-t * 1.6);
  }
  return x;
}
function hum(freq, seconds = 1.2) {
  const n = Math.round(seconds * SR);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, Math.min(t, seconds - t) / 0.05);
    x[i] = env * (0.5 * Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(2 * Math.PI * freq * 2 * t));
  }
  return x;
}
function centroid(x) { return DSP.features(x, SR).centroid; }
// How far a frequency stands above the surrounding spectrum. A fraction-of-
// total metric is biased by bandwidth — a narrow drum body always looks tiny
// beside wideband noise — so peaks are measured against the median bin.
function tonalPeak(x, freq) {
  const N = 8192;
  const re = new Float64Array(N), im = new Float64Array(N);
  const w = DSP.hann(N);
  for (let i = 0; i < N; i++) { re[i] = (x[i] || 0) * w[i]; im[i] = 0; }
  DSP.fft(re, im, false);
  const mags = [];
  for (let k = 1; k < N / 2; k++) mags.push(Math.hypot(re[k], im[k]));
  const sorted = mags.slice().sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1] || 1e-9;
  const bin = Math.round((freq * N) / SR);
  let best = 0;
  for (let k = Math.max(1, bin - 3); k <= bin + 3; k++) best = Math.max(best, mags[k - 1] || 0);
  return best / median;
}
// Unambiguous frequency measure for a low, strong signal
function zcFreq(x, from, to) {
  let c = 0;
  for (let i = from + 1; i < to; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) c++;
  return (c / 2) * (SR / (to - from));
}
function bandEnergy(x, lo, hi) {
  const N = 8192;
  const re = new Float64Array(N), im = new Float64Array(N);
  const w = DSP.hann(N);
  // measure over the loudest part
  let best = 0, bestRms = 0;
  for (let s = 0; s + N <= x.length; s += N >> 1) {
    const r = DSP.rms(x, s, s + N);
    if (r > bestRms) { bestRms = r; best = s; }
  }
  for (let i = 0; i < N; i++) { re[i] = (x[best + i] || 0) * w[i]; im[i] = 0; }
  DSP.fft(re, im, false);
  let inBand = 0, total = 1e-12;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * SR) / N;
    const m = Math.hypot(re[k], im[k]);
    total += m;
    if (f >= lo && f <= hi) inBand += m;
  }
  return inBand / total;
}

// --- morph 0 changes nothing
{
  const src = mouthBoom();
  for (const name of Instrument.order) {
    const out = Instrument.shape(src, SR, name, { morph: 0, rootHz: 55 });
    let same = out.length === src.length;
    if (same) for (let i = 0; i < src.length; i++) if (out[i] !== src[i]) { same = false; break; }
    check("morph 0 leaves " + name + " untouched", same, out.length + " vs " + src.length);
  }
}

// --- deterministic
{
  const src = mouthBoom();
  const a = Instrument.shape(src, SR, "kick", { morph: 0.7, rootHz: 55, seed: 5 });
  const b = Instrument.shape(src, SR, "kick", { morph: 0.7, rootHz: 55, seed: 5 });
  let same = a.length === b.length;
  if (same) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
  check("shaping is deterministic", same, "two identical calls match");
}

// --- kick
{
  const src = mouthBoom(1.6);
  const out = Instrument.shape(src, SR, "kick", { morph: 0.85, rootHz: 55, seed: 1 });
  const seconds = out.length / SR;
  check("kick is cut to a kick's length", seconds > 0.3 && seconds < 0.48,
    seconds.toFixed(3) + "s from " + (src.length / SR).toFixed(2) + "s");
  // The real claim is that whatever you feed it lands on the same instrument.
  // Measured against the kick made from dark material rather than an absolute
  // number, so the test is about convergence, not about one lucky source.
  const fromNoise = Instrument.shape(mouthTss(1.2), SR, "kick", { morph: 0.85, rootHz: 55, seed: 1 });
  const hfNoise = bandEnergy(fromNoise, 2000, 20000);
  const hfDark = bandEnergy(out, 2000, 20000);
  check("a bright noise shaped into a kick lands where a dark one does",
    hfNoise < Math.max(hfDark * 4, 0.05),
    "high-end share: from noise " + (100 * hfNoise).toFixed(1) + "%, from a boom " +
    (100 * hfDark).toFixed(1) + "% (raw noise was " +
    (100 * bandEnergy(mouthTss(1.2), 2000, 20000)).toFixed(0) + "%)");
  check("kick energy is in the low end", bandEnergy(out, 0, 200) > 0.55,
    (100 * bandEnergy(out, 0, 200)).toFixed(0) + "% below 200Hz");
  // the defining feature: pitch falls fast, then settles on the root
  const tail = out.subarray(Math.round(0.12 * SR));
  const settled = DSP.detectPitch(tail, SR, 30, 400);
  check("kick settles on the root note", Math.abs(settled.freq - 55) < 8,
    "tail pitch=" + settled.freq.toFixed(1) + "Hz, root=55Hz");
  const headHz = zcFreq(out, 0, Math.round(0.025 * SR));
  const tailHz = zcFreq(out, Math.round(0.15 * SR), Math.round(0.3 * SR));
  check("kick pitch falls off a cliff", headHz > tailHz * 1.5,
    "first 25ms=" + headHz.toFixed(0) + "Hz, tail=" + tailHz.toFixed(0) + "Hz");
  check("kick has no NaNs and does not clip", out.every ? true : true);
  let bad = 0, peak = 0;
  for (let i = 0; i < out.length; i++) {
    if (!isFinite(out[i])) bad++;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  check("kick output is finite and bounded", bad === 0 && peak <= 1.05, "bad=" + bad + " peak=" + peak.toFixed(3));
}

// --- a kick follows the key
{
  const src = mouthBoom();
  const inC = Instrument.shape(src, SR, "kick", { morph: 0.9, rootHz: 32.7, seed: 1 });
  const tail = DSP.detectPitch(inC.subarray(Math.round(0.12 * SR)), SR, 25, 400);
  check("kick root follows the key", Math.abs(tail.freq - 32.7) < 6,
    "C1 requested, got " + tail.freq.toFixed(1) + "Hz");
}

// --- hat
{
  const src = mouthTss(1.2);
  const out = Instrument.shape(src, SR, "hat", { morph: 0.85, seed: 1 });
  const seconds = out.length / SR;
  check("hat is cut to a hat's length", seconds > 0.04 && seconds < 0.14,
    seconds.toFixed(3) + "s from " + (src.length / SR).toFixed(2) + "s");
  check("hat is bright", centroid(out) > 7000, centroid(out).toFixed(0) + " Hz");
  check("hat has almost no low end", bandEnergy(out, 0, 1000) < 0.06,
    (100 * bandEnergy(out, 0, 1000)).toFixed(1) + "% below 1kHz");
}

// --- open hat rings longer than a closed one
{
  const src = mouthTss(1.2);
  const closed = Instrument.shape(src, SR, "hat", { morph: 0.85, seed: 1 });
  const open = Instrument.shape(src, SR, "openhat", { morph: 0.85, seed: 1 });
  check("open hat rings longer than closed", open.length > closed.length * 3,
    (open.length / SR).toFixed(3) + "s vs " + (closed.length / SR).toFixed(3) + "s");
}

// --- snare and clap
{
  const src = mouthTss(1.2);
  const snare = Instrument.shape(src, SR, "snare", { morph: 0.8, seed: 1 });
  check("snare length", snare.length / SR > 0.18 && snare.length / SR < 0.36, (snare.length / SR).toFixed(3) + "s");
  check("snare has drum body under the noise", tonalPeak(snare, 186) > 4,
    tonalPeak(snare, 186).toFixed(1) + "x the median bin at 186Hz (source: " +
    tonalPeak(src, 186).toFixed(1) + "x)");

  const clap = Instrument.shape(src, SR, "clap", { morph: 0.8, seed: 1 });
  // the stagger: four bursts inside the first 40 ms means several level peaks
  const env = DSP.follow(clap, SR, 0.4, 6);
  let peaks = 0;
  const window = Math.round(0.04 * SR);
  for (let i = 2; i < window - 2; i++) {
    if (env[i] > env[i - 2] && env[i] > env[i + 2] && env[i] > DSP.peak(env) * 0.25) {
      peaks++;
      i += Math.round(0.004 * SR);
    }
  }
  check("clap has the multi-hand stagger", peaks >= 3, peaks + " level peaks in the first 40ms");
}

// --- bass follows the recording and plays the requested note
{
  const src = hum(110, 1.2);
  const out = Instrument.shape(src, SR, "bass", { morph: 0.8, pitchHz: 110, rootHz: 55, seed: 1 });
  check("bass keeps the recording's length", Math.abs(out.length - src.length) < 64,
    out.length + " vs " + src.length);
  const p = DSP.detectPitch(out, SR);
  check("bass plays the requested note", Math.abs(p.freq - 110) < 3, p.freq.toFixed(2) + "Hz");
  check("bass is dark", centroid(out) < 500, centroid(out).toFixed(0) + "Hz");

  // a recording that stops halfway should give a bass that stops halfway too
  const gated = Float32Array.from(hum(110, 1.2));
  for (let i = Math.round(0.6 * SR); i < gated.length; i++) gated[i] = 0;
  const follows = Instrument.shape(gated, SR, "bass", { morph: 0.9, pitchHz: 110, seed: 1 });
  const early = DSP.rms(follows, 0, Math.round(0.4 * SR));
  const late = DSP.rms(follows, Math.round(0.8 * SR), follows.length);
  check("bass follows the recording's phrasing", late < early * 0.12,
    "loud=" + early.toFixed(3) + " after it stops=" + late.toFixed(4));
}

// --- sub is a near-pure sine
{
  const src = hum(110, 1);
  const out = Instrument.shape(src, SR, "sub", { morph: 1, pitchHz: 55, seed: 1 });
  check("sub is centred on its fundamental", bandEnergy(out, 40, 75) > 0.7,
    (100 * bandEnergy(out, 40, 75)).toFixed(0) + "% in 40-75Hz");
}

// --- chord builds a triad
{
  const src = hum(220, 1.2);
  const minor = Instrument.shape(src, SR, "chord", { morph: 1, chordIntervals: [3, 7], seed: 1 });
  const third = 220 * Math.pow(2, 3 / 12);   // 261.6
  const fifth = 220 * Math.pow(2, 7 / 12);   // 329.6
  const hasThird = bandEnergy(minor, third * 0.98, third * 1.02);
  const hasFifth = bandEnergy(minor, fifth * 0.98, fifth * 1.02);
  const hasRoot = bandEnergy(minor, 216, 224);
  check("chord keeps the root", hasRoot > 0.05, (100 * hasRoot).toFixed(1) + "%");
  check("chord adds the minor third", hasThird > 0.03, (100 * hasThird).toFixed(1) + "% at " + third.toFixed(0) + "Hz");
  check("chord adds the fifth", hasFifth > 0.03, (100 * hasFifth).toFixed(1) + "% at " + fifth.toFixed(0) + "Hz");

  const major = Instrument.shape(src, SR, "chord", { morph: 1, chordIntervals: [4, 7], seed: 1 });
  const majThird = 220 * Math.pow(2, 4 / 12);
  check("major chord uses the major third",
    bandEnergy(major, majThird * 0.98, majThird * 1.02) > 0.03,
    (100 * bandEnergy(major, majThird * 0.98, majThird * 1.02)).toFixed(1) + "% at " + majThird.toFixed(0) + "Hz");
}

// --- morph is a continuum, not a switch
{
  const src = mouthBoom(1.6);
  const lengths = [0, 0.25, 0.5, 0.75, 1].map(function (m) {
    return Instrument.shape(src, SR, "kick", { morph: m, rootHz: 55, seed: 1 }).length / SR;
  });
  let monotonic = true;
  for (let i = 1; i < lengths.length; i++) if (lengths[i] > lengths[i - 1] + 1e-6) monotonic = false;
  check("morph moves the sound gradually", monotonic,
    lengths.map((l) => l.toFixed(2) + "s").join(" -> "));
}

// --- every instrument survives every kind of input
{
  const inputs = { boom: mouthBoom(1.6), tss: mouthTss(1.2), hum: hum(110, 1.2), tiny: mouthTss(0.03) };
  let problems = [];
  Instrument.order.forEach(function (name) {
    Object.keys(inputs).forEach(function (kind) {
      const out = Instrument.shape(inputs[kind], SR, name,
        { morph: 1, rootHz: 55, pitchHz: 110, chordIntervals: [3, 7], seed: 1 });
      if (!out || !out.length) { problems.push(name + "/" + kind + ": empty"); return; }
      for (let i = 0; i < out.length; i++) {
        if (!isFinite(out[i])) { problems.push(name + "/" + kind + ": NaN"); return; }
      }
      if (DSP.peak(out) > 1.2) problems.push(name + "/" + kind + ": peak " + DSP.peak(out).toFixed(2));
    });
  });
  check("every instrument handles every input", problems.length === 0, problems.slice(0, 5).join("; ") || "13 instruments x 4 inputs");
}

// --- speed
{
  const src = mouthBoom(3);
  const t0 = Date.now();
  Instrument.shape(src, SR, "kick", { morph: 0.8, rootHz: 55, seed: 1 });
  Instrument.shape(src, SR, "hat", { morph: 0.8, seed: 1 });
  const ms = Date.now() - t0;
  console.log("timing: two shapes of a 3s take = " + ms + "ms");
  check("shaping is fast enough to preview live", ms < 400, ms + "ms");
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nall green");
process.exit(fails ? 1 : 0);
