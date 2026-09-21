# Data model

## Core entities

`Finding` is an attributable research observation. It is the editorial unit rendered in Recent Finds.

`Commander` and `Card` are lightweight canonical entities identified by slug; Scryfall UUIDs are enrichment, not identity.

`CardCommanderRelationship` is a first-class edge. It joins exactly one card and commander and retains `findingIds`, `sourceUrls`, raw metrics, evidence strength, independent-source count, and a derived relationship score.

`CommunityResource` is a projection of a finding whose depth is greater than a mere mention. It directs users to original work.

## Generated datasets

| File | Purpose |
| --- | --- |
| `manifest.json` | Content version, timestamp, file hashes, and sizes |
| `findings.json` | Current normalized feed |
| `commanders.json` | Commander search projection and maximum Diamond score |
| `hidden-cards.json` | Card-first projection with associated obscure commanders |
| `community-resources.json` | Credited outbound resource index |
| `relationships/card-commander.json` | Provenance-preserving edges |
| `trending/{7d,30d,90d}.json` | Time-window projections |
| `history/*.json` | Compact finding snapshots written only on content change |

## Lifecycle

The intended state machine is `unknown → candidate → emerging → breaking_out → established`. State is not yet guessed from one snapshot; it will be derived after enough historical popularity, discussion, and validation snapshots exist. Raw time series must remain available so scoring changes can be replayed.

## Compatibility

Every generated file has `schemaVersion`. Breaking changes increment it and require a userscript compatibility change. Manifest `dataVersion` identifies content, not a date.
