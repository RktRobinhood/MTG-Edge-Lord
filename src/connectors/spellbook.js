const VARIANTS_URL = "https://backend.commanderspellbook.com/variants/";
const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

/** Page size the API accepts. Larger values are clamped server-side. */
const PAGE_SIZE = 500;

/** Pages per pass. Enough to cover the whole variant set with room to grow. */
const MAX_PAGES = 250;

/**
 * Days between full passes.
 *
 * A combo count is a property of the whole variant set, so a delta fetch
 * cannot maintain it: new variants would be added and withdrawn ones never
 * removed. The honest alternative to an incorrect delta is a correct full
 * pass that runs rarely. Most scheduled runs therefore fetch nothing at all.
 */
export const REFRESH_DAYS = 7;

/**
 * Commander Spellbook combo lines.
 *
 * **Displayed, never scored.** Combo density correlates with cEDH, so feeding
 * it into `worksScore` would quietly drag results back toward the meta this
 * product exists to escape. `docs/SCORING.md` states the rule; this connector
 * writes only `comboCount` and `comboUrl`, and nothing in `src/shared/edge-score.js`
 * reads either.
 */
export const spellbookConnector = {
  id: "spellbook",
  network: true,

  async enrichCatalog(commanders, context) {
    const diagnostics = [];
    const state = context.state ?? {};

    if (state.lastPassAt && daysBetween(state.lastPassAt, context.today) < REFRESH_DAYS) {
      return { commanders, diagnostics: [`Last full pass was ${state.lastPassAt}; next one is due after ${REFRESH_DAYS} days.`], state };
    }

    const wanted = new Map(commanders
      .filter((commander) => commander.name)
      .map((commander) => [commander.name.toLowerCase(), commander.slug]));

    const counts = new Map();
    let url = `${VARIANTS_URL}?limit=${PAGE_SIZE}`;
    let pages = 0;
    let variants = 0;

    while (url && pages < MAX_PAGES) {
      const payload = await fetchJson(url, context.fetch);
      for (const variant of payload.results ?? []) {
        variants += 1;
        for (const slug of commanderSlugsFor(variant, wanted)) {
          counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
      }
      url = payload.next ?? "";
      pages += 1;
    }

    const complete = !url;
    diagnostics.push(`Read ${variants} combo variant(s) across ${pages} page(s); ${counts.size} catalogued commanders appear in at least one.`);
    if (!complete) diagnostics.push(`Stopped at the ${MAX_PAGES}-page ceiling before the end of the variant set; counts are a floor, not a total.`);

    return {
      commanders: commanders.map((commander) => {
        const comboCount = counts.get(commander.slug);
        if (comboCount === undefined) return commander;
        return { ...commander, comboCount, comboUrl: `https://commanderspellbook.com/search/?q=${encodeURIComponent(`commander:"${commander.name}"`)}` };
      }),
      diagnostics,
      // Only a complete pass resets the clock. A truncated one runs again
      // tomorrow rather than leaving partial counts in place for a week.
      state: complete ? { lastPassAt: context.today } : { ...state, lastRunAt: context.today }
    };
  }
};

/**
 * A variant counts for a commander when that commander is one of the cards the
 * line uses. Matching on colour identity alone would attribute every Izzet
 * combo to every Izzet commander, which is not a signal about the commander.
 */
function commanderSlugsFor(variant, wanted) {
  const slugs = new Set();
  for (const use of variant.uses ?? []) {
    const slug = wanted.get(String(use?.card?.name ?? "").toLowerCase());
    if (slug) slugs.add(slug);
  }
  return slugs;
}

function daysBetween(from, to) {
  if (!from || !to) return Infinity;
  return Math.abs(new Date(to) - new Date(from)) / 86400000;
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Commander Spellbook request failed: HTTP ${response.status}`);
  return response.json();
}

/** Fields this connector owns. Neither is read by scoring, by design. */
export const COMBO_FACT_FIELDS = Object.freeze(["comboCount", "comboUrl"]);
