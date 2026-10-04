/* Synthesised effect sounds: riser, sub impact, soft crash, downlifter, and a
 * reverb impulse. Pure, so the shapes can be measured in node.
 *
 * Every effect here is the kind a club record actually uses and none of them
 * is pitched, so none can clash with the key of whatever is playing:
 *   riser      – a resonant band-pass sweeping up through stereo noise, with a
 *                faint pulse that speeds up, then a short dip so the hit that
 *                follows lands in a gap instead of on top of it
 *   impact     – a rounded sub thump with a soft, dark tail
 *   crash      – a bright, wide noise wash that decays, not a clang
 *   downlifter – the riser run backwards, for after a drop
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
    const q = 1 / Q, fMax = sr / 3.2;
    let low = 0, band = 0, air = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const fc = Math.min(fMax, f0 * Math.pow(f1 / f0, t));
      const f = 2 * Math.sin(Math.PI * fc / (2 * sr));
      const w = r() * 2 - 1;
      let y = 0;
      for (let k = 0; k < 2; k++) {
        low += f * band;
        const high = w - low - q * band;
        band += f * high;
        y = band;
      }
      air += 0.35 * (w - air);                 // a little un-filtered top end for shimmer
      out[i] = (y * 0.9 + (w - air) * 0.12 * t) * fn(t);
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

  return { riser: riser, downlifter: downlifter, crash: crash, impact: impact, reverbImpulse: reverbImpulse };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FX;
