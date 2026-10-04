# Autopilot DJ

Drop in tracks and it plays them as a club-style tech-house set: beatmatched,
key-aware, with bass swaps, drop swaps, filter builds, loop rolls and echo
throws, all decided and scheduled for you.

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
| Choose | `js/brain.js` | Next track by harmonic fit, tempo distance and the energy arc; then one of three moves from what the two structures allow |
| Lock | `js/timeline.js`, `js/engine.js` | Both decks follow one tempo curve, so bar lines stay aligned while tempo glides to the incoming track's own. The glide's duration is solved so the outgoing deck reaches the swap bar exactly as it ends |
| Perform | `js/engine.js` | EQ kills and swaps, filter sweeps, echo throws, loop rolls, risers and impacts — every event placed on the audio clock ahead of time |

The three moves:

- **Bass swap** — the incoming intro rides over the outgoing outro with its low
  end cut; the basslines trade places on the bar where the incoming drop lands.
- **Drop swap** — the outgoing breakdown builds (high-pass closing, riser, a
  loop roll in the last bar, echo throw) and the incoming drop lands on the one.
- **Echo out** — when tempos are more than about 8% apart: echo throw, cut on
  the downbeat, the new track starts at its own tempo.

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
of it off under *Effects*.

## How many tracks?

There is no cap in the app. The limit is your browser's memory: a decoded
five-minute track takes about 50 MB. The counter above the list shows the
estimate and warns past about 1.5 GB — if the tab slows or crashes, remove a few
tracks or add them in smaller batches.

## Things to know

- **Key detection is an estimate.** It is tuned on the synthetic demo tracks
  (right tonic on all four, exact Camelot code on three); real music will do
  worse, and relative major/minor is the usual mistake — which is harmonically
  harmless. Fix a wrong key from the dropdown on the track row; **beat ±N**
  nudges where bar 1 is if the downbeat guess is off.
- **Tempo changes are pitch-coupled**, like vinyl. Blends are limited to about
  5% tempo difference for that reason (≈ 0.9 of a semitone).
- **Section detection assumes dance-music structure.** A track with no kick
  breaks and no loudness change gets no drop cues and falls back to echo-out.
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

## Tests

```sh
node dj/test/logic.test.js     # analysis on tracks with known answers, planner, timeline maths, Spotify matching
node dj/test/spotify.test.js   # login + playlist import against a stand-in Spotify
node dj/test/browser.test.js   # the real page: offline mix measurements, then live playback
```

The browser test renders a bass swap offline and measures it: the low end does
not double during the blend, the decks' onsets line up within 4 ms (and the same
test is shown to see a deliberate 30 ms slip), nothing clips. Then it drives the
page: add demos, start, mix now, watch the swap land, pause, export a WAV,
import a playlist CSV. It needs playwright and a chromium (`CHROMIUM=/path` if
it cannot find one).
