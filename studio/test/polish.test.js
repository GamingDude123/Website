global.DSP = require(__dirname + "/../js/dsp.js");
const Polish = require(__dirname + "/../js/polish.js");
const SR = 44100;
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}
function buf(seconds) { return new Float32Array(Math.round(seconds * SR)); }
function room(x, amp = 0.004) {
  for (let i = 0; i < x.length; i++) x[i] += (Math.random() * 2 - 1) * amp;
  return x;
}
// place a generator into a longer buffer with room tone around it, the way a
// phone recording actually arrives
function recorded(gen, seconds, padBefore = 0.35, padAfter = 0.4) {
  const body = gen();
  const x = buf(seconds + padBefore + padAfter);
  room(x);
  const at = Math.round(padBefore * SR);
  for (let i = 0; i < body.length && at + i < x.length; i++) x[at + i] += body[i];
  return x;
}

const KICK = () => {
  const n = Math.round(0.28 * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = 0.8 * Math.sin(2 * Math.PI * (58 * Math.exp(-t * 11)) * t) * Math.exp(-t * 13);
  }
  return x;
};
const HAT = () => {
  const n = Math.round(0.05 * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * 0.5 * Math.exp(-(i / SR) * 110);
  return x;
};
const SNARE = () => {
  const n = Math.round(0.18 * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.exp(-t * 26);
    x[i] = ((Math.random() * 2 - 1) * 0.55 + 0.3 * Math.sin(2 * Math.PI * 190 * t)) * env;
  }
  return x;
};
const HUM = (freq, seconds, harmonics = 3) => () => {
  const n = Math.round(seconds * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= harmonics; h++) v += (0.5 / h) * Math.sin(2 * Math.PI * freq * h * t);
    const env = Math.min(1, Math.min(t, seconds - t) / 0.05);
    x[i] = v * env;
  }
  return x;
};
const WASH = (seconds) => () => {
  const n = Math.round(seconds * SR), x = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp = lp * 0.99 + (Math.random() * 2 - 1) * 0.01;
    const t = i / SR;
    x[i] = lp * 12 * Math.min(1, Math.min(t, seconds - t) / 0.1);
  }
  return x;
};

// --- roles
const cases = [
  ["kick", recorded(KICK, 0.28)],
  ["hat", recorded(HAT, 0.05)],
  ["snare", recorded(SNARE, 0.18)],
  ["bass", recorded(HUM(98, 1.2), 1.2)],
  ["vocal", recorded(HUM(240, 0.9, 5), 0.9)],
  ["chord", recorded(HUM(196, 2.2, 6), 2.2)],
  ["texture", recorded(WASH(2.0), 2.0)],
];
for (const [want, audio] of cases) {
  const r = Polish.process(audio, { sampleRate: SR, bpm: 120, keyRoot: 9, scale: "minor" });
  check("classify " + want, r && r.role === want, r ? "got=" + r.role + " dur=" + r.features.duration.toFixed(2) +
    " cen=" + r.features.centroid.toFixed(0) + " conf=" + r.features.pitchConfidence.toFixed(2) +
    " pitch=" + r.features.pitch.toFixed(1) + " flat=" + r.features.flatness.toFixed(3) : "null");
}

// --- output hygiene, every role
for (const [want, audio] of cases) {
  const r = Polish.process(audio, { sampleRate: SR, bpm: 120, keyRoot: 9, scale: "minor" });
  if (!r) continue;
  const p = DSP.peak(r.samples);
  check(want + " does not clip", p <= 0.9001 && p > 0.5, "peak=" + p.toFixed(3));
  let bad = 0;
  for (let i = 0; i < r.samples.length; i++) if (!isFinite(r.samples[i])) bad++;
  check(want + " has no NaNs", bad === 0, bad + " bad samples");
  check(want + " reports what it did", r.steps.length >= 2, r.steps.join(" / "));
  check(want + " starts and ends quietly", Math.abs(r.samples[0]) < 0.02 &&
    Math.abs(r.samples[r.samples.length - 1]) < 0.02,
    "first=" + r.samples[0].toFixed(4) + " last=" + r.samples[r.samples.length - 1].toFixed(4));
}

// --- trimming actually removes the pad
{
  const audio = recorded(KICK, 0.28, 0.5, 0.5);
  const r = Polish.process(audio, { sampleRate: SR, bpm: 120 });
  const dur = r.samples.length / SR;
  check("trim cuts the silence", dur > 0.2 && dur < 0.45, "duration=" + dur.toFixed(3) + "s of 1.28s");
}

// --- tuning lands on the key
{
  // 107 Hz is between G#2 (103.8) and A2 (110); in A minor it should go to A
  const audio = recorded(HUM(107, 1.2), 1.2);
  const r = Polish.process(audio, { sampleRate: SR, bpm: 120, keyRoot: 9, scale: "minor" });
  const p = DSP.detectPitch(r.samples, SR);
  const midi = Polish.freqToMidi(p.freq);
  const cents = (midi - Math.round(midi)) * 100;
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const inKey = Polish.scales.minor.map((s) => (9 + s) % 12).includes(pc);
  check("tuned into the key", inKey && Math.abs(cents) < 20,
    "note=" + Polish.midiToNoteName(midi) + " cents=" + cents.toFixed(1) + " reported=" + r.note);
  check("tuning is reported", r.note === "A2", "note=" + r.note + " shifted=" + r.shifted.toFixed(2));
}
{
  // a sound already in key should be left alone
  const audio = recorded(HUM(110, 1.2), 1.2);
  const r = Polish.process(audio, { sampleRate: SR, bpm: 120, keyRoot: 9, scale: "minor" });
  check("in-tune sample is not shifted", Math.abs(r.shifted) < 0.15, "shifted=" + r.shifted.toFixed(3));
}
{
  // percussion must never be tuned
  const r = Polish.process(recorded(SNARE, 0.18), { sampleRate: SR, bpm: 120, keyRoot: 9 });
  check("percussion is not tuned", r.shifted === 0 && r.note === null, "shifted=" + r.shifted + " note=" + r.note);
}

// --- grid fitting
{
  const r = Polish.process(recorded(WASH(1.9), 1.9), { sampleRate: SR, bpm: 120, keyRoot: 9 });
  const dur = r.samples.length / SR;
  check("fits to 4 beats at 120bpm", r.beats === 4 && Math.abs(dur - 2.0) < 0.01,
    "beats=" + r.beats + " duration=" + dur.toFixed(4) + "s");
}
{
  const r = Polish.process(recorded(WASH(1.9), 1.9), { sampleRate: SR, bpm: 140, keyRoot: 9 });
  const dur = r.samples.length / SR;
  const want = (r.beats * 60) / 140;
  check("fits the grid at 140bpm too", r.beats && Math.abs(dur - want) < 0.01,
    "beats=" + r.beats + " duration=" + dur.toFixed(4) + "s want=" + want.toFixed(4));
}
{
  const r = Polish.process(recorded(KICK, 0.28), { sampleRate: SR, bpm: 120 });
  check("one-shots are not stretched", r.beats === null, "beats=" + r.beats);
}
{
  // nowhere near the grid: 1.35s at 120bpm is 2.7 beats, and forcing it to
  // either 2 or 4 would be a 35%+ stretch, so it should be left alone
  const r = Polish.process(recorded(WASH(1.35), 1.35), { sampleRate: SR, bpm: 120 });
  check("leaves hopeless stretches alone", r.beats === null,
    "beats=" + r.beats + " duration=" + (r.samples.length / SR).toFixed(3));
}

// --- beatFit maths
{
  const f = Polish.beatFit(2.05, 120);
  check("beatFit picks 4 beats", f.beats === 4 && Math.abs(f.stretch - 2 / 2.05) < 1e-6,
    "beats=" + f.beats + " stretch=" + f.stretch.toFixed(4));
  const g = Polish.beatFit(0.24, 120);
  check("beatFit picks half a beat", g.beats === 0.5, "beats=" + g.beats);
}

// --- snapToScale
{
  const s = Polish.snapToScale(440, 9, "minor"); // A4 in A minor
  check("snapToScale leaves A alone in A minor", Math.abs(s.semitones) < 1e-6, "semis=" + s.semitones.toFixed(4));
  const t = Polish.snapToScale(440 * Math.pow(2, 1 / 12), 9, "minor"); // A#4, not in A minor
  check("snapToScale moves A# out of A minor", Math.abs(t.semitones) > 0.9 && Math.abs(t.semitones) < 1.1,
    "semis=" + t.semitones.toFixed(3) + " -> " + Polish.midiToNoteName(t.midi));
  const u = Polish.snapToScale(445, 9, "minor"); // A4 a bit sharp
  check("snapToScale corrects tuning", u.semitones < 0 && u.semitones > -0.25, "semis=" + u.semitones.toFixed(3));
}

// --- timing on a phone-sized recording
{
  const audio = recorded(HUM(150, 3), 3);
  const t0 = Date.now();
  Polish.process(audio, { sampleRate: SR, bpm: 120, keyRoot: 9, scale: "minor" });
  const ms = Date.now() - t0;
  console.log("timing: full polish of a 3.75s recording = " + ms + "ms");
  check("polish is fast enough to feel instant", ms < 1500, ms + "ms");
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nall green");
process.exit(fails ? 1 : 0);
