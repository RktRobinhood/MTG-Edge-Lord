# Sources, access, and attribution

## Policy

Prefer official APIs, bulk downloads, and RSS. Identify the bot, rate-limit conservatively, honour `robots.txt` and conditional GET, and cache the previous result as a fallback. Canonical URLs and creator credit are mandatory.

**Accessible is not the same as permitted.** A source that answers an unauthenticated request but forbids automated use in its terms is out of scope, regardless of how easy it would be. Those exclusions are listed below so the decision is not silently revisited.

Access status below was verified on 2026-09-21.

## Approved sources

| Source | Signal | Access |
| --- | --- | --- |
| **Scryfall bulk** | Card identity, colours, types, mana value, price | `oracle_cards` (~25MB gz) + `oracle_tags` (~6MB gz), daily. Scryfall asks broad consumers to use bulk rather than the API. |
| **EDHREC commander JSON** | Rank, deck count, brackets, themes, synergy, save history | Targeted daily walk of public commander pages. `robots.txt` permits; a commanders sitemap is published. |
| **EDHREC articles RSS** | Daily deck tech on specific commanders | `https://edhrec.com/articles/feed`. Supports ETag/Last-Modified. |
| **Archidekt API** | New/updated decks, per-commander deck counts, primers, per-card notes, self-reported bracket | Unauthenticated JSON. `/api/` permitted by `robots.txt`; staff grant permission publicly in [forum thread 2832338](https://archidekt.com/forum/thread/2832338). **Rate limit: 40 req/min** per staff. |
| **Commander Spellbook** | Combo lines with bracket tags | Open API, `robots.txt` is `Allow: /`. |
| **EDHTop16** | cEDH tournament results and win rates | Open GraphQL, `robots.txt` allows all. Use to *subtract* the meta. |
| **YouTube Data API v3** | Deck-tech coverage as an interest signal | Free API key, no billing. Swap `UC`→`UU` for the uploads playlist and poll `playlistItems.list` at 1 unit each. |
| **MTGGoldfish Atom / SCG commander feed** | Article coverage | Permissive `robots.txt`, no anti-scraping clause. |
| **MTGJSON** | Set and card metadata | Open bulk. |
| **cEDH Decklist Database** | Commander→community mapping | Public web page pairing commander names with dedicated Discord invites. A legitimate proxy for community energy without touching Discord's API. |
| **Reddit** | Brewing discussion, reasoning, negative evidence | **Pending.** OAuth only — no unauthenticated tier survives. Requires approval under the Responsible Builder Policy before access; start early. |

### Reddit specifics

Target subs, ranked by density of obscure-commander brewing: **r/EDHBrews** (29k, highest ratio), **r/DegenerateEDH** (24k), **r/PauperEDH** (23k, the format forces obscurity), **r/EDH** (384k, highest volume), r/BudgetBrews (77k), r/CompetitiveEDH (119k).

Earlier drafts of this document listed **r/EDHJank** and **r/CommanderPrecons** — neither exists. r/jankEDH exists but is ~3.6k members with negligible volume.

Constraints once approved: 100 queries/min per client ID, a mandatory User-Agent format, and an obligation to **delete content that has been deleted on Reddit**, sweeping roughly every 48 hours. That last point constrains permanent snapshots in `data/history/`.

## Excluded sources

| Source | Reason |
| --- | --- |
| **Moxfield** | `robots.txt` on both API hosts is `Disallow: /`. Terms §4(c) prohibits robots and spiders; §5 prohibits *"systematic retrieval of data"* to compile a database — a direct description of this pipeline. Legitimate route is a support-issued User-Agent whitelist. |
| **TappedOut** | Terms prohibit accessing content by robot, bot, spider or crawler. Returns 403 to automated clients regardless. |
| **Cubecobra** | Terms prohibit data mining; `robots.txt` blocks all `/api/`. Cube content, not Commander. |
| **Discord** | No read API exists for servers a bot has not joined. Developer Policy #20 bans mining, #15 restricts API data to stated functionality, and **#21 bans LLM use of message content** without express permission. |
| **X / Twitter** | `robots.txt` is `Disallow: /`. No free read tier. |
| **Reddit scraped mirrors** | Technically open and current, but route around Reddit's own terms. Rejected deliberately, not overlooked. |
| **Legacy forums** (MTG Salvation, MTG Nexus, No Goblins Allowed) | All serve bot challenges or `Disallow: /`. |
| **Commander's Herald** | Not a permissions issue — the site is effectively dead for brewing. Budget, pauper and deckbuilding categories last published April 2025; the live feed is political satire. |
| **Twitch** | Permitted via Helix, but the signal is structurally absent: constructed-format streams name decks in titles, **Commander streams name the night or the set, never the commander** — a pod of four players over several hours has no single commander to name. Also note Developer Agreement §VI restricts redistributing Twitch Data, which a public `data/` directory would do. |
| **Bluesky** | Open API, no anti-scraping clause, but near-zero brewing content. Useful as a distribution channel later, not as an input. |
| **MTGGoldfish deck pages** | Metagame percentages are structurally the opposite of off-meta discovery. The article feed is still used. |

## Known terms tension

EDHREC and Archidekt are both owned by Space Cow Media and ship the **same generic terms template**, which prohibits using automated agents to *"generate automated searches, requests, or queries."* This conflicts with Archidekt staff's public grant and with both sites' own `robots.txt`.

Current position: proceed on `robots.txt` plus the explicit staff grant, while remaining non-commercial, low-volume, identified, rate-limited, and linking back rather than mirroring. **Seeking written permission from Space Cow Media is an open action item** — one reply would cover EDHREC's JSON, its articles feed, Archidekt, and Commander Spellbook together.

## Operational notes

- `json.edhrec.com` **403s on `OPTIONS` preflight.** Use a bare `fetch(url)` with no init headers.
- The colorless EDHREC slug is `c` in some paths and 403s; special-case it to `colorless`.
- WordPress category feeds report the **site-wide** latest post in `Last-Modified`. Dedupe on item GUID, never that header.
- Use the YouTube **Data API**, not `feeds/videos.xml` — that path works but is disallowed by YouTube's `robots.txt`.
- Reports that CI/datacenter IPs are blocked are weakly evidenced. Well-diagnosed cases point at HTTP-client and TLS fingerprinting plus path-scoped challenges, which affect a laptop equally. EDHREC sits on CloudFront with no bot-challenge layer and has no blocking reports.

## Attribution rules

- Store title/creator metadata, short original factual summaries, relationship evidence, and canonical links.
- Never store full decklists, transcripts, article text, thumbnails without permission, or substantial excerpts.
- A deep dive should make the creator more visible in the UI than this project.
- When several people independently reach the same interaction, keep every source URL and reflect the true independent-source count.
- Correct or remove a finding when a creator asks, or when the canonical source disappears.

## Connector contract

Connectors have an ID and return findings, or enrich existing findings, plus diagnostics. Network connectors are opt-in locally, fail closed, and cannot erase reviewed input. One connector's failure must degrade only its own lane.

New connectors must document authentication, rate limits, pagination, cache strategy, terms, and test fixtures before being enabled in the daily workflow.
