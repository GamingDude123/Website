/* Writing the pattern for you.
 *
 * Once every pad knows what it is, a bar of music is mostly a lookup: kicks go
 * on the pulse, claps answer on the backbeat, hats fill the gaps, and the
 * two-step patterns leave the second and fourth beats open, which is what
 * makes garage feel like it is leaning forward.
 *
 * Each entry is 16 sixteenth-notes of velocity, 0 meaning silent. Every role
 * has several variants so pressing the button again gives a different take
 * rather than the same bar back.
 */

var Patterns = (function () {
  "use strict";

  const GENRES = {
    garage: {
      name: "UK garage",
      hint: "two-step, swung, kick out of the way of the clap",
      swing: 0.18,
      bpm: 132,
      patterns: {
        kick: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0.45, 0, 0, 0.95, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0, 0.5, 0],
        ],
        snare: [
          [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
          [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.5],
          [0, 0, 0, 0, 1, 0, 0, 0.4, 0, 0, 0, 0, 1, 0, 0, 0],
        ],
        hat: [
          [0, 0, 0.75, 0, 0, 0, 0.6, 0.4, 0, 0, 0.75, 0, 0, 0, 0.6, 0.45],
          [0.5, 0, 0.7, 0, 0.45, 0, 0.7, 0, 0.5, 0, 0.7, 0, 0.45, 0, 0.7, 0.4],
          [0, 0, 0.8, 0, 0, 0.35, 0.6, 0, 0, 0, 0.8, 0, 0, 0.35, 0.6, 0],
        ],
        bass: [
          [1, 0, 0, 0.7, 0, 0, 0.75, 0, 0, 0, 1, 0, 0, 0.7, 0, 0],
          [1, 0, 0, 0, 0, 0.7, 0, 0, 0.9, 0, 0, 0.7, 0, 0, 0.75, 0],
          [1, 0, 0.6, 0, 0, 0, 0.8, 0, 0, 0, 0.95, 0, 0.6, 0, 0, 0],
        ],
        vocal: [
          [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0.65, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0.6, 0],
          [1, 0, 0, 0.6, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
        ],
        chord: [
          [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0],
        ],
        texture: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        perc: [
          [0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0.55, 0, 0.45],
          [0, 0, 0, 0.5, 0, 0, 0, 0.4, 0, 0.5, 0, 0, 0, 0, 0, 0.5],
        ],
      },
    },

    house: {
      name: "House",
      hint: "four on the floor, offbeat hats",
      swing: 0.05,
      bpm: 124,
      patterns: {
        kick: [
          [1, 0, 0, 0, 0.9, 0, 0, 0, 0.95, 0, 0, 0, 0.9, 0, 0, 0],
          [1, 0, 0, 0, 0.9, 0, 0, 0.45, 0.95, 0, 0, 0, 0.9, 0, 0, 0],
        ],
        snare: [
          [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
          [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.55, 1, 0, 0, 0],
        ],
        hat: [
          [0, 0, 0.75, 0, 0, 0, 0.8, 0, 0, 0, 0.75, 0, 0, 0, 0.85, 0],
          [0.5, 0, 0.7, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.7, 0, 0.5, 0, 0.85, 0],
        ],
        bass: [
          [1, 0, 0, 0, 0, 0, 0.8, 0, 1, 0, 0, 0, 0, 0, 0.8, 0],
          [1, 0, 0, 0.7, 0, 0, 0.8, 0, 0.95, 0, 0, 0.7, 0, 0, 0.8, 0],
        ],
        vocal: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
        ],
        chord: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0],
        ],
        texture: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        perc: [
          [0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0.5, 0],
          [0, 0.45, 0, 0, 0, 0.5, 0, 0, 0, 0.45, 0, 0, 0, 0.5, 0, 0],
        ],
      },
    },

    breaks: {
      name: "Breaks",
      hint: "chopped drums, snare on the run",
      swing: 0.09,
      bpm: 142,
      patterns: {
        kick: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0, 0, 0],
          [1, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0, 0.6, 0],
        ],
        snare: [
          [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0.85, 0],
          [0, 0, 0, 0, 1, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0.6],
        ],
        hat: [
          [0.6, 0, 0.5, 0, 0.6, 0, 0.5, 0, 0.6, 0, 0.5, 0, 0.6, 0, 0.5, 0.4],
          [0, 0.4, 0.7, 0, 0, 0.4, 0.7, 0, 0, 0.4, 0.7, 0, 0, 0.4, 0.7, 0],
        ],
        bass: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0.7, 0, 0, 0.9, 0, 0, 0, 0, 0.7, 0, 0],
        ],
        vocal: [
          [1, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0],
        ],
        chord: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0]],
        texture: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        perc: [[0, 0, 0.5, 0, 0, 0, 0, 0.45, 0, 0.5, 0, 0, 0, 0, 0.5, 0]],
      },
    },

    halftime: {
      name: "Half time",
      hint: "slow and wide, space between the hits",
      swing: 0.02,
      bpm: 88,
      patterns: {
        kick: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0],
        ],
        snare: [
          [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0.5, 0],
        ],
        hat: [
          [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
          [0, 0, 0.5, 0, 0.7, 0, 0, 0, 0, 0, 0.5, 0, 0.7, 0, 0, 0.4],
        ],
        bass: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0.8, 0, 0, 0],
        ],
        vocal: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        chord: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        texture: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        perc: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.45]],
      },
    },
  };

  const STEPS = 16;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rotate(pattern, by) {
    const out = new Array(STEPS);
    for (let i = 0; i < STEPS; i++) out[i] = pattern[(i - by + STEPS * 2) % STEPS];
    return out;
  }

  /* Give every pad a part.
   *
   * `pads` is an array of { id, role, beats }. Returns the swing for the genre
   * and one 16-step row per pad. Long loops that were fitted to the grid get a
   * single trigger instead of a pattern — retriggering a two-bar pad every
   * sixteenth would just be a stutter.
   */
  function arrange(pads, genreName, seed) {
    const genre = GENRES[genreName] || GENRES.garage;
    const rand = mulberry32(seed === undefined ? 1 : seed);
    const rows = {};
    const usedByRole = {};

    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      const variants = genre.patterns[pad.role] || genre.patterns.perc;
      const seen = usedByRole[pad.role] || 0;
      usedByRole[pad.role] = seen + 1;

      if (pad.beats && pad.beats >= 2) {
        const row = new Array(STEPS).fill(0);
        row[0] = 1;
        rows[pad.id] = { steps: row, loop: true };
        continue;
      }

      // A second pad in the same role takes a different variant, and if the
      // variants run out it gets shifted off the first one so the two
      // interlock instead of doubling up.
      let choice = Math.floor(rand() * variants.length);
      if (seen > 0) choice = (choice + seen) % variants.length;
      let steps = variants[choice].slice();
      if (seen >= variants.length) steps = rotate(steps, 2 * seen);

      // Nudge the velocities so a bar does not read as a straight line.
      for (let s = 0; s < STEPS; s++) {
        if (!steps[s]) continue;
        const jitter = 1 + (rand() - 0.5) * 0.16;
        steps[s] = Math.max(0.15, Math.min(1, steps[s] * jitter));
      }
      rows[pad.id] = { steps: steps, loop: false };
    }

    return { swing: genre.swing, bpm: genre.bpm, rows: rows, genre: genreName };
  }

  return {
    genres: GENRES,
    steps: STEPS,
    arrange: arrange,
    rotate: rotate,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Patterns;
