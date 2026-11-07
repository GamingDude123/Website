# Krillion Puffer Helper

Chrome extension (Manifest V3) that shows suggested answers for the current Puffer Party category in a small sidebar.

## Install
1. `chrome://extensions` > enable Developer mode > Load unpacked > pick this folder.
2. No API key needed.
3. Open krillion.io and start a game. The sidebar appears top-right.

## Use
- Suggestions refresh when the prompt text changes. Click one to copy it (it's then marked used).
- If auto-detection grabs the wrong text, click **pick** and click the element that holds the category; the choice is remembered.

## Caveat
Written without access to krillion.io's markup, so prompt detection is heuristic and untested against the live site.
