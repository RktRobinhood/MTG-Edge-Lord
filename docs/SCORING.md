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

**Combo presence is displayed but never scored.** Combo density correlates with cEDH, and scoring it would quietly drag recommendations back toward the meta this product exists to escape.

### Confidence floor

Roughly 12% of decks carry bracket tags. Below a minimum bracket-tagged deck count, bracket distribution is **displayed but contributes zero** to the score, and the commander is labelled *insufficient data* rather than scored low. Absence of evidence is not evidence of jank.

## Cohort score v1 (new commanders)

Global rank is meaningless for a card released three weeks ago — everything new sits near rank 3,000. New commanders are therefore scored **relative to their own set cohort**.

- **Cohort position:** where it sits among the legends released in the same set.
- **Interest-to-traction ratio:** discussion volume ÷ deck count. High chatter with low builds means people are intrigued but nobody has committed. That is the sleeper.

The high flyers score badly on the ratio precisely because everyone is already building them, which is the intended behaviour. A commander graduates from cohort scoring to the normal Edge score once it has enough decks to clear the confidence floor.

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
