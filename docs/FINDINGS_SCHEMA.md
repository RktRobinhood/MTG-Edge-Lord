# Findings schema

The executable contract is [`schema/finding.schema.json`](../schema/finding.schema.json). Inbox records omit `score` and `fingerprint`; the pipeline generates both.

Required editorial fields:

- Stable `id` and controlled `findingType`.
- Short original `title` and factual `summary` (never copied creator prose).
- Canonical HTTPS source, creator, source type, and resource depth.
- Publication date and ISO observation timestamp.
- Commander/card entity arrays.
- Evidence strength, independent-source count, conversation depth, reasoned/tested flags.
- Normalized mechanics/archetype tags.

Optional evidence includes concise notes and supporting/rejected alternatives with reasons. Popularity and movement are optional because absence is preferable to invented data.

Resource depth uses `mention | discussion | decklist | primer | deep_dive | community_hub`. Conversation depth separately uses `mention | reasoned | tested | maintained | validated`; one describes the linked resource and the other describes the evidence.

Finding types are `discovery_signal | deep_dive_resource | validation_signal | hidden_card | emerging_brew | relationship_signal`.

## Review checklist

1. Is the canonical source and creator visible?
2. Is the summary factual, short, and independently written?
3. Are independent sources actually independent?
4. Does `tested` have evidence beyond a suggestion?
5. Are popularity values dated?
6. Are rejected alternatives represented fairly?
7. Would the outbound link send the user to the person who did the work?
