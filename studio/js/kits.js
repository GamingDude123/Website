/* Preset kits: something to play with before you have recorded anything.
 *
 * Every sound here is synthesised from scratch by `Instrument.render` — none of
 * it is sampled from a record or lifted from a commercial pack. What makes them
 * sound like the genre is not the samples anyway, it is the arrangement: the
 * open hat landing on the offbeat, the kick leaving the second and fourth beat
 * alone in garage, the bass rolling on the sixteenths under a tech house
 * groove. The patterns below are written out rather than generated for exactly
 * that reason.
 *
 * Each kit also brings its own tempo, key, swing and effect settings, because
 * the same drums at 124 with a long reverb and at 134 with hard swing are two
 * different records.
 */

var Kits = (function () {
  "use strict";

  // Sixteen sixteenths. 0 is silent, anything else is how hard it is hit.
  const K = {
    fourFloor: [1, 0, 0, 0, 0.92, 0, 0, 0, 0.96, 0, 0, 0, 0.92, 0, 0, 0],
    backbeat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    offbeats: [0, 0, 0.75, 0, 0, 0, 0.75, 0, 0, 0, 0.75, 0, 0, 0, 0.75, 0],
  };

  const KITS = [
    {
      id: "house",
      name: "Classic house",
      hint: "124 bpm · four on the floor, open hat on the offbeat, stab on the and",
      bpm: 124, keyRoot: 9, scale: "minor", swing: 0.06, genre: "house",
      master: { reverb: 0.32, delay: 0.24, sidechain: 0.55 },
      pads: [
        { name: "kick", voice: "kick", octave: 1, steps: K.fourFloor },
        { name: "clap", voice: "clap", steps: K.backbeat },
        { name: "hat", voice: "hat", level: 0.26,
          steps: [0.5, 0.3, 0.4, 0.3, 0.5, 0.3, 0.4, 0.3, 0.5, 0.3, 0.4, 0.3, 0.5, 0.3, 0.45, 0.35] },
        { name: "open hat", voice: "openhat", level: 0.3, steps: K.offbeats },
        // The stab is the sound of the genre: a triad with the filter shutting.
        { name: "stab", voice: "stab", octave: 3, notes: [0, 3, 7, 12],
          sends: { reverb: 0.42, delay: 0.3 },
          steps: [0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0] },
        { name: "sub", voice: "sub", octave: 1, tau: 0.3,
          steps: [1, 0, 0, 0, 0, 0, 0.8, 0, 0.95, 0, 0, 0, 0, 0, 0.8, 0] },
        { name: "rim", voice: "rim", level: 0.3,
          steps: [0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.55] },
      ],
    },

    {
      id: "tech",
      name: "Tech house",
      hint: "126 bpm · tight and dry, bass rolling on the sixteenths",
      bpm: 126, keyRoot: 9, scale: "minor", swing: 0.04, genre: "house",
      master: { reverb: 0.18, delay: 0.16, sidechain: 0.62 },
      pads: [
        { name: "kick", voice: "kick", octave: 1, steps: K.fourFloor },
        { name: "clap", voice: "clap", level: 0.5, steps: K.backbeat },
        { name: "hat", voice: "hat", level: 0.28,
          steps: [0.55, 0.3, 0.45, 0.3, 0.55, 0.3, 0.45, 0.35, 0.55, 0.3, 0.45, 0.3, 0.55, 0.3, 0.5, 0.4] },
        { name: "rim", voice: "rim", level: 0.34,
          steps: [0, 0, 0, 0.55, 0, 0, 0, 0, 0, 0, 0, 0.55, 0, 0, 0.5, 0] },
        // Offbeat sixteenths under a four-four kick: the roll that never sits
        // on the beat and never stops moving.
        { name: "bass", voice: "bass", octave: 1, tau: 0.13, filterTau: 0.05,
          steps: [0, 0, 0.85, 0, 0, 0, 0.85, 0, 0, 0, 0.85, 0, 0, 0, 0.85, 0] },
        { name: "blip", voice: "blip", octave: 3, level: 0.3,
          steps: [0, 0, 0, 0, 0, 0, 0, 0.55, 0, 0, 0, 0, 0, 0, 0, 0.5] },
        { name: "shaker", voice: "shaker", level: 0.22,
          steps: [0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35] },
      ],
    },

    {
      id: "garage",
      name: "UK garage",
      hint: "134 bpm · two-step and heavily swung, kick out of the way of the clap",
      bpm: 134, keyRoot: 9, scale: "minor", swing: 0.2, genre: "garage",
      master: { reverb: 0.36, delay: 0.32, sidechain: 0.48 },
      pads: [
        // Two-step: beats two and four are left to the clap, and the kick comes
        // back late. That gap is the whole feel.
        { name: "kick", voice: "kick", octave: 1,
          steps: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0, 0, 0] },
        { name: "clap", voice: "clap", steps: K.backbeat },
        { name: "hat", voice: "hat", level: 0.28,
          steps: [0, 0, 0.7, 0, 0, 0, 0.55, 0.4, 0, 0, 0.7, 0, 0, 0, 0.55, 0.45] },
        { name: "shaker", voice: "shaker", level: 0.2,
          steps: [0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0] },
        { name: "sub", voice: "sub", octave: 1, tau: 0.22,
          steps: [1, 0, 0, 0.7, 0, 0, 0.75, 0, 0, 0, 0.95, 0, 0, 0.7, 0, 0] },
        { name: "stab", voice: "stab", octave: 3, notes: [0, 3, 7],
          sends: { reverb: 0.45, delay: 0.35 },
          steps: [0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0] },
      ],
    },

    {
      id: "techno",
      name: "Techno",
      hint: "130 bpm · straight, no swing, long reverb on everything",
      bpm: 130, keyRoot: 0, scale: "minor", swing: 0, genre: "house",
      master: { reverb: 0.46, delay: 0.2, sidechain: 0.68 },
      pads: [
        { name: "kick", voice: "kick", octave: 1,
          steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
        { name: "open hat", voice: "openhat", level: 0.32, steps: K.offbeats },
        { name: "clap", voice: "clap", level: 0.5,
          steps: [0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0.5] },
        { name: "bass", voice: "bass", octave: 1, tau: 0.11, filterTau: 0.04, open: 1800,
          steps: [0.9, 0, 0.7, 0, 0.9, 0, 0.7, 0, 0.9, 0, 0.7, 0, 0.9, 0, 0.75, 0.6] },
        { name: "tom", voice: "tom", octave: 1, level: 0.34,
          steps: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.55] },
        { name: "blip", voice: "blip", octave: 3, level: 0.26,
          sends: { reverb: 0.5, delay: 0.4 },
          steps: [0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    },
  ];

  function byId(id) {
    for (let i = 0; i < KITS.length; i++) if (KITS[i].id === id) return KITS[i];
    return null;
  }

  /* Render every sound in a kit. Returns plain data — samples plus the settings
   * the pad should carry — and leaves it to the caller to put them on pads. */
  function build(kit, sampleRate) {
    return kit.pads.map(function (pad, index) {
      const voice = Instrument.voices[pad.voice];
      const rootHz = Polish.rootFrequency(kit.keyRoot, pad.octave === undefined ? 2 : pad.octave);
      const samples = Instrument.render(pad.voice, sampleRate, {
        rootHz: rootHz,
        pitchHz: rootHz,
        notes: pad.notes,
        tau: pad.tau,
        filterTau: pad.filterTau,
        open: pad.open,
        seconds: pad.seconds,
        // A fixed seed per pad, so a kit sounds the same every time it is
        // loaded and two hats in one kit are still different from each other.
        seed: index + 1,
      });
      return {
        name: pad.name,
        samples: samples,
        voice: pad.voice,
        role: voice.role,
        steps: pad.steps,
        level: pad.level,
        sends: pad.sends,
      };
    });
  }

  return {
    all: KITS,
    byId: byId,
    build: build,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Kits;
