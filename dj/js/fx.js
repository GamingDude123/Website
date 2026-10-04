/* Synthesised effect sounds: riser, sub impact, soft crash, downlifter, reverse
 * swell, snare roll, laser zap, siren, and a reverb impulse. Pure, so the shapes
 * can be measured in node.
 *
 * Every effect here is the kind a club record actually uses and none of them
 * is pitched, so none can clash with the key of whatever is playing:
 *   riser      – a resonant band-pass sweeping up through stereo noise, with a
 *                faint pulse that speeds up, then a short dip so the hit that
 *                follows lands in a gap instead of on top of it
 *   impact     – a rounded sub thump with a soft, dark tail
 *   crash      – a bright, wide noise wash that decays, not a clang
 *   downlifter – the riser run backwards, for after a drop
 *   swell      – a crash played backwards: a wash that builds and stops dead on
 *                the hit that follows
 *   snareRoll  – one bar of snare hits getting faster (8ths, 16ths, 32nds) and louder
 *   zap        – a laser: a bright tone falling fast through the spectrum
 *   siren      – a wailing tone, for the cheeky end of the effects
 * Each returns an array of channels (one for mono, two for stereo).
 */

var FX = (function () {
  "use strict";

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const smooth = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  function normalise(channels, peak) {
    let m = 0;
    channels.forEach(function (c) { for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) > m) m = Math.abs(c[i]); });
    const k = m > 0 ? peak / m : 1;
    channels.forEach(function (c) { for (let i = 0; i < c.length; i++) c[i] *= k; });
    return channels;
  }

  // Noise through a state-variable band-pass whose centre moves from f0 to f1
  // (exponentially, so equal musical steps take equal time). `fn(t)` shapes the
  // loudness over 0..1. Run twice per sample so the filter stays stable up
  // into the top octave.
  function sweptNoise(sr, seconds, f0, f1, Q, seed, fn) {
    const n = Math.floor(sr * seconds), out = new Float32Array(n), r = rng(seed);
    const q = 1 / Q, fMax = sr / 3.2, BLOCK = 16;
    let low = 0, band = 0, air = 0;
    // the filter and the loudness are worked out once per 16 samples (0.4 ms),
    // the loudness glided between them — the same sound for a tenth of the work
    let f = 0, g0 = fn(0), g1 = g0;
    for (let i = 0; i < n; i++) {
      const j = i % BLOCK;
      if (j === 0) {
        const t = i / n;
        f = 2 * Math.sin(Math.PI * Math.min(fMax, f0 * Math.pow(f1 / f0, t)) / (2 * sr));
        g0 = g1; g1 = fn(Math.min(1, (i + BLOCK) / n));
        if (i === 0) g0 = fn(0);
      }
      const w = r() * 2 - 1;
      let y = 0;
      for (let k = 0; k < 2; k++) {
        low += f * band;
        const high = w - low - q * band;
        band += f * high;
        y = band;
      }
      air += 0.35 * (w - air);                 // a little un-filtered top end for shimmer
      const t = i / n;
      out[i] = (y * 0.9 + (w - air) * 0.12 * t) * (g0 + (g1 - g0) * (j / BLOCK));
    }
    return out;
  }

  function riser(sr, seconds) {
    const top = Math.min(9000, sr / 3.2 - 200);
    const env = function (t) { return 0.07 + 0.93 * Math.pow(t, 1.8); };
    // a pulse that starts as a slow breath and ends as a flutter
    function pulsed(seed) {
      let phase = 0;
      const base = sweptNoise(sr, seconds, 450, top, 2.2, seed, env);
      for (let i = 0; i < base.length; i++) {
        const t = i / base.length;
        phase += 2 * Math.PI * (1.5 + 13 * t * t) / sr;
        base[i] *= 1 - 0.2 * t * (0.5 - 0.5 * Math.cos(phase));
      }
      return base;
    }
    const L = pulsed(101), R = pulsed(202);
    const fadeIn = Math.floor(sr * 0.05), dip = Math.floor(sr * 0.07), n = L.length;
    for (let i = 0; i < n; i++) {
      const g = Math.min(1, i / fadeIn) * (i > n - dip ? 1 - smooth((i - (n - dip)) / dip) : 1);
      L[i] *= g; R[i] *= g;
    }
    return normalise([L, R], 0.9);
  }

  function downlifter(sr, seconds) {
    const top = Math.min(7000, sr / 3.2 - 200);
    const env = function (t) { return Math.pow(1 - t, 1.6); };
    const mk = function (seed) {
      const x = sweptNoise(sr, seconds, top, 350, 1.8, seed, env);
      const a = Math.floor(sr * 0.012);
      for (let i = 0; i < a; i++) x[i] *= i / a;
      return x;
    };
    return normalise([mk(303), mk(404)], 0.8);
  }

  function crash(sr) {
    const n = Math.floor(sr * 2.4);
    const mk = function (seed) {
      const r = rng(seed), out = new Float32Array(n);
      let hp = 0, lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = r() * 2 - 1;
        hp += 0.45 * (w - hp);              // remove the lows ...
        const bright = w - hp;
        lp += 0.55 * (bright - lp);         // ... and the harshest top, leaving a wash
        const e = Math.min(1, t / 0.004) * (0.7 * Math.exp(-t / 0.28) + 0.3 * Math.exp(-t / 0.9));
        out[i] = lp * e;
      }
      return out;
    };
    return normalise([mk(505), mk(606)], 0.7);
  }

  function impact(sr) {
    const n = Math.floor(sr * 1.8), x = new Float32Array(n), r = rng(707);
    let phase = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // sub sweeps down from a punchy 85 Hz to a felt 38 Hz and rings out
      phase += 2 * Math.PI * (38 + 47 * Math.exp(-t / 0.11)) / sr;
      const body = Math.sin(phase) * Math.min(1, t / 0.003) * Math.exp(-t / 0.42);
      lp += 0.07 * ((r() * 2 - 1) - lp);    // dark noise for the "air" of the hit
      const air = lp * Math.exp(-t / 0.22) * 1.6;
      x[i] = body * 0.85 + air * 0.25;
    }
    normalise([x], 0.85);
    return [x, Float32Array.from(x)];
  }

  // A crash played backwards. It is the last `seconds` of the crash's first stretch,
  // reversed, so it builds all the way and ends on the loudest point; longer than
  // the crash itself and it starts from silence.
  function swell(sr, seconds) {
    const c = crash(sr), n = Math.max(1, Math.floor(sr * seconds)), m = Math.min(n, c[0].length);
    const out = [new Float32Array(n), new Float32Array(n)];
    for (let ch = 0; ch < 2; ch++) {
      for (let i = 0; i < m; i++) out[ch][n - 1 - i] = c[ch][i];
      const a = Math.floor(sr * 0.04);                      // start from nothing, end with a short dip so the hit lands in a gap
      for (let i = 0; i < a; i++) out[ch][n - m + i] *= i / a;
      const d = Math.floor(sr * 0.02);
      for (let i = 0; i < d; i++) out[ch][n - 1 - i] *= i / d;
    }
    return normalise(out, 0.8);
  }

  // One bar (`seconds` long) of snare hits: eighth notes for two beats, sixteenths for one,
  // thirty-seconds for the last, each louder than the one before.
  function snareRoll(sr, seconds) {
    const n = Math.floor(sr * seconds), beat = seconds / 4, times = [];
    for (let b = 0; b < 2; b += 0.5) times.push(b * beat);
    for (let b = 2; b < 3; b += 0.25) times.push(b * beat);
    for (let b = 3; b < 4; b += 0.125) times.push(b * beat);
    const mk = function (seed) {
      const r = rng(seed), out = new Float32Array(n);
      times.forEach(function (t, k) {
        const amp = 0.3 + 0.7 * (k / (times.length - 1)), start = Math.floor(t * sr), len = Math.min(n - start, Math.floor(sr * 0.14));
        let hp = 0, lp = 0;
        for (let i = 0; i < len; i++) {
          const x = i / sr, w = r() * 2 - 1;
          hp += 0.25 * (w - hp);                            // the snare's rattle: noise without the lows ...
          lp += 0.6 * ((w - hp) - lp);                      // ... and without the harshest top
          const body = Math.sin(2 * Math.PI * (185 - 40 * Math.min(1, x / 0.03)) * x) * Math.exp(-x / 0.02);
          out[start + i] += amp * (lp * Math.exp(-x / 0.045) * 0.9 + body * 0.5) * Math.min(1, i / (sr * 0.001));
        }
      });
      return out;
    };
    return normalise([mk(808), mk(909)], 0.8);
  }

  // A laser zap: a tone that starts high and falls fast, with a little bite.
  function zap(sr) {
    const n = Math.floor(sr * 0.42), x = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      phase += 2 * Math.PI * (160 + 3400 * Math.exp(-t / 0.075)) / sr;
      x[i] = (Math.sin(phase) + 0.35 * Math.sin(2 * phase + 0.7)) * Math.exp(-t / 0.16) * Math.min(1, i / (sr * 0.002)) * Math.min(1, (n - 1 - i) / (sr * 0.02));
    }
    normalise([x], 0.6);
    return [x, Float32Array.from(x)];
  }

  // A siren: a wailing tone swinging between 650 and 1250 Hz twice a second.
  function siren(sr, seconds) {
    const n = Math.floor(sr * seconds), x = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, f = 950 + 300 * Math.sin(2 * Math.PI * 0.9 * t - Math.PI / 2);
      phase += 2 * Math.PI * f / sr;
      const tri = Math.asin(Math.sin(phase)) * 2 / Math.PI;             // a triangle: rounder than a saw, edgier than a sine
      x[i] = (0.75 * tri + 0.25 * Math.sin(phase)) * Math.min(1, t / 0.15) * Math.min(1, (seconds - t) / 0.3);
    }
    normalise([x], 0.5);
    return [x, Float32Array.from(x)];
  }

  // Exponentially decaying stereo noise: a plain, dense room.
  function reverbImpulse(sr, seconds) {
    const n = Math.floor(sr * seconds);
    const ch = [new Float32Array(n), new Float32Array(n)];
    let seed = 99;
    for (let c = 0; c < 2; c++) {
      let lp = 0;
      for (let i = 0; i < n; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        lp += 0.5 * ((seed / 2147483648 - 1) - lp);
        ch[c][i] = lp * Math.pow(1 - i / n, 3);
      }
    }
    return ch;
  }

  return { riser: riser, downlifter: downlifter, crash: crash, impact: impact, swell: swell, snareRoll: snareRoll, zap: zap, siren: siren, reverbImpulse: reverbImpulse };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FX;
