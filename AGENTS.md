# Repository operating notes

MTG Edge Lord is a Tampermonkey userscript backed by static, generated JSON. It does three things: **advanced search across every Commander**, **a daily Edge Lord discovery feed** for off-meta commanders that demonstrably work, and **an append-only archive** of every commander the feed has surfaced. The old Chrome extension architecture is intentionally retired.

## Invariants

- Keep collection out of the userscript. It fetches only this repository's generated `data/` files and never calls a third party from a user's browser.
- Preserve raw evidence and canonical outbound URLs. Never copy substantial creator prose, decklists, videos, or primers.
- Treat every external source as a replaceable connector. One failure must degrade only its own lane.
- Derived scores retain components and human-readable reasons. An unscored entity is labelled unscored, never given a zero.
- Generated files live in `data/` and must pass validation. `research/inbox/` remains valid for human-reviewed input.
- The archive is append-only and records the rank a commander held **when it was surfaced**. A later run may add to an entry; nothing may unsay one, and refreshing that rank would erase the only claim the archive makes.
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

## Attribution and traffic

MTG Edge Lord surfaces other people's work. It never substitutes for it.

Every finding renders as a **digest**: enough to decide whether it is worth your time, and a canonical link that is more prominent than anything this project wrote. The digest is a short factual summary in our own words — never a creator's prose, never a decklist, never an article body.

The rule of thumb: if a reader could get what they wanted without clicking through to the source, the digest is too long. We drive traffic to creators; we do not intercept it.

This applies to every connector. Sources are read through their public, permitted surfaces — published feeds, documented APIs, and pages their own `robots.txt` allows. Where a source's terms are ambiguous, the resolution is to reduce what we store, not to ask for an exception.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `RktRobinhood/MTG-Edge-Lord`, driven through the `gh` CLI. External PRs are not a request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles use their own names as label strings, plus local `in-progress` and `epic` labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
