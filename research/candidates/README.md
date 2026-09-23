# Candidates

Unreviewed output from the daily finds run. See `docs/agents/daily-finds.md`.

Nothing in this directory is a finding yet, and nothing here reaches a user. The `manual` connector reads `research/inbox/` only, so a record sitting here is inert by construction — which is what makes it safe for a scheduled agent run to commit straight to `main`.

## Files

- `YYYY-MM-DD.json` — that run's proposed findings, in the shape `schema/finding.schema.json` describes, minus `score` and `fingerprint`.
- `seen.json` — the ledger of every commander and source URL proposed or rejected, so a later run does not re-chase what an earlier one dismissed.
- `LEADS.md` — links on sources `docs/SOURCES.md` excludes from automated access, parked for a human to read and file by hand.

## Promoting one

Read the record and its source link. If it holds up:

```bash
git mv research/candidates/2026-09-23.json research/inbox/2026-09-23-<slug>.json
```

Split the file first if only one record of several earns it. The next pipeline run picks it up as reviewed input and publishes it; the archive then records the rank it held on the day it was surfaced.

If it does not hold up, delete the record and set that entry's `status` to `rejected` in `seen.json` with the reason. A rejection written down is worth more than a rejection remembered.
