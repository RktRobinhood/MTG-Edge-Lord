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
