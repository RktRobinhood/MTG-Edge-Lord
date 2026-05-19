# MTG Edge Lord

MTG Edge Lord is an EDHREC overlay. EDHREC remains the app and this project adds an auto-hiding side rail for off-meta commander search, saved ideas, and personal deck taste tracking.

## Install

### Userscript

1. Install Tampermonkey or Violentmonkey.
2. Open `overlay/edhrec-companion.user.js` from GitHub Pages or this repo.
3. Accept the userscript install prompt.
4. Open any `https://edhrec.com/*` page.

The overlay appears as a narrow rail on the right side of EDHREC. Hover, focus, or pin it to open the full panel.

### Chrome extension

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select the repo root folder, the folder containing `manifest.json`.

## Overlay Panels

- `Scout` - current commander rating, status, likes, dislikes, profile metrics, and notes.
- `Find` - loads EDHREC ranked commanders and searches by rank, deck count, taste, difference, and off-meta score.
- `Profile` - owned deck profile summary, liked signals, avoid signals, and import/export.
- `Saved` - commanders marked while browsing EDHREC.

## Why It Needs Installation

GitHub Pages cannot inject code into `edhrec.com` by itself because browsers isolate websites by origin. The userscript or unpacked extension is what makes the overlay run by default on EDHREC.

## Files

- `index.html` - installer / project landing page.
- `overlay/edhrec-companion.user.js` - the EDHREC overlay.
- `manifest.json` - optional Chrome extension wrapper.
- `assets/` - legacy standalone prototype assets kept for reference.
