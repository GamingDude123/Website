/* A scratch kit, for when there is no microphone handy.
 *
 * These are deliberately made to arrive the way a real take does: a second of
 * room tone before anything happens, a hiss underneath, a bit of DC offset, and
 * two of them slightly out of tune. That way the raw/polished switch on a pad
 * has something honest to show.
 */

var DemoKit = (function () {
  "use strict";

  function noise(amount) {
    return (Math.random() * 2 - 1) * amount;
  }

  /* Wrap a sound in the mess a phone recording comes with. */
  function asTake(sr, body, before, after, hiss) {
    const pre = Math.round(before * sr);
    const out = new Float32Array(pre + body.length + Math.round(after * sr));
    for (let i = 0; i < out.length; i++) out[i] = noise(hiss) + 0.004;
    for (let i = 0; i < body.length; i++) out[pre + i] += body[i];
    return out;
  }

  function boom(sr) {
    const n = Math.round(0.34 * sr);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 44 + 60 * Math.exp(-t * 22);
      x[i] = 0.75 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9);
      if (t < 0.004) x[i] += noise(0.25) * (1 - t / 0.004); // the thump of a hand
    }
    return asTake(sr, x, 0.42, 0.5, 0.0045);
  }

  function tss(sr) {
    const n = Math.round(0.07 * sr);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      x[i] = noise(0.5) * Math.exp(-t * 70);
    }
    DSP.biquad(x, sr, "highpass", 5500, 0.7);
    return asTake(sr, x, 0.3, 0.4, 0.004);
  }

  function pat(sr) {
    const n = Math.round(0.17 * sr);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 24);
      x[i] = (noise(0.45) + 0.22 * Math.sin(2 * Math.PI * 205 * t)) * env;
    }
    DSP.biquad(x, sr, "highpass", 240, 0.7);
    return asTake(sr, x, 0.36, 0.45, 0.004);
  }

  /* 106 Hz sits between G#2 and A2, so tuning to A minor has to move it. */
  function hum(sr) {
    const n = Math.round(1.15 * sr);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, Math.min(t, 1.15 - t) / 0.06);
      x[i] = env * (0.5 * Math.sin(2 * Math.PI * 106 * t) +
                    0.22 * Math.sin(2 * Math.PI * 212 * t) +
                    0.11 * Math.sin(2 * Math.PI * 318 * t));
    }
    return asTake(sr, x, 0.4, 0.55, 0.005);
  }

  /* A vowel: three formants over 238 Hz, which is also off the key. */
  function ahh(sr) {
    const n = Math.round(0.86 * sr);
    const x = new Float32Array(n);
    const f0 = 238;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, Math.min(t, 0.86 - t) / 0.08);
      let v = 0;
      for (let h = 1; h <= 12; h++) {
        const f = f0 * h;
        // crude vowel: emphasise harmonics near 700, 1200 and 2600 Hz
        const shape = Math.exp(-Math.pow((f - 700) / 420, 2)) +
                      0.6 * Math.exp(-Math.pow((f - 1200) / 500, 2)) +
                      0.3 * Math.exp(-Math.pow((f - 2600) / 800, 2));
        v += (shape / h) * Math.sin(2 * Math.PI * f * t + h);
      }
      // a little wobble, because nobody holds a note perfectly still
      x[i] = env * v * 0.28 * (1 + 0.02 * Math.sin(2 * Math.PI * 4.5 * t));
    }
    return asTake(sr, x, 0.33, 0.5, 0.005);
  }

  /* 2.05 s of swell: long enough that the grid fit has to stretch it. */
  function wash(sr) {
    const n = Math.round(2.05 * sr);
    const x = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp = lp * 0.992 + noise(0.008);
      const t = i / sr;
      x[i] = lp * 14 * Math.min(1, Math.min(t / 0.5, (2.05 - t) / 0.35));
    }
    DSP.biquad(x, sr, "lowpass", 2600, 0.9);
    return asTake(sr, x, 0.3, 0.4, 0.004);
  }

  const KIT = [
    { name: "boom", make: boom },
    { name: "pat", make: pat },
    { name: "tss", make: tss },
    { name: "hum", make: hum },
    { name: "ahh", make: ahh },
    { name: "wash", make: wash },
  ];

  return {
    build: function (sampleRate) {
      return KIT.map(function (entry) {
        return { name: entry.name, samples: entry.make(sampleRate) };
      });
    },
  };
})();
