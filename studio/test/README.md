# Tests

```sh
node studio/test/dsp.test.js        # signal processing, no browser needed
node studio/test/polish.test.js     # the pipeline and its decisions
node studio/test/browser.test.js    # the real page in a real browser
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
localhost is one), loads the scratch kit, checks that each take was classified
and edited correctly, records from chromium's fake audio device, plays the
pattern, bounces a WAV and measures it, then reloads the page to confirm the kit
came back. Set `CHROMIUM=/path/to/chrome` if playwright cannot find a browser
on its own. Screenshots and the bounced WAV are left in a temp directory, which
it prints when it finishes.

Three of the bugs these caught, as a flavour of what they are for:

- A hidden `.sheet` overlay still covered the whole page, because `display: flex`
  outranks the `hidden` attribute. Every tap was being swallowed.
- The overlap-add in the time stretcher divided by a near-zero window sum at the
  buffer edges, so a 0.5-peak signal came back peaking at 42.
- Stopping the transport mid-sidechain-duck left the mix 45% quieter for good.
