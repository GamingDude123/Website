/* Listening to a track: tempo, beat grid, downbeat, key and song structure.
 *
 * Pure functions — Float32Array in, plain objects out, no AudioContext — so the
 * whole thing can be tested in node against signals whose answers are known.
 *
 * Nothing here is a neural network. It is the usual dance-music toolkit:
 * band-split onset strength, autocorrelation plus a comb filter for tempo and
 * phase, a chromagram against Krumhansl's key profiles, and per-bar loudness
 * and kick presence to find where the drops and breakdowns are.
 */

var Analysis = (function () {
  "use strict";

  const HOP = 32;               // onset-envelope hop, in decimated samples (~2.9 ms)
  const BPM_MIN = 80;
  const BPM_MAX = 180;

  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  // ------------------------------------------------------------------ utils

  function toMono(channels) {
    if (channels.length === 1) return channels[0];
    const n = channels[0].length;
    const out = new Float32Array(n);
    const k = 1 / channels.length;
    for (let c = 0; c < channels.length; c++) {
      const ch = channels[c];
      for (let i = 0; i < n; i++) out[i] += ch[i] * k;
    }
    return out;
  }

  // Box-filter decimation to roughly 11 kHz. The analysis never looks above
  // 5 kHz, so the aliasing a box filter lets through does not matter.
  function decimate(x, sr) {
    const f = Math.max(1, Math.round(sr / 11025));
    const n = Math.floor(x.length / f);
    const y = new Float32Array(n);
    for (let i = 0, p = 0; i < n; i++, p += f) {
      let s = 0;
      for (let j = 0; j < f; j++) s += x[p + j];
      y[i] = s / f;
    }
    return { data: y, sr: sr / f };
  }

  function percentile(arr, p) {
    const a = Array.from(arr).sort(function (u, v) { return u - v; });
    if (!a.length) return 0;
    return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
  }

  function mean(arr, from, to) {
    let s = 0;
    from = Math.max(0, from); to = Math.min(arr.length, to);
    for (let i = from; i < to; i++) s += arr[i];
    return to > from ? s / (to - from) : 0;
  }

  // --------------------------------------------------------------------- FFT

  const twiddles = {};
  function fft(re, im) {
    const n = re.length;
    if (!twiddles[n]) {
      const c = new Float64Array(n / 2), s = new Float64Array(n / 2);
      for (let i = 0; i < n / 2; i++) { c[i] = Math.cos(-2 * Math.PI * i / n); s[i] = Math.sin(-2 * Math.PI * i / n); }
      twiddles[n] = { c: c, s: s };
    }
    const tw = twiddles[n];
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = tw.c[k], wi = tw.s[k];
          const a = i + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  }

  // -------------------------------------------------- bands and onset strength

  // Mean-square power per hop in three bands: kick/bass, body, air. One-pole
  // filters are crude, but the bands only need to separate "thump" from
  // "tss", not be accurate.
  function bandPowers(x, sr) {
    const n = Math.floor(x.length / HOP);
    const low = new Float32Array(n), mid = new Float32Array(n), high = new Float32Array(n);
    const a1 = 1 - Math.exp(-2 * Math.PI * 150 / sr);
    const a2 = 1 - Math.exp(-2 * Math.PI * 2000 / sr);
    let l1 = 0, l1b = 0, m1 = 0, m1b = 0;
    for (let f = 0; f < n; f++) {
      let sl = 0, sm = 0, sh = 0;
      const base = f * HOP;
      for (let i = 0; i < HOP; i++) {
        const s = x[base + i];
        l1 += a1 * (s - l1); l1b += a1 * (l1 - l1b);
        m1 += a2 * (s - m1); m1b += a2 * (m1 - m1b);
        const lo = l1b, md = m1b - l1b, hi = s - m1b;
        sl += lo * lo; sm += md * md; sh += hi * hi;
      }
      low[f] = sl / HOP; mid[f] = sm / HOP; high[f] = sh / HOP;
    }
    return { low: low, mid: mid, high: high, n: n };
  }

  function flux(power) {
    const n = power.length;
    const out = new Float32Array(n);
    let prev = Math.sqrt(power[0]);
    for (let i = 1; i < n; i++) {
      const e = Math.sqrt(power[i]);
      const d = e - prev;
      out[i] = d > 0 ? d : 0;
      prev = e;
    }
    return out;
  }

  function normalise(arr) {
    const m = mean(arr, 0, arr.length) || 1e-9;
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = arr[i] / m;
    return out;
  }

  // ------------------------------------------------------------------- tempo

  function interp(arr, p) {
    if (p < 0 || p >= arr.length - 1) return 0;
    const i = p | 0, f = p - i;
    return arr[i] * (1 - f) + arr[i + 1] * f;
  }

  function combScore(env, period, phase) {
    let s = 0, n = 0;
    for (let p = phase; p < env.length - 1; p += period) {
      const i = p | 0, f = p - i;
      s += env[i] * (1 - f) + env[i + 1] * f;
      n++;
    }
    return n ? s / n : 0;
  }

  async function estimateTempo(onset, fps) {
    const n = onset.length;
    // Remove the slow trend so loud sections do not dominate the correlation.
    const win = Math.round(fps * 1.5);
    const flat = new Float32Array(n);
    let run = 0;
    for (let i = 0; i < n; i++) {
      run += onset[i];
      if (i >= win) run -= onset[i - win];
      const m = run / Math.min(i + 1, win);
      const v = onset[i] - m;
      flat[i] = v > 0 ? v : 0;
    }

    const lagMin = Math.floor(fps * 60 / BPM_MAX) - 2;
    const lagMax = Math.ceil(fps * 60 / BPM_MIN * 2) + 2;
    const ac = new Float32Array(lagMax + 2);
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let s = 0;
      for (let t = 0; t + lag < n; t++) s += flat[t] * flat[t + lag];
      ac[lag] = s / Math.max(1, n - lag);
      if (lag % 64 === 0) await tick();
    }

    let best = 0, bestScore = -1;
    for (let b = BPM_MIN; b <= BPM_MAX; b += 0.25) {
      const L = fps * 60 / b;
      const prior = Math.exp(-0.5 * Math.pow(Math.log(b / 125) / Math.log(1.28), 2));
      const s = (interp(ac, L) + interp(ac, 2 * L)) * prior;
      if (s > bestScore) { bestScore = s; best = b; }
    }
    return { bpm: best, flat: flat };
  }

  // Search tempo and beat phase on the comb-filter score. Returns the phase in
  // envelope frames (float) of the first beat inside the first period.
  function refineGrid(env, fps, bpm, span, bpmStep, phaseStep) {
    let best = { score: -1, bpm: bpm, phase: 0 };
    for (let b = bpm - span; b <= bpm + span + 1e-9; b += bpmStep) {
      const period = fps * 60 / b;
      for (let ph = 0; ph < period; ph += phaseStep) {
        const s = combScore(env, period, ph);
        if (s > best.score) best = { score: s, bpm: b, phase: ph };
      }
    }
    return best;
  }

  function smooth3(a) {
    const out = new Float32Array(a.length);
    for (let i = 1; i < a.length - 1; i++) out[i] = 0.25 * a[i - 1] + 0.5 * a[i] + 0.25 * a[i + 1];
    return out;
  }

  async function findGrid(onset, fps) {
    const t = await estimateTempo(onset, fps);
    const env = smooth3(t.flat);
    await tick();
    const coarse = refineGrid(env, fps, t.bpm, 0.8, 0.04, 1);
    await tick();
    const fine = refineGrid(env, fps, coarse.bpm, 0.05, 0.005, 0.15);
    let bpm = fine.bpm, phase = fine.phase;
    // Tracks made in a DAW sit on round tempos; a hundredth of a BPM of error
    // is 80 ms of drift over a six minute track, so snap when it is close.
    const snapped = Math.round(bpm * 2) / 2;
    if (Math.abs(snapped - bpm) < 0.03) {
      const r = refineGrid(env, fps, snapped, 0, 1, 0.1);
      bpm = snapped; phase = r.phase;
    }
    // Fold the phase back to the start of the track so beat 0 is the first
    // beat that actually exists.
    const period = fps * 60 / bpm;
    while (phase >= period) phase -= period;
    return { bpm: bpm, phaseFrames: phase, env: env };
  }

  // --------------------------------------------------------------- downbeat

  function pickDownbeat(feat, grid, fps, power) {
    const beatFrames = fps * 60 / grid.bpm;
    const nBeats = Math.floor((feat.n - grid.phaseFrames) / beatFrames);
    const near = Math.max(2, Math.round(fps * 0.012));
    function peakNear(arr, p) {
      let m = 0;
      for (let i = Math.round(p) - near; i <= Math.round(p) + near; i++) if (i >= 0 && i < arr.length && arr[i] > m) m = arr[i];
      return m;
    }
    const clapScore = [0, 0, 0, 0], novScore = [0, 0, 0, 0];
    const midBeat = new Float64Array(nBeats), lowLevel = new Float64Array(nBeats), allLevel = new Float64Array(nBeats);
    for (let k = 0; k < nBeats; k++) {
      const p = grid.phaseFrames + k * beatFrames;
      midBeat[k] = peakNear(feat.fluxMid, p) + 0.5 * peakNear(feat.fluxHigh, p);
      const a = Math.round(p), b = Math.round(p + beatFrames);
      lowLevel[k] = Math.sqrt(mean(power.low, a, b));
      allLevel[k] = Math.sqrt(mean(power.low, a, b) + mean(power.mid, a, b) + mean(power.high, a, b));
    }
    // Snares and claps land on beats 2 and 4, so the beat *before* them is the
    // downbeat. Comparing against the beats they should not land on keeps this
    // from just rewarding the loudest phase.
    for (let m = 0; m < 4; m++) {
      let s = 0;
      for (let k = 0; k < nBeats; k++) {
        const slot = ((k - m) % 4 + 4) % 4;
        s += (slot === 1 || slot === 3) ? midBeat[k] : -midBeat[k];
      }
      clapScore[m] = s;
    }
    // Sections change on bar lines: the beat where the music differs most from
    // the beats just before it is very likely a downbeat. Short windows keep
    // the peak sharp enough to tell a bar line from the beat after it.
    for (const W of [2, 4]) {
      for (let k = W; k + W <= nBeats; k++) {
        let before = 0, after = 0, lb = 0, la = 0;
        for (let j = 1; j <= W; j++) { before += allLevel[k - j]; after += allLevel[k + j - 1]; lb += lowLevel[k - j]; la += lowLevel[k + j - 1]; }
        const lvl = (before + after) / (2 * W) + 1e-9;
        const change = (Math.abs(after - before) + Math.abs(la - lb)) / (W * lvl);
        novScore[k % 4] += change * change;
      }
    }
    function z(a) {
      const m = a.reduce(function (u, v) { return u + v; }, 0) / 4;
      const sd = Math.sqrt(a.reduce(function (u, v) { return u + (v - m) * (v - m); }, 0) / 4) || 1;
      return a.map(function (v) { return (v - m) / sd; });
    }
    const zc = z(clapScore), zn = z(novScore);
    let best = 0, bestV = -Infinity;
    for (let m = 0; m < 4; m++) {
      const v = zc[m] + 1.5 * zn[m];
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  }

  // ---------------------------------------------------------------------- key

  // Key profiles, tonic first. These are Albrecht & Shanahan's (2013): fitted
  // to a larger corpus than Krumhansl's, and far more decisive about the third,
  // which is what tells a minor key from its relative major in sparse dance
  // music where the harmony is a bassline and a stab.
  const MAJOR = [0.238, 0.006, 0.111, 0.006, 0.137, 0.094, 0.016, 0.214, 0.009, 0.080, 0.008, 0.034];
  const MINOR = [0.220, 0.006, 0.104, 0.123, 0.019, 0.103, 0.012, 0.214, 0.062, 0.022, 0.061, 0.052];
  const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

  function camelot(pc, mode) {
    const major = mode === "major" ? pc : (pc + 3) % 12;
    const num = ((major * 7) % 12 + 7) % 12 + 1;
    return num + (mode === "major" ? "B" : "A");
  }

  function correlate(a, b) {
    const n = a.length;
    let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    return num / (Math.sqrt(da * db) || 1);
  }

  // Keep only the second half of every beat. A kick repeats on the beat, so it
  // makes stable spectral lines in the chromagram that look exactly like
  // notes; the gaps between kicks are where the bassline, stabs and pads
  // are audible on their own.
  function gateKicks(x, sr, firstBeat, beatLen) {
    const out = [];
    const fade = Math.round(0.004 * sr);
    const total = Math.floor((x.length / sr - firstBeat) / beatLen);
    for (let k = 0; k < total; k++) {
      const a = Math.round((firstBeat + (k + 0.5) * beatLen) * sr);
      const z = Math.min(x.length, Math.round((firstBeat + (k + 0.95) * beatLen) * sr));
      for (let i = a; i < z; i++) {
        const e = Math.min(1, (i - a) / fade, (z - i) / fade);
        out.push(x[i] * e);
      }
    }
    return Float32Array.from(out);
  }

  async function detectKey(x, sr, gate) {
    if (gate) x = gateKicks(x, sr, gate.firstBeat, gate.beatLen);
    const N = 8192;
    const chroma = new Float64Array(12);
    const re = new Float64Array(N), im = new Float64Array(N);
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const loBin = Math.ceil(80 * N / sr), hiBin = Math.floor(2000 * N / sr);
    const binPc = new Int8Array(hiBin + 1);
    for (let b = loBin; b <= hiBin; b++) {
      const midi = 69 + 12 * Math.log2((b * sr / N) / 440);
      binPc[b] = ((Math.round(midi) % 12) + 12) % 12;
    }
    // Pass one: the spectral peaks of every frame. Pass two weighs them
    // against a reference taken from the whole track, not each frame —
    // normalising per frame would turn a drum-only frame's noise into notes
    // as loud as a bassline's.
    const peaks = [];
    const frameMaxes = [];
    let frames = 0;
    for (let start = 0; start + N <= x.length; start += N) {
      for (let i = 0; i < N; i++) { re[i] = x[start + i] * win[i]; im[i] = 0; }
      fft(re, im);
      const mags = new Float64Array(hiBin + 1);
      // The kick's thump lives below ~100 Hz and would set the reference
      // every frame, so take it from above.
      let frameMax = 0;
      const refBin = Math.ceil(100 * N / sr);
      for (let b = loBin; b <= hiBin; b++) {
        mags[b] = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
        if (b >= refBin && mags[b] > frameMax) frameMax = mags[b];
      }
      const list = [];
      for (let b = loBin + 1; b < hiBin; b++) {
        const m = mags[b];
        if (m > mags[b - 1] && m >= mags[b + 1]) list.push([b, m]);
      }
      peaks.push(list);
      frameMaxes.push(frameMax);
      if (++frames % 40 === 0) await tick();
    }
    const ref = percentile(frameMaxes, 0.9) || 1e-9;
    peaks.forEach(function (list) {
      list.forEach(function (p) {
        const m = p[1] / ref;
        if (m > 0.25) chroma[binPc[p[0]]] += Math.min(m, 1.5) * Math.min(m, 1.5);
      });
    });
    let best = { r: -2, pc: 0, mode: "minor" }, second = -2;
    for (let pc = 0; pc < 12; pc++) {
      const rot = new Float64Array(12);
      for (let i = 0; i < 12; i++) rot[i] = chroma[(pc + i) % 12];
      const rMaj = correlate(rot, MAJOR), rMin = correlate(rot, MINOR);
      [[rMaj, "major"], [rMin, "minor"]].forEach(function (c) {
        if (c[0] > best.r) { second = best.r; best = { r: c[0], pc: pc, mode: c[1] }; }
        else if (c[0] > second) second = c[0];
      });
    }
    return {
      pc: best.pc, mode: best.mode,
      camelot: camelot(best.pc, best.mode),
      name: NOTE_NAMES[best.pc] + (best.mode === "minor" ? "m" : ""),
      confidence: Math.max(0, Math.min(1, (best.r - second) * 6 + 0.2)),
    };
  }

  // ---------------------------------------------------------------- structure

  function twoMeans(values) {
    let lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    for (let it = 0; it < 20; it++) {
      let sl = 0, nl = 0, sh = 0, nh = 0;
      values.forEach(function (v) {
        if (Math.abs(v - lo) <= Math.abs(v - hi)) { sl += v; nl++; } else { sh += v; nh++; }
      });
      if (nl) lo = sl / nl;
      if (nh) hi = sh / nh;
    }
    return { lo: lo, hi: hi };
  }

  function sectionsFrom(labels) {
    let runs = [];
    labels.forEach(function (l, i) {
      if (runs.length && runs[runs.length - 1].type === l) runs[runs.length - 1].end = i + 1;
      else runs.push({ type: l, start: i, end: i + 1 });
    });
    // Anything shorter than four bars is a wobble in the measurement, not a
    // section: give it to the longer neighbour.
    for (let guard = 0; guard < 50; guard++) {
      const idx = runs.findIndex(function (r, i) { return r.end - r.start < 4 && runs.length > 1; });
      if (idx < 0) break;
      const left = runs[idx - 1], right = runs[idx + 1];
      const target = !left ? right : !right ? left : ((left.end - left.start) >= (right.end - right.start) ? left : right);
      if (target === left) left.end = runs[idx].end; else right.start = runs[idx].start;
      runs.splice(idx, 1);
      const merged = [];
      runs.forEach(function (r) {
        if (merged.length && merged[merged.length - 1].type === r.type) merged[merged.length - 1].end = r.end;
        else merged.push(r);
      });
      runs = merged;
    }
    // Phrases are multiples of four bars; pull near-misses onto the grid.
    for (let i = 1; i < runs.length; i++) {
      const b = runs[i].start, m = Math.round(b / 4) * 4;
      if (m !== b && Math.abs(m - b) <= 1 && m > runs[i - 1].start && m < runs[i].end) {
        runs[i].start = m; runs[i - 1].end = m;
      }
    }
    return runs;
  }

  function findStructure(power, grid, fps, feat, downbeatSec, srEnv) {
    const barFrames = fps * 60 / grid.bpm * 4;
    const startFrame = downbeatSec * fps;
    const nBars = Math.floor((power.n - startFrame) / barFrames);
    const near = Math.max(2, Math.round(fps * 0.012));
    const beatFrames = barFrames / 4;
    const I = [], R = [], K = [], L = [], D = [];
    for (let b = 0; b < nBars; b++) {
      const a = Math.round(startFrame + b * barFrames), z = Math.round(startFrame + (b + 1) * barFrames);
      const lo = mean(power.low, a, z);
      // A kick is loud but brief; what separates a drop from a drum-only
      // intro is what fills the gaps between kicks, so measure the second
      // half of each beat, after the kick body has died away.
      let gap = 0;
      for (let j = 0; j < 4; j++) {
        const g0 = Math.round(startFrame + b * barFrames + (j + 0.5) * beatFrames);
        const g1 = Math.round(startFrame + b * barFrames + (j + 0.95) * beatFrames);
        gap += mean(power.low, g0, g1) + mean(power.mid, g0, g1) + mean(power.high, g0, g1);
      }
      I.push(10 * Math.log10(gap / 4 + 1e-12));
      R.push(10 * Math.log10(lo + mean(power.mid, a, z) + mean(power.high, a, z) + 1e-12));
      L.push(lo);
      D.push(mean(feat.fluxMid, a, z) / (feat.meanMid || 1) + mean(feat.fluxHigh, a, z) / (feat.meanHigh || 1));
      let kick = 0;
      for (let j = 0; j < 4; j++) {
        const p = Math.round(startFrame + b * barFrames + j * beatFrames);
        let m = 0;
        for (let i = p - near; i <= p + near; i++) if (i >= 0 && i < feat.fluxLow.length && feat.fluxLow[i] > m) m = feat.fluxLow[i];
        kick += m;
      }
      K.push(kick / 4);
    }
    const kRef = percentile(K, 0.9) || 1e-9;
    const hasKick = K.map(function (k) { return k / kRef >= 0.35; });
    // Level between the kicks plus how busy the hats, claps and stabs are:
    // together they separate a drop from a drum-only intro more cleanly
    // than either does alone.
    const S = I.map(function (v, i) { return v + 15 * Math.log10(D[i] + 1e-6); });
    const kickBars = [];
    S.forEach(function (v, i) { if (hasKick[i]) kickBars.push(v); });
    // Drops sit within a couple of dB of the loudest kick-bearing bars. A
    // drum-only intro or a fading outro sits well below. If everything is
    // that close, the track has no separate groove sections.
    const threshold = kickBars.length > 4 ? percentile(kickBars, 0.85) - 1.8 : -Infinity;
    const labels = S.map(function (v, i) {
      if (!hasKick[i]) return "break";
      return v >= threshold ? "drop" : "groove";
    });
    const runs = sectionsFrom(labels);
    const sections = runs.map(function (r, i) {
      let type = r.type;
      const firstDrop = runs.findIndex(function (q) { return q.type === "drop"; });
      let lastDrop = -1;
      runs.forEach(function (q, j) { if (q.type === "drop") lastDrop = j; });
      if (type === "groove") type = (i < firstDrop || firstDrop < 0) ? "intro" : i > lastDrop ? "outro" : "groove";
      if (type === "break" && i === 0) type = "intro";
      if (type === "break" && i === runs.length - 1) type = "outro";
      return { type: type, start: r.start, end: r.end };
    });
    return { nBars: nBars, sections: sections, intensity: I, loudness: R, density: D, kick: K.map(function (k) { return k / kRef; }), lowPower: L };
  }

  // ------------------------------------------------------------------ driver

  async function analyze(samples, sampleRate, opts) {
    opts = opts || {};
    const progress = opts.onProgress || function () {};
    const dec = decimate(samples, sampleRate);
    const x = dec.data, sr = dec.sr;
    const fps = sr / HOP;
    progress(0.05);
    await tick();

    const power = bandPowers(x, sr);
    const feat = { n: power.n, fluxLow: flux(power.low), fluxMid: flux(power.mid), fluxHigh: flux(power.high) };
    feat.meanMid = mean(feat.fluxMid, 0, feat.n); feat.meanHigh = mean(feat.fluxHigh, 0, feat.n);
    const nl = normalise(feat.fluxLow), nm = normalise(feat.fluxMid), nh = normalise(feat.fluxHigh);
    const onset = new Float32Array(power.n);
    for (let i = 0; i < power.n; i++) onset[i] = nl[i] + 0.6 * nm[i] + 0.6 * nh[i];
    progress(0.2);
    await tick();

    const grid = await findGrid(onset, fps);
    progress(0.55);

    const beatLen = 60 / grid.bpm;
    const barLen = beatLen * 4;
    const firstBeat = (grid.phaseFrames + 0.5) * HOP / sr;
    const m = pickDownbeat(feat, grid, fps, power);
    const downbeat = firstBeat + m * beatLen;
    progress(0.65);
    await tick();

    const structure = findStructure(power, grid, fps, feat, downbeat - 0.5 * HOP / sr, sr);
    const key = await detectKey(x, sr, { firstBeat: firstBeat, beatLen: beatLen });
    progress(0.95);

    const duration = samples.length / sampleRate;
    const sections = structure.sections;
    const drops = sections.filter(function (s) { return s.type === "drop"; });
    const firstDropSec = drops[0];
    const dropStarts = [];
    sections.forEach(function (s, i) {
      if (s.type === "drop" && i > 0 && sections[i - 1].type === "break") dropStarts.push(s.start);
    });
    const lastDrop = drops[drops.length - 1];
    const last = sections[sections.length - 1];
    const outroStart = last && last.type === "outro" ? last.start : (lastDrop ? lastDrop.end : structure.nBars);
    let dropPower = 0, dropN = 0;
    drops.forEach(function (s) {
      for (let b = s.start; b < s.end; b++) { dropPower += Math.pow(10, structure.loudness[b] / 10); dropN++; }
    });
    const loudnessDb = dropN ? 10 * Math.log10(dropPower / dropN) : 10 * Math.log10(mean(power.low, 0, power.n) + mean(power.mid, 0, power.n) + mean(power.high, 0, power.n) + 1e-12);

    const dropFraction = structure.nBars ? drops.reduce(function (u, s) { return u + (s.end - s.start); }, 0) / structure.nBars : 0;
    const hiRatio = mean(power.high, 0, power.n) / (mean(power.low, 0, power.n) + mean(power.mid, 0, power.n) + mean(power.high, 0, power.n) + 1e-12);
    const energy = Math.max(1, Math.min(10, Math.round(
      1 + 9 * (0.35 * Math.min(1, dropFraction / 0.7) + 0.3 * Math.min(1, hiRatio / 0.12) + 0.35 * Math.max(0, Math.min(1, (grid.bpm - 108) / 28))))));

    progress(1);
    return {
      bpm: grid.bpm,
      beatLen: beatLen,
      barLen: barLen,
      firstBeat: firstBeat,
      downbeat: downbeat,
      duration: duration,
      bars: structure.nBars,
      sections: sections,
      intensity: structure.intensity,
      density: structure.density,
      kick: structure.kick,
      cues: {
        mixIn: 0,
        firstDrop: firstDropSec ? firstDropSec.start : 0,
        dropStarts: dropStarts,
        outroStart: outroStart,
      },
      key: key,
      energy: energy,
      loudnessDb: loudnessDb,
    };
  }

  return {
    analyze: analyze,
    toMono: toMono,
    camelot: camelot,
    NOTE_NAMES: NOTE_NAMES,
    // exposed for tests
    decimate: decimate,
    detectKey: detectKey,
    HOP: HOP,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Analysis;
