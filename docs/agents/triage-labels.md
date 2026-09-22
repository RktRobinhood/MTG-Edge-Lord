# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Local additions

These are not part of the canonical five. They exist so a human can see, at a glance, what an agent is holding.

| Label         | Meaning                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `in-progress` | An agent has claimed this issue and is working on it **right now**                   |
| `epic`        | A tracking issue. Not directly implementable; its children carry `ready-for-agent`   |

### Rules for `in-progress`

- Apply it **before** the first write to the working tree for that issue, alongside `ready-for-agent`.
- Remove it when the work lands or is abandoned. Never leave it on a closed issue.
- More than one `in-progress` issue at a time is allowed only when the work is genuinely parallel.
- `epic` and `in-progress` are mutually exclusive: an epic is progressed through its children.
