const PAGE_BASE = "https://json.edhrec.com/pages/commanders/";

/**
 * The scored band. Below 500 a commander is meta and not what this product is
 * for; past 3,000 the evidence to say "this works" does not exist, which is an
 * invariant in `AGENTS.md`, so there is nothing to crawl.
 */
export const SCORED_BAND = Object.freeze({ minRank: 500, maxRank: 3000 });

/**
 * Pages fetched per scheduled run. ~2,500 commanders are in band, so the whole
 * band refreshes in about eight days. A full 6,792-page crawl would be ~543MB
 * and over an hour; this is ~24MB and ~3 minutes, which is an ordinary amount
 * of traffic and defensible if EDHREC ever asks.
 */
export const PAGES_PER_RUN = 300;

/** Floor between requests, matching the catalogue walk. */
export const REQUEST_DELAY_MS = 600;

/** Themes kept per commander, most-played first. Enough to filter on. */
const MAX_THEMES = 8;

/** High-synergy cards kept per commander; the depth signal saturates well before this. */
const MAX_SYNERGY_CARDS = 8;

/** Similar commanders kept per commander, for the detail panel. */
const MAX_SIMILAR = 6;

/** Weeks of save history kept. Retention is a trend, not a daily series. */
const RETENTION_WEEKS = 8;

export const edhrecPagesConnector = {
  id: "edhrec-pages",
  network: true,

  /**
   * Fetches individual commander pages for a rotated slice of the scored band.
   *
   * Rotation is by slug rather than by index, so a commander entering or
   * leaving the band between runs shifts the cursor by one commander instead
   * of resetting the rotation.
   */
  async enrichCatalog(commanders, context) {
    const diagnostics = [];
    const state = context.state ?? {};
    const band = inBand(commanders);
    if (!band.length) return { commanders, diagnostics: ["No commanders in the scored band; nothing to crawl."], state };

    const slice = rotateSlice(band, state.cursor, context.pagesPerRun ?? PAGES_PER_RUN);
    const enriched = new Map();
    let failures = 0;

    for (const [index, commander] of slice.entries()) {
      try {
        enriched.set(commander.slug, pageFacts(await fetchPage(commander.slug, context.fetch)));
      } catch (error) {
        failures += 1;
        diagnostics.push(`${commander.slug}: ${error.message}; kept the previous page data.`);
      }
      if (index < slice.length - 1) await context.sleep(REQUEST_DELAY_MS);
    }

    diagnostics.push(`Crawled ${slice.length - failures}/${slice.length} commander page(s) from the ${band.length}-commander scored band.`);
    if (failures) diagnostics.push(`${failures} page(s) failed and retained their previous data.`);

    return {
      commanders: commanders.map((commander) => applyPageFacts(commander, enriched.get(commander.slug))),
      diagnostics,
      state: { cursor: slice.at(-1)?.slug ?? state.cursor, lastRunAt: context.today }
    };
  }
};

export function inBand(commanders) {
  return commanders
    .filter((commander) => {
      const rank = commander.popularity?.edhrecRank;
      return Number.isFinite(rank) && rank >= SCORED_BAND.minRank && rank <= SCORED_BAND.maxRank;
    })
    .sort((a, b) => a.popularity.edhrecRank - b.popularity.edhrecRank);
}

/**
 * Takes the `size` commanders after `cursor`, wrapping at the end of the band.
 * An unknown cursor starts from the beginning rather than skipping a rotation,
 * and a band smaller than `size` is returned once rather than repeated.
 */
export function rotateSlice(band, cursor, size) {
  const take = Math.min(size, band.length);
  const start = cursor ? band.findIndex((commander) => commander.slug === cursor) + 1 : 0;
  const from = start > 0 && start <= band.length ? start : 0;
  const slice = band.slice(from, from + take);
  return slice.length >= take ? slice : [...slice, ...band.slice(0, take - slice.length)];
}

/**
 * `json.edhrec.com` returns 403 on an `OPTIONS` preflight, and any request
 * init with headers triggers one. A bare `fetch(url)` is the only shape that
 * works — do not add an Accept or User-Agent header here.
 */
async function fetchPage(slug, fetchImpl) {
  const response = await fetchImpl(`${PAGE_BASE}${pageSlug(slug)}.json`);
  if (!response.ok) throw new Error(`EDHREC page request failed: HTTP ${response.status}`);
  return response.json();
}

/** The colourless slug is `c` on some EDHREC paths and 403s; `colorless` works. */
export function pageSlug(slug) {
  return slug === "c" ? "colorless" : slug;
}

export function pageFacts(payload) {
  const bracketCounts = normalizeBracketCounts(payload?.bracket_counts);
  const themes = (payload?.tag_counts ?? [])
    .filter((tag) => tag?.slug)
    .slice(0, MAX_THEMES)
    .map((tag) => tag.slug);
  const highSynergyCards = selectSynergyCards(payload);
  const retentionTrend = weeklyRetention(payload?.savedate_counts);
  const similar = (payload?.similar ?? []).filter((name) => typeof name === "string").slice(0, MAX_SIMILAR);

  return {
    ...(bracketCounts ? { bracketCounts } : {}),
    ...(themes.length ? { themes } : {}),
    ...(highSynergyCards.length ? { highSynergyCards } : {}),
    ...(similar.length ? { similar } : {}),
    ...(retentionTrend.length ? { retentionTrend } : {}),
    ...(highSynergyCards.length ? { archetypeDepth: archetypeDepthFrom(payload) } : {}),
    pageAsOf: todayFrom(payload)
  };
}

/**
 * Bracket counts arrive keyed `"1"`–`"5"`. Stored as a five-element array,
 * which is a third of the bytes and the shape `bracketFit` wants.
 * Absent rather than zeroed when EDHREC reports nothing.
 */
export function normalizeBracketCounts(counts) {
  if (!counts || typeof counts !== "object") return null;
  const brackets = [1, 2, 3, 4, 5].map((bracket) => Number(counts[bracket] ?? counts[String(bracket)]) || 0);
  return brackets.some((count) => count > 0) ? brackets : null;
}

function selectSynergyCards(payload) {
  const lists = payload?.container?.json_dict?.cardlists ?? [];
  const list = lists.find((entry) => entry.tag === "highsynergycards");
  return (list?.cardviews ?? [])
    .filter((card) => card?.slug || card?.sanitized)
    .slice(0, MAX_SYNERGY_CARDS)
    .map((card) => card.slug ?? card.sanitized);
}

/**
 * EDHREC publishes ~50 days of daily save counts. Stored raw that is a
 * kilobyte per commander, and retention is a trend rather than a daily
 * series, so days collapse into weekly totals, oldest first.
 *
 * Bucketed by **calendar date, not by array position**. EDHREC omits days
 * with no saves rather than reporting a zero, so a quiet commander's entries
 * are sparse: grouping every seven entries would let one "week" span months
 * and stop the halves being comparable windows. Weeks are counted back from
 * the most recent day, and a week with no saves at all is a real zero.
 */
export function weeklyRetention(savedateCounts) {
  if (!savedateCounts || typeof savedateCounts !== "object") return [];
  const days = Object.entries(savedateCounts)
    .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .map(([date, count]) => [Date.parse(`${date}T00:00:00Z`), Math.max(0, Number(count) || 0)])
    .filter(([time]) => Number.isFinite(time));
  if (!days.length) return [];

  const latest = Math.max(...days.map(([time]) => time));
  const earliest = Math.min(...days.map(([time]) => time));
  const week = 7 * 86400000;
  // Complete weeks only. EDHREC publishes 50 days, which is seven weeks and a
  // day; counting that spare day as an eighth week would put a one-day total
  // beside seven-day ones and make the windows incomparable.
  const spanWeeks = Math.min(RETENTION_WEEKS, Math.floor((latest - earliest + 86400000) / week));
  if (spanWeeks < 1) return [];

  // Index 0 is the oldest kept week; the newest week ends on `latest`.
  const weeks = Array.from({ length: spanWeeks }, () => 0);
  for (const [time, count] of days) {
    const weeksBack = Math.floor((latest - time) / week);
    if (weeksBack >= spanWeeks) continue;
    weeks[spanWeeks - 1 - weeksBack] += count;
  }
  return weeks;
}

function todayFrom(payload) {
  const days = Object.keys(payload?.savedate_counts ?? {}).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  return days.at(-1) ?? null;
}

/**
 * A failed page leaves the commander untouched, so partial data never
 * overwrites good data from an earlier rotation.
 */
function applyPageFacts(commander, facts) {
  return facts ? { ...commander, ...facts } : commander;
}

/**
 * How deep the commander's high-synergy pool runs, in 0..1.
 *
 * A commander with a handful of cards that genuinely want to be in its deck is
 * a one-trick build; one with a broad pool of cards that outperform their
 * baseline has an archetype behind it. Measured as the mean synergy of the
 * high-synergy list, scaled by how full that list is, so a commander with two
 * strong cards cannot beat one with eight.
 *
 * Absent rather than zero when EDHREC publishes no high-synergy list.
 */
export function archetypeDepthFrom(payload) {
  const lists = payload?.container?.json_dict?.cardlists ?? [];
  const cards = lists.find((entry) => entry.tag === "highsynergycards")?.cardviews ?? [];
  if (!cards.length) return undefined;
  const synergies = cards.map((card) => Math.max(0, Math.min(1, Number(card.synergy) || 0)));
  const mean = synergies.reduce((sum, value) => sum + value, 0) / synergies.length;
  const fullness = Math.min(1, cards.length / MAX_SYNERGY_CARDS);
  return mean * fullness;
}

/**
 * The commander fields this connector owns, carried across a catalogue
 * refresh. `DETAIL_FACT_FIELDS` are the subset that never enters the search
 * projection — they are split into `commander-detail.json` and fetched only
 * when a reader opens a commander.
 */
export const DETAIL_FACT_FIELDS = Object.freeze(["highSynergyCards", "similar"]);

export const PAGE_FACT_FIELDS = Object.freeze([
  "bracketCounts",
  "themes",
  "retentionTrend",
  "archetypeDepth",
  "pageAsOf",
  ...DETAIL_FACT_FIELDS
]);
