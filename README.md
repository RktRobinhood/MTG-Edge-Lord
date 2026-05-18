# Commander Edgeboard

Static EDH commander discovery tool for GitHub Pages.

## Files

- `index.html` - main GitHub Pages entry point.
- `profile.html` - commander deck entry and habit explorer.
- `assets/styles.css` - app styling.
- `assets/data.js` - local seed commander catalog.
- `assets/app.js` - filtering, scoring, imports, exports, and optional EDHREC refresh.
- `assets/profile.js` - structured commander profile editor and trend analysis.
- `overlay/edhrec-companion.user.js` - EDHREC commander-page overlay userscript.

## Run Locally

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

Put these files at the root of a GitHub repository and enable Pages for the repository root. The app has no build step.

## Data Flow

The app starts from the local seed catalog and stores user data in browser `localStorage`. `Refresh EDHREC` optionally loads ranked commander pages from `json.edhrec.com` and stores that snapshot locally. It does not auto-fetch card details or call Scryfall/Moxfield unless the user opens a quick link.

Use `profile.html` to rate existing commander decks on a 1-5 enjoyment scale and record power, complexity, table heat, play pattern, speed, likes, dislikes, and notes. Discovery uses those profiles for taste matching, difference scoring, and habit-aware recommendations.

The EDHREC overlay stores its own data on the `edhrec.com` origin. Export JSON from the overlay, then import it into the main app to merge saved ideas and deck profiles.
