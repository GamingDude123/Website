# Wii Channel Arcade

A phone app styled after the Wii Menu. Every game you add becomes its own
channel, and tapping one boots it in a real emulator running inside the page.

It's a PWA, so there's no app store involved: open it in your phone's browser,
add it to the home screen, and it launches fullscreen with its own icon and
works offline.

## How you use it

Tap the Disc Channel, pick a game file, and it becomes a channel. **Tap that
channel to play it** — that's the whole loop. Press and hold a channel (or hit
**Edit** in the top bar) to rename or delete it. The game you played last keeps
a blue ring so you can find it again at a glance.

## The two halves

**The arcade** — NES, SNES, Game Boy / Color, Game Boy Advance, N64, DS,
Virtual Boy, Genesis, Master System, Game Gear, 32X, PlayStation, PC Engine,
Lynx, Atari 2600 and arcade games all run directly on the phone, using
[EmulatorJS](https://emulatorjs.org) libretro cores compiled to WebAssembly.
Touch controls, save states and fast-forward come from the emulator's own UI.

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
