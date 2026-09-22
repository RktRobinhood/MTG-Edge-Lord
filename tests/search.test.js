import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  SORTS,
  buildSearchIndex,
  filterCommanders,
  hydrateCommanders,
  matchesColors,
  sortCommanders
} from "../src/userscript/search.js";

// Shaped like published records: the pipeline's `edgeScore` is present and
// the client recomputes the components around it. A record with no published
// score is one the pipeline withheld, and stays withheld.
const commanders = [
  {
    name: "Massimo, the Magician", slug: "massimo", colorIdentity: "WUR", manaValue: 3, price: 4.27,
    types: ["Creature"], creatureTypes: ["Cat", "Wizard"], themes: ["spellslinger", "burn"],
    functionalTags: ["copy", "recursion"], momentum: 44, edgeScore: 58.6,
    bracketCounts: [4, 109, 142, 11, 6], archetypeDepth: 0.42, retentionTrend: [66, 71, 86, 105, 114, 91, 103, 117],
    releasedAt: "2026-11-09", popularity: { edhrecRank: 1050, deckCount: 2200 }
  },
  {
    name: "Krenko, Mob Boss", slug: "krenko", colorIdentity: "R", manaValue: 4, price: 0.5,
    types: ["Creature"], creatureTypes: ["Goblin", "Warrior"], themes: ["tokens", "goblins"],
    functionalTags: ["ramp"], momentum: 47.8,
    releasedAt: "2012-07-13", popularity: { edhrecRank: 5, deckCount: 44161 }
  },
  {
    name: "Sidar Jabari of Zhalfir", slug: "sidar", colorIdentity: "W", manaValue: 2, price: 1.1,
    types: ["Creature"], creatureTypes: ["Human", "Knight"], themes: ["knights", "aggro"],
    functionalTags: ["evasion"], momentum: 12, edgeScore: 41.3,
    bracketCounts: [10, 60, 30, 5, 0], archetypeDepth: 0.2, retentionTrend: [30, 30, 30, 30],
    releasedAt: "2024-02-09", popularity: { edhrecRank: 2100, deckCount: 900 }
  },
  {
    name: "Unscored Legend", slug: "unscored", colorIdentity: "BG", manaValue: 5,
    types: ["Creature"], creatureTypes: ["Elf"], momentum: 8,
    popularity: { edhrecRank: 2800, deckCount: 140 }
  }
];

// The index hydrates: tier and every score component are recomputed from the
// raw inputs, exactly as the userscript does with the published dataset.
const index = buildSearchIndex(commanders);
const hydrated = hydrateCommanders(commanders);
const filters = (overrides) => ({ ...DEFAULT_FILTERS, ...overrides });

test("the index is built from named fields, so field names are not matchable", () => {
  assert.equal(filterCommanders(index, filters({ query: "edgeScore" })).length, 0);
  assert.equal(filterCommanders(index, filters({ query: "popularity" })).length, 0);
  assert.equal(filterCommanders(index, filters({ query: "slug" })).length, 0);
});

test("a query matches name, theme, tag, creature type and card type", () => {
  assert.deepEqual(filterCommanders(index, filters({ query: "massimo" })).map((c) => c.slug), ["massimo"]);
  assert.deepEqual(filterCommanders(index, filters({ query: "spellslinger" })).map((c) => c.slug), ["massimo"]);
  assert.deepEqual(filterCommanders(index, filters({ query: "goblin" })).map((c) => c.slug), ["krenko"]);
  assert.deepEqual(filterCommanders(index, filters({ query: "recursion" })).map((c) => c.slug), ["massimo"]);
});

test("query terms combine, they do not widen the result", () => {
  assert.deepEqual(filterCommanders(index, filters({ query: "cat wizard" })).map((c) => c.slug), ["massimo"]);
  assert.equal(filterCommanders(index, filters({ query: "cat goblin" })).length, 0);
});

test("colour identity honours Magic's three conventions", () => {
  assert.equal(matchesColors("WUR", ["U"], "includes"), true);
  assert.equal(matchesColors("WUR", ["U", "B"], "includes"), false);
  assert.equal(matchesColors("WUR", ["W", "U", "R"], "exact"), true);
  assert.equal(matchesColors("WU", ["W", "U", "R"], "exact"), false);
  assert.equal(matchesColors("WU", ["W", "U", "R"], "atMost"), true);
  assert.equal(matchesColors("WUB", ["W", "U", "R"], "atMost"), false);
  assert.equal(matchesColors("", ["W"], "includes"), false);
  assert.equal(matchesColors("WUR", [], "includes"), true, "no selection means no colour filter");
});

test("a commander with unknown colour identity is excluded by a colour filter, not silently included", () => {
  assert.equal(matchesColors(undefined, ["W"], "includes"), false);
});

test("the rank band is a first-class filter", () => {
  const band = filterCommanders(index, filters({ minRank: "1000", maxRank: "3000" }));
  assert.deepEqual(band.map((c) => c.slug).sort(), ["massimo", "sidar", "unscored"]);
});

test("axes compose, each one narrowing the last", () => {
  const banded = filterCommanders(index, filters({ minRank: "1000", maxRank: "3000" }));
  const white = filterCommanders(index, filters({ minRank: "1000", maxRank: "3000", colors: ["W"] }));
  const blueWhite = filterCommanders(index, filters({ minRank: "1000", maxRank: "3000", colors: ["W", "U"] }));
  const cheap = filterCommanders(index, filters({ minRank: "1000", maxRank: "3000", colors: ["W", "U"], maxManaValue: "2" }));

  assert.deepEqual(banded.map((c) => c.slug).sort(), ["massimo", "sidar", "unscored"]);
  assert.deepEqual(white.map((c) => c.slug).sort(), ["massimo", "sidar"]);
  assert.deepEqual(blueWhite.map((c) => c.slug), ["massimo"], "Sidar is mono-white, so it drops out");
  assert.deepEqual(cheap.map((c) => c.slug), [], "Massimo costs 3, so the mana filter empties the result");
});

test("a commander with no price is not treated as expensive", () => {
  const budget = filterCommanders(index, filters({ maxPrice: "1" }));
  assert.deepEqual(budget.map((c) => c.slug).sort(), ["krenko", "unscored"]);
});

test("scoredOnly hides commanders with no bracket evidence", () => {
  const scored = filterCommanders(index, filters({ tier: "edge", scoredOnly: true }));
  assert.deepEqual(scored.map((c) => c.slug).sort(), ["massimo", "sidar"]);
});

test("the index recomputes tier and components, and agrees with the published score", () => {
  const massimo = index.commanders.find((c) => c.slug === "massimo");
  assert.equal(massimo.tier, "edge");
  assert.equal(massimo.edgeScore, 58.6, "the client's own arithmetic reproduces the published number");
  assert.equal(massimo.quality.bracketFit, 0.576);
  assert.equal(index.commanders.find((c) => c.slug === "unscored").edgeScore, undefined);
  assert.equal(index.commanders.find((c) => c.slug === "krenko").tier, "meta");
});

test("the default sort is Edge score, and popularity is never the fallback", () => {
  assert.equal(DEFAULT_SORT, "edge");
  assert.notEqual(DEFAULT_SORT, "deckCount");
  assert.equal(SORTS[0].id, "edge");
  const sorted = sortCommanders(hydrated, DEFAULT_SORT);
  assert.deepEqual(sorted.map((c) => c.slug), ["massimo", "sidar", "krenko", "unscored"]);
});

test("an unrecognised sort falls back to Edge score, not to popularity", () => {
  assert.deepEqual(sortCommanders(hydrated, "nonsense").map((c) => c.slug), sortCommanders(hydrated, DEFAULT_SORT).map((c) => c.slug));
});

test("an unscored commander sorts last rather than being ranked as a zero", () => {
  const sorted = sortCommanders(hydrated, "edge");
  assert.equal(sorted.at(-1).slug, "unscored");
  assert.equal(sorted.at(-1).edgeScore, undefined);
});

test("cheapest-first puts the unpriced commander last, not first", () => {
  assert.deepEqual(sortCommanders(hydrated, "price").map((c) => c.slug), ["krenko", "sidar", "massimo", "unscored"]);
});

test("popularity is available as a sort, it is just never the default", () => {
  assert.deepEqual(sortCommanders(hydrated, "deckCount").map((c) => c.slug), ["krenko", "massimo", "sidar", "unscored"]);
});

test("filter vocabularies come from the data, most-used first", () => {
  assert.ok(index.themes.includes("spellslinger"));
  assert.ok(index.functionalTags.includes("ramp"));
  assert.ok(index.creatureTypes.includes("Cat"));
});

test("filtering the full catalogue stays well inside a keystroke", () => {
  const many = Array.from({ length: 6792 }, (_, position) => ({
    ...commanders[position % commanders.length],
    slug: `commander-${position}`,
    name: `Commander ${position}`
  }));
  const large = buildSearchIndex(many);
  const started = performance.now();
  for (const query of ["spell", "spellslinger", "cat wiz", "gob"]) filterCommanders(large, filters({ query }));
  const elapsed = (performance.now() - started) / 4;
  assert.ok(elapsed < 50, `expected under 50ms per query, took ${elapsed.toFixed(1)}ms`);
});
