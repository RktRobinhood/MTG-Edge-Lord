# Architecture

```text
 Scryfall bulk            EDHREC pages            community sources
 (all commanders)         (rank 500-3000)         (RSS, YouTube, Archidekt, Reddit)
        │                        │                          │
        │                        │                  heuristic pre-filter
        │                        │                          │
        │                        │                     LLM judgement
        │                        │                          │
        └────────────────┬───────┴──────────────────────────┘
                         │
            normalize → validate → deduplicate
                         │
         score (edge / cohort / finding / relationship)
                         │
        columnar JSON + manifest + dated history
                         │
             GitHub Pages / raw GitHub
                         │
        userscript (IndexedDB cache) on EDHREC
```

## Two functions, two data paths

**Advanced search** covers all ~6,800 commanders and is fed by **Scryfall bulk downloads** — one file per day, no crawling. This supplies colour identity, mana value, type line, price, and functional tags.

**Edge Lord scoring** covers rank 500–3,000 and is fed by a **targeted EDHREC walk**, rotated across days so no single run is heavy. This supplies bracket distribution, themes, synergy, and save history.

The split matters: search needs breadth and gets it cheaply from a sanctioned bulk file; scoring needs depth and pays for it with a polite, incremental crawl of a bounded set.

## Boundaries

The userscript owns display, local search/filter/sort, route detection, caching, and outbound navigation. It performs no research and contacts no third party — only this repository's generated files.

The build owns source access, normalization, judgement, scoring, and publication. Connectors return normalized candidates or enrich existing ones. `runPipeline` catches connector errors so one provider cannot invalidate the last known good data, and each discovery lane degrades independently.

## The daily job

1. Refresh Scryfall bulk and the EDHREC slice due for rotation.
2. Poll community sources for new items.
3. **Heuristic pre-filter** — match commander names, apply the rank band, drop anything in the top 500. Thousands of items become dozens.
4. **LLM judgement** on the survivors only: is this genuine brewing effort or a passing mention? Extract cards, mechanics, and evidence quality.
5. Score, validate, write, and commit only if content changed.

Spending tokens only after the cheap filter keeps a daily run at a trivial cost. Model output is non-deterministic, so diffs are reviewed rather than trusted blindly.

## Client storage

The full searchable dataset is stored **columnar rather than as per-record objects**, which cuts it from ~2.7MB to ~1.2MB (about 0.3MB gzipped) while adding every planned filter axis. Repeated keys and full-precision floats were the bulk of the old size.

Storage is **IndexedDB, not `localStorage`** — asynchronous, so parsing never stalls EDHREC's page load, and with headroom for the card-level dataset later.

## Publication and cache protocol

1. The userscript requests `data/manifest.json` with cache-busting.
2. Matching `dataVersion`: use the local cache, download nothing.
3. New version: fetch datasets in parallel, then atomically replace the cache.
4. Network failure: render the last valid cache and label it as cached.
5. Pages failure: retry against raw GitHub.

`dataVersion` is content-derived. If generated hashes have not changed, the manifest and history are left untouched, so a scheduled run cannot manufacture daily churn.

## Discovery lanes

Connectors fall into two kinds.

**Enrichment** connectors join facts onto the commander catalogue: Scryfall
bulk (card facts), the EDHREC page crawl (brackets, themes, synergy),
Commander Spellbook (combo counts), EDHTop16 (tournament validation), the cEDH
Decklist Database (dedicated communities) and Archidekt (deck counts). Each
runs in sequence and each failure degrades only its own fields, because the
pipeline carries every connector's previous output forward before enrichment
begins.

**Discovery** connectors produce *candidates* — a title, a canonical link, a
date and the commanders named. RSS feeds and the YouTube Data API are the two.
A candidate is not a finding.

Candidates then pass through two stages:

1. **`src/pipeline/prefilter.js`** — free, deterministic and testable. Match
   against the catalogue, apply the rank band, drop the top 500. Thousands
   become dozens, and nothing it rejects ever reaches a model.
2. **`src/pipeline/judge.js`** — a model reads what survived and decides
   whether it is genuine brewing effort or a passing mention. That distinction
   is semantic; upvote counts and keyword frequency cannot make it.

The model sees **source metadata only** — title, tags, counts — never an
article body, a decklist or a primer's prose. Judgements below a confidence
floor are discarded rather than published, and the daily workflow opens a pull
request for feed changes rather than pushing them.

Rotation cursors, bulk-file timestamps, per-feed seen lists and the rolling
coverage window live in `state/connectors.json`, committed so a run can pick up
where the last one stopped.

## Resilience

- The UI mounts in a shadow root and depends on the EDHREC URL, not fragile page selectors.
- Schemas reject unattributed URLs, malformed entities, invalid dates, and out-of-range scores.
- Every derived edge retains finding IDs and source URLs.
- History is written only when content changes.
- A commander below the confidence floor is labelled *insufficient data*, never scored zero.

## Future seams

- Reddit OAuth connector once approval lands, behind repository secrets.
- EDHTop16 tournament snapshots as explicit validation evidence.
- Commander Spellbook delta connector for combo lines.
- Card-level search as a second dataset, once commander search is proven.
