# Tests

```sh
node studio/test/dsp.test.js         # signal processing, no browser needed
node studio/test/polish.test.js      # the pipeline and its decisions
node studio/test/instrument.test.js  # the instrument rebuilds, measured
node studio/test/browser.test.js     # the real page in a real browser
```

`dsp.test.js` and `polish.test.js` need nothing but node — that is the reason
those two files avoid `AudioContext` entirely. They check the maths against
signals with known answers: a 220 Hz sine still reads as 220 Hz after being
stretched to twice its length, a pitch shift of seven semitones lands within a
couple of cents, de-noising a burst surrounded by room tone drops the floor
without touching the burst, and a held note with no silence in it comes back
unchanged.

`browser.test.js` needs playwright and a chromium:

```sh
npm i -D playwright && npx playwright install chromium
```

It serves the site on a local port (the microphone needs a secure context, and
localhost is one) and then plays the thing: presses and holds pads to record
into them from chromium's fake audio device, taps them to check they fire
without opening anything, holds one to open its editor, rebuilds it as a hi-hat
and then a kick, arms the loop and taps out a performance to check the hits land
on the right rows, holds the FX buttons, records over a full pad to check it
keeps its part, chops a take across the empty pads, bounces a WAV and measures
it, and reloads to confirm the kit comes back where it was. It also checks the
layout itself — sixteen pads, thumb-sized, no scrolling, the grid owning the
screen.

Set `CHROMIUM=/path/to/chrome` if playwright cannot find a browser on its own.
Screenshots and the bounced WAV are left in a temp directory, printed at the
end.

Some of the bugs these caught, as a flavour of what they are for:

- A hidden `.sheet` overlay still covered the whole page, because `display: flex`
  outranks the `hidden` attribute. Every tap was being swallowed.
- The overlap-add in the time stretcher divided by a near-zero window sum at the
  buffer edges, so a 0.5-peak signal came back peaking at 42.
- Stopping the transport mid-sidechain-duck left the mix 45% quieter for good.
- Recording over a pad inherited the part it was playing and then immediately
  overwrote it with a freshly generated one.
- The time-stretch length blend was linear, so a 1.6 s take was still 0.6 s long
  at 85% "make this a hi-hat".
