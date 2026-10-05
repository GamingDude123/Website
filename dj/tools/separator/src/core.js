/* The separation core: everything between "a decoded song" and "vocals + instrumental",
 * except the neural network itself, which is passed in as an onnxruntime session.
 *
 * It is plain JS with no imports so that the very same file runs in the browser
 * worker (bundled by tools/separator/build.sh, with onnxruntime-web) and in node
 * (test/separator.test.js, with onnxruntime-node). Pass the `ort` module that matches
 * the session; the core only needs `ort.Tensor`.
 *
 * Model: Meta's "htdemucs" (Hybrid Transformer Demucs v4, 4 stems: drums, bass, other,
 * vocals) as exported to ONNX by Kevin Gibbons' demucs-js (MIT, see LICENSE-demucs-js.md).
 * The export leaves the STFT / iSTFT outside the graph, so this file does them:
 *
 *   input 0  mix       [1, 2, 343980]        7.8 s of stereo audio at 44.1 kHz, fixed length
 *   input 1  spec      [1, 4, 2048, 336]     STFT of that audio, (re, im) of left then right
 *   output 0 mask      [1, 4, 4, 2048, 336]  per stem, the spectrogram of that stem (same layout)
 *   output 1 time      [1, 4, 2, 343980]     per stem, the time-domain branch; stem = ISTFT(mask) + time
 *
 * A song is cut into 7.8 s chunks that overlap (25% by default) and are blended with a
 * triangle window. Memory is kept to what is asked for: only two stems are accumulated,
 * `vocals` and `inst` (= drums + bass + other). The iSTFT is linear, so the three
 * instrumental spectrograms are added first and inverted once: two inverse transforms per
 * chunk instead of four, and two output buffers instead of four.
 *
 * What differs from upstream demucs-js (tools/separator/upstream/, kept for comparison):
 *  - the left edge of its reflect padding was wrong (zeros instead of a mirror image),
 *  - its iSTFT returned a signal 4096 samples too short, so the last 2476 samples of every
 *    chunk read past the end of the buffer (garbage, or NaN in the last row),
 *  - its FFT recomputed sin/cos in the inner loop and it ran eight inverse transforms per
 *    frame; here twiddles are tabulated and two real signals share one complex transform (two per frame),
 *  - everything is written to be allocation-light (one set of scratch buffers per call).
 */

var SeparatorCore = (function () {
  "use strict";

  const SAMPLE_RATE = 44100;
  const SEGMENT = 343980;                       // floor(7.8 * 44100): the model's fixed input length
  const NFFT = 4096, HOP = 1024;
  const FREQS = NFFT / 2;                       // 2048 bins; the Nyquist bin is dropped, as in demucs
  const FRAMES = Math.ceil(SEGMENT / HOP);      // 336
  const PAD = HOP / 2 * 3;                      // 1536: demucs' extra reflect padding before the STFT
  const SPEC_SIZE = 4 * FREQS * FRAMES;
  const STEMS = 4, VOCALS = 3;                  // drums, bass, other, vocals
  const COMP = FREQS * FRAMES;                  // one (stem, component) plane of a spectrogram
  const STEM_PLANE = 4 * COMP;

  // ---- FFT: iterative radix-2 on Float64 buffers, tabulated twiddles ----------------------
  function makeFFT(n) {
    const rev = new Uint16Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    let bits = 0; while ((1 << bits) < n) bits++;
    for (let i = 0; i < n; i++) {
      let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      rev[i] = r;
    }
    for (let i = 0; i < n / 2; i++) { const a = -2 * Math.PI * i / n; cos[i] = Math.cos(a); sin[i] = Math.sin(a); }
    // in place; inverse = true flips the sign of the exponent and does NOT scale by 1/n
    return function transform(re, im, inverse) {
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      const sgn = inverse ? -1 : 1;
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const a = i + j, b = a + half, wr = cos[k], wi = sgn * sin[k];
            const tr = wr * re[b] - wi * im[b], ti = wr * im[b] + wi * re[b];
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          }
        }
      }
    };
  }
  const fft = makeFFT(NFFT);

  // torch.hann_window(4096): periodic
  const hann = new Float64Array(NFFT);
  for (let i = 0; i < NFFT; i++) hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / NFFT));

  // Sum of hann^2 over every iSTFT frame (the 336 real ones plus the 4 zero frames demucs
  // pads on, two each side), at each sample of a chunk: torch.istft divides by this.
  // Frame t (0..335) starts at chunk sample t*HOP - PAD; the padding frames are t = -2, -1, 336, 337.
  const invEnv = new Float64Array(SEGMENT);
  (function () {
    const env = new Float64Array(SEGMENT);
    for (let t = -2; t < FRAMES + 2; t++) {
      const n0 = t * HOP - PAD;
      for (let i = 0; i < NFFT; i++) { const n = n0 + i; if (n >= 0 && n < SEGMENT) env[n] += hann[i] * hann[i]; }
    }
    for (let n = 0; n < SEGMENT; n++) invEnv[n] = env[n] > 1e-11 ? 1 / env[n] : 0;
  })();

  // ---- STFT / iSTFT, exactly what demucs' HTDemucs._spec / _ispec do ----------------------
  function createDsp() {
    const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
    const ar = new Float64Array(FREQS), ai = new Float64Array(FREQS), br = new Float64Array(FREQS), bi = new Float64Array(FREQS);
    const accum = [0, 1, 2, 3].map(function () { return new Float64Array(SEGMENT); });

    // L, R: Float32Array(SEGMENT) -> Float32Array [4][2048][336]: re(L), im(L), re(R), im(R)
    // (demucs: reflect-pad 1536 left and 1536+84 right, torch.stft(4096, hop 1024, hann, normalized,
    // center=True, reflect), drop the Nyquist bin, keep frames 2..337. Those frames lie entirely inside
    // the first padding, so one reflection of the chunk is all it takes.)
    function forward(L, R) {
      const out = new Float32Array(SPEC_SIZE), norm = 1 / Math.sqrt(NFFT), N = SEGMENT;
      for (let t = 0; t < FRAMES; t++) {
        const base = t * HOP - PAD;
        for (let i = 0; i < NFFT; i++) {
          let idx = base + i;
          if (idx < 0) idx = -idx; else if (idx >= N) idx = 2 * (N - 1) - idx;
          const w = hann[i] * norm;
          re[i] = L[idx] * w; im[i] = R[idx] * w;
        }
        fft(re, im, false);
        // two real signals in one complex transform: Z = L + iR
        for (let k = 0; k < FREQS; k++) {
          const nk = (NFFT - k) & (NFFT - 1);
          const o = k * FRAMES + t;
          out[o] = (re[k] + re[nk]) * 0.5;                 // Re L
          out[COMP + o] = (im[k] - im[nk]) * 0.5;          // Im L
          out[2 * COMP + o] = (im[k] + im[nk]) * 0.5;      // Re R
          out[3 * COMP + o] = (re[nk] - re[k]) * 0.5;      // Im R
        }
      }
      return out;
    }

    // Inverse of one pair of stereo signals. `sources` lists which stems of the model's mask output
    // are added together first; the result goes to accum[a] (left) and accum[b] (right), already
    // divided by the window envelope. m: Float32Array [4 stems][4][2048][336].
    function inverse(m, sources, a, b) {
      const ya = accum[a], yb = accum[b], N = SEGMENT, scale = 1 / Math.sqrt(NFFT);   // irfft's 1/n times demucs' sqrt(n)
      ya.fill(0); yb.fill(0);
      for (let t = 0; t < FRAMES; t++) {
        for (let k = 0; k < FREQS; k++) {
          const o = k * FRAMES + t;
          let x0 = 0, x1 = 0, x2 = 0, x3 = 0;
          for (let s = 0; s < sources.length; s++) {
            const p = sources[s] * STEM_PLANE + o;
            x0 += m[p]; x1 += m[p + COMP]; x2 += m[p + 2 * COMP]; x3 += m[p + 3 * COMP];
          }
          ar[k] = x0; ai[k] = x1; br[k] = x2; bi[k] = x3;
        }
        ai[0] = 0; bi[0] = 0;                                // irfft ignores the imaginary part of DC
        // Z = A + iB where A, B are the half spectra of left and right (Hermitian), Nyquist bin = 0
        re[0] = ar[0]; im[0] = br[0];
        re[FREQS] = 0; im[FREQS] = 0;
        for (let k = 1; k < FREQS; k++) {
          re[k] = ar[k] - bi[k]; im[k] = ai[k] + br[k];
          const nk = NFFT - k;
          re[nk] = ar[k] + bi[k]; im[nk] = br[k] - ai[k];
        }
        fft(re, im, true);
        const n0 = t * HOP - PAD, i0 = Math.max(0, -n0), i1 = Math.min(NFFT, N - n0);
        for (let i = i0; i < i1; i++) {
          const w = hann[i] * scale;
          ya[n0 + i] += re[i] * w; yb[n0 + i] += im[i] * w;
        }
      }
      for (let n = 0; n < N; n++) { ya[n] *= invEnv[n]; yb[n] *= invEnv[n]; }
    }
    return { forward: forward, inverse: inverse, accum: accum };
  }

  // triangle blend window of demucs' apply_model (peak 1 in the middle)
  function makeWeights() {
    const w = new Float32Array(SEGMENT), half = Math.floor(SEGMENT / 2) + 1;
    for (let i = 0; i < half; i++) w[i] = i + 1;
    for (let i = half; i < SEGMENT; i++) w[i] = SEGMENT - i;
    const peak = half;
    for (let i = 0; i < SEGMENT; i++) w[i] /= peak;
    return w;
  }

  function abortError() { const e = new Error("Separation was cancelled"); e.name = "AbortError"; return e; }
  function defaultYield() { return new Promise(function (r) { setTimeout(r, 0); }); }

  /* Split `channels` (1 or 2 Float32Arrays of equal length, 44.1 kHz) into vocals and inst.
   *   ort      the onnxruntime module that created `session` (only ort.Tensor is used)
   *   session  an ort InferenceSession of htdemucs.onnx
   *   opts.overlap     0..0.9, default 0.25
   *   opts.onProgress  fn(fraction 0..1), after every chunk
   *   opts.isAborted   fn() -> boolean, polled between chunks; true rejects with an AbortError
   *   opts.yieldFn     fn() -> Promise, awaited between chunks so that messages can be handled
   * The input arrays are only read. Resolves {vocals:[L,R], inst:[L,R]} (new Float32Arrays, stereo,
   * same length as the input). */
  async function separate(ort, session, channels, opts) {
    opts = opts || {};
    if (!channels || !channels.length || channels.length > 2) throw new Error("separate: expected 1 or 2 channels");
    const L = channels[0], R = channels.length > 1 ? channels[1] : channels[0];
    if (!(L instanceof Float32Array) || !(R instanceof Float32Array) || L.length !== R.length) throw new Error("separate: channels must be Float32Arrays of the same length");
    const total = L.length;
    const overlap = Math.min(0.9, Math.max(0, opts.overlap === undefined ? 0.25 : +opts.overlap));
    const stride = Math.max(1, Math.floor((1 - overlap) * SEGMENT));
    const nChunks = total ? Math.ceil(total / stride) : 0;
    const progress = typeof opts.onProgress === "function" ? opts.onProgress : function () {};
    const isAborted = typeof opts.isAborted === "function" ? opts.isAborted : function () { return false; };
    const yieldFn = typeof opts.yieldFn === "function" ? opts.yieldFn : defaultYield;

    const outV = [new Float32Array(total), new Float32Array(total)];
    const outI = [new Float32Array(total), new Float32Array(total)];
    progress(0);
    if (!nChunks) { progress(1); return { vocals: outV, inst: outI }; }

    const dsp = createDsp(), weight = makeWeights();
    const wsum = new Float64Array(SEGMENT);      // blend weights of the samples [offset, offset + SEGMENT)
    const in0 = session.inputNames[0], in1 = session.inputNames[1];

    function prepare(k) {
      const offset = k * stride, len = Math.min(SEGMENT, total - offset);
      const shift = Math.floor((SEGMENT - len) / 2);          // a short last chunk is centred in its window
      const start = offset - shift, s0 = Math.max(0, start), s1 = Math.min(total, start + SEGMENT);
      const mix = new Float32Array(2 * SEGMENT);              // zeros outside the song, the song's own audio as context inside it
      mix.set(L.subarray(s0, s1), s0 - start);
      mix.set(R.subarray(s0, s1), SEGMENT + s0 - start);
      const spec = dsp.forward(mix.subarray(0, SEGMENT), mix.subarray(SEGMENT));
      const feeds = {};
      feeds[in0] = new ort.Tensor("float32", mix, [1, 2, SEGMENT]);
      feeds[in1] = new ort.Tensor("float32", spec, [1, 4, FREQS, FRAMES]);
      return { offset: offset, len: len, shift: shift, feeds: feeds };
    }

    function post(res, p) {
      let mask = null, time = null;
      for (const name in res) { const t = res[name]; if (t.dims.length === 5) mask = t.data; else if (t.dims.length === 4) time = t.data; }
      if (!mask || !time) throw new Error("the model returned unexpected outputs");
      dsp.inverse(mask, [VOCALS], 0, 1);                        // vocals: accum 0 = left, 1 = right
      dsp.inverse(mask, [0, 1, 2], 2, 3);                       // inst = drums + bass + other: accum 2, 3
      const A = dsp.accum, offset = p.offset, len = p.len, shift = p.shift;
      for (let c = 0; c < 2; c++) {
        const yv = A[c], yi = A[2 + c], ov = outV[c], oi = outI[c];
        const tv = (VOCALS * 2 + c) * SEGMENT, t0 = (0 * 2 + c) * SEGMENT, t1 = (1 * 2 + c) * SEGMENT, t2 = (2 * 2 + c) * SEGMENT;
        for (let j = 0; j < len; j++) {
          const n = shift + j, w = weight[j];
          ov[offset + j] += w * (yv[n] + time[tv + n]);
          oi[offset + j] += w * (yi[n] + time[t0 + n] + time[t1 + n] + time[t2 + n]);
        }
      }
      for (let j = 0; j < len; j++) wsum[j] += weight[j];
      // samples before the next chunk's start are complete: normalise them now, then slide the weights
      const done = (p.offset + stride >= total) ? total - offset : Math.min(stride, len);
      for (let j = 0; j < done; j++) {
        const inv = wsum[j] > 0 ? 1 / wsum[j] : 0;
        outV[0][offset + j] *= inv; outV[1][offset + j] *= inv; outI[0][offset + j] *= inv; outI[1][offset + j] *= inv;
      }
      if (stride < SEGMENT) { wsum.copyWithin(0, stride); wsum.fill(0, SEGMENT - stride); } else wsum.fill(0);
    }

    // On a GPU the network runs while JS is free, so the (JS) transforms are overlapped with it: chunk k+1 is started
    // before chunk k is post-processed, and chunk k+2 is prepared while k+1 runs. Between the end of one run and the start of
    // the next there is a trip through the event loop, so that an abort message is seen without waiting for another chunk.
    let pending = null;
    try {
      if (isAborted()) throw abortError();
      let cur = prepare(0), runP = session.run(cur.feeds);
      pending = runP;
      let upcoming = nChunks > 1 ? prepare(1) : null;
      for (let k = 0; k < nChunks; k++) {
        const res = await runP, finished = cur;
        pending = null;
        cur = upcoming;
        if (cur) {
          await yieldFn();
          if (isAborted()) throw abortError();
          runP = session.run(cur.feeds);
          pending = runP;
        }
        post(res, finished);
        progress((k + 1) / nChunks);
        upcoming = k + 2 < nChunks ? prepare(k + 2) : null;
      }
    } catch (e) {
      if (pending && pending.catch) pending.catch(function () {});   // a started run we no longer wait for
      throw e;
    }
    return { vocals: outV, inst: outI };          // the last chunk reported 1
  }

  return {
    SAMPLE_RATE: SAMPLE_RATE, SEGMENT: SEGMENT, FRAMES: FRAMES, FREQS: FREQS, STEMS: STEMS, NFFT: NFFT, HOP: HOP, PAD: PAD,
    separate: separate, createDsp: createDsp, makeWeights: makeWeights,
    chunkCount: function (length, overlap) {
      const o = Math.min(0.9, Math.max(0, overlap === undefined ? 0.25 : +overlap));
      return length ? Math.ceil(length / Math.max(1, Math.floor((1 - o) * SEGMENT))) : 0;
    },
    stride: function (overlap) {
      const o = Math.min(0.9, Math.max(0, overlap === undefined ? 0.25 : +overlap));
      return Math.max(1, Math.floor((1 - o) * SEGMENT));
    }
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SeparatorCore;
