# Data model

## Core entities

`Commander` is the primary searchable entity, identified by slug. Scryfall UUIDs are enrichment, not identity. Every commander carries card facts (from Scryfall bulk) and, within the scored band, EDHREC-derived quality data.

`Finding` is an attributable research observation — the editorial unit rendered in the discovery feed.

`Card` is a lightweight canonical entity, currently referenced by findings rather than independently searchable.

`CardCommanderRelationship` is a first-class edge joining exactly one card and commander, retaining `findingIds`, `sourceUrls`, raw metrics, evidence strength, independent-source count, and a derived relationship score.

`CommunityResource` projects a finding whose depth exceeds a mere mention, directing users to the original work.

## Commander record

| Group | Fields | Source |
| --- | --- | --- |
| Identity | `name`, `slug`, `scryfallId` | Scryfall / EDHREC |
| Card facts | `colorIdentity`, `manaValue`, `types`, `creatureTypes`, `price`, `setCode`, `releasedAt` | Scryfall bulk |
| Mechanics | `functionalTags` | Scryfall Tagger bulk |
| Popularity | `edhrecRank`, `deckCount`, `asOf`, `tier` | EDHREC |
| Quality | `bracketCounts`, `bracketFit`, `archetypeDepth`, `retention`, `worksScore`, `edgeScore` | EDHREC pages |
| Themes | `themes` | EDHREC `tag_counts` |
| Discovery | `findingIds`, `momentum`, `cohortScore` | Pipeline |

`tier` is one of `meta`, `rare`, `edge`, `uncharted`, derived from rank. Quality fields are **absent rather than zero** for commanders below the confidence floor; the UI renders those as *insufficient data*.

### Card facts

`colorIdentity` is a **WUBRG-ordered string**, not an array: `"BG"`, or `""` for colourless. There are only 32 possible values, so the column costs almost nothing once dictionary-encoded, and `"BG".includes("B")` is the whole of the *includes* filter semantics. *Exact* compares the string; *at most* checks every character of the commander's identity against the selection.

`types` holds the card types with `Legendary` stripped (`["Artifact", "Creature"]`). `creatureTypes` holds the subtypes, and is empty for a non-creature commander. Both come from the front face of a double-faced card.

`price` is USD, non-foil where Scryfall has one and foil otherwise. It is **absent rather than zero** when Scryfall has no price, which is normal for an unreleased set.

`functionalTags` are Scryfall Tagger oracle tags **rolled up to a configured root**. Tagger's taxonomy is ~4,500 tags, most far too granular to filter on (`tutor-creature-giant`); each root in `src/connectors/scryfall-bulk.js` absorbs its whole subtree, so that commander filters under `tutor`. Adding a root there adds a filter axis.

Commanders are joined to Scryfall **by name, not by id**. Scryfall's `id` identifies one chosen printing, which need not be the printing EDHREC references. Partner and background pairings arrive from EDHREC as combined names, match no single card, and correctly keep their card facts absent.

## Generated datasets

| File | Purpose |
| --- | --- |
| `manifest.json` | Content version, timestamp, file hashes and sizes |
| `commanders.json` | Columnar search projection — every commander, every filter axis |
| `findings.json` | Current normalized discovery feed |
| `hidden-cards.json` | Card-first projection with associated obscure commanders |
| `community-resources.json` | Credited outbound resource index |
| `relationships/card-commander.json` | Provenance-preserving edges |
| `commander-history.json` | Rank/deck-count snapshots for momentum |
| `trending/{7d,30d,90d}.json` | Time-window projections |
| `history/*.json` | Dated finding snapshots, written only on content change |

### Columnar encoding

`commanders.json` stores **parallel arrays keyed by field**, not an array of objects. Per-record JSON repeats every key ~6,800 times and serialises floats at full precision. The columnar form holds the same data in **0.81MB against 2.60MB**, about 0.21MB gzipped, with headroom for the filter axes still to land.

`src/shared/columnar.js` is the single encoder and decoder, used by both the pipeline and the userscript. The encoded form is self-describing, so the client needs no field spec to read it.

Each column picks whichever of three shapes serialises smallest:

| Kind | Stores | Good for |
| --- | --- | --- |
| `raw` | one entry per record | `name`, `slug`, `scryfallId` |
| `dict` | each distinct value once, plus an index per record | `momentum`, `trendZscore` |
| `sparse` | one dominant `fill` value, plus the exceptions | `diamondScore`, `findingIds`, `asOf` |

`sparse` is the reason the file is small. A column that is `0` for every commander but one, or an empty array for every commander but one, costs a few dozen bytes rather than 6,792 entries.

A field missing from a record stays missing on decode. That distinction matters: an unscored commander must render as *insufficient data*, never as a zero.

Numeric fields are rounded at write time to the precision actually displayed, per the map in `src/shared/catalog.js`. A momentum value shown as `12.4` is stored as `12.4`, never `12.400000000000002`.

The file is written **without indentation**. Record-shaped datasets stay indented so a generated diff can be reviewed, as `AGENTS.md` requires; pretty-printing a columnar file produces thousands of lines holding one number each, which is both harder to read and three times the size.

`commanders.json` is at `schemaVersion` 2. The decoder still accepts the version 1 array shape, so a stale client cache or a half-deployed backend degrades to old data rather than to an empty panel.

## Lifecycle

The intended state machine is `unknown → candidate → emerging → breaking_out → established`. State is not guessed from a single snapshot; it is derived once enough historical popularity, discussion, and validation snapshots exist. Raw time series stay available so scoring changes can be replayed.

## Retention

History files are permanent by default, since the dated record of what was surfaced and when is a deliberate product feature.

**Exception:** content sourced from Reddit must be deleted when deleted upstream, swept roughly every 48 hours, per Reddit's platform obligations. Reddit-derived findings must therefore be identifiable and removable without rewriting unrelated history.

## Compatibility

Every generated file carries `schemaVersion`. Breaking changes increment it and require a matching userscript change. Manifest `dataVersion` identifies content, not a date.
