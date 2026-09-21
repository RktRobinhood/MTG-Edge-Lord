# Repository operating notes

MTG Edge Lord is a Tampermonkey userscript backed by static, generated JSON. The old Chrome extension architecture is intentionally retired.

## Invariants

- Keep collection out of the userscript. It fetches only this repository's generated `data/` files.
- Preserve raw evidence and canonical outbound URLs. Never copy substantial creator prose, decklists, videos, or primers.
- Treat every external source as a replaceable connector. One failure must not abort other connectors.
- `research/inbox/` is human-reviewable source input. Generated files live in `data/` and must pass validation.
- Derived scores retain components and human-readable reasons.
- Do not bulk-crawl Reddit, EDHREC, Moxfield, Archidekt, or creator sites without documented permission/API terms.

## Definition of done

Run `npm run check`. Review generated-data diffs for attribution, dates, URLs, and meaningful novelty before committing.
