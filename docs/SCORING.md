# Scoring

Diamond scoring is a ranking aid, not a claim of objective deck strength.

## Finding score v1

| Component | Initial weight | Inputs |
| --- | ---: | --- |
| Obscurity | 30% | Rank and deck-count curves, not a cutoff |
| Community | 20% | Evidence strength, independent sources, discussion depth |
| Expert work | 20% | Resource depth from mention through primer/deep dive |
| Mechanical | 15% | Reasoned interaction, testing, number of concrete cards |
| Momentum | 10% | Strongest available 7/30/90-day movement |
| Validation | 5% | Results or explicitly validated evidence |

Every component is 0–100. The total is the weighted sum and stores `modelVersion: diamond-v1`. The generated record also carries up to five plain-language reasons.

Missing popularity data is treated conservatively rather than automatically making a result obscure. The weights are exported constants and are deliberately easy to calibrate once historical labels exist.

## Relationship score v1

Card↔commander edges use:

- commander inclusion: 25%
- EDHREC synergy: 30%
- inverse global popularity: 20%
- evidence strength: 25%

Missing raw statistical metrics remain empty; they are never invented. Community evidence can surface an early edge, but later structured data may strengthen or weaken it.

## Guardrails

- Preserve components and raw inputs next to totals.
- Never boost raw mention volume without independence/depth signals.
- A tournament appearance is validation, not proof of universal deck quality.
- Negative evidence may lower a future component, but must remain readable rather than silently disappearing.
