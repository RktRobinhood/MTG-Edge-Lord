# Sources, access, and attribution

## Policy

Prefer official APIs, bulk downloads, and RSS. Identify the bot, rate-limit conservatively, honour `robots.txt` and conditional GET, and cache the previous result as a fallback. Canonical URLs and creator credit are mandatory.

**Accessible is not the same as permitted.** A source that answers an unauthenticated request but forbids automated use in its terms is out of scope, regardless of how easy it would be. Those exclusions are listed below so the decision is not silently revisited.

Access status below was verified on 2026-09-21.

## Approved sources

| Source | Signal | Access |
| --- | --- | --- |
| **Scryfall bulk** | Card identity, colours, types, mana value, price, functional tags | `oracle_cards` (24MB gz) + `oracle_tags` (6MB gz), verified 2026-09-22. Both published as gzipped JSONL and streamed line by line. Scryfall asks broad consumers to use bulk rather than the API; `updated_at` on the bulk index is checked first, so an unchanged file costs one request. |
| **EDHREC commander JSON** | Rank, deck count, brackets, themes, synergy, save history | Targeted daily walk of public commander pages. `robots.txt` permits; a commanders sitemap is published. |
| **EDHREC articles RSS** | Daily deck tech on specific commanders | `https://edhrec.com/articles/feed`. Supports ETag/Last-Modified. |
| **Archidekt API** | New/updated decks, per-commander deck counts, primers, per-card notes, self-reported bracket | Unauthenticated JSON. `/api/` permitted by `robots.txt`; staff grant permission publicly in [forum thread 2832338](https://archidekt.com/forum/thread/2832338). **Rate limit: 40 req/min** per staff. |
| **Commander Spellbook** | Combo lines with bracket tags | Open API, `robots.txt` is `Allow: /`. |
| **EDHTop16** | cEDH tournament results and win rates | Open GraphQL, `robots.txt` allows all. Use to *subtract* the meta. |
| **YouTube Data API v3** | Deck-tech coverage as an interest signal | Free API key, no billing. Swap `UC`→`UU` for the uploads playlist and poll `playlistItems.list` at 1 unit each. |
| **MTGGoldfish Atom / SCG commander feed** | Article coverage | Permissive `robots.txt`, no anti-scraping clause. |
| **MTGJSON** | Set and card metadata | Open bulk. |
| **cEDH Decklist Database** | Commander→community mapping | Public web page pairing commander names with dedicated Discord invites, verified 2026-09-22: 158 pairs parsed, 113 matching the catalogue. Only the invite link is stored; no community content is read. A legitimate proxy for community energy without touching Discord's API. |

### What replaces Reddit

Reddit would be the best brewing signal that exists. It is also unreachable
without approval: `robots.txt` is total exclusion, unauthenticated `.json`
endpoints return 403, and the Responsible Builder Policy requires approval
*before* access.

**We are not pursuing that approval** (decided 2026-09-22; see
`.out-of-scope/third-party-outreach.md`). Approaching a company for an
exception is something to do with a shipped product and a volume that warrants
the conversation, and the signal is available elsewhere: **Archidekt primers
and per-card notes** are the same "someone is trying to make this work"
evidence, structured, unauthenticated and explicitly permitted.

Reddit moves to the excluded list below, alongside its mirrors.

## Excluded sources

| Source | Reason |
| --- | --- |
| **Moxfield** | `robots.txt` on both API hosts is `Disallow: /`. Terms §4(c) prohibits robots and spiders; §5 prohibits *"systematic retrieval of data"* to compile a database — a direct description of this pipeline. Legitimate route is a support-issued User-Agent whitelist. |
| **TappedOut** | Terms prohibit accessing content by robot, bot, spider or crawler. Returns 403 to automated clients regardless. |
| **Cubecobra** | Terms prohibit data mining; `robots.txt` blocks all `/api/`. Cube content, not Commander. |
| **Discord** | No read API exists for servers a bot has not joined. Developer Policy #20 bans mining, #15 restricts API data to stated functionality, and **#21 bans LLM use of message content** without express permission. |
| **X / Twitter** | `robots.txt` is `Disallow: /`. No free read tier. |
| **Reddit** | `robots.txt` is `Disallow: /`, unauthenticated `.json` returns 403, and the Responsible Builder Policy requires approval before access. We are not seeking it (2026-09-22) — see `.out-of-scope/third-party-outreach.md`. |
| **Reddit scraped mirrors** | Technically open and current, but route around Reddit's own terms. Rejected deliberately, not overlooked. |
| **YouTube RSS** (`/feeds/videos.xml`) | Works without a key, but YouTube's `robots.txt` explicitly disallows it and their terms permit automated access only for search engines honouring robots.txt. The Data API is the clean path and is what this project uses. |
| **Commander's Herald** | Not a terms problem: its budget, pauper and deckbuilding categories last published in April 2025, and the live feed is political satire. Wiring it in would inject US political commentary into a Magic tool. |
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

## Terms tension, and the position we take

EDHREC and Archidekt ship the same generic terms template, which prohibits
using automated agents to *"generate automated searches, requests, or
queries."* That sits awkwardly beside both sites' own `robots.txt`, which
permit the paths used here, and beside Archidekt staff's public grant in
[forum thread 2832338](https://archidekt.com/forum/thread/2832338).

**We are not seeking a written exception** (decided 2026-09-22;
`.out-of-scope/third-party-outreach.md`). The resolution is to reduce what we
store rather than ask permission to store more:

- Reads are targeted, identified, rate-limited and rotated. The EDHREC crawl
  is ~300 pages a day at 600ms; Archidekt is held to the 40 req/min its staff
  stated.
- Every request carries a User-Agent naming this repository.
- We store source metadata, a short factual summary in our own words, and a
  canonical link. Never a decklist, a primer's prose, an article body or a
  transcript.
- The UI makes the original source more prominent than anything we wrote, and
  the whole finding card links out.

That makes this project a referrer rather than a mirror, which is the
substance of what an exception would have been asking for.

**Reopen the question** if a source asks us to stop, if crawl volume grows
past the rotated budgets above, or if the project takes money.
