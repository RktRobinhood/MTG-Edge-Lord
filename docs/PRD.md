# Product requirements

## Problem

Commander discovery is dominated by aggregate popularity. That makes it easy to find established commanders and staples, but hard to find an obscure commander with a real community, an underplayed card with a specific home, or a new relationship that has not yet reached aggregate recommendation pages.

## Product promise

One userscript turns EDHREC into a research-backed discovery surface for interesting, underplayed, and emerging Commander choices. Every surfaced result answers: what appeared, why it matters, how strong the evidence is, and where the original work lives.

## Primary journeys

1. **Commander-first:** obscure commander → unusual cards → discussions, lists, primers, and validation.
2. **Card-first:** interesting card → unusually strong card/commander edges → obscure commanders.
3. **Signal-first:** new thread, video, primer, combo, or result → normalized relationships → statistical/mechanical assessment.
4. **Recent finds:** a compact, date-aware feed of meaningful new signals rather than raw mention volume.

## Functional requirements

- Filter and sort commanders by name, current popularity data, Diamond score, and momentum.
- Show hidden-tech cards and reverse card-to-commander relationships.
- Explain every score with component values and concise reasons.
- Link visibly to the canonical creator/community source.
- Preserve negative evidence and rejected alternatives.
- Cache versioned static data and remain usable from the last good cache when GitHub is unavailable.
- Avoid coupling core UI behavior to EDHREC's internal DOM.

## Research quality bar

Random mentions do not become findings by default. Stronger evidence includes independent discussion, reasoned interactions, tested or maintained lists, repeat brewer work, curated primers, and outcome data. Discovery and validation are separate labels. A creator's work is credited and linked, never mirrored.

## Non-goals

- Rebuilding EDHREC or bulk copying its datasets.
- Hosting copied decklists, primers, transcripts, or creator articles.
- Scraping external sites from users' browsers.
- Treating a fixed rank threshold as the definition of off-meta.
- Claiming objective deck power or competitive viability from popularity alone.

## Success signals

- Users follow outbound links to original research.
- Findings repeatedly identify relationships before they become obvious aggregate recommendations.
- Broken connectors degrade independently and do not break the feed.
- A result's score can be traced back to preserved evidence.
