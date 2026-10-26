/* Signal processing for the sampler.
 *
 * Everything in here is pure — Float32Array in, Float32Array out, no
 * AudioContext. That keeps the analysis testable outside a browser, and a
 * phone recording is only a few seconds long, so one synchronous pass is
 * cheaper than the plumbing needed to hand buffers to a worker.
 */

var DSP = (function () {
  "use strict";

  // ---------------------------------------------------------------- windows

  const hannCache = {};

  function hann(n) {
    if (hannCache[n]) return hannCache[n];
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    hannCache[n] = w;
    return w;
  }

  // -------------------------------------------------------------------- FFT

  const fftCache = {};

  function fftTables(n) {
    if (fftCache[n]) return fftCache[n];
    const bits = Math.round(Math.log2(n));
    if (1 << bits !== n) throw new Error("FFT size must be a power of two");
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if ((i >> b) & 1) r |= 1 << (bits - 1 - b);
      rev[i] = r;
    }
    const cos = new Float64Array(n >> 1);
    const sin = new Float64Array(n >> 1);
    for (let i = 0; i < n >> 1; i++) {
      cos[i] = Math.cos((-2 * Math.PI * i) / n);
      sin[i] = Math.sin((-2 * Math.PI * i) / n);
    }
    fftCache[n] = { rev: rev, cos: cos, sin: sin };
    return fftCache[n];
  }

  /* In-place complex FFT. `inverse` conjugates the twiddles and scales by 1/n
   * so that fft(fft(x), inverse) round-trips. */
  function fft(re, im, inverse) {
    const n = re.length;
    const t = fftTables(n);
    for (let i = 0; i < n; i++) {
      const j = t.rev[i];
      if (j > i) {
        let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
        tmp = im[i]; im[i] = im[j]; im[j] = tmp;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let base = 0; base < n; base += size) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const wr = t.cos[k];
          const wi = inverse ? -t.sin[k] : t.sin[k];
          const a = base + j;
          const b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
  }

  // ------------------------------------------------------------ basic level

  function peak(x) {
    let p = 0;
    for (let i = 0; i < x.length; i++) {
      const v = x[i] < 0 ? -x[i] : x[i];
      if (v > p) p = v;
    }
    return p;
  }

  function rms(x, from, to) {
    from = from || 0;
    to = to === undefined ? x.length : to;
    let sum = 0;
    for (let i = from; i < to; i++) sum += x[i] * x[i];
    const n = Math.max(1, to - from);
    return Math.sqrt(sum / n);
  }

  /* Short-time RMS, one value per `hop` samples. Used for trimming and for
   * describing the shape of a hit. */
  function envelope(x, hop) {
    const n = Math.max(1, Math.ceil(x.length / hop));
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const from = i * hop;
      env[i] = rms(x, from, Math.min(x.length, from + hop));
    }
    return env;
  }

  /* Per-sample amplitude envelope. Fast attack, slow release, so it traces the
   * shape of a sound rather than its individual cycles — which is what makes it
   * possible to take that shape off a recording and put another one on. */
  function follow(x, sr, attackMs, releaseMs) {
    const atk = Math.exp(-1 / ((sr * attackMs) / 1000));
    const rel = Math.exp(-1 / ((sr * releaseMs) / 1000));
    const out = new Float32Array(x.length);
    let env = 0;
    for (let i = 0; i < x.length; i++) {
      const a = x[i] < 0 ? -x[i] : x[i];
      const coeff = a > env ? atk : rel;
      env = coeff * env + (1 - coeff) * a;
      out[i] = env;
    }
    return out;
  }

  function removeDC(x) {
    let mean = 0;
    for (let i = 0; i < x.length; i++) mean += x[i];
    mean /= Math.max(1, x.length);
    if (Math.abs(mean) < 1e-6) return x;
    for (let i = 0; i < x.length; i++) x[i] -= mean;
    return x;
  }

  function normalize(x, ceiling) {
    ceiling = ceiling === undefined ? 0.89 : ceiling;
    const p = peak(x);
    if (p < 1e-6) return x;
    const g = ceiling / p;
    for (let i = 0; i < x.length; i++) x[i] *= g;
    return x;
  }

  /* tanh-ish saturation. `drive` of 1 is barely audible, 6 is obvious. */
  function saturate(x, drive) {
    if (drive <= 0) return x;
    const k = 1 + drive;
    const comp = Math.tanh(k) || 1;
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) / comp;
    return x;
  }

  function fadeEdges(x, sr, inMs, outMs) {
    const nIn = Math.min(x.length >> 1, Math.round((inMs / 1000) * sr));
    const nOut = Math.min(x.length >> 1, Math.round((outMs / 1000) * sr));
    for (let i = 0; i < nIn; i++) x[i] *= i / nIn;
    for (let i = 0; i < nOut; i++) x[x.length - 1 - i] *= i / nOut;
    return x;
  }

  function reverse(x) {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = x[x.length - 1 - i];
    return out;
  }

  function percentile(values, p) {
    const copy = Float32Array.from(values);
    copy.sort();
    const idx = Math.min(copy.length - 1, Math.max(0, Math.round(p * (copy.length - 1))));
    return copy[idx];
  }

  /* Finish an overlap-add pass.
   *
   * Hann-squared frames at a quarter-frame hop sum to 1.5 in the body of the
   * buffer, so dividing by that sum restores unity gain. The first and last
   * half-frame are only covered by one window, where the sum tapers to zero —
   * dividing there amplifies by 1/w and produces a huge spike at the edges, so
   * the divisor is floored and those edges are left as a short natural fade.
   */
  function olaNormalize(out, wsum, length) {
    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = out[i] / Math.max(0.5, wsum[i]);
    }
    return result;
  }

  // ------------------------------------------------------------------ trim

  /* Where the sound actually starts and stops. The threshold is relative to
   * both the peak and the room noise, because a finger-snap recorded in a
   * quiet room and a hum recorded next to a fan need different cutoffs. */
  function trimBounds(x, sr) {
    const hop = 128;
    const env = envelope(x, hop);
    if (env.length < 4) return { start: 0, end: x.length };
    const top = peak(env);
    const floorLevel = percentile(env, 0.1);
    const thr = Math.max(top * 0.035, floorLevel * 3.5, 2e-4);

    let first = -1;
    let last = -1;
    for (let i = 0; i < env.length; i++) {
      if (env[i] > thr) { if (first < 0) first = i; last = i; }
    }
    if (first < 0) return { start: 0, end: x.length };

    // A couple of hops of pre-roll so the attack transient survives, and a
    // longer tail so a decay is not cut off mid-ring.
    const start = Math.max(0, (first - 2) * hop);
    const end = Math.min(x.length, (last + 4) * hop);
    if (end - start < Math.round(sr * 0.02)) return { start: 0, end: x.length };
    return { start: start, end: end };
  }

  function trim(x, sr) {
    const b = trimBounds(x, sr);
    return x.slice(b.start, b.end);
  }

  // -------------------------------------------------------------- denoising

  /* Spectral-subtraction noise gate.
   *
   * The noise profile is averaged from the quietest frames in the recording
   * rather than "the first 200 ms", because people start talking or tapping
   * the moment they hit record.
   *
   * The catch is that a sustained hum or a held note has no quiet frames, so
   * the profile would be the sound itself and subtraction would erase it. The
   * gap between the quietest frames and the typical frame says which case this
   * is: a room-tone floor sits far below the median, a held note sits right on
   * it. That gap scales the subtraction, so a recording with nothing to strip
   * comes back untouched instead of hollowed out.
   */
  function denoise(x, strength) {
    const N = 1024;
    const hop = N >> 2;
    if (x.length < N * 3) return Float32Array.from(x);
    strength = strength === undefined ? 1 : strength;

    const w = hann(N);
    const bins = (N >> 1) + 1;
    const frames = Math.floor((x.length - N) / hop) + 1;
    const spec = new Float32Array(frames * N * 2); // interleaved re/im per frame
    const mag = new Float32Array(frames * bins);

    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let f = 0; f < frames; f++) {
      const off = f * hop;
      for (let i = 0; i < N; i++) { re[i] = x[off + i] * w[i]; im[i] = 0; }
      fft(re, im, false);
      const sOff = f * N * 2;
      for (let i = 0; i < N; i++) {
        spec[sOff + i * 2] = re[i];
        spec[sOff + i * 2 + 1] = im[i];
      }
      for (let k = 0; k < bins; k++) {
        mag[f * bins + k] = Math.hypot(re[k], im[k]);
      }
    }

    // Frame energies, so the quietest frames can be pooled into a profile.
    const energy = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let sum = 0;
      for (let k = 0; k < bins; k++) {
        const m = mag[f * bins + k];
        sum += m * m;
      }
      energy[f] = sum;
    }

    const quietCut = percentile(energy, 0.12);
    const noise = new Float32Array(bins);
    let quietFrames = 0;
    let quietEnergy = 0;
    for (let f = 0; f < frames; f++) {
      if (energy[f] > quietCut) continue;
      for (let k = 0; k < bins; k++) noise[k] += mag[f * bins + k];
      quietEnergy += energy[f];
      quietFrames++;
    }
    if (!quietFrames) return Float32Array.from(x);
    for (let k = 0; k < bins; k++) noise[k] /= quietFrames;
    quietEnergy /= quietFrames;

    // How far the floor sits below the loud part of the recording, in dB.
    // Comparing against the loud frames rather than the median matters: a
    // one-shot can occupy well under half the clip, which would make the
    // median itself silence and hide the gap entirely. Under ~8 dB there is no
    // separable background and the pass backs off to nothing.
    const loud = Math.max(percentile(energy, 0.9), 1e-12);
    const headroom = 10 * Math.log10(loud / Math.max(quietEnergy, 1e-12));
    const confidence = Math.max(0, Math.min(1, (headroom - 8) / 14));
    if (confidence <= 0) return Float32Array.from(x);

    const beta = 1.4 * strength * confidence;
    const floorGain = Math.max(0.02, 0.1 / Math.max(0.25, strength * confidence));
    const gains = new Float32Array(bins);
    const prev = new Float32Array(bins).fill(1);
    const out = new Float32Array(x.length);
    const wsum = new Float32Array(x.length);

    for (let f = 0; f < frames; f++) {
      for (let k = 0; k < bins; k++) {
        const m = mag[f * bins + k];
        let g = m > 1e-9 ? (m - beta * noise[k]) / m : 0;
        if (g < floorGain) g = floorGain;
        if (g > 1) g = 1;
        gains[k] = g;
      }
      // Smooth across frequency (a jagged mask sounds like tinkling glass)
      // and across time (so the gate opens and closes gently).
      for (let k = 1; k < bins - 1; k++) {
        gains[k] = 0.25 * gains[k - 1] + 0.5 * gains[k] + 0.25 * gains[k + 1];
      }
      for (let k = 0; k < bins; k++) {
        const smooth = gains[k] > prev[k] ? 0.5 : 0.75; // open fast, close slow
        gains[k] = prev[k] * smooth + gains[k] * (1 - smooth);
        prev[k] = gains[k];
      }

      const sOff = f * N * 2;
      for (let k = 0; k < bins; k++) {
        const g = gains[k];
        re[k] = spec[sOff + k * 2] * g;
        im[k] = spec[sOff + k * 2 + 1] * g;
        if (k > 0 && k < N >> 1) { // mirror for a real-valued result
          re[N - k] = re[k];
          im[N - k] = -im[k];
        }
      }
      fft(re, im, true);

      const off = f * hop;
      for (let i = 0; i < N; i++) {
        out[off + i] += re[i] * w[i];
        wsum[off + i] += w[i] * w[i];
      }
    }

    return olaNormalize(out, wsum, x.length);
  }

  // --------------------------------------------------------- pitch tracking

  /* YIN. Returns the fundamental in Hz plus a 0..1 confidence, which is what
   * decides whether a sound gets tuned (a hum) or left alone (a snare). */
  function pitchAt(x, sr, offset, W, fmin, fmax) {
    const N = W >> 1;
    const tauMin = Math.max(2, Math.floor(sr / fmax));
    const tauMax = Math.min(N - 1, Math.floor(sr / fmin));
    if (tauMax <= tauMin || offset + W > x.length) return null;

    const d = new Float64Array(tauMax + 1);
    for (let tau = tauMin; tau <= tauMax; tau++) {
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const diff = x[offset + i] - x[offset + i + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }

    // Cumulative mean normalised difference.
    const dp = new Float64Array(tauMax + 1);
    let running = 0;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      running += d[tau];
      dp[tau] = (d[tau] * (tau - tauMin + 1)) / (running || 1e-12);
    }

    let best = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (dp[tau] < 0.14) {
        while (tau + 1 <= tauMax && dp[tau + 1] < dp[tau]) tau++;
        best = tau;
        break;
      }
    }
    if (best < 0) {
      let min = Infinity;
      for (let tau = tauMin; tau <= tauMax; tau++) {
        if (dp[tau] < min) { min = dp[tau]; best = tau; }
      }
    }
    if (best <= tauMin || best >= tauMax) return null;

    // Parabolic interpolation for sub-sample period accuracy.
    const y0 = dp[best - 1];
    const y1 = dp[best];
    const y2 = dp[best + 1];
    const denom = 2 * (2 * y1 - y0 - y2);
    const shift = denom !== 0 ? (y2 - y0) / denom : 0;
    const period = best + Math.max(-1, Math.min(1, shift));
    return { freq: sr / period, confidence: Math.max(0, Math.min(1, 1 - y1)) };
  }

  /* Median of several windows taken from the loudest part of the sound, so a
   * breath at the start or a room tail at the end cannot drag the estimate. */
  function detectPitch(x, sr, fmin, fmax) {
    fmin = fmin || 45;
    fmax = fmax || 1600;
    const W = 4096;
    if (x.length < W + 64) {
      const single = pitchAt(x, sr, 0, Math.max(512, (x.length - 8) & ~1), fmin, fmax);
      return single || { freq: 0, confidence: 0 };
    }

    const hop = 512;
    const env = envelope(x, hop);
    let loudest = 0;
    for (let i = 0; i < env.length; i++) if (env[i] > env[loudest]) loudest = i;

    const results = [];
    for (let k = -1; k <= 2; k++) {
      const off = Math.max(0, Math.min(x.length - W, (loudest + k * 2) * hop));
      const r = pitchAt(x, sr, off, W, fmin, fmax);
      if (r && r.confidence > 0.2) results.push(r);
    }
    if (!results.length) return { freq: 0, confidence: 0 };

    results.sort(function (a, b) { return a.freq - b.freq; });
    const mid = results[results.length >> 1];
    let conf = 0;
    for (let i = 0; i < results.length; i++) conf += results[i].confidence;
    return { freq: mid.freq, confidence: conf / results.length };
  }

  // ------------------------------------------------ resampling and stretch

  /* Catmull-Rom resample. `ratio` above 1 makes the sound shorter and higher,
   * exactly like speeding up a record. */
  function resample(x, ratio) {
    if (Math.abs(ratio - 1) < 1e-4) return Float32Array.from(x);
    const outLen = Math.max(1, Math.round(x.length / ratio));
    return resampleTo(x, outLen);
  }

  function resampleTo(x, outLen) {
    const out = new Float32Array(outLen);
    const scale = (x.length - 1) / Math.max(1, outLen - 1);
    for (let i = 0; i < outLen; i++) {
      const pos = i * scale;
      const i1 = Math.floor(pos);
      const t = pos - i1;
      const p0 = x[Math.max(0, i1 - 1)];
      const p1 = x[Math.min(x.length - 1, i1)];
      const p2 = x[Math.min(x.length - 1, i1 + 1)];
      const p3 = x[Math.min(x.length - 1, i1 + 2)];
      out[i] = p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
    }
    return out;
  }

  /* WSOLA time stretch: change the length, keep the pitch.
   *
   * `factor` is the output-to-input length ratio. Each output frame is copied
   * from wherever in a search window the waveform best continues what was
   * already written, which is what stops the overlap-add from phasing.
   *
   * The window is centred on the ideal analysis position, which advances by a
   * fixed hop and never depends on where the last match landed. Anchoring on
   * the previous match instead lets the pointer drift: at large factors the
   * best match is consistently a full synthesis hop ahead, the pointer stops
   * making progress, runs off the end of the input, and the tail gets repeated
   * at a hop that phase-locks the output to a wrong pitch.
   */
  function timeStretch(x, factor) {
    const frame = 1024;
    const Hs = frame >> 2;
    if (!isFinite(factor) || factor <= 0) return Float32Array.from(x);
    if (Math.abs(factor - 1) < 0.004 || x.length < frame * 3) {
      return Float32Array.from(x);
    }

    const w = hann(frame);
    const Ha = Math.max(1, Math.round(Hs / factor));
    // Wide enough to contain a full cycle of anything down to ~90 Hz, so a
    // phase-aligned candidate is actually inside the window.
    const delta = 256;
    const corrLen = 512;
    const outLen = Math.max(frame, Math.round(x.length * factor));
    const out = new Float32Array(outLen + frame);
    const wsum = new Float32Array(outLen + frame);
    const ref = new Float32Array(corrLen);
    const maxPos = x.length - frame;

    let ideal = 0;
    let first = true;
    for (let s = 0; s < outLen; s += Hs) {
      let p = Math.max(0, Math.min(maxPos, Math.round(ideal)));
      if (!first) {
        let bestScore = -Infinity;
        for (let d = -delta; d <= delta; d++) {
          const cand = Math.round(ideal) + d;
          if (cand < 0 || cand > maxPos) continue;
          let dot = 0;
          let energy = 1e-9;
          for (let i = 0; i < corrLen; i += 2) {
            const v = x[cand + i];
            dot += ref[i] * v;
            energy += v * v;
          }
          const score = dot / Math.sqrt(energy);
          if (score > bestScore) { bestScore = score; p = cand; }
        }
      }

      for (let i = 0; i < frame; i++) {
        out[s + i] += x[p + i] * w[i];
        wsum[s + i] += w[i] * w[i];
      }
      for (let i = 0; i < corrLen; i++) {
        const src = p + Hs + i;
        ref[i] = src < x.length ? x[src] : 0;
      }
      ideal += Ha;
      first = false;
    }

    return olaNormalize(out, wsum, outLen);
  }

  /* Resample to change pitch, then stretch back to the original length. */
  function pitchShift(x, semitones) {
    if (Math.abs(semitones) < 0.01) return Float32Array.from(x);
    const ratio = Math.pow(2, semitones / 12);
    const shifted = resample(x, ratio);
    const stretched = timeStretch(shifted, x.length / shifted.length);
    // WSOLA lands within a frame of the target; force an exact match so pads
    // stay locked to the grid.
    if (stretched.length === x.length) return stretched;
    const out = new Float32Array(x.length);
    out.set(stretched.subarray(0, Math.min(x.length, stretched.length)));
    return out;
  }

  function fitToLength(x, outLen) {
    if (outLen === x.length) return Float32Array.from(x);
    const stretched = timeStretch(x, outLen / x.length);
    if (stretched.length === outLen) return stretched;
    const out = new Float32Array(outLen);
    out.set(stretched.subarray(0, Math.min(outLen, stretched.length)));
    return out;
  }

  // ----------------------------------------------------------------- tone

  /* RBJ cookbook biquad, applied in place.
   *
   * Written out here rather than leaning on BiquadFilterNode so the whole
   * polish chain stays synchronous and pure: no OfflineAudioContext to await,
   * and the same code runs under a test runner.
   */
  function biquad(x, sr, type, freq, Q, gainDb) {
    Q = Q || 0.707;
    gainDb = gainDb || 0;
    const A = Math.pow(10, gainDb / 40);
    const w0 = (2 * Math.PI * Math.min(freq, sr * 0.49)) / sr;
    const cos = Math.cos(w0);
    const sin = Math.sin(w0);
    const alpha = sin / (2 * Q);
    let b0, b1, b2, a0, a1, a2;

    if (type === "lowpass") {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (type === "highpass") {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (type === "peaking") {
      b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
    } else if (type === "highshelf") {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cos + s);
      b1 = -2 * A * ((A - 1) + (A + 1) * cos);
      b2 = A * ((A + 1) + (A - 1) * cos - s);
      a0 = (A + 1) - (A - 1) * cos + s;
      a1 = 2 * ((A - 1) - (A + 1) * cos);
      a2 = (A + 1) - (A - 1) * cos - s;
    } else if (type === "lowshelf") {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cos + s);
      b1 = 2 * A * ((A - 1) - (A + 1) * cos);
      b2 = A * ((A + 1) - (A - 1) * cos - s);
      a0 = (A + 1) + (A - 1) * cos + s;
      a1 = -2 * ((A - 1) + (A + 1) * cos);
      a2 = (A + 1) + (A - 1) * cos - s;
    } else {
      return x;
    }

    const c0 = b0 / a0;
    const c1 = b1 / a0;
    const c2 = b2 / a0;
    const d1 = a1 / a0;
    const d2 = a2 / a0;

    // Prime the history with the first sample so the filter does not start
    // from silence and stamp a click on the attack.
    let x1 = x[0];
    let x2 = x[0];
    let y1 = x[0] * (c0 + c1 + c2) / (1 + d1 + d2);
    let y2 = y1;
    if (!isFinite(y1)) { y1 = 0; y2 = 0; }

    for (let i = 0; i < x.length; i++) {
      const xn = x[i];
      const yn = c0 * xn + c1 * x1 + c2 * x2 - d1 * y1 - d2 * y2;
      x2 = x1; x1 = xn;
      y2 = y1; y1 = yn;
      x[i] = yn;
    }
    return x;
  }

  /* Feed-forward compressor with a peak detector, in place. Levels out a
   * recording made by waving a phone around. */
  function compress(x, sr, thresholdDb, ratio, attackMs, releaseMs, makeupDb) {
    const atk = Math.exp(-1 / ((sr * attackMs) / 1000));
    const rel = Math.exp(-1 / ((sr * releaseMs) / 1000));
    const makeup = Math.pow(10, (makeupDb || 0) / 20);
    const slope = 1 - 1 / ratio;
    let env = 0;
    for (let i = 0; i < x.length; i++) {
      const a = x[i] < 0 ? -x[i] : x[i];
      const coeff = a > env ? atk : rel;
      env = coeff * env + (1 - coeff) * a;
      const over = 20 * Math.log10(env + 1e-9) - thresholdDb;
      const reduction = over > 0 ? over * slope : 0;
      x[i] *= makeup * Math.pow(10, -reduction / 20);
    }
    return x;
  }

  // ------------------------------------------------------------- describing

  /* A compact description of what a sound is, used to decide its role in the
   * kit and how it should be processed. */
  function features(x, sr) {
    const N = 2048;
    const duration = x.length / sr;
    const p = peak(x);
    const level = rms(x);

    // Analyse the loudest frame rather than the average of the whole clip:
    // silence and tails wash out the spectrum of a short hit.
    const hop = 512;
    const env = envelope(x, hop);
    let loudest = 0;
    for (let i = 0; i < env.length; i++) if (env[i] > env[loudest]) loudest = i;
    const start = Math.max(0, Math.min(Math.max(0, x.length - N), loudest * hop));

    const re = new Float64Array(N);
    const im = new Float64Array(N);
    const w = hann(N);
    for (let i = 0; i < N; i++) {
      re[i] = (start + i < x.length ? x[start + i] : 0) * w[i];
      im[i] = 0;
    }
    fft(re, im, false);

    const bins = N >> 1;
    let magSum = 0;
    let weighted = 0;
    let logSum = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let k = 1; k < bins; k++) {
      const f = (k * sr) / N;
      const m = Math.hypot(re[k], im[k]);
      magSum += m;
      weighted += m * f;
      logSum += Math.log(m + 1e-9);
      if (f < 200) low += m;
      else if (f < 2200) mid += m;
      else high += m;
    }
    const centroid = magSum > 1e-9 ? weighted / magSum : 0;
    const arithmetic = magSum / (bins - 1);
    const geometric = Math.exp(logSum / (bins - 1));
    const flatness = arithmetic > 1e-9 ? geometric / arithmetic : 0;

    let crossings = 0;
    for (let i = 1; i < x.length; i++) {
      if ((x[i - 1] < 0 && x[i] >= 0) || (x[i - 1] >= 0 && x[i] < 0)) crossings++;
    }

    // How long the loudest moment takes to fall 20 dB — separates a clipped
    // snare from a sustained note.
    const peakIdx = loudest;
    const target = env[peakIdx] * 0.1;
    let decayHops = env.length - peakIdx;
    for (let i = peakIdx; i < env.length; i++) {
      if (env[i] < target) { decayHops = i - peakIdx; break; }
    }

    const pitch = detectPitch(x, sr);
    const total = low + mid + high + 1e-9;
    return {
      duration: duration,
      peak: p,
      rms: level,
      centroid: centroid,
      flatness: flatness,
      zcr: crossings / Math.max(1, x.length / sr) / 2,
      low: low / total,
      mid: mid / total,
      high: high / total,
      decay: (decayHops * hop) / sr,
      pitch: pitch.freq,
      pitchConfidence: pitch.confidence,
    };
  }

  // ------------------------------------------------------------------- wav

  /* 16-bit PCM WAV. Used both for the bounce and for storing pads in
   * IndexedDB, where a Blob is far kinder than a JSON array of floats. */
  function encodeWav(channels, sr) {
    const chans = channels.length;
    const frames = channels[0].length;
    const bytes = frames * chans * 2;
    const buffer = new ArrayBuffer(44 + bytes);
    const view = new DataView(buffer);

    function ascii(offset, text) {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    }

    ascii(0, "RIFF");
    view.setUint32(4, 36 + bytes, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, chans, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * chans * 2, true);
    view.setUint16(32, chans * 2, true);
    view.setUint16(34, 16, true);
    ascii(36, "data");
    view.setUint32(40, bytes, true);

    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < chans; c++) {
        let v = channels[c][i];
        if (v > 1) v = 1;
        if (v < -1) v = -1;
        view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        offset += 2;
      }
    }
    return buffer;
  }

  return {
    hann: hann,
    fft: fft,
    peak: peak,
    rms: rms,
    envelope: envelope,
    follow: follow,
    percentile: percentile,
    removeDC: removeDC,
    normalize: normalize,
    saturate: saturate,
    fadeEdges: fadeEdges,
    reverse: reverse,
    biquad: biquad,
    compress: compress,
    trimBounds: trimBounds,
    trim: trim,
    denoise: denoise,
    detectPitch: detectPitch,
    resample: resample,
    resampleTo: resampleTo,
    timeStretch: timeStretch,
    pitchShift: pitchShift,
    fitToLength: fitToLength,
    features: features,
    encodeWav: encodeWav,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = DSP;
