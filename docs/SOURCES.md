# Sources, access, and attribution

## Policy

Prefer official APIs, bulk data, RSS, and repositories. Use targeted requests with identification and conservative frequency. A source without reliable permitted access is manual/optional—not an invitation to ship an undocumented scraper. Canonical URLs and creators are mandatory.

| Source | Intended signal | Access status |
| --- | --- | --- |
| Scryfall | Canonical card identity/mechanics | Automated targeted collection lookup; bulk data for future broad refreshes |
| Scryfall Tagger | Community card tags | Manual/optional until a supported export/API is documented |
| Commander Spellbook | Combo relationships | Public API candidate; optional connector after delta behavior/rate policy is verified |
| EDHTop16 | Tournament validation | Public API/repository candidate; add tournament-level snapshots, not aggregate claims |
| EDHREC | Rank, decks, inclusion, synergy | No documented public API; do not bulk crawl. Use permitted exports or targeted manual snapshots |
| Reddit communities | Reasoning, testing, negative evidence | Replaceable connector boundary; manual now. OAuth/API connector only with credentials and current terms |
| Panzer-MTG / Unpopular MTG / Commander Labs | Deep dives | Allowlisted RSS/channel metadata or manual review; link to original video/content |
| cEDH DDB Brewer's Corner | Curated emerging brews | Manual/optional until repository/API terms and stable identifiers are verified |
| Archidekt | Public creator/deck references | Store canonical referenced links; no bulk crawl |
| Moxfield | Public creator/deck references | Store canonical referenced links; no bulk crawl |

Target Reddit communities include r/jankEDH, r/EDH, r/EDHBrews, r/BudgetBrews, and r/DegenerateEDH. They should be evaluated for independent reasoning and testing, not harvested as a keyword counter.

## Attribution rules

- Store title/creator metadata, short original factual summaries, relationship evidence, and canonical links.
- Do not store full decklists, transcripts, article text, thumbnails without permission, or substantial excerpts.
- A deep dive should make the creator more visible in the UI than the project itself.
- If multiple people independently reach the same interaction, keep their source URLs and reflect the actual independent-source count.
- Correct or remove a finding when a creator requests it or the canonical source disappears.

## Connector contract

Connectors have an ID and return findings or enriched findings plus diagnostics. Network connectors are opt-in locally, fail closed, and cannot erase reviewed input. New connectors must document authentication, rate limits, pagination, cache strategy, terms, and test fixtures before being enabled in the daily workflow.

The current automated network connector performs one batched Scryfall collection lookup for only the cards already referenced in reviewed findings. It identifies the project with a user agent and uses the requested JSON accept header.
