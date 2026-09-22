/**
 * Rolling count of how often each commander has been covered.
 *
 * This is the interest numerator for the cohort score. It has to be
 * accumulated rather than counted per run, because the connectors dedupe:
 * a video is new exactly once, so a single run sees almost nothing. What
 * matters is how much coverage a commander has attracted over a window.
 *
 * Dates and attribution only, never content. Coverage records that a source
 * named a commander on a day; it never records what the source said. The
 * source name is kept because a count that cannot tell three videos from one
 * channel apart from three channels is not an interest signal — it is a
 * measure of how prolific one creator is.
 */

/** Days of coverage history kept. Long enough to span a set's first months. */
export const COVERAGE_WINDOW_DAYS = 60;

/** Half the window. Recent coverage is compared against the half before it. */
export const COVERAGE_TREND_DAYS = 30;

export function updateCoverage(previous, candidates, today) {
  const coverage = {};
  for (const [slug, entries] of Object.entries(previous ?? {})) coverage[slug] = entries.map(readEntry);
  for (const candidate of candidates) {
    const source = sourceKey(candidate);
    for (const commander of candidate.commanders ?? []) {
      coverage[commander.slug] = [...(coverage[commander.slug] ?? []), { date: today, source }];
    }
  }
  return trimCoverage(coverage, today);
}

export function trimCoverage(coverage, today, windowDays = COVERAGE_WINDOW_DAYS) {
  const cutoff = dateBefore(today, windowDays);
  const trimmed = {};
  for (const [slug, entries] of Object.entries(coverage ?? {})) {
    const kept = entries.map(readEntry).filter((entry) => entry.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
    if (kept.length) trimmed[slug] = kept;
  }
  return trimmed;
}

/** Attaches `mentionCount` where there is coverage; absent where there is none. */
export function applyCoverage(commanders, coverage) {
  return commanders.map((commander) => {
    const mentionCount = coverage?.[commander.slug]?.length;
    return mentionCount ? { ...commander, mentionCount } : commander;
  });
}

/**
 * The shape of a commander's coverage over the window, rather than its total.
 *
 * Returns `null` wherever the window cannot support a claim. That is the
 * common case and the one that matters: the window is 60 days, the history is
 * young, and most commanders have one date or none. A ratio against an empty
 * baseline is the failure mode this guards — a first-ever mention is not
 * infinite growth, so the comparison is smoothed and the gates below are
 * counts, which an empty window cannot satisfy by accident.
 */
export function coverageTrend(entries, today, trendDays = COVERAGE_TREND_DAYS) {
  const normalized = (entries ?? []).map(readEntry);
  if (!normalized.length) return null;
  const split = dateBefore(today, trendDays);
  const recent = normalized.filter((entry) => entry.date >= split);
  const prior = normalized.filter((entry) => entry.date < split);
  const sources = new Set(recent.map((entry) => entry.source).filter(Boolean));
  const activeDays = new Set(recent.map((entry) => entry.date));
  return {
    recent: recent.length,
    prior: prior.length,
    // An unattributable record cannot corroborate anything, so it counts for
    // nothing here even though it still counts toward `mentionCount`.
    independentSources: sources.size,
    activeDays: activeDays.size,
    // Smoothed, so a jump from nothing to something is bounded rather than
    // dividing by zero into an enormous number.
    ratio: (recent.length + 1) / (prior.length + 1)
  };
}

/** Accepts the legacy date-string form alongside the attributed form. */
function readEntry(entry) {
  return typeof entry === "string" ? { date: entry, source: null } : { date: entry.date, source: entry.source ?? null };
}

function sourceKey(candidate) {
  const source = candidate.source ?? {};
  return source.creator ?? source.name ?? null;
}

function dateBefore(date, days) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - days * 86400000).toISOString().slice(0, 10);
}
