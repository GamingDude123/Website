# Loop Lab

Sixteen pads. Hold an empty one to record into it; let go and the sound is on
the pad, cleaned up and playing. Tap pads to play them. Hit the red button and
whatever you play goes into the loop, snapped to the grid.

Open `studio/index.html` from a web server (the microphone needs `https://` or
`localhost`). No build step, no dependencies, no network calls.

## Playing it

| | |
| --- | --- |
| Hold an empty pad | records into it — no dialog, no questions |
| Tap a pad | plays it, on the way down |
| Hold a full pad | opens it |
| **MIC** | hold any pad to record over it, keeping the part it was playing |
| **●** | arms the loop: everything you tap gets written in, snapped to the nearest sixteenth |
| **FILTER** / **ROLL** | work while you hold them |
| Open a pad → **Chop** | slices it across the empty pads at its transients |

Nothing that makes a sound asks a question first. The pad guesses what you
recorded and gets on with it; the pad editor is where you disagree with it.

Without a microphone: **⚙ → Scratch kit** loads six takes made deliberately
rough — room hiss, a second of dead air, two of them out of tune — so the
**Polished / Raw take** switch in the pad editor has something honest to show.

## What "it edits for you" actually means

It is signal processing, not a language model. There is no server, no API key
and nothing is uploaded — which is also why it is instant and works offline. The
maths lives in `js/dsp.js`; the decisions live in `js/polish.js`.

Per take, in order:

| Stage | What happens | When it does nothing |
| --- | --- | --- |
| De-noise | The quietest frames become a per-frequency noise profile, subtracted with a smoothed spectral mask | The take is one held sound with no gaps, so there is no separable floor |
| Trim | Short-time RMS against a threshold relative to both the peak and the room floor, keeping ~6 ms of pre-roll | The whole take is above the threshold |
| Listen | Duration, spectral centroid, flatness, band ratios and YIN pitch confidence pick one of eight roles | — |
| Tune | The fundamental is moved to the nearest note of the key, pitch shifted (resample + WSOLA) so the length is unchanged | The sound is percussive, already in tune, or more than 7 semitones away |
| Fit the grid | Time-stretched to the nearest power-of-two number of beats at the current tempo | The stretch needed is beyond 0.8–1.28×, where it stops sounding like the same sound |
| Rebuild | The instrument you picked is imposed: its envelope is forced onto the recording and a synthesised version is layered underneath | You left the strength at 0, or picked "as recorded" |
| Shape | Role-specific EQ, saturation and compression | — |
| Level | Peak normalise, plus the fader position for that role in a mix | — |

Then the arranger (`js/patterns.js`) gives each pad a part from the chosen feel,
the kick ducks everything else under it, and the master bus runs glue
compression, a limiter and a soft clipper.

## Rebuilding a pad as an instrument

Open a pad and change **Rebuild as**. The take is rebuilt as that instrument
rather than just filtered like one — a hi-hat, a kick, a clap, a sub, whatever —
and plays back straight away so you can hear it. **How much** crossfades between
your recording and the instrument.

Filtering alone cannot do this. What tells your ear "that is a kick" is mostly
the shape of the sound in time: a 2 ms attack, a pitch that falls off a cliff in
the first 30 ms, and silence by 400 ms. No EQ gives a two-second mouth noise
that shape. So `js/instrument.js` does two things per instrument:

- **Forces the envelope.** The recording's natural loudness shape is divided out
  and the instrument's is multiplied in, which is what turns a 1.2 s hiss into
  an 80 ms hi-hat. Both sides are raised to the morph amount, so it fades
  continuously from untouched to completely reshaped.
- **Layers a synthesised instrument underneath.** A sine whose pitch collapses
  onto the key's root plus a beater click for a kick; two body tones and a band
  of wire noise for a snare; four noise bursts staggered a few milliseconds
  apart for a clap; six square waves at deliberately unmusical ratios, filtered
  hard and cut off almost at once, for a hat — the way the 808 did it; an
  oscillator following your own phrasing for a bass; and for a chord, your note
  stacked with pitch-shifted copies of itself into a triad in the key.

What survives of your recording is its attack and its timbre, which is the part
that makes it yours. A "tss" rebuilt as a kick keeps 3.7% of its high end,
down from 81%.

Instruments that were only *guessed* are never rebuilt behind your back — the
strength stays at 0 until you move it. Everything that lands on a pad is
cleaned, trimmed and mixed, but left recognisably the thing you recorded.

## Notes on the tricky parts

**Time stretching.** WSOLA, in `DSP.timeStretch`. The search window is centred
on the ideal analysis position, which advances by a fixed hop regardless of
where the previous match landed. Anchoring on the previous match instead — the
obvious way to write it — lets the pointer stall at large stretch factors: the
best match is consistently a full synthesis hop ahead, the pointer stops
progressing, runs off the end of the input, and the tail gets repeated at a hop
that phase-locks the output to a wrong pitch. It sounds fine and measures a
semitone sharp.

**Overlap-add edges.** Hann-squared frames at a quarter-frame hop sum to 1.5 in
the body of a buffer, so dividing by that sum restores unity gain — but the
first and last half-frame are covered by one window only, where the sum tapers
to zero. Dividing there amplifies by 1/w: a 0.5-peak signal came back with a
peak of 42, which is also enough to make the pitch detector read the spike
instead of the note. The divisor is floored, and the edges are left as a short
natural fade.

**Noise profiles.** Averaging the quietest frames is right, but deciding
*whether to subtract at all* needs the gap between the floor and the loud part
of the take — not the median frame. A one-shot can occupy well under half a
clip, which makes the median itself silence and hides the gap completely.

**Master gain staging.** Samples are peak-normalised so pads feel consistent
under a finger, which means balancing them against each other has to be a
separate step. Without per-role fader levels, eight normalised sounds sum
straight into the limiter. And glue compression set low enough to work
continuously flattens the bar into a wall — measured as a crest factor of 5 dB,
against 9-10 dB for the same pattern with the compressor only catching peaks.

**The final clipper.** `DynamicsCompressorNode` has no look-ahead, so the first
millisecond of a transient goes straight past it. The last stage is a fixed
`y = 0.98·tanh(1.3x)` curve, which cannot leave ±0.98 however hard it is driven.

**Recording.** The microphone is requested with `echoCancellation`,
`noiseSuppression` and `autoGainControl` all off. They are tuned for phone calls
and they wreck a sample — ducking the tail of a hit and pumping the room tone up
between sounds. The de-noise pass does that job afterwards with the whole
recording to look at rather than a 20 ms window.

**The bounce is a render, not a recording.** `buildBus` and `trigger` both take
the context as an argument, so **Bounce WAV** runs the same code against an
`OfflineAudioContext`. The file is what you were listening to, rendered faster
than real time.

## Files

| File | |
| --- | --- |
| `js/dsp.js` | FFT, YIN pitch detection, spectral de-noise, WSOLA stretch and pitch shift, biquads, compressor, feature extraction, WAV encoding. Pure functions — no `AudioContext`, runs under a test runner |
| `js/polish.js` | The pipeline, the role classifier, the per-role recipes, scales and grid fitting |
| `js/instrument.js` | The instrument catalogue, envelope imposition, and the synthesised layers |
| `js/patterns.js` | Pattern templates per feel, and the arranger |
| `js/engine.js` | Graph, transport, sidechain, offline bounce |
| `js/record.js` | Microphone capture and file decoding |
| `js/recorder-worklet.js` | The capture worklet |
| `js/demokit.js` | The scratch kit |
| `js/store.js` | IndexedDB persistence (pads as WAV blobs) |
| `js/ui.js` | The pad grid, the gestures, live capture, chopping, the sheets |

## Tests

```sh
node studio/test/dsp.test.js         # signal processing, no browser needed
node studio/test/polish.test.js      # the pipeline and its decisions
node studio/test/instrument.test.js  # the rebuilds, measured
node studio/test/browser.test.js     # the real page in a real browser
```

See `test/README.md`. The first two run under plain node, which is why
`js/dsp.js` and `js/polish.js` never touch an `AudioContext`.

## Keyboard

`Space` plays and stops. `1234567890qwerty` fire the sixteen pads. `Esc` closes
a sheet. Audio files can be dropped anywhere on the page.
