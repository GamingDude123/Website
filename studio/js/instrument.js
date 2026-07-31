/* Making a recording sound like the instrument you picked.
 *
 * EQ alone cannot do this. What tells your ear "that is a kick" is mostly the
 * shape of the sound in time — a 2 ms attack, a pitch that falls off a cliff in
 * the first 30 ms, and everything gone by 400 ms — and no filter can give a
 * two-second mouth noise that shape.
 *
 * So each instrument here is two things: an envelope the recording is forced
 * into, and a synthesised version of the instrument that gets layered
 * underneath it. Which is how it is actually done in a studio — a real kick
 * sample gets a sub layered under it and its tail gated off.
 *
 * The `morph` amount crossfades between the two worlds. At 0 the recording
 * comes back untouched. At 1 it is bent all the way into the instrument's
 * envelope with the synthesised layer sitting under it, and what survives of
 * your recording is its timbre and its attack — the part that makes it yours.
 */

var Instrument = (function () {
  "use strict";

  /* Seeded, so re-shaping the same take twice gives the same result. Noise
   * that changed on every preview would make A/B comparison meaningless. */
  function rng(seed) {
    let a = (seed || 1) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Attack-then-exponential-decay, peaking at 1. */
  function decayEnv(len, sr, attackSec, tau) {
    const env = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const rise = attackSec > 0 ? 1 - Math.exp(-t / attackSec) : 1;
      env[i] = rise * Math.exp(-t / tau);
    }
    return env;
  }

  /* Take the loudness shape off a recording and put a different one on.
   *
   * Dividing by the natural envelope flattens the sound to a constant level,
   * leaving only its timbre; multiplying by the target imposes the new shape.
   * Both are raised to `amount`, so this fades continuously from "untouched" to
   * "completely reshaped". The divisor is floored, or the quiet gaps between
   * words would be amplified into the foreground.
   */
  function reshape(x, sr, target, amount) {
    if (amount <= 0) return x;
    const env = DSP.follow(x, sr, 2, 45);
    const top = DSP.peak(env);
    if (top < 1e-6) return x;
    const floor = top * 0.08;
    for (let i = 0; i < x.length; i++) {
      const natural = Math.max(env[i], floor);
      const flatten = Math.min(6, Math.pow(top / natural, amount));
      const impose = Math.pow(Math.max(target[i], 1e-4), amount);
      x[i] *= flatten * impose;
    }
    return x;
  }

  // ------------------------------------------------------------------ synths

  /* A kick: sine whose pitch collapses onto the root note, plus a beater click.
   * The pitch drop is the whole trick — a steady 55 Hz sine is a bass note, the
   * same sine falling from 190 Hz in 30 ms is a kick drum. */
  function kickSynth(len, sr, o) {
    const root = o.rootHz || 55;
    const out = new Float32Array(len);
    const start = Math.min(210, root * 3.6);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = root + (start - root) * Math.exp(-t / 0.03);
      phase += (2 * Math.PI * f) / sr;
      out[i] = Math.sin(phase) * Math.exp(-t / 0.115) * (1 - Math.exp(-t / 0.0015));
    }
    const rnd = rng(o.seed);
    const clickLen = Math.min(len, Math.round(sr * 0.007));
    const click = new Float32Array(clickLen);
    for (let i = 0; i < clickLen; i++) {
      click[i] = (rnd() * 2 - 1) * Math.exp(-(i / sr) / 0.0016);
    }
    DSP.biquad(click, sr, "highpass", 1800, 0.7);
    for (let i = 0; i < clickLen; i++) out[i] += click[i] * 0.35;
    return out;
  }

  /* A snare: two body tones for the drum and a band of noise for the wires. */
  function snareSynth(len, sr, o) {
    const out = new Float32Array(len);
    let p1 = 0;
    let p2 = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      p1 += (2 * Math.PI * 186) / sr;
      p2 += (2 * Math.PI * 331) / sr;
      const rise = 1 - Math.exp(-t / 0.0008);
      out[i] = (Math.sin(p1) * 0.7 + Math.sin(p2) * 0.32) * Math.exp(-t / 0.055) * rise * 0.55;
    }
    const rnd = rng(o.seed);
    const noise = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      noise[i] = (rnd() * 2 - 1) * Math.exp(-t / 0.085) * (1 - Math.exp(-t / 0.0008));
    }
    DSP.biquad(noise, sr, "highpass", 1100, 0.7);
    DSP.biquad(noise, sr, "lowpass", 9000, 0.7);
    for (let i = 0; i < len; i++) out[i] += noise[i] * 0.85;
    return out;
  }

  /* A clap is not one sound: it is three or four hands landing a few
   * milliseconds apart, then the room. That spacing is what stops it reading as
   * a snare. */
  function clapSynth(len, sr, o) {
    const out = new Float32Array(len);
    const rnd = rng(o.seed);
    const taps = [0, 0.0095, 0.019, 0.028];
    for (let k = 0; k < taps.length; k++) {
      const from = Math.round(taps[k] * sr);
      for (let i = from; i < len; i++) {
        out[i] += (rnd() * 2 - 1) * Math.exp(-((i - from) / sr) / 0.0085) * 0.62;
      }
    }
    const tailFrom = Math.round(0.03 * sr);
    for (let i = tailFrom; i < len; i++) {
      out[i] += (rnd() * 2 - 1) * Math.exp(-((i - tailFrom) / sr) / 0.075) * 0.4;
    }
    DSP.biquad(out, sr, "highpass", 900, 0.8);
    DSP.biquad(out, sr, "lowpass", 7000, 0.7);
    DSP.biquad(out, sr, "peaking", 1600, 1.1, 4);
    return out;
  }

  /* A hat, the way the 808 did it: six square waves at deliberately
   * unmusical ratios, so nothing lines up into a pitch, then filtered hard at
   * the top and cut off almost immediately. */
  function hatSynth(len, sr, o) {
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    const base = 263;
    const tau = o.open ? 0.155 : 0.021;
    const out = new Float32Array(len);
    const phase = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let v = 0;
      for (let k = 0; k < ratios.length; k++) {
        phase[k] += (2 * Math.PI * base * ratios[k]) / sr;
        v += Math.sin(phase[k]) >= 0 ? 1 : -1;
      }
      out[i] = (v / ratios.length) * Math.exp(-t / tau) * (1 - Math.exp(-t / 0.0004));
    }
    const rnd = rng(o.seed);
    for (let i = 0; i < len; i++) {
      out[i] += (rnd() * 2 - 1) * Math.exp(-(i / sr) / (tau * 0.85)) * 0.28;
    }
    // Two passes for a steeper slope: one 12 dB/octave filter still leaves
    // enough low end to sound like a shaker rather than a hat.
    DSP.biquad(out, sr, "highpass", 6800, 0.7);
    DSP.biquad(out, sr, "highpass", 6800, 0.7);
    DSP.biquad(out, sr, "peaking", 10500, 1, 3);
    return out;
  }

  /* A tom: same idea as the kick but the pitch falls much further up, and much
   * more slowly, so it keeps a note. */
  function tomSynth(len, sr, o) {
    const root = (o.rootHz || 55) * 2.5;
    const out = new Float32Array(len);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = root + root * 0.6 * Math.exp(-t / 0.09);
      phase += (2 * Math.PI * f) / sr;
      out[i] = Math.sin(phase) * Math.exp(-t / 0.19) * (1 - Math.exp(-t / 0.002)) * 0.85;
    }
    const rnd = rng(o.seed);
    const hitLen = Math.min(len, Math.round(sr * 0.01));
    for (let i = 0; i < hitLen; i++) {
      out[i] += (rnd() * 2 - 1) * Math.exp(-(i / sr) / 0.003) * 0.3;
    }
    return out;
  }

  /* Bass and sub follow the recording rather than a fixed decay — the envelope
   * is applied by `shape` afterwards — so what you get is a clean oscillator
   * playing your phrasing at the note you are in. */
  function bassSynth(len, sr, o) {
    const f = o.pitchHz && o.pitchHz > 25 ? o.pitchHz : (o.rootHz || 55);
    const out = new Float32Array(len);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      phase += (2 * Math.PI * f) / sr;
      out[i] = Math.sin(phase) + 0.34 * Math.sin(phase * 2) + 0.13 * Math.sin(phase * 3);
    }
    DSP.biquad(out, sr, "lowpass", Math.max(420, f * 7), 0.9);
    return out;
  }

  function subSynth(len, sr, o) {
    const f = o.pitchHz && o.pitchHz > 25 ? o.pitchHz : (o.rootHz || 55);
    const out = new Float32Array(len);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      phase += (2 * Math.PI * f) / sr;
      out[i] = Math.sin(phase);
    }
    return out;
  }

  /* Not a synth but a transform: stack the recording with pitch-shifted copies
   * of itself to turn one hummed note into a chord in your key. */
  function harmonise(x, sr, o) {
    const intervals = o.chordIntervals || [3, 7];
    const out = Float32Array.from(x);
    for (let k = 0; k < intervals.length; k++) {
      const voice = DSP.pitchShift(x, intervals[k]);
      const n = Math.min(out.length, voice.length);
      for (let i = 0; i < n; i++) out[i] += voice[i] * 0.72;
    }
    // Three voices stacked are nearly three times the amplitude. Coming back at
    // the level it went in at is both correct and what stops the blend below
    // from overshooting.
    return DSP.normalize(out, DSP.peak(x) || 0.89);
  }

  // ------------------------------------------------------------- the catalogue

  /* `role` is what the rest of the app treats the pad as — its pattern, its
   * mix level, whether the kick ducks it. Several instruments share one role:
   * a clap is a snare as far as the arranger is concerned. */
  const INSTRUMENTS = {
    kick: {
      label: "Kick", role: "kick", group: "drums", pitched: false,
      env: { total: 0.42, attack: 0.0015, tau: 0.115 },
      filters: function (x, sr) {
        DSP.biquad(x, sr, "lowpass", 320, 0.8);
        DSP.biquad(x, sr, "peaking", 70, 1.1, 3);
      },
      synth: kickSynth, synthMix: 0.72, morph: 0.7,
      hint: "forces a fast pitch drop onto the root and layers a sub under it",
    },
    snare: {
      label: "Snare", role: "snare", group: "drums", pitched: false,
      env: { total: 0.26, attack: 0.0008, tau: 0.07 },
      filters: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 200, 0.7);
        DSP.biquad(x, sr, "peaking", 220, 1.2, 3);
      },
      synth: snareSynth, synthMix: 0.6, morph: 0.6,
      hint: "gates the tail and layers drum body plus wire noise",
    },
    clap: {
      label: "Clap", role: "snare", group: "drums", pitched: false,
      env: { total: 0.3, attack: 0.0006, tau: 0.075 },
      filters: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 500, 0.7);
      },
      synth: clapSynth, synthMix: 0.62, morph: 0.65,
      hint: "adds the four-hands-landing stagger a clap needs",
    },
    hat: {
      label: "Hi-hat", role: "hat", group: "drums", pitched: false,
      env: { total: 0.08, attack: 0.0003, tau: 0.021 },
      filters: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 4000, 0.7);
      },
      synth: hatSynth, synthMix: 0.55, morph: 0.75,
      hint: "cuts it to 80 ms and layers metallic top end",
    },
    openhat: {
      label: "Open hat", role: "hat", group: "drums", pitched: false,
      env: { total: 0.42, attack: 0.0003, tau: 0.155 },
      filters: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 3600, 0.7);
      },
      synth: function (len, sr, o) {
        return hatSynth(len, sr, { seed: o.seed, open: true });
      },
      synthMix: 0.55, morph: 0.7,
      hint: "the same, left ringing",
    },
    tom: {
      label: "Tom", role: "perc", group: "drums", pitched: false,
      env: { total: 0.5, attack: 0.002, tau: 0.19 },
      filters: function (x, sr) {
        DSP.biquad(x, sr, "lowpass", 2200, 0.8);
      },
      synth: tomSynth, synthMix: 0.6, morph: 0.6,
      hint: "a membrane that keeps its note as it falls",
    },
    perc: {
      label: "Perc", role: "perc", group: "drums", pitched: false,
      env: { total: 0.22, attack: 0.0008, tau: 0.06 },
      filters: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 300, 0.7);
        DSP.biquad(x, sr, "peaking", 2600, 0.9, 3);
      },
      synth: null, synthMix: 0, morph: 0.5,
      hint: "tightens it into a hit without adding anything",
    },
    bass: {
      label: "Bass", role: "bass", group: "tuned", pitched: true,
      env: null, followEnvelope: true,
      filters: function (x, sr) {
        DSP.biquad(x, sr, "lowpass", 900, 0.8);
      },
      synth: bassSynth, synthMix: 0.62, morph: 0.55,
      hint: "an oscillator on your note, following how you played it",
    },
    sub: {
      label: "Sub", role: "bass", group: "tuned", pitched: true,
      env: null, followEnvelope: true,
      filters: function (x, sr) {
        DSP.biquad(x, sr, "lowpass", 220, 0.9);
      },
      synth: subSynth, synthMix: 0.85, morph: 0.8,
      hint: "pure sine, felt more than heard",
    },
    chord: {
      label: "Chord", role: "chord", group: "tuned", pitched: true,
      env: null,
      filters: null,
      transform: harmonise, morph: 0.55,
      hint: "stacks your note into a triad in the key",
    },
    vocal: {
      label: "Vocal", role: "vocal", group: "tuned", pitched: true,
      env: null,
      filters: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 110, 0.7);
        DSP.biquad(x, sr, "peaking", 2800, 0.8, 2.5);
      },
      synth: null, synthMix: 0, morph: 0.35,
      hint: "cleans it up and leaves it alone",
    },
    texture: {
      label: "Texture", role: "texture", group: "tuned", pitched: false,
      env: null,
      filters: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 80, 0.7);
        DSP.biquad(x, sr, "lowpass", 10000, 0.7);
      },
      synth: null, synthMix: 0, morph: 0.3,
      hint: "keeps it long and washes it back",
    },
    asis: {
      label: "As recorded", role: null, group: "plain", pitched: false,
      env: null, filters: null, synth: null, synthMix: 0, morph: 0,
      hint: "cleaned and trimmed, nothing else",
    },
  };

  const ORDER = ["kick", "snare", "clap", "hat", "openhat", "tom", "perc",
                 "bass", "sub", "chord", "vocal", "texture", "asis"];

  /* The role the classifier guesses maps onto the instrument offered first. */
  const ROLE_TO_INSTRUMENT = {
    kick: "kick", snare: "snare", hat: "hat", perc: "perc",
    bass: "bass", vocal: "vocal", chord: "chord", texture: "texture",
  };

  function get(name) {
    return INSTRUMENTS[name] || null;
  }

  function roleOf(name) {
    const inst = INSTRUMENTS[name];
    return inst ? inst.role : null;
  }

  /* The main event. `opts`: morph 0..1, rootHz, pitchHz, chordIntervals, seed. */
  function shape(x, sr, name, opts) {
    const inst = INSTRUMENTS[name];
    const o = opts || {};
    if (!inst || name === "asis") return Float32Array.from(x);

    const morph = Math.max(0, Math.min(1, o.morph === undefined ? inst.morph : o.morph));
    if (morph < 0.005) return Float32Array.from(x);

    if (inst.transform) {
      const transformed = inst.transform(x, sr, o);
      const n = Math.min(x.length, transformed.length);
      const blended = new Float32Array(n);
      for (let i = 0; i < n; i++) blended[i] = x[i] * (1 - morph) + transformed[i] * morph;
      return blended;
    }

    // How long the result should be: the recording's own length at morph 0,
    // the instrument's natural length at morph 1. This is what lets a
    // two-second noise become an 80 ms hat.
    //
    // Interpolated in log space and against the square root of the morph,
    // because length is heard in ratios, not milliseconds. A straight linear
    // blend leaves a 1.6 s take still 0.6 s long at 85% — when someone picks
    // "hi-hat" and turns it most of the way up, they should get a hi-hat.
    const natural = x.length;
    const targetLen = inst.env ? Math.round(sr * inst.env.total) : natural;
    const lengthMorph = Math.sqrt(morph);
    const outLen = Math.max(64, Math.round(Math.exp(
      Math.log(natural) * (1 - lengthMorph) + Math.log(targetLen) * lengthMorph
    )));

    const carrier = new Float32Array(outLen);
    carrier.set(x.subarray(0, Math.min(outLen, natural)));

    let envelope = null;
    if (inst.env) {
      envelope = decayEnv(outLen, sr, inst.env.attack, inst.env.tau);
      reshape(carrier, sr, envelope, morph);
    }

    if (inst.filters) {
      // Filtering reaches full strength well before the morph does, and stays
      // there. The frequency range is the instrument's identity in a way its
      // exact decay is not, and leaking even a few percent of an unfiltered
      // "tss" past a kick's filter leaves audible hiss on every hit — a kick
      // has essentially no high end for it to hide behind. Below about a third
      // of the way up it still only tilts the sound rather than converting it.
      const strength = Math.min(1, morph * 1.8);
      const filtered = Float32Array.from(carrier);
      inst.filters(filtered, sr);
      for (let i = 0; i < outLen; i++) {
        carrier[i] = carrier[i] * (1 - strength) + filtered[i] * strength;
      }
    }

    if (!inst.synth) {
      DSP.fadeEdges(carrier, sr, 1, 6);
      return carrier;
    }

    const synth = inst.synth(outLen, sr, {
      rootHz: o.rootHz,
      pitchHz: o.pitchHz,
      seed: o.seed === undefined ? 1 : o.seed,
    });

    // A synth that follows the recording instead of its own decay: the point of
    // a bass layer is that it plays what you played.
    if (inst.followEnvelope) {
      const env = DSP.follow(carrier, sr, 4, 70);
      const top = DSP.peak(env) || 1;
      for (let i = 0; i < outLen; i++) synth[i] *= env[i] / top;
    }

    // Match levels before blending, or the mix would depend on how loud the
    // recording happened to be.
    DSP.normalize(synth, 1);
    DSP.normalize(carrier, 1);
    const mix = morph * inst.synthMix;
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      out[i] = carrier[i] * (1 - mix) + synth[i] * mix;
    }
    DSP.fadeEdges(out, sr, 0.5, 4);
    return out;
  }

  return {
    instruments: INSTRUMENTS,
    order: ORDER,
    roleFor: ROLE_TO_INSTRUMENT,
    get: get,
    roleOf: roleOf,
    shape: shape,
    reshape: reshape,
    decayEnv: decayEnv,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Instrument;
