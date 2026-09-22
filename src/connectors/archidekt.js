import { inBand, rotateSlice } from "./edhrec-pages.js";

const DECKS_URL = "https://archidekt.com/api/decks/v3/";
const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

/** Archidekt's `formats` id for Commander. */
const COMMANDER_FORMAT = 3;

/**
 * **40 requests per minute**, per Archidekt staff in
 * [forum thread 2832338](https://archidekt.com/forum/thread/2832338). The 80
 * figure that circulates online is wrong. 1,500ms is a request every 40
 * seconds of allowance, comfortably inside it.
 */
export const REQUEST_DELAY_MS = 1500;

/**
 * Commanders queried per run. At the rate limit above, 200 is about five
 * minutes, and the ~2,500-commander scored band comes round every 13 days.
 */
export const COMMANDERS_PER_RUN = 200;

/**
 * Archidekt caps a filtered deck count at 1,000. That is a feature here:
 * anything under the cap is the off-meta band this product cares about, and
 * anything at it is meta enough that the exact number does not matter.
 */
export const DECK_COUNT_CAP = 1000;

/** Primers considered per commander, from the most-viewed page. */
const MAX_PRIMERS = 3;

/**
 * Archidekt is the best "someone is trying to make this work" source that is
 * both structured and permitted. A brewer who writes a primer and per-card
 * notes for a rank-2,000 commander is the highest-quality effort signal there
 * is.
 *
 * **Attribution:** this stores the deck title, the author's username, the
 * canonical URL and a few counts. It never stores a decklist, primer prose or
 * per-card notes. The brewer is more prominent in the UI than this project.
 */
export const archidektConnector = {
  id: "archidekt",
  network: true,

  async enrichCatalog(commanders, context) {
    const diagnostics = [];
    const state = context.state ?? {};
    const band = inBand(commanders);
    if (!band.length) return { commanders, candidates: [], diagnostics: ["No commanders in the scored band."], state };

    const slice = rotateSlice(band, state.cursor, context.commandersPerRun ?? COMMANDERS_PER_RUN);
    const counts = new Map();
    const candidates = [];
    let failures = 0;

    for (const [index, commander] of slice.entries()) {
      try {
        const page = await fetchDecks(commander.name, context.fetch);
        counts.set(commander.slug, Math.min(Number(page.count) || 0, DECK_COUNT_CAP));
        candidates.push(...primerCandidates(page.results ?? [], commander, context.today));
      } catch (error) {
        failures += 1;
        diagnostics.push(`${commander.slug}: ${error.message}; kept the previous Archidekt data.`);
      }
      if (index < slice.length - 1) await context.sleep(REQUEST_DELAY_MS);
    }

    diagnostics.push(`Queried ${slice.length - failures}/${slice.length} commander(s) at ${Math.round(60000 / REQUEST_DELAY_MS)} req/min; found ${candidates.length} primer(s).`);

    return {
      commanders: commanders.map((commander) => {
        const archidektDecks = counts.get(commander.slug);
        return archidektDecks === undefined ? commander : { ...commander, archidektDecks };
      }),
      candidates,
      diagnostics,
      state: { cursor: slice.at(-1)?.slug ?? state.cursor, lastRunAt: context.today }
    };
  }
};

async function fetchDecks(commanderName, fetchImpl) {
  const url = `${DECKS_URL}?formats=${COMMANDER_FORMAT}&commanderName=${encodeURIComponent(commanderName)}&orderBy=-viewCount`;
  const response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Archidekt request failed: HTTP ${response.status}`);
  return response.json();
}

/**
 * `hasPrimer` is **not a working server-side filter**, so it is applied here.
 * A page returns about 60 results regardless of `pageSize`.
 */
export function primerCandidates(decks, commander, today) {
  return decks
    .filter((deck) => deck.hasPrimer && !deck.private && !deck.unlisted && !deck.theorycrafted)
    .slice(0, MAX_PRIMERS)
    .map((deck) => ({
      id: `archidekt:${deck.id}`,
      title: String(deck.name ?? "").trim() || `${commander.name} primer`,
      source: {
        name: "Archidekt",
        type: "decklist",
        url: `https://archidekt.com/decks/${deck.id}`,
        creator: String(deck.owner?.username ?? deck.owner ?? "Archidekt brewer"),
        resourceDepth: "primer"
      },
      publishedAt: String(deck.updatedAt ?? "").slice(0, 10) || today,
      observedAt: today,
      commanders: [{ slug: commander.slug, name: commander.name }],
      metrics: {
        views: Number(deck.viewCount) || 0,
        comments: Number(deck.comments) || 0,
        selfReportedBracket: deck.edhBracket ?? null
      },
      // Metadata only. The primer's prose stays on Archidekt, where the
      // brewer published it and where readers are sent to read it.
      signal: [deck.name, ...(deck.tags ?? [])].filter(Boolean).join(" · ")
    }));
}

export const ARCHIDEKT_FACT_FIELDS = Object.freeze(["archidektDecks"]);
