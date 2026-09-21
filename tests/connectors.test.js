import assert from "node:assert/strict";
import test from "node:test";
import { edhrecConnector, normalizeCommander } from "../src/connectors/edhrec.js";
import { scryfallConnector } from "../src/connectors/scryfall.js";

test("Scryfall enriches only referenced entities through one collection request", async () => {
  const calls = [];
  const finding = { commanders: [{ name: "Commander Example", slug: "commander-example" }], cards: [{ name: "Card Example", slug: "card-example" }] };
  const result = await scryfallConnector.enrich([finding], {
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ data: [{ name: "Card Example", id: "00000000-0000-4000-8000-000000000001" }] }) };
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).identifiers.length, 2);
  assert.equal(result.findings[0].cards[0].scryfallId, "00000000-0000-4000-8000-000000000001");
});

test("EDHREC catalogue follows pagination and normalizes rank/deck data", async () => {
  const pages = [
    { container: { json_dict: { cardlists: [{ tag: "past2years", more: "next.json", cardviews: [{ id: "00000000-0000-4000-8000-000000000002", name: "One", slug: "one", rank: 1, num_decks: 40, trend_zscore: 1.2 }] }] } } },
    { container: { json_dict: { cardlists: [{ tag: "past2years", more: "", cardviews: [{ id: "00000000-0000-4000-8000-000000000003", name: "Two", slug: "two", rank: 2, num_decks: 30 }] }] } } }
  ];
  const result = await edhrecConnector.collectCatalog({
    today: "2026-09-21",
    sleep: async () => {},
    fetch: async () => ({ ok: true, json: async () => pages.shift() })
  });
  assert.equal(result.commanders.length, 2);
  assert.deepEqual(result.commanders[1].popularity, { edhrecRank: 2, deckCount: 30, asOf: "2026-09-21" });
  assert.equal(normalizeCommander({}, "2026-09-21"), null);
});
