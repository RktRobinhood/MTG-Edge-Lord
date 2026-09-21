const COLLECTION_URL = "https://api.scryfall.com/cards/collection";
const MAX_IDENTIFIERS = 75;

export const scryfallConnector = {
  id: "scryfall",
  network: true,
  async enrich(findings, context) {
    const names = [...new Set(findings.flatMap((finding) => [
      ...finding.commanders.map((item) => item.name),
      ...finding.cards.map((item) => item.name)
    ]))];
    const cards = new Map();
    for (let index = 0; index < names.length; index += MAX_IDENTIFIERS) {
      const identifiers = names.slice(index, index + MAX_IDENTIFIERS).map((name) => ({ name }));
      const response = await context.fetch(COLLECTION_URL, {
        method: "POST",
        headers: {
          Accept: "application/json;q=0.9,*/*;q=0.8",
          "Content-Type": "application/json",
          "User-Agent": "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)"
        },
        body: JSON.stringify({ identifiers })
      });
      if (!response.ok) throw new Error(`Scryfall collection request failed: HTTP ${response.status}`);
      const payload = await response.json();
      for (const card of payload.data ?? []) cards.set(card.name.toLowerCase(), card);
    }

    const enriched = findings.map((finding) => ({
      ...finding,
      commanders: finding.commanders.map((entity) => enrichEntity(entity, cards)),
      cards: finding.cards.map((entity) => enrichEntity(entity, cards))
    }));
    return { findings: enriched, diagnostics: [`Resolved ${cards.size}/${names.length} referenced cards through Scryfall collection lookup.`] };
  }
};

function enrichEntity(entity, cards) {
  const card = cards.get(entity.name.toLowerCase());
  return card ? { ...entity, scryfallId: card.id } : entity;
}
