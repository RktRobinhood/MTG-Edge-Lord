# Product requirements

## Problem

EDHREC's own search pulls you back toward the top. Ask it almost anything and it answers with the commanders you already know. There is no way to pin yourself to a band of obscurity and dig around inside it, and no way to ask the question that actually matters when brewing: *is this obscure commander any good?*

Two separate frustrations follow from that:

1. You cannot search the format the way you think about it — by colour, mechanic, theme, budget, and **how off-meta you want to be**, all at once.
2. Nothing tells you whether an unpopular commander is genuinely underrated or simply bad. Obscurity alone is not a recommendation.

## Product promise

One userscript turns EDHREC into a search tool that lets you stay off the beaten path, and a discovery feed that finds off-meta commanders which **demonstrably work**.

The brand line is the quality bar: **cool, different, and still competitive — not jank.** Novelty that wins games, not novelty for its own sake.

## The two functions

### 1. Advanced search (primary)

Search and filter **every commander** — all ~6,800 — locally and instantly.

Axes: colour identity, mana value, creature type, EDHREC theme, functional mechanic tag, price band, rank band, bracket fit, momentum, recency.

The defining behaviour: **results are never sorted by popularity by default.** Popularity is available as a sort, never the fallback. A rank band of 1,000–3,000 is a first-class filter, not a workaround.

### 2. Edge Lord discovery (secondary, and the reason for the name)

A dated feed of off-meta commanders that are showing real signs of life, with the evidence attached and a permanent record of what was surfaced and when.

Findings are produced by a **scheduled daily job**, not by hand. It reads public community sources, judges what it finds, and commits the result to this repository. Every finding links out to the original work.

## Defining "off-meta"

Off-meta is expressed in EDHREC rank, because that is how players experience rarity.

| Tier | Rank | Count | Treatment |
| --- | --- | --- | --- |
| Meta | 1–500 | 500 | Searchable. Baseline, never surfaced as a find. |
| Rare | 500–1,000 | 500 | Seen occasionally. Fully scored. |
| **Edge** | **1,000–3,000** | **2,000** | **The heart of the product.** Fully scored. |
| Uncharted | 3,000+ | ~3,800 | Searchable and filterable, but **unscored** and labelled *insufficient data*. |

Search spans every tier. **Edge Lord surfacing never goes deeper than rank 3,000**, because past that the evidence required to say "this works" does not exist.

This is a data-driven boundary, not an aesthetic one. Around rank 3,000 a commander has roughly 150 decks, of which only ~12% carry bracket tags — about 19 decks. That cannot support a quality judgement. We accept some chaff at the bottom of the Edge tier rather than pretending to certainty we do not have.

## Defining "works, not jank"

Both edge and jank are unpopular. The separator is whether the people who *did* build it were building a real deck.

| Component | Weight | Signal |
| --- | ---: | --- |
| Bracket skew | 40% | Do its decks cluster in Brackets 3–5, or 1–2? |
| Archetype depth | 40% | Does it have a deep high-synergy card pool, or is it goodstuff in a colour identity? |
| Retention | 20% | Do deck saves hold and grow, or spike at set release and die? |

Combo presence is displayed as a flag but is **not** scored — combo density correlates with cEDH and would drag recommendations back toward the meta.

Bracket data is self-reported and thin for obscure commanders, so a **confidence floor** applies: below a minimum bracket-tagged deck count, the distribution is displayed but does not move the score.

## Discovery lanes

1. **Community finds.** Someone is visibly doing the work — a primer, per-card notes, a brewing thread, a deck tech. The signal is *effort*, not mention. Recency raises priority; it does not lower the bar.
2. **New arrivals.** New commanders are judged **against their own set cohort**, not the whole format, since everything new sits at rank 3,000 by default. The target is not the high flyer — it is the commander with genuine interest whose build numbers lag its chatter. High interest ÷ low builds = a sleeper.
3. **Derived momentum.** Movement in EDHREC's own numbers, labelled as an aggregate signal requiring follow-up, never as community consensus.

## Non-goals

- Rebuilding EDHREC or mirroring its datasets. Filtering their public data better is in scope; copying it is not.
- Hosting decklists, primers, transcripts, or creator articles.
- Scraping external sites from users' browsers.
- Accessing any source that forbids automated use.
- Treating a fixed rank threshold as the whole definition of off-meta.
- Claiming objective deck power or competitive viability from popularity alone.
- User accounts, submissions, or votes. The daily job is the contributor.

## Success signals

- You can answer *"Mardu commanders outside the top 1,000, skewing Bracket 3–4, under $200, built around sacrifice"* in one query.
- The feed identifies commanders before they become obvious aggregate recommendations, and the git history proves the date.
- Users follow outbound links to the original creators.
- A broken connector degrades its own lane and nothing else.
- Every score traces back to preserved evidence.
