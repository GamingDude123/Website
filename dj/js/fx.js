/* Synthesised effect sounds: riser, impact and a reverb impulse. Pure. */

var FX = (function () {
  "use strict";

  function riser(sr, seconds) {
    const n = Math.floor(sr * seconds);
    const out = new Float32Array(n);
    let lp = 0, seed = 12345;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const w = seed / 2147483648 - 1;
      const t = i / n;
      const a = 0.02 + 0.6 * t * t;               // filter opens as it rises
      lp += a * (w - lp);
      out[i] = (lp * 0.9 + (w - lp) * 0.15 * t) * (0.15 + 0.85 * t * t);
    }
    return out;
  }

  function impact(sr) {
    const n = Math.floor(sr * 1.6);
    const out = new Float32Array(n);
    let phase = 0, seed = 777, hp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      phase += 2 * Math.PI * (38 + 90 * Math.exp(-t / 0.09)) / sr;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const w = seed / 2147483648 - 1;
      const noise = (w - hp) * Math.exp(-t / 0.35); hp = w * 0.9;
      out[i] = Math.sin(phase) * Math.exp(-t / 0.5) * 0.65 + noise * 0.15;
    }
    return out;
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

  return { riser: riser, impact: impact, reverbImpulse: reverbImpulse };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FX;
