# Rejected: third-party outreach as a prerequisite for building

**Decided 2026-09-22.** Covers #11 (Space Cow Media permission email) and #12 (Reddit API approval).

## The request

Both issues proposed contacting a company and waiting for a written answer before a lane could ship. #11 asked Space Cow Media to convert an ambiguous terms clause into an explicit yes for EDHREC, Archidekt and Commander Spellbook. #12 asked Reddit for Responsible Builder approval, with an expected latency of weeks.

## Why it was rejected

The project is pre-release with no users. Approaching a company for an exception is a thing you do when you have something to point at and a volume that warrants the conversation. Doing it now spends goodwill on a hypothesis and puts a third party's inbox on the critical path.

There is also no need for it. Everything the product requires is reachable through surfaces the sources publish for exactly this purpose:

- **Documented public APIs** — Scryfall bulk, Commander Spellbook `/variants/`, EDHTop16 GraphQL, Archidekt `/api/` (permitted by their `robots.txt`, with a public staff grant in [forum thread 2832338](https://archidekt.com/forum/thread/2832338)), YouTube Data API.
- **Published feeds** — EDHREC articles, MTGGoldfish, StarCityGames. RSS exists to be read by machines.
- **Ordinary public pages their own `robots.txt` allows** — the cEDH Decklist Database front page.

## The posture that replaces it

Reduce what we store rather than ask permission to store more. We hold source metadata, a short factual summary written in our own words, and a canonical link. No decklists, no primer prose, no article bodies, no transcripts. The link back to the creator is the most prominent element of any finding.

Framed that way we are a referrer, not a mirror, and the terms tension that motivated #11 mostly dissolves: the clause in question restricts automated querying at a scale and character we do not reach.

## Reddit specifically

Reddit stays excluded. `robots.txt` is total exclusion, unauthenticated JSON returns 403, and the Responsible Builder Policy requires approval before access. Without approval there is no permitted path, and mirrors route around the terms rather than satisfying them. See `docs/SOURCES.md`.

Consequence: #19 (Reddit content deletion sweep) is moot. No Reddit content is collected, so there is nothing to sweep.

## When to reopen

Reopen #11 if a Space Cow Media property asks us to stop, if crawl volume grows past the rotated ~300 pages/day this project is designed around, or if the project takes money. Reopen #12 only if Reddit becomes the difference between shipping and not — it currently is not, because Archidekt primers carry the same "someone is trying to make this work" signal through a permitted surface.
