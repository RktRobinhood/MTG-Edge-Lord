# Candidate conventions

How a candidate record is shaped, so the pile stays filterable as it grows.
The executable contract is still [`schema/finding.schema.json`](../../schema/finding.schema.json);
this file covers the editorial decisions the schema cannot express.

## A record is a commander plus a build idea

**One record = one commander + one idea.** Never a card on its own, never a
"good commander" with no idea attached, never a decklist.

- `commanders` carries **exactly one** entry. A record about two commanders is
  two records, or it is one record about whichever one the idea belongs to.
- `cards` carries the **3-8 cards the idea turns on** — the pieces that make the
  line work. It is not a decklist and must never grow into one. If a card could
  be cut without changing the idea, it does not belong in the array.
- `title` states the idea, not the commander. "Vraska's Sculpture tokens are
  creatures, and two builders route around it differently" is an idea.
  "Vraska, Soul of Stone deck tech" is not.

A `hidden_card` finding is the one exception where the card leads, and even then
it is anchored to the commanders that want it.

## Tags are namespaced so they can be filtered

The schema allows any `^[a-z0-9][a-z0-9-]*$` string, which means tags are the
only free-form filterable axis we have. Keep them namespaced or they become
unusable at volume. Every tag uses one of these prefixes:

| Prefix | Meaning | Examples |
| --- | --- | --- |
| `ci-` | Colour identity, WUBRG order, lowercase | `ci-u`, `ci-wb`, `ci-wubrg`, `ci-c` |
| `arch-` | Archetype. Reuse EDHREC's theme vocabulary where one fits | `arch-stax`, `arch-combo`, `arch-reanimator` |
| `mech-` | The specific rules hook the idea turns on | `mech-proliferate`, `mech-summoning-sickness`, `mech-crew` |
| `band-` | Rank bucket at the time of filing | `band-500-1000`, `band-1000-2000`, `band-2000-3000` |
| `recheck-` | Freshness cadence, see below | `recheck-30d`, `recheck-90d`, `recheck-180d` |
| `seed-` | Batch marker for bulk-seeded records | `seed-2026-09` |

`arch-` answers "what kind of deck is this", `mech-` answers "what is the trick".
A record usually has one `ci-`, one or two `arch-`, one or two `mech-`, exactly
one `band-` and exactly one `recheck-`.

`seed-2026-09` marks the records filed during the initial catalogue seeding
rather than found by a normal daily run. They were gathered to give the feed a
starting population, so they are worth a harder look on review than a record
that surfaced on its own.

## Freshness: two clocks, because they rot at different speeds

Commanders move slowly. A rank-1,500 commander is still roughly rank 1,500 three
months later, and an idea that was good in September is usually still good in
December. **Resources rot much faster than ideas do** — a deck gets deleted, a
primer gets rewritten into something else, an article 404s in a site migration.

So the record keeps the two apart:

- **`publishedAt` is the resource's clock.** When the creator wrote it, or last
  updated it. For an Archidekt deck this is `updatedAt`, not the creation date.
- **`observedAt` is our clock.** The moment we fetched the URL and it answered.
  This is what tells a reviewer whether the link was alive recently, and it is
  the only field that proves we actually read the thing.
- **`popularity.asOf` is the catalogue's clock**, carried from `data/`, so rank
  and deck count are never quoted without a date attached.

The `recheck-*` tag says how fast this particular record goes stale, chosen from
what the *source* is rather than what the idea is:

| Tag | Use for | Why |
| --- | --- | --- |
| `recheck-30d` | Tournament and metagame data (EDHTop16) | Results age fastest; last month's conversion rate is a different number now |
| `recheck-90d` | Anything on Archidekt | Decks are mutable and deletable; the primer you read may not be the primer that is there now |
| `recheck-180d` | Published articles, EDHREC rank | The text is immutable; what rots is the link and whether the idea got power-crept |

**Pre-release commanders take the fastest cadence regardless of source.** Pick the
`recheck-*` tag from whichever input rots fastest, and for a commander whose set
has not released yet that is not the article — it is the rank. A preview legend's
EDHREC position is built from a few hundred speculative lists and moves hard in
the weeks after release, so `recheck-30d` applies even when the source is a
stable published article. On 2026-09-23 that covered the three Reality Fracture
(`fra`, releases 2026-10-02) records: Vraska, Liliana the Faultless and Uldaros
Theorix.

A record past its recheck window is not wrong — it is **unverified**. The
distinction matters: re-reading the source either refreshes `observedAt` or
turns up a dead link, and a dead canonical source is grounds for correcting or
removing the finding under the attribution rules in `docs/SOURCES.md`.

## Filtering, in practice

```bash
# every seeded record that leans on a mutable Archidekt deck
jq '[.[] | select(.tags | index("seed-2026-09") and index("recheck-90d"))]' 2026-09-23.json

# everything in the deepest part of the band
jq '[.[] | select(.tags | index("band-2000-3000"))]' *.json

# ideas that turn on a named mechanic
jq '[.[] | select(.tags[] | startswith("mech-"))]' *.json
```

## Validate with the repo's validator, not a hand-rolled one

Before committing, run every record through `createValidator` from
`src/shared/validation.js` against `schema/finding.schema.json` — the same call
`src/pipeline/run.js` makes. Checking required fields and enums by hand is not
enough and has already failed once: on 2026-09-23 nine of ten records were filed
with a `title` over the schema's 140-character limit, which a hand-written check
missed entirely. Nothing caught it until the pipeline refused to build, and
because publication is the only thing that reads the inbox, the records would
have sat there looking filed while every scheduled run died on them.

`title` is a **headline**, not the idea sentence. The claim belongs in `summary`,
which has room for it. If a title runs past about 90 characters it is a sentence
wearing a title's clothes.

## Honesty fields

`evidence.tested` means someone reported games played, not that the line is
theoretically sound. `evidence.conversationDepth` describes the evidence;
`source.resourceDepth` describes the linked resource. They are different axes and
a record often scores `deep_dive` on one and `reasoned` on the other.

`movement` and `popularity` are optional precisely so that absence is available.
Leave a field out rather than inventing a number for it.
