# Autopilot DJ

Drop in tracks and it plays them as a club-style tech-house set: beatmatched,
key-aware, with bass swaps, drop swaps, vinyl brakes, spinbacks, filter builds,
loop rolls and echo throws, all decided and scheduled for you. The decks are
turntables you can grab, Pause stops them like a DJ would, it drops sound effects
in on its own, and it can take the vocals out of a track, or keep only the vocals.

Open `dj/index.html` from a web server (`localhost` or `https://`). No build
step, no dependencies, nothing uploaded. **Add demo tracks** gives you four
generated tracks to hear it straight away; **Add your files** takes anything the
browser can decode.

## What it is, and isn't

It is signal processing and rules, not a neural network or a language model. It
copies the *techniques* of club DJing — phrase-matched mixing, bass swaps,
swapping on the drop, building with filters and rolls. It does not have taste,
read a crowd, or choose tracks the way a person with years of records does, so
"John Summit level" is a description of the moves, not a claim about the
artist. Treat the planner as a very tidy resident DJ.

## How it works

| Stage | File | What happens |
| --- | --- | --- |
| Listen | `js/analysis.js` | Band-split onset strength → autocorrelation → comb filter for tempo and beat phase; downbeat from claps on 2/4 plus where the music changes; per-bar kick presence, level between kicks and rhythmic density to find intro / break / drop / outro; chromagram (kick-gated, peaks only) against Albrecht–Shanahan key profiles, shown as a Camelot code |
| Choose | `js/brain.js` | Next track by harmonic fit, tempo distance and the energy arc; then a move from what the two tracks allow (below) |
| Lock | `js/timeline.js`, `js/engine.js` | Both decks follow one tempo curve, so bar lines stay aligned while tempo glides to the incoming track's own. The glide's duration is solved so the outgoing deck reaches the swap bar exactly as it ends |
| Perform | `js/engine.js` | EQ kills and swaps, filter sweeps, echo throws, loop rolls, risers and impacts — every event placed on the audio clock ahead of time |

The moves:

- **Bass swap** — the incoming intro rides over the outgoing outro with its low
  end cut; the basslines trade places on the bar where the incoming drop lands.
  Needs keys that fit and tempos within the blend limit. A track with no
  detected intro still gets one: its first eight bars are used. Two variations
  (under *Creative moves*, on by default):
  - **Filter swap** — the outgoing track closes down through a low-pass (into
    reverb) as the incoming one opens up from a high-pass.
  - **Vocal mashup** — when the outgoing track has an instrumental ending and the
    incoming one opens with a vocal, the vocal comes in alone over the
    instrumental and its instruments join over the last two beats.
- **Drop swap** — the outgoing breakdown builds (high-pass closing, riser, a
  loop roll in the last bar, echo throw) and the incoming drop lands on the one.
  With no detected drop it cuts on a phrase line instead. It overlaps the two
  tracks for an instant only, so a key clash does not stop it (a *Strict* DJ
  still minds), and when the tempos are too far apart the new track simply
  lands at its own tempo.
- **Vinyl brake** — the outgoing deck winds down like a stopped record over its
  last two beats, pitch falling with it, and the next track lands on the one.
- **Spinback** — the last beat is wound backwards, fast and slowing, as the next
  track lands on the one.
- **Stutter cut** — a gate chops the last two beats (eighths, sixteenths,
  thirty-seconds) and the next track lands on the one.
- **Echo out** — echo throw, cut on the downbeat, the new track starts clean.

The last four need no key or tempo match. They used to be one move — echo out
— which is what a library of mixed keys and tempos got every time. Now a pair
that cannot blend draws from all of them (weighted by style, flair and energy, and
the same pair always draws the same), and even a pair that could blend now and
then takes a clean exit so the set does not repeat itself. *Vinyl brakes &
spinbacks* and *Creative moves* can be switched off under *Moves*; *Smooth* style
rarely brakes and never spins back or stutters.

Every decision is written in plain words in the strip under the decks and in the
log.

## Vibes and the AI settings

Pick a **vibe** under the decks and it sets everything at once: Let the AI
decide, Warehouse, Main stage, Late night, Sunrise or Open. **Fine-tune** under
*Details* opens the individual settings: style of mix, blend length, bass swap
style, how long each track plays, variety, energy arc, key strictness, how far
apart tempos may be, how the next track is chosen, flair, echo and reverb
amounts, and which effects are allowed. Changing one by hand switches the vibe to
*Custom*. Settings are remembered in your browser.

**Auto-tune** (on by default) is the automix: for each transition it nudges the
flair, play time and bass-swap style to suit the two tracks — a smooth blend
for a gentle step, a hard swap when the key matches and the energy jumps. It
writes what it changed into the reason text. The preview and the live mix use
the same seeded choices, so what you preview is what plays.

## Effects

Everything is generated, nothing is sampled: a swept-noise **riser** with a
rising pulse, a sub **impact** on the drop, a soft **crash** and a **downlifter**
on exits, plus loop rolls and echo throws. Faders and EQ follow smooth curves,
and the bass swap is equal-power so the low end never dips or doubles. Turn any
of it off under *Effects*. Even a plain blend gets a hit where the basslines
trade (softer when the energy does not rise) once flair is about 40% or more.

The **effects strip** under the decks is always on show: twelve pads. Each lights
while its effect sounds and is outlined while the transition that is lined up (or
the one previewed) will use it, and the booth pulses on a hit. Tapping a pad acts on
the next beat. Echo, Filter, Riser, Impact, Crash and Downlift are master-bus
effects. **Roll** repeats the beat that is playing, in halves then quarters, and
hands the track back on the beat. **Spinback** winds the playing deck backwards,
fast and slowing, then the track returns exactly where it would have been.
**Brake** is a vinyl stop and restart of the decks without pausing the clock, so
the mix carries on on the beat (a mix in progress included). Roll, Brake and
Spinback act on the decks, so they wait while a hand is on one or a pause is under
way. Every pad needs a running set, so they are grey until you start one.

## Turntables and pause

Each deck is a turntable with a platter that turns with the track (200° a
second at normal speed, so it speeds up, slows and runs backwards with the
sound) and a tonearm that creeps inward as the track plays.

- **Drag the platter** (or drag the waveform) to scrub: clockwise is forwards,
  counter-clockwise runs the track backwards, holding still holds the record,
  letting go spins it back to normal speed from wherever you left it.
- **Hold ⏪ / ⏩** to wind back or forward, faster the longer you hold;
  **±4 bars** buttons beat-jump and stay on the beat. With the platter focused,
  the arrow keys jump a bar (Shift for four).
- A planned mix that has not started is taken back while you do this and
  planned again when you let go. The decks are **locked while a mix is running**
  (moving one would knock the other out of time), and the platter says so.
- **Pause** is a vinyl stop: the platters wind down over about a second with the
  pitch falling and the sound fading, then the clock freezes. **Resume** spins
  them back up. A resumed deck restarts a little ahead of where it stopped, by
  exactly as much as the stop lost, so every fade, swap and effect already
  scheduled is still on the beat — pausing in the middle of a blend is safe.

How it works: a web audio source cannot seek or run backwards, so a scrub
borrows the deck and plays it with a forward source and a reversed copy of the
30 seconds around the platter, handing over at the instant the platter is at
rest. Speed is the same piecewise-linear curve the planner uses, so the display
and the next mix always agree with what you hear. The tests drive a track whose
pitch encodes its position (`test/browser.test.js`) and hold the audio to an
independent simulation.

## Automatic sound effects

*Automatic sound effects* (Off / Subtle / Lively / Wild, under *Effects*) drops
effects in on its own while a track plays, on the master bus like the pads, from
what the track's own structure invites:

- **Subtle**: a riser into each of the track's own drops and a hit on the drop.
- **Lively**: also a snare roll or reverse swell into the drop, and soft hits and
  reverse swells on 16-bar phrase lines.
- **Wild**: also lasers on the last beat of a bar mid-phrase, the odd siren, more
  of everything. Around each *swap* there is also a draw for a reverse swell, a
  snare roll or a zap.

They keep out of the transitions (the way out of a track and the first bars after
the way in belong to the transition, which takes back any that were planned
there), come back with the same choices on every run so an export matches the
live set, and respect the effects switch and the riser / hit / crash switches.
The strip lights for each one as it comes. The pads have twelve now: three more
sounds — **Swell** (a crash played backwards), **Snare roll** (one bar, getting
faster and louder) and **Zap** (a laser) — which are synthesised like the rest.

## Vocal tools

Each deck has **Full / No vocals / Vocals only**. *No vocals* is the instrumental
(the singer taken out), *Vocals only* is the a cappella (the instruments taken out).

**AI separation (the default).** Tracks are split with Meta's Demucs v4
(`htdemucs`, four stems; drums, bass and other are summed into the instrumental),
running in your browser through onnxruntime-web on **WebGPU**, in a worker
(`js/separator.js`, `vendor/separator/`). The first time, it downloads the model
(about 170 MB, in four parts under `models/htdemucs/`, plus a 24 MB wasm file) and keeps it in the
browser's cache storage, so later visits need no download. Then the track that is
playing and the one next in the queue are split one at a time in the background,
the playing one first; the deck's buttons say "splitting 42%" until it is done.
When the stems arrive the track's audio becomes a six-channel buffer (mix,
instrumental, vocals) and the deck is handed over to it without a sound; from then on
the buttons only choose between the three, so they are instant and everything else
the deck does (tempo, brake, scrub, loop roll, spinback) carries all three along.
Stems are held only for the playing and next track and are made again if a track
comes up again later (they are not saved). It works on mono files too.

- **Needs WebGPU:** a recent Chrome, Edge or Safari. Without it, with *AI vocal
  separation* switched off in the settings, or if the model cannot be loaded, the
  buttons use the basic filter below (the log says which).
- **How long it takes depends on the GPU.** The model's author reports about 3x
  real time on a desktop GPU; that has not been measured here. On a CPU (this
  project's tests, wasm, one thread) it runs at about a fifth of real time, which
  is too slow to use, so the CPU path is only used by the tests.
- **Memory:** a separated five-minute track is about 320 MB (six channels), so two
  of them are about 650 MB, on top of the model and its working memory (about 1.5 GB on the CPU path;
  the GPU path has not been measured).
- **How good it is:** this is the model a lot of stem-splitting tools use, and it
  should be far better than the filter below on real songs, but it has only been run
  on synthetic test signals here, never on a real song by ear. Expect faint
  traces of the vocal in the instrumental and of the instruments in the vocal; it
  is much better than a filter at both, not perfect.
- **Licence:** the weights are Meta's, which the package they came from
  (`demucs@1.0.0` on npm) says are for personal and research use only; see
  `models/htdemucs/NOTICE.md`.

**In blends**, *Take clashing vocals out of blends* (on by default) and the
vocal mashup use the stems too: from the vocal stem the analysis works out, bar by
bar, how much of the loudness is a voice. When both the outgoing track's end and the
incoming intro riding over it have a voice, the outgoing vocal is taken out until the
swap; a mashup brings the incoming vocal in over an instrumental ending and
lets its instruments join over the last two beats. These moves are only planned
between two tracks that have both been split; if the next track is not ready when the
mix is planned, that mix simply has no vocal move.

**The basic filter (the fallback).** A short-time Fourier transform (`js/vocal-worklet.js`, an
AudioWorklet) turns down or keeps whatever is in the middle of the stereo image in the
vocal range. It is classic signal processing, not AI, and rough on real songs: on a
busy synthetic mix *No vocals* took the voice down about 19 dB and the lead and pad
3-4 dB with it. It does not work on mono files, anything else in the middle
(a snare, a centred lead) goes with the vocal, and a vocal with reverb or doubling leaves
some of itself behind. With it, every deck goes through a fixed 512-sample (11.6 ms)
delay and the effects are delayed to match, so beats still line up. Its per-bar
estimate of where a voice is (stereo image, 300 Hz - 3.4 kHz) cannot tell a voice from a
centred lead.

## Your files stay put

Files you add are saved in this browser (IndexedDB, as the original bytes plus
the analysis, a few kilobytes), so a refresh no longer empties the list. On the
next visit each file is decoded again, the saved analysis is reused, and your
key and downbeat fixes and the queue order come back. The generated demos are
re-rendered. Nothing is uploaded; **Remove** deletes a track's saved copy and
**Remove all** (press twice) empties the library. The counter says *saved in
this browser* when it worked, and a note says so once if the browser refuses
(a private window, a full disk): the page then works as before, just forgetfully.
Browsers may throw away site storage when the disk is short of space, so the page
asks them to keep it, but cannot make them.

## Hiding long lists

Long lists used to make the page stutter, because every progress tick while files
were being analysed redrew the whole list (with a 24-option key menu on every
row). Now:

- **Hide tracks / Show tracks** collapses the track list to one line (how many
  are hidden, what is playing, what is up next). The Spotify and SoundCloud
  result lists have the same **Hide list / Show list** button; their counts and
  the two *Queue matched* buttons stay on show while the rows are hidden.
- **Auto-hide** (on by default, remembered) hides a list on its own once it is
  longer than 12, and while a big batch of files is still arriving. A list you
  are using (a row open for editing, focus inside) is left open. Turning it off
  shows everything; turning it back on lets it decide again.
- Even when shown, only the first 60 rows are drawn, with **Show 60 more**; the
  edit controls are built only for the row you are editing; the placeholder for
  a file being analysed has its own small list, so its progress never redraws
  the tracks; and nothing is written to the page unless it changed.

Measured with 300 stand-in tracks (before there was a track limit): a redraw that changed
something went from about 110 ms and 13,000 page elements to under 1 ms and 720
(the first page of rows), or 0 and under 0.1 ms while hidden. Spotify and
SoundCloud lists can be long, so those keep the paging.

## How many tracks?

The library holds **150 tracks**. Decoded audio is big (five minutes of stereo is
about 100 MB), so the page never holds the whole library decoded: only the track
that is playing and the one next in the queue are kept in memory, and a track is
read again from its saved copy when it comes up (a second or so, done while the
one before it is still playing). What stays for every track is small: the
analysis, the waveform and the length. Files beyond the limit are not added (the
log says so), and a saved library bigger than that comes back as its first 150.
The counter above the list shows what is in memory right now. **Remove all** and
**Stop adding** both drop anything still being added.

Two things still cost memory in proportion to the number of tracks: **Export a
mix** decodes every track it renders at once (it says so and stops if that would
be more than about 2 GB, and how many tracks would fit), and the track list
itself (see hiding long lists above). The saved copies are the original files, so
150 of them take as much disk as the files do; if the browser refuses to keep
that much, the counter says "not saved" and they will be gone after a refresh.

## Things to know

- **Key detection is an estimate.** It is tuned on the synthetic demo tracks
  (right tonic on all four, exact Camelot code on three); real music will do
  worse, and relative major/minor is the usual mistake — which is harmonically
  harmless. Fix a wrong key from the dropdown on the track row; **beat ±N**
  nudges where bar 1 is if the downbeat guess is off.
- **Tempo changes are pitch-coupled**, like vinyl. Blends are limited to about
  5% tempo difference for that reason (≈ 0.9 of a semitone).
- **Section detection assumes dance-music structure.** A track with no kick
  breaks and no loudness change gets no drop cues; it still gets a phrase-line
  cut, a brake, a spinback or an echo out.
- **Mix now** replaces the planned transition with one that starts in a few
  bars. If the planned one has not started yet it is taken back first.
- **Export mix (WAV)** renders the queue offline with the same scheduler.

## Spotify

Spotify streams cannot be mixed. They are DRM-protected, the Web Playback SDK
never gives the page any audio, and Spotify closed the tempo/key endpoints to
new apps. So this cannot beatmatch, EQ or effect a Spotify stream, and it does
not pretend to. What it can do is use a Spotify playlist as the **setlist**:

- **Import playlist CSV** (an [Exportify](https://exportify.net) export) — no
  login at all.
- **Connect** with your own Spotify app's Client ID (PKCE, no server). Add the
  redirect URI shown on the page to the app in the Spotify dashboard.

Each entry is matched to a file you have added (title, artist and duration), and
the matched ones are queued in playlist order or ordered by the DJ. Unmatched
entries are listed so you know which files to add.

**Connecting for real** (about two minutes, no server needed):

1. At [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   create an app. Tick *Web API*.
2. Under the app's settings add the **Redirect URI** the page shows under the
   Spotify panel (it is this page's own address, e.g.
   `https://your-site/dj/index.html`). Spotify requires `https://`, except for
   `http://127.0.0.1`, so use that address rather than `localhost` when testing.
3. Paste the app's **Client ID** (not the secret — this uses PKCE and never
   needs it) into the page and press **Connect**.

New Spotify apps start in development mode: only the app owner's account, plus
any users you add under *User management*, can log in.

What is tested: the whole login and playlist path runs against a stand-in
Spotify (`test/spotify.test.js`) — PKCE (the verifier we send hashes to the
challenge we sent), the `state` check, token refresh, paging, the playlist
endpoint's rename (`/items`, falling back to `/tracks`), and `null` entries for
removed tracks, which that test found crashing the import. What no test can
show is that Spotify itself accepts the requests; that needs a real app.

## SoundCloud

Same story as Spotify: SoundCloud audio plays inside its own player and the page
never gets it, so it cannot be mixed. What works, with no login and no key: paste a
public playlist, profile or track link (or a secret link) and the page asks
SoundCloud's own embedded player which tracks are in it, matches them to files you
own, and shows listen / buy / free-download links for the rest. If SoundCloud does
not answer (an ad blocker or privacy setting blocking `w.soundcloud.com`, a private
or removed link) the message appears in the SoundCloud card itself and the
**paste a list** box opens: one `Artist - Title` per line always works, with
nothing sent anywhere. The widget path has only been tested against a stand-in,
not the real service.

## Tests

```sh
node dj/test/logic.test.js     # analysis on tracks with known answers, planner, timeline maths, Spotify matching
node dj/test/spotify.test.js   # login + playlist import against a stand-in Spotify
node dj/test/separator.test.js # the AI separation: the real model on a synthetic clip, in Node and in the browser (slow on a CPU; SEP_SKIP_BROWSER=1 skips the browser part)
node dj/test/browser.test.js   # the real page: offline mix measurements, then live playback
```

The browser test renders a bass swap offline and measures it: the low end does
not double during the blend, the decks' onsets line up within 4 ms (and the same
test is shown to see a deliberate 30 ms slip), nothing clips. Then it drives the
page: add demos, start, grab the platter and drag it each way, hold rewind, jump
bars, mix now, check the effect lamps, pause in the middle of a mix and resume,
export a WAV, import a playlist CSV. Offline, it plays a track whose pitch
encodes its position through the DJ pause, a scripted scrub, the vinyl brake and
the spinback, and holds each to a simulation of what it should do. It needs playwright and a chromium (`CHROMIUM=/path` if
it cannot find one).
