/**
 * The archive: every commander this project has ever surfaced, and when.
 *
 * The feed is a moving window — a finding ages out and the commander goes with
 * it, which makes the product forgetful in the one way that matters. If Edge
 * Lord surfaced a commander at rank 2,400 eight months ago, that is the most
 * interesting thing it knows about that commander, and until now it was thrown
 * away with the next run.
 *
 * Append-only by construction. Nothing here removes an entry, because the
 * claim being recorded is historical: *we surfaced this, on this date, from
 * this source*. A later run can add to an entry; it can never unsay it.
 *
 * What it stores is a pointer, not a copy. Per `AGENTS.md`, the canonical link
 * stays prominent and the creator keeps the traffic: the archive holds names,
 * dates, links and this project's own rank observation — never a summary of
 * anyone's work.
 */

/** Links kept per commander. Enough to show corroboration, not a link farm. */
export const ARCHIVE_SOURCE_CAP = 6;

export function updateArchive(previous, findings, today, catalog = []) {
  const entries = new Map((previous?.archive ?? []).map((entry) => [entry.slug, entry]));
  const ranks = new Map(catalog.map((commander) => [commander.slug, commander.popularity]));

  for (const finding of findings) {
    for (const commander of finding.commanders ?? []) {
      const existing = entries.get(commander.slug);
      const findingIds = dedupe([...(existing?.findingIds ?? []), finding.id]);
      entries.set(commander.slug, {
        slug: commander.slug,
        name: commander.name ?? existing?.name ?? commander.slug,
        // The date we surfaced it, not the date the source published. The
        // archive is a record of this project's own behaviour.
        firstSurfacedAt: existing?.firstSurfacedAt ?? today,
        lastSurfacedAt: today,
        findingIds,
        timesSurfaced: findingIds.length,
        findingTypes: dedupe([...(existing?.findingTypes ?? []), finding.findingType]).sort(),
        sources: mergeSources(existing?.sources, finding.source),
        // Captured once, at first surfacing, and never updated. A commander
        // that was rank 2,400 when we found it and is rank 700 now is the
        // whole point; overwriting this would erase exactly that.
        ...firstSeenPopularity(existing, ranks.get(commander.slug) ?? finding.popularity)
      });
    }
  }

  return {
    schemaVersion: 1,
    archive: [...entries.values()].sort((a, b) =>
      b.firstSurfacedAt.localeCompare(a.firstSurfacedAt) || a.name.localeCompare(b.name))
  };
}

function firstSeenPopularity(existing, popularity) {
  if (existing?.popularityAtFirstSurface) return { popularityAtFirstSurface: existing.popularityAtFirstSurface };
  if (!popularity?.edhrecRank) return {};
  return {
    popularityAtFirstSurface: {
      edhrecRank: popularity.edhrecRank,
      ...(typeof popularity.deckCount === "number" ? { deckCount: popularity.deckCount } : {}),
      ...(popularity.asOf ? { asOf: popularity.asOf } : {})
    }
  };
}

/** Newest first, deduped by URL, capped. The link is the point of the record. */
function mergeSources(existing, source) {
  if (!source?.url) return (existing ?? []).slice(0, ARCHIVE_SOURCE_CAP);
  const incoming = { name: source.name, url: source.url, ...(source.creator ? { creator: source.creator } : {}) };
  const rest = (existing ?? []).filter((entry) => entry.url !== source.url);
  return [incoming, ...rest].slice(0, ARCHIVE_SOURCE_CAP);
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}
