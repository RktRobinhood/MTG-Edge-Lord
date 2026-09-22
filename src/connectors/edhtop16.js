const GRAPHQL_URL = "https://edhtop16.com/api/graphql";
const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

/** Commanders pulled per page from the ranked list. */
const PAGE_SIZE = 100;

/** Pages per run. The cEDH field is small; this covers it several times over. */
const MAX_PAGES = 20;

const QUERY = `query($first: Int!, $after: String, $filters: CommanderStatsFilters!) {
  commanders(first: $first, after: $after, timePeriod: ONE_YEAR, minEntries: 4, sortBy: POPULARITY) {
    pageInfo { hasNextPage endCursor }
    edges { node { name colorId breakdownUrl stats(filters: $filters) { count topCuts conversionRate } } }
  }
}`;

/**
 * Tournament validation from EDHTop16.
 *
 * **EDHTop16 is cEDH only**, so it illuminates Bracket 5 and nothing else. A
 * commander with no presence here is the *norm* for the Edge tier, not a
 * commander that failed to validate. Absence therefore never lowers a score,
 * and the UI must not present it as unvalidated or weak.
 *
 * It also serves the inverse purpose: it tells you what *is* meta, so you can
 * subtract it.
 */
export const edhtop16Connector = {
  id: "edhtop16",
  network: true,

  async enrichCatalog(commanders, context) {
    const diagnostics = [];
    const wanted = new Map(commanders
      .filter((commander) => commander.name)
      .map((commander) => [commander.name.toLowerCase(), commander.slug]));

    const validation = new Map();
    let after = null;
    let pages = 0;
    let seen = 0;

    do {
      const payload = await gql(context.fetch, { first: PAGE_SIZE, after, filters: { timePeriod: "ONE_YEAR" } });
      const page = payload.commanders;
      for (const edge of page?.edges ?? []) {
        seen += 1;
        const entry = toValidation(edge.node);
        // A partner pairing is named "A / B" here. Credit both halves: each is
        // a catalogued commander in its own right.
        for (const slug of slugsFor(edge.node.name, wanted)) {
          const existing = validation.get(slug);
          if (!existing || entry.tournamentEntries > existing.tournamentEntries) validation.set(slug, entry);
        }
      }
      after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
      pages += 1;
    } while (after && pages < MAX_PAGES);

    diagnostics.push(`Read ${seen} cEDH commander record(s) across ${pages} page(s); ${validation.size} match the catalogue.`);
    diagnostics.push("cEDH only: absence of tournament data is normal for the Edge tier and never lowers a score.");

    return {
      commanders: commanders.map((commander) => {
        const found = validation.get(commander.slug);
        return found ? { ...commander, tournament: found } : commander;
      }),
      diagnostics,
      state: { ...(context.state ?? {}), lastRunAt: context.today }
    };
  }
};

function toValidation(node) {
  return {
    tournamentEntries: Number(node.stats?.count) || 0,
    topCuts: Number(node.stats?.topCuts) || 0,
    conversionRate: Math.round((Number(node.stats?.conversionRate) || 0) * 1000) / 1000,
    url: node.breakdownUrl ? `https://edhtop16.com${node.breakdownUrl}` : "https://edhtop16.com/",
    asOf: new Date().toISOString().slice(0, 10)
  };
}

function slugsFor(name, wanted) {
  const found = new Set();
  const whole = wanted.get(String(name).toLowerCase());
  if (whole) found.add(whole);
  for (const half of String(name).split(" / ")) {
    const slug = wanted.get(half.trim().toLowerCase());
    if (slug) found.add(slug);
  }
  return found;
}

async function gql(fetchImpl, variables) {
  const response = await fetchImpl(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ query: QUERY, variables })
  });
  if (!response.ok) throw new Error(`EDHTop16 request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(`EDHTop16 rejected the query: ${JSON.stringify(payload.errors[0]).slice(0, 200)}`);
  return payload.data ?? {};
}

export const TOURNAMENT_FACT_FIELDS = Object.freeze(["tournament"]);
