# Scoring

Every score here is a ranking aid, not a claim of objective deck strength. All components are 0–100, stored alongside the total with human-readable reasons and a `modelVersion`.

## Edge score v1

The headline number. Answers: *is this commander both genuinely off-meta and demonstrably functional?*

```
edgeScore = obscurity × worksScore
```

Multiplicative, not additive — a commander must be **both**. A popular-but-good commander and an obscure-but-bad one should each score near zero, and an additive model would rank both mid-table.

### Obscurity

Derived from EDHREC rank on a curve, not a cutoff. Peaks across the Edge tier (rank 1,000–3,000), falls off through Rare (500–1,000), reaches zero inside the top 500. Commanders past rank 3,000 are **not scored at all** — see the confidence floor below.

### Works score

| Component | Weight | Input |
| --- | ---: | --- |
| Bracket fit | 40% | Self-reported bracket distribution across a commander's decks |
| Archetype depth | 40% | Size and strength of the high-synergy card pool |
| Retention | 20% | Deck-save trend over time, penalising release spikes |

**Bracket fit** is the share of decks built at a competitive power level:

```
bracketFit = (1.0·B3 + 1.0·B4 + 0.6·B5) ÷ (B1 + B2 + B3 + B4 + B5)
```

Brackets 1 (Exhibition) and 2 (Core) contribute nothing to the numerator but stay in the denominator, so a commander dominated by precon-level builds scores low automatically and Bracket 1 needs no special case. Bracket 5 is weighted 0.6 so cEDH presence helps without letting a pure-cEDH commander top the chart — cEDH is a different meta, not an off-meta build.

**Archetype depth** separates a real deck from goodstuff in a colour identity. A commander with a deep pool of genuinely high-synergy cards has an archetype; one with none is a pile of staples.

**Retention** catches the set-release trap. Jank gets tried once. Edge gets rebuilt.

It measures the most recent fortnight against the commander's **own highest week**, not against its earlier average. The question is whether the interest it attracted is still there, and "is it growing" is already answered independently by `momentum` — rewarding growth here would count it twice. Holding steady therefore scores 1, and a commander that shed two thirds of a spike scores about 0.3.

Retention is also **not measured below ten saves in the peak week**. At four a week one deck moves the ratio by a quarter, and the component carries 20% of the works score — a commander reached the top 100 on a peak of four. Low volume is not thereby ignored; obscurity and deck count already measure it. This says only that reading a *trend* needs enough signal.

A peak inside the final fortnight that sits well above the preceding fortnight returns **no value at all**, and the component is dropped. That is a commander people have only just picked up, where no retention evidence exists in either direction; an earlier two-half comparison gave those full marks, which handed maximum retention to precisely the untested spike this component exists to catch.

**Combo presence is displayed but never scored.** Combo density correlates with cEDH, and scoring it would quietly drag recommendations back toward the meta this product exists to escape.

### Confidence floor

Roughly 12% of decks carry bracket tags. Below **30 bracket-tagged decks**, bracket distribution is **displayed but contributes zero** to the score, and the commander is labelled *insufficient data* rather than scored low. Absence of evidence is not evidence of jank.

**Bracket fit gates the score.** It is the only direct evidence that a commander is built to win, so a commander below the floor is unscored rather than ranked on the other two components. Without that rule the top of the default sort fills with commanders we know least about: archetype depth and retention alone put a commander with 13 bracket-tagged decks above one with 438. In practice the rule costs little — 2,457 of the 2,501 commanders in the scored band clear the floor.

A commander missing one of the *other* components — no save history yet, say — is not scored zero on it. The missing component is dropped, the remaining weights renormalise, and the result is flagged `partialScore`. An unscored commander carries a readable reason and sorts last rather than being ranked as a zero.

### Implementation

`src/shared/edge-score.js`. Obscurity is zero inside the top 500, rises linearly through the Rare tier, is flat at 1 across rank 1,000–3,000 and is zero past 3,000. Archetype depth is the mean synergy of the high-synergy card pool scaled by how full that pool is, so two strong cards cannot beat eight. Retention compares the most recent half of the weekly save trend against the earlier half, where holding steady maps to 0.5.

## Cohort score v1 (new commanders)

Global rank is meaningless for a card released three weeks ago — everything new sits near rank 3,000. New commanders are therefore scored **relative to their own set cohort**.

- **Cohort position:** where it sits among the legends released in the same set.
- **Interest-to-traction ratio:** discussion volume ÷ deck count. High chatter with low builds means people are intrigued but nobody has committed. That is the sleeper.

The high flyers score badly on the ratio precisely because everyone is already building them, which is the intended behaviour. A commander **graduates** to the normal Edge score at 400 decks, or when it ages out of the 120-day release window.

Two guards keep this lane honest. A new commander needs **at least 50 decks** before its position in a set means anything — at 16 decks, sitting 141st of 231 is a fact about nobody having built anything yet. And the two components are **not renormalised** when one is missing, unlike the Edge score: interest-to-traction is the discriminating half, so a position-only score is discounted to the evidence behind it and tops out at **60** rather than 100. Without that, every commander scored while the YouTube lane was off came back near the top of the scale.

**The two scores are mutually exclusive.** Inside the window, before graduation, a commander carries a cohort score or nothing — never an Edge score, because the rank that score is built on is the very thing this section says is meaningless for a new card. A new arrival that misses the cohort bar is unscored rather than falling back to an Edge score.

Cohort position rewards the overlooked middle of a set, not its top: the set leader is the commander everyone is already building. The interest numerator comes from the discovery lanes' rolling 60-day coverage window; without it the score degrades to cohort position alone and is flagged partial. A new commander is **never surfaced merely for being new** — it must clear a minimum cohort score to carry one at all.

`src/shared/cohort-score.js`.

## Finding score v1

Applies to individual community findings in the discovery feed.

| Component | Weight | Inputs |
| --- | ---: | --- |
| Obscurity | 30% | Rank and deck-count curves, not a cutoff |
| Community | 20% | Evidence strength, independent sources, discussion depth |
| Expert work | 20% | Resource depth from mention through primer/deep dive |
| Mechanical | 15% | Reasoned interaction, testing, number of concrete cards |
| Momentum | 10% | Strongest available 7/30/90-day movement |
| Validation | 5% | Results or explicitly validated evidence |

Missing popularity data is treated conservatively rather than automatically making a result obscure. Weights are exported constants, deliberately easy to recalibrate once historical labels exist.

## Relationship score v1

Card↔commander edges:

- Commander inclusion: 25%
- EDHREC synergy: 30%
- Inverse global popularity: 20%
- Evidence strength: 25%

Missing raw metrics stay empty and are never invented. Community evidence can surface an early edge; later structured data may strengthen or weaken it.

## Guardrails

- Preserve components and raw inputs next to every total.
- Never boost raw mention volume without independence or depth signals.
- A tournament appearance is validation, not proof of universal deck quality.
- Negative evidence may lower a component but must remain readable rather than silently disappearing.
- **Effort, not mention.** A primer or per-card notes outweighs any number of name-drops.
- An unscored commander is labelled as unscored. It is never shown a zero.
