# Wii Channel Arcade

A phone app styled after the Wii Menu. Every game you add becomes its own
channel, and tapping one boots it in a real emulator running inside the page.
There's a Photo Channel too, because the Wii had one.

It's a PWA, so there's no app store involved: open it in your phone's browser,
add it to the home screen, and it launches fullscreen with its own icon and
works offline.

## How you use it

Tap the Disc Channel, pick a game file, and it becomes a channel. **Tap that
channel to play it** — that's the whole loop. Press and hold a channel (or hit
**Edit** in the top bar) to rename or delete it. The game you played last keeps
a blue ring so you can find it again at a glance.

## The three halves

**The arcade** — NES, SNES, Game Boy / Color, Game Boy Advance, N64, DS,
Virtual Boy, Genesis, Master System, Game Gear, 32X, PlayStation, PC Engine,
Lynx, Atari 2600 and arcade games all run directly on the phone, using
[EmulatorJS](https://emulatorjs.org) libretro cores compiled to WebAssembly.
Touch controls, save states and fast-forward come from the emulator's own UI.

**The Photo Channel** — a Game Boy Camera. Your phone's camera, live, squeezed
down to the real thing's 128 × 112 sensor and four shades, with 4×4 ordered
dithering so faces come out as faces rather than two flat blobs. Seven
palettes, five pixel frames, a three-second self-timer on a long press, and an
album that exports at 1024 × 896. **Import** turns a picture you already have
into one of these, which also gives the channel something to do on a phone
that won't hand out a camera.

Photos are saved as their 128 × 112 shade indices — one byte per pixel, values
0–3 — rather than as an encoded image. Nothing is lost to re-encoding, and the
palette stays a display choice, so any shot can be re-tinted long afterwards.

**Dolphin Command Center** — Wii and Wii U games can't be emulated in a
browser: that needs a JIT recompiler for the console's PowerPC CPU and
low-level GPU access, and no browser hands either out. So this half doesn't
fake it. It tracks the library, keeps per-game Dolphin settings somewhere you
can find them, and hands off to Dolphin on Android.

## Games

The app ships no games and downloads none. It runs files you add yourself from
your own device, and they never leave it — everything lives in the browser's
IndexedDB storage on your phone.

## Install

**iPhone:** open in Safari → Share → Add to Home Screen.
**Android:** open in Chrome → ⋮ → Install app.

## Files

| Path | What it does |
| --- | --- |
| `index.html`, `js/menu.js` | The channel grid |
| `play.html`, `js/play.js` | Boots a game into EmulatorJS |
| `js/photo.js` | Photo Channel — camera, dithering, frames, album |
| `dolphin.html`, `js/dolphin.js` | Wii / Wii U shelf and Dolphin handoff |
| `js/systems.js` | Console definitions and file-extension detection |
| `js/store.js` | IndexedDB: games, BIOS files, shelf, settings |
| `js/wii-ui.js` | Synthesised menu sounds, haptics, clock, panels |
| `sw.js` | Offline caching — app shell plus emulator cores |

## Notes

- Cores that need `SharedArrayBuffer` (PSP, DOS, 3DS) are deliberately left
  out. They require COOP/COEP response headers, which GitHub Pages can't send.
- The file input has no `accept` list on purpose. iOS resolves accept entries
  to UTIs and has none for `.sfc`, `.z64`, `.gba` and friends, so listing them
  greys out the very files you're trying to pick. Files are validated after
  selection instead.
- A `.iso` over 900 MB is treated as a Wii disc rather than PlayStation, since
  a PS1 disc tops out near 700 MB. Smaller ones still ask.
- The first launch of a system downloads its core from the EmulatorJS CDN.
  After that the service worker serves it from cache, so it works offline.
- PlayStation and Lynx need a BIOS file from your own console — add one under
  the Wii button → Settings.
- The Photo Channel's file input *does* set `accept="image/*"`, unlike the game
  picker. iOS has UTIs for every image type, so nothing gets greyed out.
- Cameras need a secure context. Over plain http the channel says so and falls
  back to Import; over https, and on GitHub Pages, it just works.
- The camera stops the moment you leave the view or background the app, so the
  indicator light never stays on behind your back.
