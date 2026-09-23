# Daily finds: the research run

A scheduled agent run that hunts for **diamonds in the rough** — off-meta commanders and off-meta ideas that people are visibly doing the work on — and files what it finds as reviewable candidates.

It is the reading half of Edge Lord discovery. The `.github/workflows/daily-research.yml` build is the counting half: it crawls, scores and judges connector metadata at volume. This run does the thing that build cannot — it follows a link, reads what a person actually wrote, and decides whether there is a real idea in it.

## What this run is not

- **It never runs the pipeline.** `npm run research:network` walks EDHREC and Archidekt for tens of minutes and moves the rotation cursors in `state/connectors.json`. That is the scheduled workflow's job, and a second walk would start tomorrow's crawl from the wrong place. This run reads `data/` as it stands and leaves `state/` alone.
- **It never writes `data/`.** Nothing this run produces reaches a user's browser. Generated data comes from the pipeline, and model-written findings reach the feed only after a human moves them.
- **It never crawls.** A handful of targeted page reads, spaced out. If a question needs a hundred requests to answer, it is the pipeline's question, not this one's.

## The bar

`docs/PRD.md` sets it: **cool, different, and still competitive — not jank.** Novelty that wins games.

The separator is **effort, not mention**. A primer, an explained mechanical interaction, a report of games played, per-card notes, a considered deck tech — those are effort. A name in a set review, a top-ten roundup, a commander used as an example — those are mentions, however enthusiastic.

Surfacing band, from `docs/PRD.md`:

| Rank | Treatment for this run |
| --- | --- |
| 1–500 | Meta. Never a find. |
| 501–3,000 | The band. Everything filed sits here. |
| 3,000+ | Too thin to judge. Not filed, even when the idea is charming. |

`node scripts/check-candidate.js "<name>"` answers the band question and the have-we-had-this question together. Run it before writing anything up.

New commanders are the standing exception, because everything new sits near rank 3,000 by default. Judge those against their own set cohort — the target is not the high flyer, it is the one whose chatter outruns its build count.

## Where to look

Read the approved list in `docs/SOURCES.md` first; it is the authority and it carries verification dates. In practice this run's surfaces are:

- **EDHREC articles** — deck techs on specific commanders, via `https://edhrec.com/articles/feed`.
- **Archidekt** — primers and per-card notes, the best "someone is trying to make this work" evidence that is explicitly permitted. Staff limit is 40 req/min; this run will not come near it.
- **cEDH Decklist Database** — the Brewer's Corner is a discovery signal, promotion out of it a validation signal.
- **Commander Spellbook** and **EDHTop16** — combo lines and tournament results, used to *confirm* a line or to subtract the meta.
- **Creator channels that hunt obscure commanders** — Panzer MTG, Unpopular MTG, and anyone else who earns a place by covering what the meta does not. A deck tech from a channel that specialises in off-meta is worth more than one from a channel covering whatever is popular.
- **Article feeds** — MTGGoldfish, SCG.
- **Web search**, to find the above. Searching is fine; what matters is where the run then goes to read.

### What is off-limits, and what to do instead

`docs/SOURCES.md` excludes Reddit, Moxfield, TappedOut, Discord, X, and Reddit's scraped mirrors. Those exclusions are decisions with reasons, not gaps — do not route around them, and do not fetch those domains.

The exclusion is about **automated access, not about links**. A person who reads a public thread and writes a summary in their own words is doing what any reader does; a scheduled job that queries the site every morning is the thing the terms forbid. This run is the second one.

So when a search result points at an excluded source and looks genuinely promising, **do not open it**. Append it to `research/candidates/LEADS.md` — the URL, the commander, and why it looked worth a look — and leave it for a human to read and file through `research/inbox/` by hand. `research/inbox/2026-09-20-massimo-vraska.json` is what that looks like when it works.

## What a run produces

Three files, all under `research/candidates/`, and nothing else:

**`YYYY-MM-DD.json`** — an array of finding-shaped records, valid against `schema/finding.schema.json` minus `score` and `fingerprint` (the pipeline generates both). `docs/FINDINGS_SCHEMA.md` describes the fields; the existing inbox record is the worked example. Zero to three records. Three is a good day.

Every record obeys the attribution rules in `AGENTS.md`: a short factual summary **in our own words**, never the creator's prose, never a decklist, never an article body. If a reader could get what they wanted without clicking through, the summary is too long.

**`seen.json`** — the ledger, updated every run. It holds every commander and every source URL the run has proposed *or rejected*, with a date and a one-line reason. Rejections are the valuable half: they are recorded nowhere else, and they are what stops tomorrow's run re-chasing a lead today's already dismissed.

```json
{ "slug": "...", "name": "...", "status": "candidate", "firstSeenAt": "...", "lastSeenAt": "...", "reason": "..." }
```

`status` is one of `published` (in `data/findings.json`), `filed` (in `research/inbox/`), `candidate` (proposed, awaiting review), `rejected` (judged not a find), or `lead` (parked for a human).

**`LEADS.md`** — dated sections of links on excluded sources, for a human to read by hand.

## The novelty gate

**A run that finds nothing meaningful writes nothing and commits nothing.** Silence is a valid outcome and the expected one on many days. There is no quota; padding a thin day with a passing mention is the one failure mode that damages the feed, because a feed of maybes is indistinguishable from a feed of nothing.

Deduplication is not novelty. `check-candidate.js` stops a repeat; it says nothing about whether a first-time find was worth surfacing. That judgement is the run's own, and the bar above is the whole of it.

## Committing

Commit only `research/candidates/`. Push to `main`.

Candidates are inert: no connector reads that directory, so nothing here can reach a user by accident. That is what makes a direct commit safe, and it is also why a candidate is not a finding yet.

**Promotion is a human act.** A reviewer who agrees with a candidate moves the record into `research/inbox/`, where the `manual` connector picks it up as reviewed input and the next pipeline run publishes it. Moving the file *is* the review; that is the whole ceremony.

## Reporting

End the run with a short report: what was read, what was filed, what was rejected and why. On a silent day, say so in one line — the run that finds nothing and says nothing is indistinguishable from the run that crashed.
