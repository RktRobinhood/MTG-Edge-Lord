# Repository operating notes

MTG Edge Lord is a Tampermonkey userscript backed by static, generated JSON. It does two things: **advanced search across every Commander**, and **a daily Edge Lord discovery feed** for off-meta commanders that demonstrably work. The old Chrome extension architecture is intentionally retired.

## Invariants

- Keep collection out of the userscript. It fetches only this repository's generated `data/` files and never calls a third party from a user's browser.
- Preserve raw evidence and canonical outbound URLs. Never copy substantial creator prose, decklists, videos, or primers.
- Treat every external source as a replaceable connector. One failure must degrade only its own lane.
- Derived scores retain components and human-readable reasons. An unscored entity is labelled unscored, never given a zero.
- Generated files live in `data/` and must pass validation. `research/inbox/` remains valid for human-reviewed input.
- Search covers every commander. **Edge Lord surfacing never goes deeper than EDHREC rank 3,000** — past that the evidence to say "this works" does not exist.

## Source access

Access rules live in `docs/SOURCES.md`, which records what was verified and when. Two standing rules:

- **Check the source's own policy before adding a connector.** `robots.txt`, terms, and any published operator statement. Record the finding in `docs/SOURCES.md` with the date.
- **Accessible is not permitted.** Several sources answer unauthenticated requests while forbidding automated use. The exclusion list in `docs/SOURCES.md` is a decision, not an oversight — do not quietly re-add Moxfield, TappedOut, Discord, or Reddit mirrors.

Approved automated reads are targeted, identified, rate-limited, cached, and conditional where the source supports it. Archidekt's documented limit is 40 req/min. EDHREC is walked once per scheduled build with a delay between pages.

## LLM use in the pipeline

The daily job uses a model to judge whether a community signal is a genuine find. Findings it produces are non-deterministic, so **generated-data diffs must be reviewed before they are trusted**, and every finding keeps its source link prominent so a reader can check the model's work.

Never feed a model content from a source whose terms forbid it — Discord's Developer Policy #21 is the explicit case.

## Definition of done

Run `npm run check`. Review generated-data diffs for attribution, dates, URLs, score sanity, and meaningful novelty before committing.
