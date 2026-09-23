/**
 * Findings render as **digests**, not as replacements for the source.
 *
 * `AGENTS.md` sets the posture: this project surfaces other people's work and
 * sends traffic to them. The rule of thumb is that if a reader can get what
 * they wanted without clicking through, the digest is too long. So the source
 * is the most prominent element, the whole card is a link, and the summary is
 * capped here rather than by the good intentions of whoever wrote it.
 */

/** Characters of summary rendered. Enough to decide; not enough to substitute. */
export const SUMMARY_LIMIT = 220;

export function truncateSummary(summary, limit = SUMMARY_LIMIT) {
  const text = String(summary ?? "").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * A finding with no canonical URL is unattributable, which is a bug in the
 * pipeline rather than something to paper over. Failing closed means such a
 * finding never reaches a reader as if it were our own work.
 */
export function isAttributable(finding) {
  const url = finding?.source?.url;
  return typeof url === "string" && /^https:\/\//.test(url);
}

export function attributableFindings(findings) {
  return (findings ?? []).filter(isAttributable);
}

/** What the card credits, preferring the person over the platform. */
export function sourceLabel(source) {
  const creator = String(source?.creator ?? "").trim();
  const name = String(source?.name ?? "").trim();
  if (creator && name && creator.toLowerCase() !== name.toLowerCase()) return `${creator} · ${name}`;
  return creator || name || "Source";
}

/**
 * Finds painted in the feed at once.
 *
 * The feed is a digest, not an archive: ten is what a reader will actually
 * read before scrolling stops being reading. Everything else is still in the
 * dataset and still reachable — by searching, or by asking for more — so this
 * caps what is *shown* and never what is *there*.
 */
export const FEED_PAGE_SIZE = 10;

/**
 * Newest first, by when we surfaced it rather than when the creator wrote it.
 *
 * `observedAt` is the feed's clock: a primer from June that we read today is
 * new to the reader today, and burying it under an article published
 * yesterday would hide the thing the run just found.
 *
 * It is compared by **day**, not by timestamp. Within one run the minute a
 * page was fetched is an artifact of the crawl order and says nothing to a
 * reader, so a batch is ordered by `publishedAt` instead — freshest source at
 * the top — and the score settles what is left.
 */
export function recentFirst(findings) {
  return [...(findings ?? [])].sort((a, b) =>
    day(b.observedAt).localeCompare(day(a.observedAt))
    || stamp(b.publishedAt) - stamp(a.publishedAt)
    || (b.score?.total ?? 0) - (a.score?.total ?? 0));
}

/** ISO dates and ISO timestamps both start with the day, which is all this compares. */
function day(value) {
  return String(value ?? "").slice(0, 10);
}

/** An unparseable or missing date sorts last rather than throwing the order out. */
function stamp(value) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}
