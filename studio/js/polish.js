/* The bit that does the editing for you.
 *
 * One recording goes in, a finished pad comes out: room tone stripped, edges
 * trimmed to the transient, tuned into the project key if it turns out to be
 * pitched, stretched onto the grid if it turns out to be a loop, then given
 * the EQ, saturation and compression that suits whatever it decided the sound
 * was. Nothing here needs an AudioContext, so it also runs under a test
 * runner and can be re-run cheaply when the key or tempo changes.
 */

var Polish = (function () {
  "use strict";

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    pentatonic: [0, 3, 5, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };

  function freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / 440);
  }

  function midiToNoteName(midi) {
    const rounded = Math.round(midi);
    const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
    return name + (Math.floor(rounded / 12) - 1);
  }

  /* How far this frequency has to move, in semitones, to land on the nearest
   * note of the key. Returns a fractional value so a flat hum gets its tuning
   * corrected as well as its note.
   */
  function snapToScale(freq, rootPc, scaleName) {
    const scale = SCALES[scaleName] || SCALES.minor;
    const midi = freqToMidi(freq);
    let best = 0;
    let bestDist = Infinity;
    // Every allowed pitch class within an octave either side is a candidate;
    // whichever is closest wins, which keeps the move small.
    for (let i = 0; i < scale.length; i++) {
      const pc = (rootPc + scale[i]) % 12;
      for (let octave = -1; octave <= 1; octave++) {
        const target = Math.round(midi / 12) * 12 + pc + octave * 12;
        const dist = target - midi;
        if (Math.abs(dist) < Math.abs(bestDist)) { bestDist = dist; best = target; }
      }
    }
    return { semitones: bestDist, midi: best };
  }

  // ------------------------------------------------------------------ roles

  /* What kind of sound is this? Drives the pattern it gets given, the tone
   * chain, the FX sends and whether it is tuned at all. */
  function classify(f) {
    const pitched = f.pitchConfidence > 0.55 && f.pitch > 40;

    if (pitched && f.duration > 0.12) {
      // A short pitched thump is a drum, not a bassline.
      if (f.pitch < 145 && f.duration < 0.32 && f.low > 0.6) return "kick";
      if (f.pitch < 145 && f.low > 0.45) return "bass";
      if (f.duration > 1.5) return "chord";
      return "vocal";
    }
    if (f.duration < 0.5 && f.low > 0.55 && f.centroid < 500) return "kick";
    // Noise-like hits separate mostly on length: a hat is over almost at once,
    // while snares, claps and rims ring on. Brightness only confirms it, since
    // all of them are broadband.
    if (f.duration < 0.13 && f.centroid > 3500) return "hat";
    if (f.duration < 0.7 && f.flatness > 0.12) return "snare";
    if (f.duration > 1.2) return "texture";
    return "perc";
  }

  /* Per-role treatment. `sends` and `duck` are read by the engine when it
   * builds the live graph; everything else is baked into the samples. */
  const RECIPES = {
    kick: {
      label: "kick",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 28, 0.7);
        DSP.biquad(x, sr, "peaking", 62, 1.2, 3.5);
        DSP.biquad(x, sr, "peaking", 400, 1, -2);
        DSP.biquad(x, sr, "lowpass", 7000, 0.7);
        DSP.saturate(x, 1.2);
        DSP.compress(x, sr, -14, 4, 4, 90, 2);
      },
      sends: { reverb: 0, delay: 0 },
      level: 0.85,
      duck: 0,
      tune: false,
    },
    snare: {
      label: "snare",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 170, 0.7);
        DSP.biquad(x, sr, "peaking", 3200, 0.9, 3);
        DSP.biquad(x, sr, "highshelf", 8000, 0.7, 2);
        DSP.saturate(x, 0.8);
        DSP.compress(x, sr, -16, 3.5, 3, 70, 2);
      },
      sends: { reverb: 0.18, delay: 0.05 },
      level: 0.62,
      duck: 0,
      tune: false,
    },
    hat: {
      label: "hat",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 450, 0.7);
        DSP.biquad(x, sr, "highshelf", 9000, 0.7, 2.5);
        DSP.compress(x, sr, -18, 2.5, 2, 40, 1);
      },
      sends: { reverb: 0.1, delay: 0.12 },
      level: 0.32,
      duck: 0,
      tune: false,
    },
    bass: {
      label: "bass",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 32, 0.7);
        DSP.biquad(x, sr, "peaking", 90, 1, 2);
        DSP.biquad(x, sr, "lowpass", 4500, 0.7);
        DSP.saturate(x, 1.5);
        DSP.compress(x, sr, -18, 4, 8, 120, 3);
      },
      sends: { reverb: 0, delay: 0 },
      level: 0.7,
      duck: 0.75,
      tune: true,
    },
    vocal: {
      label: "vocal",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 95, 0.7);
        DSP.biquad(x, sr, "peaking", 320, 1, -2.5);
        DSP.biquad(x, sr, "peaking", 3200, 0.9, 3);
        DSP.biquad(x, sr, "highshelf", 9000, 0.7, 1.5);
        DSP.compress(x, sr, -18, 3, 8, 90, 3);
        DSP.saturate(x, 0.4);
      },
      sends: { reverb: 0.3, delay: 0.28 },
      level: 0.6,
      duck: 0.25,
      tune: true,
    },
    chord: {
      label: "chord",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 60, 0.7);
        DSP.biquad(x, sr, "peaking", 500, 1, -1.5);
        DSP.biquad(x, sr, "lowpass", 13000, 0.7);
        DSP.compress(x, sr, -20, 2.5, 20, 150, 2);
      },
      sends: { reverb: 0.4, delay: 0.15 },
      level: 0.45,
      duck: 0.4,
      tune: true,
    },
    texture: {
      label: "texture",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 70, 0.7);
        DSP.biquad(x, sr, "lowpass", 12000, 0.7);
        DSP.compress(x, sr, -22, 2, 30, 200, 2);
      },
      sends: { reverb: 0.5, delay: 0.2 },
      level: 0.38,
      duck: 0.35,
      tune: false,
    },
    perc: {
      label: "perc",
      tone: function (x, sr) {
        DSP.biquad(x, sr, "highpass", 140, 0.7);
        DSP.biquad(x, sr, "peaking", 2500, 0.9, 2);
        DSP.compress(x, sr, -16, 3, 3, 60, 2);
      },
      sends: { reverb: 0.2, delay: 0.1 },
      level: 0.48,
      duck: 0,
      tune: false,
    },
  };

  // ------------------------------------------------------------- grid fitting

  // Powers of two only. A three-beat loop would walk against a four-beat bar
  // and drift out of the pattern within a couple of passes.
  const BEAT_CANDIDATES = [0.5, 1, 2, 4, 8, 16];

  /* Nearest musically sensible number of beats, and the stretch needed to get
   * there. Compared in log space so being 30% out is judged the same whether
   * the clip is long or short. */
  function beatFit(duration, bpm) {
    const beat = 60 / bpm;
    const beats = duration / beat;
    let best = BEAT_CANDIDATES[0];
    let bestErr = Infinity;
    for (let i = 0; i < BEAT_CANDIDATES.length; i++) {
      const err = Math.abs(Math.log2(BEAT_CANDIDATES[i] / beats));
      if (err < bestErr) { bestErr = err; best = BEAT_CANDIDATES[i]; }
    }
    return { beats: best, stretch: (best * beat) / duration };
  }

  // ------------------------------------------------------------------- main

  /* Semitone stack for a triad in the current scale. */
  function chordIntervals(scaleName) {
    const scale = SCALES[scaleName] || SCALES.minor;
    // The third and the fifth of the scale, which is what makes the chord
    // major or minor without anyone having to be told which they wanted.
    const third = scale.length > 2 ? scale[2] : 3;
    const fifth = scale.length > 4 ? scale[4] : 7;
    return [third, fifth];
  }

  /* The key's root, down where a kick or a bass note lives. */
  function rootFrequency(keyRoot, octave) {
    const midi = 12 * (octave === undefined ? 1 : octave) + 12 + (keyRoot || 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* The expensive half: clean the take up and work out what it is.
   *
   * Split out from the shaping so the instrument picker can re-shape the same
   * recording as many times as someone wants without paying for de-noising and
   * analysis on every press.
   */
  function prepare(input, options) {
    const opts = options || {};
    const sr = opts.sampleRate || 44100;
    const steps = [];

    let x = Float32Array.from(input);
    DSP.removeDC(x);

    if (opts.denoise !== false) {
      const before = DSP.rms(x);
      x = DSP.denoise(x, 1);
      const after = DSP.rms(x);
      const drop = 20 * Math.log10((before + 1e-9) / (after + 1e-9));
      if (drop > 0.4) steps.push("cleaned up the room");
    }

    if (opts.trim !== false) {
      const bounds = DSP.trimBounds(x, sr);
      if (bounds.start > 0 || bounds.end < x.length) {
        const cut = (x.length - (bounds.end - bounds.start)) / sr;
        x = x.slice(bounds.start, bounds.end);
        if (cut > 0.02) steps.push("trimmed " + cut.toFixed(2) + "s of dead air");
      }
    }
    if (x.length < 64) return null;

    // Analyse after cleaning: the guess should come from the sound itself, not
    // from whatever noise was sitting on top of it.
    const f = DSP.features(x, sr);
    const role = classify(f);
    return {
      samples: x,
      sampleRate: sr,
      features: f,
      guessRole: role,
      guess: Instrument.roleFor[role] || "perc",
      steps: steps,
    };
  }

  /* The other half: tune, fit, rebuild as the chosen instrument, shape, level.
   * Cheap enough to re-run while someone drags a slider.
   */
  function finish(prep, options) {
    const opts = options || {};
    const sr = prep.sampleRate;
    const bpm = opts.bpm || 120;
    const steps = prep.steps.slice();
    const f = prep.features;

    let x = Float32Array.from(prep.samples);

    // The instrument decides the role — a clap is a snare as far as the
    // arranger is concerned — except for "as recorded", which keeps whatever
    // the sound looked like so it still gets a sensible part.
    const instrumentName = opts.instrument || prep.guess;
    const instrument = Instrument.get(instrumentName) || Instrument.get("perc");
    const role = instrument.role || prep.guessRole;
    const recipe = RECIPES[role] || RECIPES.perc;
    // An instrument that was chosen gets rebuilt at its default strength; one
    // that was merely guessed does not. Auto-import and the scratch kit should
    // come out cleaned and shaped but still recognisably the recording — being
    // silently rebuilt as something else is a decision for a person to make.
    const chosen = !!opts.instrument;
    const morph = opts.morph !== undefined ? opts.morph : (chosen ? instrument.morph : 0);

    let beats = null;
    if (opts.fitGrid !== false && x.length / sr > 0.25 &&
        (role === "chord" || role === "texture" || role === "vocal")) {
      const fit = beatFit(x.length / sr, bpm);
      // Past roughly a quarter either way a stretch stops sounding like the
      // same sound, so a clip that is nowhere near the grid is left unfitted
      // and simply played as a one-shot.
      if (fit.stretch > 0.8 && fit.stretch < 1.28 && Math.abs(fit.stretch - 1) > 0.01) {
        x = DSP.fitToLength(x, Math.round((fit.beats * 60 * sr) / bpm));
        beats = fit.beats;
        steps.push("stretched to " + fit.beats + " beat" + (fit.beats === 1 ? "" : "s") + " at " + bpm);
      } else if (fit.stretch >= 0.99 && fit.stretch <= 1.01) {
        beats = fit.beats;
      }
    }

    let note = null;
    let shifted = 0;
    let tunedHz = 0;
    if (instrument.pitched && opts.tune !== false && f.pitchConfidence > 0.55 && f.pitch > 40) {
      const snap = snapToScale(f.pitch, opts.keyRoot || 0, opts.scale || "minor");
      if (Math.abs(snap.semitones) > 0.03 && Math.abs(snap.semitones) < 7) {
        x = DSP.pitchShift(x, snap.semitones);
        shifted = snap.semitones;
      }
      note = midiToNoteName(snap.midi);
      tunedHz = 440 * Math.pow(2, (snap.midi - 69) / 12);
      steps.push(Math.abs(shifted) < 0.03
        ? "already in tune at " + note
        : "tuned " + (shifted > 0 ? "up " : "down ") + Math.abs(shifted).toFixed(2) + " semitones to " + note);
    }

    // Rebuild it as the instrument: force the envelope, layer the synthesised
    // version underneath. This is the part EQ cannot do.
    if (morph > 0.005 && instrumentName !== "asis") {
      const before = x.length / sr;
      x = Instrument.shape(x, sr, instrumentName, {
        morph: morph,
        rootHz: rootFrequency(opts.keyRoot || 0, 1),
        pitchHz: tunedHz || f.pitch,
        chordIntervals: chordIntervals(opts.scale),
        seed: opts.seed === undefined ? 1 : opts.seed,
      });
      const after = x.length / sr;
      let line = "rebuilt it as a " + instrument.label.toLowerCase() +
        " (" + Math.round(morph * 100) + "%)";
      if (Math.abs(after - before) > 0.02) {
        line += ", " + before.toFixed(2) + "s → " + after.toFixed(2) + "s";
      }
      steps.push(line);
    }

    if (opts.tone !== false) {
      recipe.tone(x, sr);
      steps.push("shaped it like a " + recipe.label);
    }

    DSP.normalize(x, 0.89);
    // Short fades on both ends: a sample cut mid-cycle clicks, and a click on
    // every sixteenth is the fastest way to make a loop unlistenable.
    DSP.fadeEdges(x, sr, role === "kick" || role === "hat" ? 1 : 3, role === "hat" ? 4 : 12);
    steps.push("levelled it");

    return {
      samples: x,
      sampleRate: sr,
      role: role,
      instrument: instrumentName,
      instrumentLabel: instrument.label,
      morph: morph,
      guess: prep.guess,
      label: recipe.label,
      // A copy: a pad that edited this in place would change the recipe for
      // every other pad of the same role.
      sends: { reverb: recipe.sends.reverb, delay: recipe.sends.delay },
      // Where this role sits in a mix. The samples are all peak-normalised so
      // that pads feel consistent under a finger; balancing them against each
      // other is a separate job, and it is this fader that does it. Without it,
      // eight normalised sounds sum straight into the limiter.
      level: recipe.level,
      duck: recipe.duck,
      beats: beats,
      note: note,
      shifted: shifted,
      features: f,
      steps: steps,
    };
  }

  /* `input` is a Float32Array of mono audio. Options: sampleRate, bpm,
   * keyRoot (0-11), scale, instrument, morph, plus switches so the UI can turn
   * individual stages off. */
  function process(input, options) {
    const prep = prepare(input, options);
    if (!prep) return null;
    return finish(prep, options);
  }

  return {
    process: process,
    prepare: prepare,
    finish: finish,
    chordIntervals: chordIntervals,
    rootFrequency: rootFrequency,
    classify: classify,
    beatFit: beatFit,
    snapToScale: snapToScale,
    freqToMidi: freqToMidi,
    midiToNoteName: midiToNoteName,
    recipes: RECIPES,
    scales: SCALES,
    noteNames: NOTE_NAMES,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Polish;
