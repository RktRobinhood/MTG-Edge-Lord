# Architecture

```text
reviewed inbox + public structured sources
               │
        isolated connectors
               │
  normalize → validate → deduplicate
               │
     score + build card↔commander edges
               │
 static JSON + manifest + compact history
               │
        GitHub Pages / raw GitHub
               │
     cached Tampermonkey userscript
               │
              EDHREC
```

## Boundaries

The userscript owns display, local search/filter/sort, route detection, caching, and outbound navigation. It does not perform research or fan out to third-party services.

The build owns source access, normalization, history, scoring, and publication. Connectors return normalized candidates or enrich existing candidates. `runPipeline` catches connector errors so one provider cannot invalidate the last known good data.

The static backend uses a content-derived `dataVersion`. If generated file hashes have not changed, the manifest and history are left untouched. This prevents a scheduled run from manufacturing daily churn.

## Publication and cache protocol

1. Userscript requests `data/manifest.json` with cache-busting.
2. Matching `dataVersion`: use local cache without downloading datasets.
3. New version: fetch datasets in parallel, then atomically replace the browser cache.
4. Network failure: render the last valid cache and identify it as cached.
5. Pages failure: retry against raw GitHub.

## Resilience

- The UI mounts in a shadow root and depends on the EDHREC URL, not fragile page selectors.
- Schemas reject unattributed URLs, malformed entities, invalid dates, and out-of-range scores.
- Every derived edge retains finding IDs and source URLs.
- Generated history is written only when content changes.

## Future seams

- OAuth Reddit connector behind repository secrets.
- YouTube channel-feed connector with an explicit allowlist.
- EDHTop16 snapshot connector with tournament-level provenance.
- Commander Spellbook delta connector using its public API/OpenAPI schema.
- Compact EDHREC popularity snapshots if EDHREC grants/document access or a permitted export is supplied.
