import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { FUNCTIONAL_TAG_ROOTS, orderColors, scryfallBulkConnector, splitTypeLine } from "../src/connectors/scryfall-bulk.js";

const CARDS_URI = "https://data.scryfall.io/oracle-cards/test.jsonl.gz";
const TAGS_URI = "https://data.scryfall.io/oracle-tags/test.jsonl.gz";

const bulkIndex = {
  data: [
    { type: "oracle_cards", updated_at: "2026-09-21T21:01:55.006+00:00", jsonl_download_uri: CARDS_URI, compressed_size: 24710646 },
    { type: "oracle_tags", updated_at: "2026-09-21T21:00:33.445+00:00", jsonl_download_uri: TAGS_URI, compressed_size: 6004725 }
  ]
};

const cards = [
  {
    oracle_id: "oracle-massimo",
    name: "Massimo, the Magician",
    type_line: "Legendary Creature — Cat Wizard",
    color_identity: ["R", "U", "W"],
    cmc: 3,
    set: "mbc",
    released_at: "2026-11-09",
    prices: { usd: "4.27" }
  },
  {
    oracle_id: "oracle-jetmir",
    name: "Jetmir, Nexus of Revels",
    type_line: "Legendary Creature — Cat Demon",
    color_identity: ["G", "R", "W"],
    cmc: 4,
    set: "snc",
    released_at: "2022-04-29",
    prices: { usd: null, usd_foil: "1.50" }
  },
  { oracle_id: "oracle-noise", name: "Lightning Bolt", type_line: "Instant", color_identity: ["R"], cmc: 1, set: "lea", released_at: "1993-08-05", prices: {} }
];

const tags = [
  { object: "tag", id: "tutor", slug: "tutor", child_ids: ["tutor-cat"], taggings: [] },
  { object: "tag", id: "tutor-cat", slug: "tutor-creature-cat", child_ids: [], taggings: [{ oracle_id: "oracle-massimo" }] },
  { object: "tag", id: "ramp", slug: "ramp", child_ids: [], taggings: [{ oracle_id: "oracle-jetmir" }, { oracle_id: "oracle-noise" }] },
  { object: "tag", id: "alliteration", slug: "alliteration", child_ids: [], taggings: [{ oracle_id: "oracle-massimo" }] }
];

const commanders = [
  { name: "Massimo, the Magician", slug: "massimo-the-magician", popularity: { edhrecRank: 1050 } },
  { name: "Jetmir, Nexus of Revels", slug: "jetmir-nexus-of-revels", popularity: { edhrecRank: 900 } },
  { name: "Krenko + Ragavan", slug: "krenko-ragavan", popularity: { edhrecRank: 2400 } }
];

function fakeFetch({ onRequest = () => {} } = {}) {
  return async (url) => {
    const href = String(url);
    onRequest(href);
    if (href.startsWith("https://api.scryfall.com/bulk-data")) {
      return { ok: true, json: async () => bulkIndex };
    }
    const lines = href === CARDS_URI ? cards : tags;
    return { ok: true, body: gzipStream(lines) };
  };
}

function gzipStream(records) {
  const buffer = gzipSync(Buffer.from(`${records.map((record) => JSON.stringify(record)).join("\n")}\n`));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    }
  });
}

test("card facts land on every matched commander", async () => {
  const result = await scryfallBulkConnector.enrichCatalog(commanders, { fetch: fakeFetch(), state: {} });
  const [massimo] = result.commanders;
  assert.equal(massimo.colorIdentity, "WUR");
  assert.equal(massimo.manaValue, 3);
  assert.deepEqual(massimo.types, ["Creature"]);
  assert.deepEqual(massimo.creatureTypes, ["Cat", "Wizard"]);
  assert.equal(massimo.setCode, "mbc");
  assert.equal(massimo.releasedAt, "2026-11-09");
  assert.equal(massimo.price, 4.27);
});

test("a commander with no matching card keeps its fields absent rather than empty", async () => {
  const result = await scryfallBulkConnector.enrichCatalog(commanders, { fetch: fakeFetch(), state: {} });
  const pairing = result.commanders.at(-1);
  assert.equal("colorIdentity" in pairing, false);
  assert.equal("price" in pairing, false);
  assert.equal(pairing.popularity.edhrecRank, 2400);
});

test("a tag rolls up to its configured root, and unconfigured tags are dropped", async () => {
  const result = await scryfallBulkConnector.enrichCatalog(commanders, { fetch: fakeFetch(), state: {} });
  const [massimo, jetmir] = result.commanders;
  assert.deepEqual(massimo.functionalTags, ["tutor"]);
  assert.deepEqual(jetmir.functionalTags, ["ramp"]);
});

test("an unchanged bulk timestamp skips both downloads", async () => {
  const requested = [];
  const enriched = (await scryfallBulkConnector.enrichCatalog(commanders, { fetch: fakeFetch(), state: {} })).commanders;
  const second = await scryfallBulkConnector.enrichCatalog(enriched, {
    fetch: fakeFetch({ onRequest: (url) => requested.push(url) }),
    state: { oracleCardsUpdatedAt: "2026-09-21T21:01:55.006+00:00", oracleTagsUpdatedAt: "2026-09-21T21:00:33.445+00:00" }
  });
  assert.deepEqual(requested, ["https://api.scryfall.com/bulk-data"]);
  assert.deepEqual(second.commanders, enriched);
});

test("a moved bulk timestamp downloads again", async () => {
  const requested = [];
  const enriched = (await scryfallBulkConnector.enrichCatalog(commanders, { fetch: fakeFetch(), state: {} })).commanders;
  await scryfallBulkConnector.enrichCatalog(enriched, {
    fetch: fakeFetch({ onRequest: (url) => requested.push(url) }),
    state: { oracleCardsUpdatedAt: "2026-09-01T00:00:00.000+00:00", oracleTagsUpdatedAt: "2026-09-01T00:00:00.000+00:00" }
  });
  assert.equal(requested.includes(CARDS_URI), true);
  assert.equal(requested.includes(TAGS_URI), true);
});

test("a failed download throws, so the caller can retain the previous catalogue", async () => {
  const failing = async (url) => String(url).startsWith("https://api.scryfall.com/bulk-data")
    ? { ok: true, json: async () => bulkIndex }
    : { ok: false, status: 503 };
  await assert.rejects(
    scryfallBulkConnector.enrichCatalog(commanders, { fetch: failing, state: {} }),
    /Scryfall bulk download failed: HTTP 503/
  );
});

test("colour identity is WUBRG-ordered, and colourless is the empty string", () => {
  assert.equal(orderColors(["G", "B"]), "BG");
  assert.equal(orderColors(["R", "W", "U", "B", "G"]), "WUBRG");
  assert.equal(orderColors([]), "");
});

test("the type line splits into types and creature types", () => {
  assert.deepEqual(splitTypeLine("Legendary Creature — Cat Wizard"), { types: ["Creature"], creatureTypes: ["Cat", "Wizard"] });
  assert.deepEqual(splitTypeLine("Legendary Artifact Creature — Phyrexian Golem"), { types: ["Artifact", "Creature"], creatureTypes: ["Phyrexian", "Golem"] });
  assert.deepEqual(splitTypeLine("Legendary Planeswalker — Freyalise"), { types: ["Planeswalker"], creatureTypes: [] });
  assert.deepEqual(splitTypeLine("Legendary Creature — Human // Legendary Creature — Werewolf"), { types: ["Creature"], creatureTypes: ["Human"] });
});

test("the functional tag roots are configuration, not duplicates", () => {
  assert.equal(new Set(FUNCTIONAL_TAG_ROOTS).size, FUNCTIONAL_TAG_ROOTS.length);
  assert.ok(FUNCTIONAL_TAG_ROOTS.includes("ramp"));
});
