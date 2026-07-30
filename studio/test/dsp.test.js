const DSP = require(__dirname + "/../js/dsp.js");
const SR = 44100;
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}
function sine(freq, seconds, sr = SR, amp = 0.5) {
  const n = Math.round(seconds * sr);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return x;
}

// FFT round trip
{
  const n = 1024;
  const re = new Float64Array(n), im = new Float64Array(n);
  const orig = [];
  for (let i = 0; i < n; i++) { re[i] = Math.sin(i * 0.1) + Math.random() * 0.1; orig.push(re[i]); }
  DSP.fft(re, im, false);
  DSP.fft(re, im, true);
  let err = 0;
  for (let i = 0; i < n; i++) err = Math.max(err, Math.abs(re[i] - orig[i]));
  check("fft round-trip", err < 1e-9, "maxerr=" + err.toExponential(2));
}

// pitch detection
{
  for (const f of [82.41, 220, 440, 987.77]) {
    const p = DSP.detectPitch(sine(f, 0.5), SR);
    const cents = 1200 * Math.log2(p.freq / f);
    check("detectPitch " + f + "Hz", Math.abs(cents) < 12 && p.confidence > 0.7,
      "got=" + p.freq.toFixed(2) + " cents=" + cents.toFixed(1) + " conf=" + p.confidence.toFixed(2));
  }
  // noise should not read as confidently pitched
  const noise = new Float32Array(SR * 0.3);
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 2 - 1) * 0.4;
  const np = DSP.detectPitch(noise, SR);
  check("detectPitch rejects noise", np.confidence < 0.6, "conf=" + np.confidence.toFixed(2));
}

// resample
{
  const x = sine(220, 0.5);
  const y = DSP.resample(x, 2);
  const p = DSP.detectPitch(y, SR);
  check("resample halves length", Math.abs(y.length - x.length / 2) <= 1, y.length + " vs " + x.length);
  check("resample doubles pitch", Math.abs(p.freq - 440) < 5, "got=" + p.freq.toFixed(1));
}

// time stretch keeps pitch
{
  const x = sine(220, 1.0);
  for (const f of [0.5, 0.75, 1.5, 2]) {
    const y = DSP.timeStretch(x, f);
    const p = DSP.detectPitch(y, SR);
    const lenOk = Math.abs(y.length - x.length * f) / (x.length * f) < 0.02;
    const cents = 1200 * Math.log2(p.freq / 220);
    check("timeStretch x" + f, lenOk && Math.abs(cents) < 15,
      "len=" + y.length + " want~" + Math.round(x.length * f) + " pitch=" + p.freq.toFixed(1) + " cents=" + cents.toFixed(1));
    // continuity: no gaps of silence introduced
    const env = DSP.envelope(y, 1024);
    let minEnv = Infinity;
    for (let i = 1; i < env.length - 1; i++) minEnv = Math.min(minEnv, env[i]);
    check("timeStretch x" + f + " no dropouts", minEnv > 0.15, "minRms=" + minEnv.toFixed(3));
  }
}

// pitch shift keeps length
{
  const x = sine(220, 0.8);
  for (const st of [-5, -1, 3, 7, 12]) {
    const y = DSP.pitchShift(x, st);
    const p = DSP.detectPitch(y, SR);
    const want = 220 * Math.pow(2, st / 12);
    const cents = 1200 * Math.log2(p.freq / want);
    check("pitchShift " + st + "st", y.length === x.length && Math.abs(cents) < 25,
      "len=" + y.length + " pitch=" + p.freq.toFixed(1) + " want=" + want.toFixed(1) + " cents=" + cents.toFixed(1));
  }
}

// denoise: a real recording, i.e. a sound with room tone around it
{
  const clean = new Float32Array(SR * 2);
  const burst = sine(300, 0.7, SR, 0.4);
  const at = Math.round(0.5 * SR);
  for (let i = 0; i < burst.length; i++) {
    // fade the burst so its own edges are not transients
    const w = Math.min(1, Math.min(i, burst.length - i) / (0.02 * SR));
    clean[at + i] = burst[i] * w;
  }
  const noisy = new Float32Array(clean.length);
  for (let i = 0; i < clean.length; i++) noisy[i] = clean[i] + (Math.random() * 2 - 1) * 0.05;
  const out = DSP.denoise(noisy, 1);

  function noiseFloorDb(sig) {
    // the quiet stretch before the burst is pure noise
    return 20 * Math.log10(DSP.rms(sig, 0, Math.round(0.4 * SR)) + 1e-12);
  }
  function signalDb(sig) {
    const mid = at + Math.round(0.35 * SR);
    return 20 * Math.log10(DSP.rms(sig, mid, mid + Math.round(0.2 * SR)) + 1e-12);
  }
  const floorDrop = noiseFloorDb(noisy) - noiseFloorDb(out);
  const signalDrop = signalDb(noisy) - signalDb(out);
  check("denoise drops the room tone", floorDrop > 10, "floor -" + floorDrop.toFixed(1) + "dB");
  check("denoise keeps the sound", Math.abs(signalDrop) < 2.5, "signal " + (-signalDrop).toFixed(1) + "dB");
  check("denoise keeps length", out.length === noisy.length, out.length + " vs " + noisy.length);
  check("denoise leaves no edge spikes", DSP.peak(out) < DSP.peak(noisy) * 1.2,
    "peak " + DSP.peak(out).toFixed(2) + " vs " + DSP.peak(noisy).toFixed(2));
}

// denoise must not hollow out a recording that is one sustained sound with no
// silence anywhere to profile
{
  const held = sine(300, 1.5, SR, 0.4);
  for (let i = 0; i < held.length; i++) held[i] += (Math.random() * 2 - 1) * 0.03;
  const out = DSP.denoise(held, 1);
  const drop = 20 * Math.log10(DSP.rms(held) / (DSP.rms(out) + 1e-12));
  check("denoise backs off on a held note", drop < 1.5, "drop=" + drop.toFixed(2) + "dB");
}

// trim
{
  const burst = sine(400, 0.2);
  const x = new Float32Array(SR);
  for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * 0.002; // room tone
  const at = Math.round(0.4 * SR);
  for (let i = 0; i < burst.length; i++) x[at + i] += burst[i];
  const b = DSP.trimBounds(x, SR);
  check("trim finds onset", Math.abs(b.start - at) < 0.02 * SR, "start=" + b.start + " want~" + at);
  check("trim finds end", Math.abs(b.end - (at + burst.length)) < 0.05 * SR, "end=" + b.end + " want~" + (at + burst.length));
}

// features separate a kick from a hat
{
  const kick = new Float32Array(Math.round(0.25 * SR));
  for (let i = 0; i < kick.length; i++) {
    const t = i / SR;
    kick[i] = Math.sin(2 * Math.PI * (55 * Math.exp(-t * 12)) * t) * Math.exp(-t * 14);
  }
  const hat = new Float32Array(Math.round(0.06 * SR));
  for (let i = 0; i < hat.length; i++) {
    const t = i / SR;
    hat[i] = (Math.random() * 2 - 1) * Math.exp(-t * 90);
  }
  const fk = DSP.features(kick, SR), fh = DSP.features(hat, SR);
  check("features centroid kick < hat", fk.centroid < 400 && fh.centroid > 3000,
    "kick=" + fk.centroid.toFixed(0) + " hat=" + fh.centroid.toFixed(0));
  check("features low/high split", fk.low > 0.6 && fh.high > 0.6,
    "kickLow=" + fk.low.toFixed(2) + " hatHigh=" + fh.high.toFixed(2));
  check("features flatness noise > tonal", fh.flatness > fk.flatness,
    "kick=" + fk.flatness.toFixed(3) + " hat=" + fh.flatness.toFixed(3));
  check("features duration", Math.abs(fk.duration - 0.25) < 0.01, fk.duration.toFixed(3));
}

// wav
{
  const buf = DSP.encodeWav([sine(440, 0.1)], SR);
  const view = new DataView(buf);
  const tag = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  check("wav RIFF header", tag === "RIFF" && view.getUint32(24, true) === SR && buf.byteLength === 44 + Math.round(0.1 * SR) * 2,
    tag + " sr=" + view.getUint32(24, true) + " bytes=" + buf.byteLength);
}

// timing budget for a 3 second recording
{
  const x = sine(180, 3);
  const t0 = Date.now();
  const a = DSP.denoise(x, 1);
  const t1 = Date.now();
  DSP.pitchShift(a, 3);
  const t2 = Date.now();
  console.log("timing: denoise=" + (t1 - t0) + "ms pitchShift=" + (t2 - t1) + "ms");
  check("polish under 3s for 3s audio", t2 - t0 < 3000, (t2 - t0) + "ms");
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nall green");
process.exit(fails ? 1 : 0);
