# Repository operating notes

MTG Edge Lord is a Tampermonkey userscript backed by static, generated JSON. It does three things: **advanced search across every Commander**, **a daily Edge Lord discovery feed** for off-meta commanders that demonstrably work, and **an append-only archive** of every commander the feed has surfaced. The old Chrome extension architecture is intentionally retired.

## Invariants

- Keep collection out of the userscript. It fetches only this repository's generated `data/` files and never calls a third party from a user's browser.
- Preserve raw evidence and canonical outbound URLs. Never copy substantial creator prose, decklists, videos, or primers.
- Treat every external source as a replaceable connector. One failure must degrade only its own lane.
- Derived scores retain components and human-readable reasons. An unscored entity is labelled unscored, never given a zero.
- Generated files live in `data/` and must pass validation. `research/inbox/` is curated input: the daily finds run files into it, and so can a person.
- The archive is append-only and records the rank a commander held **when it was surfaced**. A later run may add to an entry; nothing may unsay one, and refreshing that rank would erase the only claim the archive makes.
- **Any change the userscript ships raises its version.** `package.json` is the single source of `@version`, and Tampermonkey updates an installed script only when that number rises. An unbumped change reaches nobody, and from the user's side it is indistinguishable from a change that did not work.
- Search covers every commander. **Edge Lord surfacing never goes deeper than EDHREC rank 3,000** — past that the evidence to say "this works" does not exist.

## Source access

Access rules live in `docs/SOURCES.md`, which records what was verified and when. Two standing rules:

- **Check the source's own policy before adding a connector.** `robots.txt`, terms, and any published operator statement. Record the finding in `docs/SOURCES.md` with the date.
- **Accessible is not permitted.** Several sources answer unauthenticated requests while forbidding automated use. The exclusion list in `docs/SOURCES.md` is a decision, not an oversight — do not quietly re-add Moxfield, TappedOut, Discord, or Reddit mirrors.

Approved automated reads are targeted, identified, rate-limited, cached, and conditional where the source supports it. Archidekt's documented limit is 40 req/min. EDHREC is walked once per scheduled build with a delay between pages.

## LLM use in the pipeline

The daily job uses a model to judge whether a community signal is a genuine find. Findings it produces are non-deterministic, so every finding keeps its source link prominent and a reader can check the model's work.

**Findings publish straight to `main`, with no review gate.** The feed is meant to be a slow daily trickle, and a gate that waited on a human stranded eleven finds on an unopened PR branch for a day. A bad finding is fixed forward in a later commit. The archive's append-only rule still holds: a fix may correct a finding, never unsay that it was surfaced.

**No pull requests and no side branches.** Every agent and workflow commits to `main` directly. A branch nobody is watching is where work goes to be forgotten.

Never feed a model content from a source whose terms forbid it — Discord's Developer Policy #21 is the explicit case.

## Definition of done

Run `npm run check`. It regenerates `data/` offline as a side effect, so on a change that is not about data, `git restore data` and delete any new `data/history/` file before committing. When you do commit data by hand, skim the diff for attribution, dates, URLs and score sanity.

**If the change touches anything the built script carries** — `src/userscript/`, the `src/shared/` modules it imports, or the build itself — raise `version` in `package.json` in the same commit and rebuild, so `mtg-edge-lord.user.js` and its `@version` ship together. `npm run check` rebuilds but it cannot know that the behaviour changed, so the bump is a judgement and never automatic. Patch for a fix nobody would describe, minor for anything a user would notice.

Changes to `data/`, `research/` or the docs do not bump it: the panel re-reads published data on its own, and versioning it would push a script update for content the installed script already handles.

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

### Daily finds

A scheduled agent run reads permitted community sources once a day, files
what it finds under `research/candidates/`, promotes the ones that clear the
bar into `research/inbox/`, and pushes to `main`. The scheduled build runs
after it and publishes those records the same day. The finds run never runs
the network pipeline, never writes `data/`, and never opens an excluded
source. See `docs/agents/daily-finds.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
