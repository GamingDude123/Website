/* Demo tracks, so the booth has something to play before you bring your own.
 *
 * Each one is a small tech-house arrangement rendered sample by sample: an
 * intro of kick and hats, a breakdown with a riser and a snare roll, a drop,
 * a second breakdown, a bigger drop and a drum-only outro. The structure is
 * written down in `truth`, which is what the tests hold the analyser to.
 *
 * Pure (no AudioContext) so it runs in node.
 */

var Synth = (function () {
  "use strict";

  const SR = 32000;

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

  const hz = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  function camelot(pc, mode) {
    const major = mode === "major" ? pc : (pc + 3) % 12;
    return (((major * 7) % 12 + 7) % 12 + 1) + (mode === "major" ? "B" : "A");
  }

  // Chord roots, in semitones above the tonic, for four bars.
  const PROGRESSION = { minor: [0, 0, 5, 7], major: [0, 0, 5, 7] };
  const THIRD = { minor: 3, major: 4 };
  const BASS_PATTERNS = [
    [0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
    [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1],
    [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0],
  ];

  function makeKick(sr, punch) {
    const n = Math.floor(sr * 0.42);
    const k = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 44 + (150 + punch * 60) * Math.exp(-t / 0.028);
      phase += 2 * Math.PI * f / sr;
      const amp = Math.exp(-t / (0.16 + 0.03 * punch));
      k[i] = Math.sin(phase) * amp + (t < 0.004 ? 0.35 * (1 - t / 0.004) : 0);
    }
    return k;
  }

  function makeNoiseHit(sr, seconds, decay, hp, rand) {
    const n = Math.floor(sr * seconds);
    const h = new Float32Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const w = rand() * 2 - 1;
      h[i] = (w - prev * hp) * Math.exp(-(i / sr) / decay);   // crude high-pass: tilts the noise bright
      prev = w;
    }
    return h;
  }

  function makeClap(sr, rand) {
    const n = Math.floor(sr * 0.22);
    const c = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const bursts = (t < 0.09) ? (0.5 + 0.5 * Math.sin(2 * Math.PI * 95 * t)) : 1;
      lp += 0.35 * ((rand() * 2 - 1) - lp);
      c[i] = lp * bursts * Math.exp(-t / 0.05);
    }
    return c;
  }

  function add(out, buf, at, gain) {
    if (at >= out.length) return;
    const n = Math.min(buf.length, out.length - at);
    for (let i = 0; i < n; i++) out[at + i] += buf[i] * gain;
  }

  // spec: { bpm, root (midi tonic), mode, seed, offset, layout, punch }
  function renderTrack(spec) {
    const sr = spec.sampleRate || SR;
    const mode = spec.mode || "minor";
    const rand = rng(spec.seed || 1);
    const beat = 60 / spec.bpm, bar = beat * 4, step = beat / 4;
    const layout = spec.layout || [["intro", 16], ["break", 8], ["drop", 16], ["break", 8], ["drop", 16], ["outro", 16]];
    const offset = spec.offset || 0;
    const totalBars = layout.reduce(function (u, s) { return u + s[1]; }, 0);
    const length = Math.ceil((offset + totalBars * bar + 1.5) * sr);
    const drums = new Float32Array(length);
    const music = new Float32Array(length);       // everything that ducks under the kick
    const kickSamples = [];

    const kick = makeKick(sr, spec.punch || 0);
    const hatC = makeNoiseHit(sr, 0.04, 0.012, 0.92, rand);
    const hatO = makeNoiseHit(sr, 0.16, 0.05, 0.92, rand);
    const shaker = makeNoiseHit(sr, 0.05, 0.02, 0.6, rand);
    const clap = makeClap(sr, rand);
    const crash = makeNoiseHit(sr, 1.6, 0.5, 0.9, rand);
    const snare = makeNoiseHit(sr, 0.14, 0.05, 0.4, rand);
    const bassPattern = BASS_PATTERNS[(spec.seed || 1) % BASS_PATTERNS.length];
    const prog = PROGRESSION[mode];
    const at = function (bars, beats) { return Math.round((offset + bars * bar + beats * beat) * sr); };

    const truth = { sections: [], bars: totalBars };
    let b0 = 0;
    layout.forEach(function (sec, secIndex) {
      const type = sec[0], bars = sec[1];
      truth.sections.push({ type: type, start: b0, end: b0 + bars });
      for (let b = 0; b < bars; b++) {
        const gb = b0 + b;
        const chord = spec.root + prog[gb % 4];
        const fromEnd = bars - b;                       // 1 on the last bar of the section
        const hasKick = type === "intro" || type === "drop" || type === "outro";
        const isBuild = type === "break" && fromEnd <= 4;
        const level = type === "outro" ? Math.max(0.4, 1 - b / (bars * 1.4)) : 1;

        if (hasKick) {
          for (let j = 0; j < 4; j++) { const s = at(gb, j); add(drums, kick, s, 0.95 * level); kickSamples.push(s); }
          for (let j = 0; j < 4; j++) add(drums, hatO, at(gb, j + 0.5), (type === "drop" ? 0.22 : 0.16) * level);
          if (type !== "intro" || b >= 8) for (let s = 0; s < 16; s++) if (s % 2 === 1 || type === "drop") add(drums, hatC, at(gb, s / 4), 0.07 * level);
          if (type !== "outro" || b < bars - 4) for (let s = 0; s < 16; s++) if (s % 4 === 3) add(drums, shaker, at(gb, s / 4), 0.08 * level);
        }
        if (type === "drop" || (type === "outro" && b < 8) || (type === "intro" && b >= 12)) {
          add(drums, clap, at(gb, 1), 0.45 * level); add(drums, clap, at(gb, 3), 0.45 * level);
        }
        if (type === "drop" && b === 0) add(drums, crash, at(gb, 0), 0.3);

        // bass: a rolling off-beat line, drops only
        if (type === "drop") {
          const f0 = hz(chord);
          for (let s = 0; s < 16; s++) {
            if (!bassPattern[s]) continue;
            const start = at(gb, s / 4), len = Math.round(step * 0.82 * sr);
            let ph = 0, lp = 0;
            for (let i = 0; i < len && start + i < length; i++) {
              const t = i / sr;
              ph += f0 / sr; if (ph > 1) ph -= 1;
              lp += (0.05 + 0.25 * Math.exp(-t / 0.07)) * ((2 * ph - 1) - lp);
              const env = Math.min(1, t / 0.004) * Math.min(1, (len - i) / (0.01 * sr));
              music[start + i] += (lp * 0.55 + Math.sin(2 * Math.PI * f0 * t) * 0.6) * env * 0.5;
            }
          }
          // stabs on the "and" of 2 and 4
          const notes = [chord + 12, chord + 12 + THIRD[mode], chord + 19];
          [1.5, 3.5].concat(b % 2 ? [2.75] : []).forEach(function (bt) {
            const start = at(gb, bt), len = Math.round(0.22 * sr);
            notes.forEach(function (nn, ni) {
              const f = hz(nn) * (1 + 0.003 * (ni - 1));
              let ph = rand();
              for (let i = 0; i < len && start + i < length; i++) {
                ph += f / sr; if (ph > 1) ph -= 1;
                music[start + i] += (2 * ph - 1) * Math.exp(-(i / sr) / 0.07) * 0.06;
              }
            });
          });
        }
        // pads in breaks and the intro's tail
        if (type === "break" || (type === "intro" && b >= 8)) {
          const notes = [chord + 24, chord + 24 + THIRD[mode], chord + 31];
          const start = at(gb, 0), len = Math.round(bar * sr);
          notes.forEach(function (nn) {
            const f = hz(nn);
            for (let d = -1; d <= 1; d += 2) {
              let ph = rand();
              const ff = f * (1 + 0.004 * d);
              let lp = 0;
              for (let i = 0; i < len && start + i < length; i++) {
                ph += ff / sr; if (ph > 1) ph -= 1;
                lp += 0.09 * ((2 * ph - 1) - lp);
                music[start + i] += lp * 0.055 * Math.min(1, i / (0.3 * sr)) * (type === "intro" ? 0.6 : 1);
              }
            }
          });
        }
        // riser and snare roll leading into the drop
        if (isBuild) {
          const start = at(gb, 0), len = Math.round(bar * sr);
          const base = (4 - fromEnd) / 4;
          let lp = 0;
          for (let i = 0; i < len && start + i < length; i++) {
            const t = base + i / len / 4;
            lp += (0.02 + 0.55 * t * t) * ((rand() * 2 - 1) - lp);
            drums[start + i] += (rand() * 2 - 1) * 0.03 * t + lp * 0.18 * t;
          }
          if (fromEnd <= 2) {
            const per = fromEnd === 2 ? 0.5 : 0.25;
            for (let j = 0; j < 4 / per; j++) add(drums, snare, at(gb, j * per), 0.12 + 0.2 * (j * per / 4 + (2 - fromEnd) * 0.5));
          }
        }
        // a lead arpeggio in the last drop makes it the bigger one
        if (type === "drop" && secIndex >= 4) {
          const arp = [0, 7, 12, 15, 12, 7, 0, 7];
          for (let s = 0; s < 8; s++) {
            const f = hz(chord + 36 + arp[s] + (mode === "major" && arp[s] === 15 ? 1 : 0));
            const start = at(gb, s / 2), len = Math.round(beat * 0.45 * sr);
            let ph = 0;
            for (let i = 0; i < len && start + i < length; i++) {
              ph += f / sr; if (ph > 1) ph -= 1;
              music[start + i] += (Math.abs(4 * ph - 2) - 1) * Math.exp(-(i / sr) / 0.14) * 0.07;
            }
          }
        }
      }
      b0 += bars;
    });

    // Sidechain: everything that is not drums breathes around the kick.
    const out = new Float32Array(length);
    let kIdx = 0, lastKick = -1;
    for (let i = 0; i < length; i++) {
      while (kIdx < kickSamples.length && kickSamples[kIdx] <= i) { lastKick = kickSamples[kIdx]; kIdx++; }
      const t = lastKick < 0 ? 1 : (i - lastKick) / sr;
      const duck = 1 - 0.75 * Math.exp(-t / 0.11);
      out[i] = Math.tanh((drums[i] + music[i] * duck) * 1.25) * 0.8;
    }

    const pc = ((spec.root % 12) + 12) % 12;
    truth.bpm = spec.bpm;
    truth.offset = offset;
    truth.pc = pc;
    truth.mode = mode;
    truth.camelot = camelot(pc, mode);
    truth.firstDrop = truth.sections.filter(function (s) { return s.type === "drop"; })[0].start;
    return { samples: out, sampleRate: sr, truth: truth, title: spec.title, artist: spec.artist };
  }

  const DEMOS = [
    { title: "Midnight Warehouse", artist: "Demo Set", bpm: 126, root: 33, mode: "minor", seed: 11, offset: 0.21, punch: 0 },
    { title: "Chrome Hearts", artist: "Demo Set", bpm: 127, root: 40, mode: "minor", seed: 12, offset: 0.05, punch: 1 },
    { title: "Basement Sun", artist: "Demo Set", bpm: 125, root: 38, mode: "minor", seed: 13, offset: 0.33, punch: 0.5 },
    { title: "Neon Static", artist: "Demo Set", bpm: 128, root: 31, mode: "major", seed: 14, offset: 0.12, punch: 1, layout: [["intro", 16], ["break", 8], ["drop", 16], ["break", 8], ["drop", 24], ["outro", 16]] },
  ];

  return { renderTrack: renderTrack, DEMOS: DEMOS, SR: SR };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Synth;
