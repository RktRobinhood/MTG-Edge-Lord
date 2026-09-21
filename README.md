# MTG Edge Lord

MTG Edge Lord is an off-meta Commander discovery layer for [EDHREC](https://edhrec.com), delivered as one Tampermonkey userscript backed by versioned JSON generated in this repository.

It does two things:

**Advanced search.** Filter every Commander by colour identity, mana value, creature type, theme, mechanic, price, bracket, and **how off-meta you want to be** — then sort by something other than popularity. EDHREC's own search keeps pulling you back to the top; this one lets you pin yourself to rank 1,000-3,000 and stay there.

**Edge Lord discovery.** A daily feed of off-meta commanders that demonstrably work, found by a scheduled job that reads public community sources and judges what it finds. The quality bar is the brand: cool, different, still competitive - not jank.

It does not reproduce EDHREC's rankings. It combines obscurity, bracket skew, archetype depth, retention, community reasoning, and momentum to explain why a commander may be a diamond in the rough.

## Install

1. Install Tampermonkey or Violentmonkey.
2. Open [`mtg-edge-lord.user.js`](https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/mtg-edge-lord.user.js).
3. Approve the userscript, then visit any page on `https://edhrec.com`.

The `EL` button opens search, recent finds, and card-first discovery. Data is cached in the browser. The script checks `data/manifest.json` and refreshes only when `dataVersion` changes; GitHub Pages is preferred and raw GitHub is the fallback.

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

Findings are produced by the scheduled daily job, which reads public sources and uses a model to judge whether a signal is genuine brewing effort or a passing mention. Because that output is non-deterministic, **always inspect the generated diff before committing**. Hand-written research is still valid: copy the documented shape into `research/inbox/`, using short factual summaries and canonical links. Never copy a creator's deck guide or substantial prose.

Source access rules, including which sources are deliberately excluded, live in [docs/SOURCES.md](docs/SOURCES.md).

## Product documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Findings schema](docs/FINDINGS_SCHEMA.md)
- [Scoring](docs/SCORING.md)
- [Sources and attribution](docs/SOURCES.md)

MTG Edge Lord is unofficial fan software and is not affiliated with EDHREC, Wizards of the Coast, or the linked community creators.
