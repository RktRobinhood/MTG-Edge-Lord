# MTG Edge Lord

MTG Edge Lord is an off-meta Commander discovery layer for [EDHREC](https://edhrec.com). It is delivered as one Tampermonkey userscript and backed by versioned JSON generated in this repository.

It does not try to reproduce EDHREC's rankings. It combines obscurity, community reasoning, substantial brewer work, mechanical relationships, momentum, and validation to explain why a commander or card may be a diamond in the rough.

## Install

1. Install Tampermonkey or Violentmonkey.
2. Open [`mtg-edge-lord.user.js`](https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/mtg-edge-lord.user.js).
3. Approve the userscript, then visit any page on `https://edhrec.com`.

The `EL` button opens recent finds, commander-first discovery, and card-first discovery. Data is cached in the browser. The script checks `data/manifest.json` and refreshes only when `dataVersion` changes; GitHub Pages is preferred and raw GitHub is the fallback.

## Repository map

- `src/userscript/` — small EDHREC UI and manifest-aware data client.
- `src/connectors/` — isolated source adapters; failures are non-fatal.
- `src/pipeline/` — normalization, scoring, relationship generation, and publishing.
- `research/inbox/` — reviewed, attributable findings awaiting/generated into the feed.
- `schema/` — public JSON schemas.
- `data/` — generated static backend and compact history.
- `docs/` — product, architecture, scoring, data, schema, and source policy.
- `.github/workflows/` — daily research build and Pages publication.

## Local development

Requires Node.js 22+.

```powershell
npm install
npm run check
```

Useful commands:

- `npm run research` — deterministic offline build from reviewed inbox data.
- `npm run research:network` — also enrich referenced cards through Scryfall's collection API.
- `npm run build` — bundle `src/userscript/` to the installable root userscript.
- `npm test` — schema, scoring, normalization, and relationship tests.
- `npm run validate` — verify generated data against schemas and manifest metadata.

Add research by copying the documented shape into `research/inbox/`, using short factual summaries and canonical links. Never copy a creator's deck guide or substantial prose. Run `npm run research:network`, inspect the generated diff, then commit both the reviewed input and generated data.

## Product documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Findings schema](docs/FINDINGS_SCHEMA.md)
- [Scoring](docs/SCORING.md)
- [Sources and attribution](docs/SOURCES.md)

MTG Edge Lord is unofficial fan software and is not affiliated with EDHREC, Wizards of the Coast, or the linked community creators.
