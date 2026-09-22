/**
 * Rolling count of how often each commander has been covered.
 *
 * This is the interest numerator for the cohort score. It has to be
 * accumulated rather than counted per run, because the connectors dedupe:
 * a video is new exactly once, so a single run sees almost nothing. What
 * matters is how much coverage a commander has attracted over a window.
 *
 * Dates only, never content. Coverage is a count of times a source named a
 * commander, not a record of what any source said.
 */

/** Days of coverage history kept. Long enough to span a set's first months. */
export const COVERAGE_WINDOW_DAYS = 60;

export function updateCoverage(previous, candidates, today) {
  const coverage = { ...(previous ?? {}) };
  for (const candidate of candidates) {
    for (const commander of candidate.commanders ?? []) {
      coverage[commander.slug] = [...(coverage[commander.slug] ?? []), today];
    }
  }
  return trimCoverage(coverage, today);
}

export function trimCoverage(coverage, today, windowDays = COVERAGE_WINDOW_DAYS) {
  const cutoff = new Date(new Date(today).getTime() - windowDays * 86400000).toISOString().slice(0, 10);
  const trimmed = {};
  for (const [slug, dates] of Object.entries(coverage ?? {})) {
    const kept = dates.filter((date) => date >= cutoff).sort();
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
