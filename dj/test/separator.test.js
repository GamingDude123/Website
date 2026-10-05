/* The AI vocal separator (js/separator.js + vendor/separator/worker.js + models/htdemucs).
 *
 *   node dj/test/separator.test.js
 *
 * Part A runs the separation core (tools/separator/src/core.js, the very file the worker bundles) with
 * onnxruntime-node on the CPU. Part B drives the real thing in Chromium: js/separator.js, the real worker, the
 * real model parts, served from a sub-path (/Website/dj/..., as GitHub Pages does), wasm execution provider.
 *
 *   SEP_SKIP_BROWSER=1   skip part B (it is slow: the network runs on one wasm thread, about 25 s per 7.8 s chunk)
 *   SEP_SKIP_MODEL=1     in part A, skip the runs that need the real network (keeps the transform and stitching tests)
 *   SEP_WEBGPU=1         also build the htdemucs session on WebGPU (SwiftShader) in this machine's Chromium: about 20 minutes
 *   ORT_NODE=dir         where onnxruntime-node lives (else: require(), tools/separator/node_modules, the build dir)
 *   CHROMIUM=/path       chromium executable, as in browser.test.js
 *   SEP_PORT=8140        port of the test server (the WebGPU probe uses the next one)
 *
 * IMPORTANT: the test signal is synthetic. It proves plumbing (lengths, no NaN, stitching, determinism, that the
 * browser path agrees with the node path), NOT musical quality. Whether htdemucs pulls a real singer out of a real
 * mix is the model's business and is not something this test can say.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const cp = require("child_process");

const DJ = path.resolve(__dirname, "..");
const Core = require(path.join(DJ, "tools", "separator", "src", "core.js"));
const MODEL_DIR = path.join(DJ, "models", "htdemucs");
const SR = 44100;
let fails = 0, skipped = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}
function skip(name, why) { console.log("SKIP " + name + "  " + why); skipped++; }
function info(s) { console.log("     " + s); }
const T0 = Date.now();
const secs = (t) => ((Date.now() - t) / 1000).toFixed(1) + " s";

// ---- a synthetic song: kick, hats and bass in the middle, a vibrato voice in the middle, a pad hard left and another hard right
function makeClip(seconds) {
  const n = Math.round(seconds * SR), L = new Float32Array(n), R = new Float32Array(n);
  const beat = 60 / 124;
  let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const vowels = [[700, 1220, 2600], [300, 2300, 3000], [400, 800, 2600], [500, 1900, 2500]];   // formant-ish: a/i/o/e
  const notes = [196, 220, 247, 220], bassNotes = [55, 55, 82.4, 65.4];
  let vph = 0, hatPrev = 0, padL = 0, padR = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, tb = t % beat, tb2 = (t + beat / 2) % beat, bi = Math.floor(t / beat);
    const kick = Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-tb * 35)) * tb) * Math.exp(-tb * 7) * 0.6;
    const noise = rnd(); const hat = (noise - hatPrev) * Math.exp(-tb2 * 55) * 0.12; hatPrev = noise;
    const bass = Math.sin(2 * Math.PI * bassNotes[bi % 4] * t) * Math.exp(-tb * 3.5) * 0.3;
    // voice: vibrato harmonic tone through three formant bumps, a syllable every third of a second
    const f0 = notes[Math.floor(t / (beat * 2)) % 4] * (1 + 0.03 * Math.sin(2 * Math.PI * 5.5 * t));
    vph += 2 * Math.PI * f0 / SR;
    const vow = vowels[Math.floor(t / beat) % 4];
    let v = 0;
    for (let h = 1; h <= 24; h++) {
      const fh = h * f0; if (fh > 8000) break;
      let a = 0; for (let k = 0; k < 3; k++) a += Math.exp(-0.5 * Math.pow((fh - vow[k]) / (90 + 0.08 * vow[k]), 2)) / (k + 1);
      v += (a + 0.02) / Math.sqrt(h) * Math.sin(h * vph);
    }
    const syl = 0.5 * (1 - Math.cos(2 * Math.PI * 3 * t));
    const voice = (v * 0.5 * (0.35 + 0.65 * syl) + 0.004 * rnd()) * 0.5;
    // pads: detuned saws, one chord per side, one-pole low-passed
    let sl = 0, sr = 0;
    for (const f of [110, 164.8, 220]) sl += 2 * ((f * (1 + 0.002) * t) % 1) - 1;
    for (const f of [130.8, 196, 261.6]) sr += 2 * ((f * (1 - 0.002) * t) % 1) - 1;
    padL += 0.08 * (sl * 0.07 - padL); padR += 0.08 * (sr * 0.07 - padR);
    const trem = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.4 * t);
    L[i] = kick + hat + bass + voice + padL * trem * 1.6;
    R[i] = kick + hat + bass + voice + padR * trem * 1.6;
  }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  for (let i = 0; i < n; i++) { L[i] *= 0.8 / peak; R[i] *= 0.8 / peak; }
  return [L, R];
}

function energy(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return s; }
function sdr(ref, est) {      // ref, est: [L, R]
  let num = 0, den = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < ref[c].length; i++) { const d = ref[c][i] - est[c][i]; num += ref[c][i] * ref[c][i]; den += d * d; }
  return 10 * Math.log10(num / Math.max(den, 1e-30));
}
function sum2(a, b) { return [0, 1].map((c) => { const o = new Float32Array(a[c].length); for (let i = 0; i < o.length; i++) o[i] = a[c][i] + b[c][i]; return o; }); }
function hasBad(a) { for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) return true; return false; }
function corr(a, b) { let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return ab / Math.sqrt(aa * bb + 1e-30); }
function maxStep(y, from, to) { let m = 0; for (let i = Math.max(1, from); i < Math.min(y.length, to); i++) m = Math.max(m, Math.abs(y[i] - y[i - 1])); return m; }
function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function sameBits(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(a[i] !== a[i] && b[i] !== b[i])) return false; return true; }

// ---- where is onnxruntime-node?
function findOrtNode() {
  const tries = [process.env.ORT_NODE, "onnxruntime-node", path.join(DJ, "tools", "separator", "node_modules", "onnxruntime-node"),
    path.join(process.env.SEP_WORK || path.join(process.env.TMPDIR || "/tmp", "autopilot-dj-separator-build"), "node_modules", "onnxruntime-node")].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  return null;
}

// a model that is not a model: the first input's STFT goes out as the given stem's spectrogram, or the audio as the given
// stem's time branch. Whatever the transforms and the chunk stitching do to it can then be checked exactly.
function stubOrt() {
  class Tensor { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; } }
  return { Tensor };
}
function stubSession(ort, mode, stem) {
  const N = Core.SEGMENT, SZ = 4 * 2048 * 336;
  return {
    inputNames: ["input", "onnx::ReduceMean_1"], outputNames: ["output", "5073"], runs: 0,
    async run(feeds) {
      this.runs++;
      const mask = new Float32Array(4 * SZ), time = new Float32Array(4 * 2 * N);
      if (mode === "spec") mask.set(feeds["onnx::ReduceMean_1"].data, stem * SZ);
      else if (mode === "time") { time.set(feeds["input"].data, stem * 2 * N); }
      return { output: new ort.Tensor("float32", mask, [1, 4, 4, 2048, 336]), "5073": new ort.Tensor("float32", time, [1, 4, 2, N]) };
    }
  };
}

// ============================================================================================================
async function partA() {
  console.log("\n== A. the separation core, in node ==");
  const stub = stubOrt();

  // ---- the transforms against a direct, naive version of what torch does
  {
    const N = Core.SEGMENT, x = new Float32Array(N), y = new Float32Array(N);
    let s = 9; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < N; i++) { x[i] = 0.4 * Math.sin(i * 0.031) + 0.1 * rnd(); y[i] = 0.3 * Math.sin(i * 0.011 + 1) + 0.1 * rnd(); }
    const dsp = Core.createDsp(), spec = dsp.forward(x, y);
    const reflect = (a, left, right) => { const o = new Float64Array(a.length + left + right); for (let i = 0; i < o.length; i++) { let j = i - left; while (j < 0 || j >= a.length) j = j < 0 ? -j : 2 * (a.length - 1) - j; o[i] = a[j]; } return o; };
    const hop = 1024, le = Math.ceil(N / hop), pad = hop / 2 * 3;
    // torch: pad 1536 / 1536+84, then stft(n_fft 4096, center=True -> reflect 2048 both ends), normalised, frames 2..2+le
    const xs = [x, y].map((a) => reflect(reflect(a, pad, pad + le * hop - N), 2048, 2048));
    let worst = 0, scale = 0;
    for (const [t, k] of [[0, 0], [0, 5], [1, 100], [2, 2047], [10, 7], [100, 1000], [200, 33], [334, 2000], [335, 0], [335, 1500], [3, 1], [333, 2046]]) {
      for (let c = 0; c < 2; c++) {
        let re = 0, im = 0;
        for (let i = 0; i < 4096; i++) {
          const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / 4096)), v = xs[c][(t + 2) * hop + i] * w / 64;
          re += v * Math.cos(2 * Math.PI * k * i / 4096); im -= v * Math.sin(2 * Math.PI * k * i / 4096);
        }
        const o = (k * 336 + t);
        worst = Math.max(worst, Math.abs(spec[(2 * c) * 2048 * 336 + o] - re), Math.abs(spec[(2 * c + 1) * 2048 * 336 + o] - im));
        scale = Math.max(scale, Math.abs(re), Math.abs(im));
      }
    }
    check("transforms: STFT matches torch's (reflect padding, window, scaling, frame alignment) at 24 bins", worst < 1e-5 * Math.max(1, scale), "max error " + worst.toExponential(2) + " (largest value " + scale.toFixed(2) + ")");

    // inverse: one frame set at one position, everything else zero; the answer is that frame, windowed, scaled and divided by the window sum
    const SZ = 4 * 2048 * 336, m = new Float32Array(4 * SZ), t0 = 120, kk = 321;
    m[3 * SZ + 0 * 2048 * 336 + kk * 336 + t0] = 1.0;       // vocals, left, real part of one bin of one frame
    m[3 * SZ + 3 * 2048 * 336 + 5 * 336 + t0] = 0.5;        // vocals, right, imaginary part of another bin
    dsp.inverse(m, [3], 0, 1);
    let werr = 0;
    const env = (n) => { let e = 0; for (let t = -2; t < 338; t++) { const i = n - (t * hop - pad); if (i >= 0 && i < 4096) { const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / 4096)); e += w * w; } } return e; };
    for (const n of [t0 * hop - pad + 5, t0 * hop - pad + 1500, t0 * hop - pad + 3000, t0 * hop - pad + 4090, t0 * hop - pad + 2048]) {
      const i = n - (t0 * hop - pad), w = 0.5 * (1 - Math.cos(2 * Math.PI * i / 4096));
      // irfft of a one-bin spectrum: 2/N * Re(X e^{+2 pi i k n / N}) * sqrt(N); (bins 1..2047 appear twice)
      const L1 = (2 / 4096) * 64 * Math.cos(2 * Math.PI * kk * i / 4096);
      const R1 = (2 / 4096) * 64 * 0.5 * -Math.sin(2 * Math.PI * 5 * i / 4096);
      werr = Math.max(werr, Math.abs(dsp.accum[0][n] - L1 * w / env(n)), Math.abs(dsp.accum[1][n] - R1 * w / env(n)));
    }
    check("transforms: inverse STFT of a single bin equals the hand-computed windowed cosine", werr < 1e-6, "max error " + werr.toExponential(2));
    check("transforms: inverse leaves the rest of the chunk silent", dsp.accum[0][(t0 - 20) * hop] === 0 && dsp.accum[0][(t0 + 20) * hop] === 0);
  }

  // ---- chunk stitching with stand-in models: exact where it can be
  {
    const sess = stubSession(stub, "time", 1);
    const lens = [1, 1000, Core.SEGMENT - 1, Core.SEGMENT, Core.SEGMENT + 1, 2 * Core.stride(0.25) + 777, Math.round(2.4 * Core.SEGMENT)];
    let worst = 0, lengthsOk = true, runsOk = true, label = [];
    for (const len of lens) {
      const x = new Float32Array(len), y = new Float32Array(len);
      for (let i = 0; i < len; i++) { x[i] = Math.sin(i * 0.013) * 0.5 + (i % 7) * 0.01; y[i] = Math.cos(i * 0.007) * 0.4; }
      sess.runs = 0;
      const r = await Core.separate(stub, sess, [x, y]);
      lengthsOk = lengthsOk && r.vocals[0].length === len && r.inst[1].length === len;
      runsOk = runsOk && sess.runs === Core.chunkCount(len);
      let e = 0; for (let i = 0; i < len; i++) e = Math.max(e, Math.abs(r.inst[0][i] - x[i]), Math.abs(r.inst[1][i] - y[i]), Math.abs(r.vocals[0][i]));
      worst = Math.max(worst, e); label.push(len + ":" + sess.runs);
    }
    check("stitching: a time-branch stand-in comes out exactly (lengths 1 ... 2.4 segments; short last chunk, overlap blend)", worst < 2e-6 && lengthsOk, "max error " + worst.toExponential(2));
    check("stitching: the number of model runs is ceil(length / stride)", runsOk, label.join(" "));
    let worstO = 0;
    for (const overlap of [0, 0.6]) {
      const len = Math.round(1.3 * Core.SEGMENT), x = new Float32Array(len);
      for (let i = 0; i < len; i++) x[i] = Math.sin(i * 0.02) * 0.5;
      const r = await Core.separate(stub, sess, [x, x], { overlap });
      for (let i = 0; i < len; i++) worstO = Math.max(worstO, Math.abs(r.inst[0][i] - x[i]));
    }
    check("stitching: exact for overlap 0 (hard cuts) and 0.6 as well", worstO < 2e-6, "max error " + worstO.toExponential(2));
  }
  {
    const len = Math.round(2.2 * Core.SEGMENT), [x, y] = makeClip(len / SR);
    const toVocals = await Core.separate(stub, stubSession(stub, "spec", 3), [x, y]);
    const toInst = await Core.separate(stub, stubSession(stub, "spec", 1), [x, y]);
    const lo = 3000, hi = len - 3000;
    const part = (a) => a.subarray(lo, hi);
    const sd = (ref, est) => { let n = 0, d = 0; for (let c = 0; c < 2; c++) for (let i = lo; i < hi; i++) { n += ref[c][i] ** 2; d += (ref[c][i] - est[c][i]) ** 2; } return 10 * Math.log10(n / d); };
    const a = sd([x, y], toVocals.vocals), b = sd([x, y], toInst.inst);
    check("stitching: a spectrogram stand-in round-trips through STFT, chunking and iSTFT (vocals path)", a > 45 && energy(toVocals.inst[0]) === 0, "SDR " + a.toFixed(1) + " dB");
    check("stitching: ... and the instrumental path sums drums+bass+other", b > 45 && energy(toInst.vocals[1]) === 0, "SDR " + b.toFixed(1) + " dB");
  }
  {
    const x = new Float32Array(Core.SEGMENT * 3), seen = [], sess = stubSession(stub, "time", 1);
    let calls = 0;
    const r = Core.separate(stub, sess, [x], { isAborted: () => ++calls > 1, onProgress: (f) => seen.push(f) });
    let err = null; try { await r; } catch (e) { err = e; }
    check("stitching: isAborted stops the loop with an AbortError, within a run or two", err && err.name === "AbortError" && sess.runs <= 3, err ? err.name + ", runs " + sess.runs : "resolved");
    const mono = await Core.separate(stub, stubSession(stub, "time", 1), [new Float32Array(5000).fill(0.25)]);
    check("stitching: mono input gives stereo output of the same length", mono.vocals.length === 2 && mono.inst.length === 2 && mono.inst[1].length === 5000 && Math.abs(mono.inst[1][2500] - 0.25) < 1e-6);
  }
  // memory of the core alone (no network): a 4-minute song through a stand-in model
  {
    const len = SR * 240, x = new Float32Array(len), y = new Float32Array(len);
    for (let i = 0; i < len; i += 97) { x[i] = 0.1; y[i] = -0.1; }
    if (global.gc) global.gc();
    const base = process.memoryUsage().rss; let peak = base;
    const iv = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 50);
    const t = Date.now();
    const sess = { inputNames: ["input", "onnx::ReduceMean_1"], outputNames: ["output", "5073"], runs: 0,
      async run() { const N = Core.SEGMENT; return { output: new stub.Tensor("float32", new Float32Array(4 * 4 * 2048 * 336), [1, 4, 4, 2048, 336]), "5073": new stub.Tensor("float32", new Float32Array(4 * 2 * N), [1, 4, 2, N]) }; } };
    const kept = await Core.separate(stub, sess, [x, y]);
    peak = Math.max(peak, process.memoryUsage().rss);                // the timer only runs between chunks: sample at the end, outputs still alive
    clearInterval(iv);
    const mb = (b) => Math.round(b / 1048576);
    const held = 6 * len * 4 / 1048576;              // input (2 ch) + two stems (2 ch each), float32
    info("core memory, 4-minute song, stand-in model: peak RSS grew by " + mb(peak - base) + " MB (input " + mb(2 * len * 4) + " MB + two stereo stems " + mb(4 * len * 4) + " MB = " + mb(6 * len * 4) + " MB, the rest is one chunk in flight) in " + secs(t));
    check("memory: the core holds input + two stems + one chunk, not four stems", kept.vocals.length === 2 && (peak - base) / 1048576 < held + 450, mb(peak - base) + " MB vs " + Math.round(held) + " MB + 450");
  }

  if (process.env.SEP_SKIP_MODEL === "1") { skip("the real model in node", "SEP_SKIP_MODEL=1"); return null; }
  const manifest = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, "manifest.json"), "utf8"));
  const bufs = manifest.parts.map((p) => fs.readFileSync(path.join(MODEL_DIR, p.file)));
  check("model: every part has the size and SHA-256 the manifest says", manifest.parts.every((p, i) => bufs[i].length === p.bytes && sha256(bufs[i]) === p.sha256), manifest.parts.length + " parts, each <= " + Math.max.apply(null, manifest.parts.map((p) => p.bytes)) + " bytes");
  check("model: every part is under 44 MB", manifest.parts.every((p) => p.bytes <= 44e6));
  const model = Buffer.concat(bufs);
  check("model: the parts join into the file the manifest names", model.length === manifest.bytes && sha256(model) === manifest.sha256, manifest.version + " " + model.length + " bytes");
  const ort = findOrtNode();
  if (!ort) { skip("the real model in node", "onnxruntime-node not found (see ORT_NODE; SEP_WITH_NODE=1 tools/separator/build.sh installs it)"); return null; }

  const t0 = Date.now();
  const session = await ort.InferenceSession.create(model);
  info("onnxruntime-node " + (ort.env && ort.env.versions ? ort.env.versions.node : "") + ", CPU, session created in " + secs(t0) + "; " + os.cpus().length + " cores");
  const [L, R] = makeClip(16);
  const n = L.length;
  const progress = [];
  const t1 = Date.now();
  const res = await Core.separate(ort, session, [L, R], { onProgress: (f) => progress.push(f) });
  const dt = (Date.now() - t1) / 1000, chunks = Core.chunkCount(n);
  info("separated 16.0 s in " + dt.toFixed(1) + " s: " + chunks + " chunks, " + (dt / chunks).toFixed(2) + " s per 7.8 s chunk, " + (16 / dt).toFixed(2) + "x real time (with the 25% overlap)");
  check("lengths: all four output arrays are as long as the input", res.vocals.length === 2 && res.inst.length === 2 && [].concat(res.vocals, res.inst).every((a) => a instanceof Float32Array && a.length === n), n + " samples");
  check("no NaN or Infinity in the output", ![].concat(res.vocals, res.inst).some(hasBad));
  const mix = [L, R], total = sum2(res.vocals, res.inst), s = sdr(mix, total);
  info("SDR of (vocals + inst) against the mix: " + s.toFixed(1) + " dB  (the 4 stems are not constrained to sum to the mix)");
  check("vocals + inst reconstructs the mix (SDR >= 20 dB)", s >= 20, s.toFixed(1) + " dB");
  const ev = energy(res.vocals[0]) + energy(res.vocals[1]), ei = energy(res.inst[0]) + energy(res.inst[1]), em = energy(L) + energy(R);
  info("energy in the vocals stem " + (100 * ev / em).toFixed(2) + "% of the mix, in inst " + (100 * ei / em).toFixed(1) + "% (synthetic voice: whether the model calls it a voice says nothing about real singers)");
  check("progress is monotonic, starts at 0 and ends at 1", progress[0] === 0 && progress[progress.length - 1] === 1 && progress.every((f, i) => i === 0 || f >= progress[i - 1]) && progress.length >= chunks, progress.map((f) => f.toFixed(2)).join(" "));

  // seams: look at the sample-to-sample step in a window around every place where one chunk fades into the next
  const stride = Core.stride(0.25), seams = [];
  for (let k = 1; k * stride < n; k++) { seams.push(k * stride); if (k * stride + Core.SEGMENT < n) seams.push(k * stride + Core.SEGMENT); }
  for (let k = 1; k * stride < n; k++) { seams.push(Math.round(k * stride + Core.SEGMENT / 2)); }      // also the middle of each chunk, where it is the only voice
  const half = 48, inside = seams.filter((p) => p > half && p + half < n);
  const ratioAt = (ys, xs, p) => Math.max(maxStep(ys[0], p - half, p + half) / (maxStep(xs[0], p - half, p + half) + 1e-3), maxStep(ys[1], p - half, p + half) / (maxStep(xs[1], p - half, p + half) + 1e-3));
  const ratio = (ys, xs) => Math.max.apply(null, inside.map((p) => ratioAt(ys, xs, p)));
  const rTot = ratio(total, mix), rInst = ratio(res.inst, mix);
  check("chunk seams: the largest step next to a seam is at most 1.15x the mix's own step there", rTot <= 1.15 && rInst <= 1.15, "(vocals+inst) " + rTot.toFixed(3) + ", inst " + rInst.toFixed(3) + ", " + inside.length + " positions (chunk starts, chunk ends, chunk middles)");
  // the same measure on the output with a click put in at the quietest seam: it has to notice
  const quiet = inside.slice().sort((p, q) => maxStep(L, p - half, p + half) - maxStep(L, q - half, q + half))[0];
  const clicked = res.inst[0].slice(); for (let i = quiet; i < n; i++) clicked[i] += 0.1;
  const rClick = ratioAt([clicked, res.inst[1]], mix, quiet);
  check("chunk seams: the measure does see a deliberate 0.1 click at a seam (so a pass above means something)", rClick > 1.15, "ratio " + rClick.toFixed(2) + " there, against " + ratioAt(res.inst, mix, quiet).toFixed(2) + " without");
  // and the reconstruction error right at the seams is not worse than elsewhere
  const errAt = (p) => { let e = 0, c = 0; for (let i = Math.max(0, p - 2048); i < Math.min(n, p + 2048); i++) { e += (L[i] - total[0][i]) ** 2; c++; } return e / c; };
  let tot = 0; for (let i = 0; i < n; i++) tot += (L[i] - total[0][i]) ** 2;
  const worstSeam = Math.max.apply(null, inside.map(errAt)) / (tot / n);
  check("chunk seams: the error of (vocals+inst) against the mix within 2048 samples of a seam is at most 3x its average", worstSeam <= 3, worstSeam.toFixed(2) + "x");

  // 7.8 s excerpt: the reference for the browser, and determinism
  const exL = L.slice(0, Core.SEGMENT), exR = R.slice(0, Core.SEGMENT);
  const t2 = Date.now();
  const a = await Core.separate(ort, session, [exL, exR]);
  const dt2 = (Date.now() - t2) / 1000;
  const b = await Core.separate(ort, session, [exL, exR]);
  check("deterministic: two runs on the same audio give identical samples", [0, 1].every((c) => sameBits(a.vocals[c], b.vocals[c]) && sameBits(a.inst[c], b.inst[c])), "7.8 s excerpt, " + Core.chunkCount(exL.length) + " chunks, " + dt2.toFixed(1) + " s each");
  const mono = await Core.separate(ort, session, [exL.subarray(0, 44100)]);
  check("mono input: two stereo stems of the same length come back", mono.vocals.length === 2 && mono.inst[1].length === 44100 && !hasBad(mono.inst[0]) && sdr([exL.subarray(0, 44100), exL.subarray(0, 44100)], sum2(mono.vocals, mono.inst)) > 15);
  const sessCount = { inputNames: session.inputNames, outputNames: session.outputNames, runs: 0, run(f) { this.runs++; return session.run(f); } };
  let calls = 0, err = null;
  try { await Core.separate(ort, sessCount, [L, R], { isAborted: () => ++calls > 1 }); } catch (e) { err = e; }
  check("abort: stops after the chunk in progress with an AbortError (" + sessCount.runs + " of " + chunks + " chunks run)", err && err.name === "AbortError" && sessCount.runs < chunks);
  return { ort, session, a, exL, exR, secondsPerChunk: dt / chunks };
}

// ============================================================================================================
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".css": "text/css", ".md": "text/markdown" };
function startServer(port, virtual) {
  const log = [];
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    log.push(req.method + " " + u);
    if (virtual(req, res, u)) return;
    if (!u.startsWith("/Website/")) { res.writeHead(404).end("not found"); return; }
    const file = path.join(path.dirname(DJ), u.slice("/Website/".length));
    if (!file.startsWith(path.dirname(DJ)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { "Content-Type": "text/plain" }).end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Content-Length": fs.statSync(file).size, "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, () => r({ server, log })));
}

function chromiumLib() {
  for (const name of ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"]) { try { return require(name); } catch (e) { /* next */ } }
  return null;
}

function chromeRssMB() {
  try {
    let total = 0;
    for (const pid of fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p))) {
      try {
        const comm = fs.readFileSync("/proc/" + pid + "/comm", "utf8");
        if (!/chrom|headless/i.test(comm)) continue;
        total += +/VmRSS:\s+(\d+)/.exec(fs.readFileSync("/proc/" + pid + "/status", "utf8"))[1];
      } catch (e) { /* gone */ }
    }
    return total / 1024;
  } catch (e) { return 0; }
}

async function partB(A) {
  console.log("\n== B. js/separator.js + the real worker, model and wasm, in Chromium ==");
  const pw = chromiumLib();
  if (!pw) { skip("browser part", "playwright not found"); return; }
  const PORT = +process.env.SEP_PORT || 8140, BASE = "http://localhost:" + PORT + "/Website/dj/";
  const full = makeClip(16), L = full[0].slice(0, Core.SEGMENT), R = full[1].slice(0, Core.SEGMENT);      // exactly 7.8 s: the excerpt part A used
  const clip = Buffer.alloc(L.length * 8); Buffer.from(L.buffer).copy(clip, 0); Buffer.from(R.buffer).copy(clip, L.length * 4);
  const posted = {};
  const { server, log } = await startServer(PORT, (req, res, u) => {
    if (u === "/Website/dj/sep-test.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end('<!doctype html><meta charset="utf-8"><title>separator test</title><script src="js/separator.js"></script><body>test</body>');
      return true;
    }
    if (u === "/Website/dj/_t/clip.f32") { res.writeHead(200, { "Content-Type": "application/octet-stream" }); res.end(clip); return true; }
    if (u.startsWith("/Website/dj/_t/result/") && req.method === "POST") {
      const parts = []; req.on("data", (c) => parts.push(c)); req.on("end", () => { posted[u.split("/").pop()] = Buffer.concat(parts); res.writeHead(204).end(); });
      return true;
    }
    if (u.startsWith("/Website/dj/_bad/")) {            // the real manifest, but the first part is cut short
      const name = u.split("/").pop(), file = path.join(MODEL_DIR, name);
      if (!fs.existsSync(file)) { res.writeHead(404).end("nf"); return true; }
      const data = fs.readFileSync(file), cut = name.endsWith("part00") ? data.subarray(0, data.length - 1000) : data;
      res.writeHead(200, { "Content-Type": name.endsWith(".json") ? "application/json" : "application/octet-stream" }); res.end(cut);
      return true;
    }
    return false;
  });
  const t0 = Date.now();
  let browser, peakRss = 0;
  const poll = setInterval(() => { peakRss = Math.max(peakRss, chromeRssMB()); }, 400);
  try {
    browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"] });
    const ctx = await browser.newContext();
    const errors = [];
    const watch = (page) => {
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
      page.on("worker", (w) => w.on("console", (m) => { if (m.type() === "error") errors.push("worker console.error: " + m.text()); }));
    };
    const modelReqs = () => log.filter((l) => /\/models\/htdemucs\//.test(l));
    const loadClip = `async () => { const b = new Float32Array(await (await fetch("_t/clip.f32")).arrayBuffer()); const n = b.length / 2; return [b.slice(0, n), b.slice(n)]; }`;

    // ---- first visit
    const page = await ctx.newPage(); watch(page);
    await page.goto(BASE + "sep-test.html");
    const env = await page.evaluate(() => ({ coi: self.crossOriginIsolated, sab: typeof SharedArrayBuffer, supported: Separator.supported(), phase: Separator.state().phase, gpu: !!navigator.gpu }));
    check("the page is not cross-origin isolated (as on GitHub Pages): no SharedArrayBuffer", env.coi === false && env.sab === "undefined", JSON.stringify(env));
    check("before init: phase idle", env.phase === "idle");
    const t1 = Date.now();
    const first = await page.evaluate(async (loadClipSrc) => {
      Separator.configure({ allowWasm: true });
      const states = []; let last = "";
      const off = Separator.onState((s) => { const k = s.phase; if (k !== last) { states.push(k); last = k; } });
      const t = performance.now();
      const ok = await Separator.init();
      const initMs = performance.now() - t, st = Separator.state();
      off();
      const [L, R] = await eval("(" + loadClipSrc + ")")();
      const before = [L[1000], R[2000], L.length];
      const prog = [], tt = performance.now();
      const out = await Separator.separate([L, R], 44100, (f) => prog.push(f));
      const sepMs = performance.now() - tt;
      const post = (name, arr) => fetch("_t/result/" + name, { method: "POST", body: arr });
      await post("vocalsL", out.vocals[0]); await post("vocalsR", out.vocals[1]); await post("instL", out.inst[0]); await post("instR", out.inst[1]);
      let wrong = null; try { await Separator.separate([L, R], 48000); } catch (e) { wrong = e.message; }
      let tooMany = null; try { await Separator.separate([], 44100); } catch (e) { tooMany = e.message; }
      const cache = await caches.open("autopilot-dj-model-v1"), keys = (await cache.keys()).map((r) => r.url.replace(/^.*\/models\/htdemucs\//, ""));
      const bad = (a) => { for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) return true; return false; };
      return { ok, initMs, st, states, prog, sepMs, secs: out.seconds, lens: [out.vocals[0].length, out.vocals[1].length, out.inst[0].length, out.inst[1].length], n: L.length,
        nan: bad(out.vocals[0]) || bad(out.vocals[1]) || bad(out.inst[0]) || bad(out.inst[1]), sameInput: before[0] === L[1000] && before[1] === R[2000] && before[2] === L.length, wrong, tooMany, keys,
        stereoBuffers: out.vocals[0].buffer !== out.vocals[1].buffer, isF32: out.inst[0] instanceof Float32Array };
    }, loadClip);
    check("init(): resolves true, phase ready", first.ok === true && first.st.phase === "ready" && first.st.progress === 1, JSON.stringify(first.st) + ", " + (first.initMs / 1000).toFixed(1) + " s (download + checks + session)");
    check("init(): the execution provider is wasm (no WebGPU adapter in this headless browser)", first.st.ep === "wasm");
    check("state went idle -> downloading -> loading -> ready", first.states.join(">") === "downloading>loading>ready", first.states.join(">"));
    const mr1 = modelReqs(), want = ["manifest.json"].concat(JSON.parse(fs.readFileSync(path.join(MODEL_DIR, "manifest.json"), "utf8")).parts.map((p) => p.file));
    check("first visit: the manifest and each part fetched exactly once", want.every((f) => mr1.filter((l) => l.endsWith("/" + f)).length === 1) && mr1.length === want.length, mr1.length + " requests");
    check("first visit: only the worker script and its one wasm file are fetched from vendor/, from the page's sub-path", log.filter((l) => /\/Website\/dj\/vendor\/separator\/worker\.js$/.test(l)).length === 1 && log.filter((l) => /\/Website\/dj\/vendor\/separator\/ort\/ort-wasm-simd-threaded\.jsep\.wasm$/.test(l)).length === 1 && log.filter((l) => /\/vendor\//.test(l)).length === 2,
      log.filter((l) => /vendor\//.test(l)).join(" | "));
    check("model parts are in the Cache API after the first visit", want.every((f) => first.keys.some((k) => k === f)), first.keys.length + " entries");
    check("separate(): result lengths equal the input, stereo, Float32Array, no NaN", first.lens.every((l) => l === first.n) && !first.nan && first.stereoBuffers && first.isF32, first.lens.join(","));
    check("separate(): progress events arrive, monotonic, 0 ... 1", first.prog.length >= 3 && first.prog[0] === 0 && first.prog[first.prog.length - 1] === 1 && first.prog.every((f, i) => !i || f >= first.prog[i - 1]), first.prog.map((f) => f.toFixed(2)).join(" "));
    check("separate(): the caller's arrays are untouched", first.sameInput);
    check("separate(): a sample rate other than 44100 is refused with a clear message", /44100/.test(first.wrong || ""), first.wrong);
    check("separate(): zero channels is refused with a clear message", /1 or 2 channels/.test(first.tooMany || ""), first.tooMany);
    info("wasm (single thread): init " + (first.initMs / 1000).toFixed(1) + " s, separate 7.8 s clip (" + Core.chunkCount(first.n) + " chunks) " + (first.secs).toFixed(1) + " s in the worker, " + (first.sepMs / 1000).toFixed(1) + " s on the page");
    if (A) {
      const f32 = (name) => { const b = posted[name]; return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
      const cv = [corr(f32("vocalsL"), A.a.vocals[0]), corr(f32("vocalsR"), A.a.vocals[1])], ci = [corr(f32("instL"), A.a.inst[0]), corr(f32("instR"), A.a.inst[1])];
      const rel = (x, y) => { let d = 0, e = 0; for (let i = 0; i < x.length; i++) { d += (x[i] - y[i]) ** 2; e += y[i] ** 2; } return 10 * Math.log10(e / Math.max(d, 1e-30)); };
      const snrI = rel(f32("instL"), A.a.inst[0]), snrV = rel(f32("vocalsL"), A.a.vocals[0]);
      info("browser (wasm) against node (CPU), same clip: correlation inst " + ci.map((c) => c.toFixed(6)).join("/") + ", vocals " + cv.map((c) => c.toFixed(6)).join("/") + "; agreement " + snrI.toFixed(1) + " dB (inst), " + snrV.toFixed(1) + " dB (vocals)");
      check("the browser's stems match node's (correlation >= 0.999 on inst and vocals, both channels; inst agrees to 40 dB)", Math.min.apply(null, ci) >= 0.999 && (energy(A.a.vocals[0]) < 1e-6 || Math.min.apply(null, cv) >= 0.999) && snrI > 40);
    } else skip("browser vs node comparison", "part A did not run the model");

    // ---- second visit: everything from the Cache API
    const lenBefore = log.length;
    const page2 = await ctx.newPage(); watch(page2);
    await page2.goto(BASE + "sep-test.html");
    const t2 = Date.now();
    const second = await page2.evaluate(async (loadClipSrc) => {
      Separator.configure({ allowWasm: true });
      const t = performance.now(), ok = await Separator.init(), initMs = performance.now() - t;
      const ready = Separator.state();
      const [L, R] = await eval("(" + loadClipSrc + ")")();
      // abort the song in the worker, with a second and third song already waiting behind it
      const ac = new AbortController();
      let aAbortedAt = 0, aRejectedAt = 0, aErr = null;
      const progA = [];
      const a = Separator.separate([L, R], 44100, (f) => { progA.push(f); if (f === 0) { aAbortedAt = performance.now(); setTimeout(() => ac.abort(), 50); } }, ac.signal).catch((e) => { aErr = e; aRejectedAt = performance.now(); });
      Separator.configure({ overlap: 0 });                              // one chunk for the short songs
      const short = L.slice(0, 2 * 44100);
      let bStart = 0; const progB = [];
      const b = Separator.separate([short], 44100, (f) => { if (!progB.length) bStart = performance.now(); progB.push(f); });
      let cErr = null, dErr = null;
      const c = Separator.separate([short, short], 44100).catch((e) => { cErr = e; });
      const d = Separator.separate([short], 44100).catch((e) => { dErr = e; });
      await a;
      const bOut = await b;
      Separator.cancelAll();                                            // C is in the worker now, D waits: both go
      await c; await d;
      const bad = (x) => { for (let i = 0; i < x.length; i++) if (!isFinite(x[i])) return true; return false; };
      const pre = Separator.state();
      let pre2 = null; const aborted = new AbortController(); aborted.abort();
      try { await Separator.separate([short], 44100, null, aborted.signal); } catch (e) { pre2 = e; }
      return { ok, initMs, ready, aErr: aErr && { name: aErr.name, message: aErr.message }, abortToReject: aRejectedAt - aAbortedAt, progA, bLens: [bOut.vocals.length, bOut.vocals[0].length, bOut.inst[1].length], bNan: bad(bOut.inst[0]) || bad(bOut.vocals[1]),
        bStartedAfterAbortMs: bStart - aRejectedAt, bProg: progB, cErr: cErr && cErr.name, dErr: dErr && dErr.name, shortN: short.length, state: pre.phase, pre2: pre2 && pre2.name };
    }, loadClip);
    const mr2 = modelReqs().length - mr1.length;
    check("second visit: ready again, with no request for the manifest or any model part (all from the Cache API)", second.ok === true && second.ready.phase === "ready" && mr2 === 0, "model requests: " + mr2 + ", ready in " + (second.initMs / 1000).toFixed(1) + " s");
    check("abort: an AbortController abort rejects with an Error named AbortError, promptly", second.aErr && second.aErr.name === "AbortError" && second.abortToReject < 1500, second.aErr ? second.aErr.name + ", " + Math.round(second.abortToReject) + " ms" : "not rejected");
    check("queue: the song behind it still comes out right (stereo, right length, no NaN)", second.bLens[0] === 2 && second.bLens[1] === second.shortN && second.bLens[2] === second.shortN && !second.bNan && second.bProg[second.bProg.length - 1] === 1, second.bLens.join(","));
    check("queue: one song at a time: the next song starts only after the aborted one has left the worker (the chunk in progress still has to finish)", second.bStartedAfterAbortMs > 500, Math.round(second.bStartedAfterAbortMs) + " ms after the abort rejected");
    check("cancelAll(): the song in the worker and the one queued behind it both reject with AbortError; an already-aborted signal rejects at once", second.cErr === "AbortError" && second.dErr === "AbortError" && second.pre2 === "AbortError");
    check("the state is still ready after aborts", second.state === "ready");

    // ---- a model that is not there; a damaged model; no WebGPU at all
    const ctx2 = await browser.newContext();
    const page3 = await ctx2.newPage(); const errs3 = []; page3.on("pageerror", (e) => errs3.push(e.message));
    await page3.goto(BASE + "sep-test.html");
    const missing = await page3.evaluate(async () => {
      Separator.configure({ allowWasm: true, modelBase: "nowhere/htdemucs/" });
      const seen = []; Separator.onState((s) => seen.push(s.phase));
      let threw = null, ok = null;
      try { ok = await Separator.init(); } catch (e) { threw = e.message; }
      const again = await Separator.init();
      let sepErr = null; try { await Separator.separate([new Float32Array(44100)], 44100); } catch (e) { sepErr = e.message; }
      return { threw, ok, again, st: Separator.state(), seen, sepErr, supported: Separator.supported() };
    });
    check("missing model: init() resolves false, never throws; phase unavailable with a readable reason", missing.threw === null && missing.ok === false && missing.again === false && missing.st.phase === "unavailable" && /404/.test(missing.st.reason) && /manifest/.test(missing.st.reason) && missing.seen[missing.seen.length - 1] === "unavailable", JSON.stringify(missing.st));
    check("missing model: separate() rejects saying it is unavailable", /unavailable/i.test(missing.sepErr || ""), missing.sepErr);
    const page4 = await ctx2.newPage();
    await page4.goto(BASE + "sep-test.html");
    const damaged = await page4.evaluate(async () => {
      Separator.configure({ allowWasm: true, modelBase: "_bad/" });
      const ok = await Separator.init(); return { ok, st: Separator.state() };
    });
    check("damaged download: phase unavailable, and the reason says the part is damaged", damaged.ok === false && damaged.st.phase === "unavailable" && /damaged/.test(damaged.st.reason), damaged.st.reason);
    const page5 = await ctx2.newPage();
    await page5.addInitScript(() => { Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }); });
    await page5.goto(BASE + "sep-test.html");
    const nogpu = await page5.evaluate(async () => {
      const before = Separator.supported(); const ok = await Separator.init(); const st = Separator.state();
      Separator.configure({ allowWasm: true }); const after = Separator.supported();
      return { before, ok, st, after };
    });
    check("no WebGPU and no allowWasm: supported() is false and init() resolves false with a reason", nogpu.before === false && nogpu.ok === false && /WebGPU/.test(nogpu.st.reason || "") && nogpu.after === true, JSON.stringify(nogpu.st));
    check("no console errors or page errors during the main flow", errors.length === 0, errors.slice(0, 3).join(" | "));
    check("the failing-model pages raised no uncaught errors", errs3.length === 0, errs3.join(" | "));
    await ctx2.close();
    info("browser part: " + secs(t0) + " wall; Chromium (all processes) peak RSS " + Math.round(peakRss) + " MB");
  } finally {
    clearInterval(poll);
    if (browser) await browser.close();
    server.close();
  }
}

// ---- WebGPU on this machine's Chromium: honest probe
async function webgpuProbe(A) {
  console.log("\n== C. WebGPU in this sandbox ==");
  const pw = chromiumLib();
  if (!pw) { skip("webgpu probe", "playwright not found"); return; }
  const PORT = (+process.env.SEP_PORT || 8140) + 1;
  const { server, log } = await startServer(PORT, (req, res, u) => { if (u === "/Website/dj/sep-test.html") { res.writeHead(200, { "Content-Type": "text/html" }); res.end('<!doctype html><title>x</title><script src="js/separator.js"></script>'); return true; } return false; });
  const sets = { "(no flags)": [], "--enable-unsafe-webgpu": ["--enable-unsafe-webgpu"],
    "--enable-unsafe-webgpu --enable-features=Vulkan --use-angle=swiftshader --use-webgpu-adapter=swiftshader": ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-webgpu-adapter=swiftshader"] };
  let working = null;
  for (const [name, flags] of Object.entries(sets)) {
    const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"].concat(flags) });
    try {
      const page = await browser.newPage(); await page.goto("http://localhost:" + PORT + "/Website/dj/sep-test.html");
      const r = await page.evaluate(async () => {
        if (!navigator.gpu) return "navigator.gpu is undefined";
        const a = await navigator.gpu.requestAdapter(); if (!a) return "requestAdapter() returned null";
        const i = a.info || {}; return "adapter: vendor=" + i.vendor + " architecture=" + i.architecture + " fallback=" + (a.info ? a.info.isFallbackAdapter : a.isFallbackAdapter) + " maxBufferSize=" + a.limits.maxBufferSize;
      });
      info(name + " -> " + r);
      if (/^adapter/.test(r) && !working) working = flags;
    } finally { await browser.close(); }
  }
  if (!working) { info("no WebGPU adapter in this sandbox: the webgpu execution provider could not be tried here"); server.close(); return; }
  if (process.env.SEP_WEBGPU !== "1") { info("an adapter exists (SwiftShader, i.e. WebGPU emulated on the CPU). Set SEP_WEBGPU=1 to build the htdemucs session on it (init runs the network once to compile the shaders: about 20 minutes on SwiftShader)"); server.close(); return; }
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"].concat(working) });
  try {
    const page = await browser.newPage(); await page.goto("http://localhost:" + PORT + "/Website/dj/sep-test.html");
    const t = Date.now();
    const r = await page.evaluate(async () => { Separator.configure({ allowWasm: false }); const ok = await Separator.init(); return { ok, st: Separator.state() }; });
    info("webgpu session (SwiftShader): " + JSON.stringify(r) + " in " + secs(t));
    check("htdemucs session on the WebGPU EP (and it ran the network once to compile the shaders)", r.ok === true && r.st.ep === "webgpu");
    check("the WebGPU path fetches the same two vendor files and nothing else", log.filter((l) => /\/vendor\//.test(l)).length === 2, log.filter((l) => /\/vendor\//.test(l)).join(" | "));
  } finally { await browser.close(); server.close(); }
}

(async () => {
  const A = await partA();
  if (process.env.SEP_SKIP_BROWSER === "1") skip("part B (browser) and C (webgpu probe)", "SEP_SKIP_BROWSER=1");
  else { await partB(A); await webgpuProbe(A); }
  console.log("\n" + (fails ? fails + " FAILED" : "all passed") + (skipped ? ", " + skipped + " skipped" : "") + ", " + secs(T0) + " total");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
