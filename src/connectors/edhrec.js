const BASE_URL = "https://json.edhrec.com/pages/";
const START_PATH = "commanders/year.json";
const MAX_PAGES = 75;

export const edhrecConnector = {
  id: "edhrec",
  network: true,
  async collectCatalog(context) {
    const commanders = [];
    let nextPath = START_PATH;
    let pages = 0;
    while (nextPath && pages < MAX_PAGES) {
      const response = await context.fetch(new URL(nextPath, BASE_URL), {
        headers: {
          Accept: "application/json",
          "User-Agent": "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)"
        }
      });
      if (!response.ok) throw new Error(`EDHREC catalogue request failed: HTTP ${response.status}`);
      const payload = await response.json();
      const list = selectCommanderList(payload);
      commanders.push(...(list.cardviews ?? []).map((card) => normalizeCommander(card, context.today)).filter(Boolean));
      nextPath = list.more || "";
      pages += 1;
      if (nextPath) await context.sleep(600);
    }
    return {
      commanders: deduplicate(commanders),
      diagnostics: [`Refreshed ${commanders.length} ranked commanders across ${pages} respectful request(s).`]
    };
  }
};

export function selectCommanderList(payload) {
  if (Array.isArray(payload?.cardviews)) return payload;
  const lists = payload?.container?.json_dict?.cardlists ?? [];
  return lists.find((list) => list.tag === "past2years")
    ?? lists.find((list) => /past\s*2\s*years/i.test(list.header ?? ""))
    ?? lists[0]
    ?? { cardviews: [], more: "" };
}

export function normalizeCommander(card, asOf) {
  const name = String(card.name ?? card.card_name ?? "").trim();
  const slug = String(card.slug ?? card.sanitized ?? "").trim();
  if (!name || !slug) return null;
  return {
    name,
    slug,
    scryfallId: card.id,
    popularity: {
      edhrecRank: Number(card.rank) || 0,
      deckCount: Number(card.num_decks) || 0,
      asOf
    },
    trendZscore: Number(card.trend_zscore) || 0
  };
}

function deduplicate(commanders) {
  return [...new Map(commanders.map((commander) => [commander.slug, commander])).values()]
    .sort((a, b) => a.popularity.edhrecRank - b.popularity.edhrecRank);
}
