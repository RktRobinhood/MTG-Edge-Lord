import assert from "node:assert/strict";
import test from "node:test";
import { buildDatasets } from "../src/pipeline/datasets.js";
import { decodeCommanders } from "../src/shared/catalog.js";

const catalog = [{
  name: "Massimo, the Magician",
  slug: "massimo-the-magician",
  popularity: { edhrecRank: 1050, deckCount: 2200, asOf: "2026-09-22" },
  trendZscore: -0.08,
  bracketCounts: [4, 109, 142, 11, 6],
  archetypeDepth: 0.42,
  retentionTrend: [66, 71, 86, 105, 114, 91, 103, 117],
  highSynergyCards: ["lightning-bolt", "brainstorm"],
  similar: ["Kess, Dissident Mage"]
}];

const build = (input) => buildDatasets([], [], input, "2026-09-22");

test("the published catalogue carries the raw inputs and the headline score, not the derivable rest", () => {
  const [commander] = decodeCommanders(build(catalog)["commanders.json"]);
  assert.equal(commander.edgeScore, 52.8, "0.4*0.576 + 0.4*0.42 + 0.2*0.648, times an obscurity of 1");
  assert.deepEqual(commander.bracketCounts, [4, 109, 142, 11, 6]);
  assert.equal(commander.archetypeDepth, 0.42);

  for (const derivable of ["tier", "obscurity", "worksScore", "quality", "unscored", "scoreModelVersion"]) {
    assert.equal(derivable in commander, false, `${derivable} is recomputed by the client and should not be published`);
  }
});

test("model versions are dataset metadata, not a field on every commander", () => {
  const dataset = build(catalog)["commanders.json"];
  assert.equal(dataset.modelVersions.edge, "edge-v1");
  assert.equal(dataset.modelVersions.cohort, "cohort-v1");
});

test("per-commander detail is split out of the page-load path", () => {
  const datasets = build(catalog);
  const [commander] = decodeCommanders(datasets["commanders.json"]);
  assert.equal("highSynergyCards" in commander, false);
  assert.deepEqual(datasets["commander-detail.json"].detail["massimo-the-magician"], {
    highSynergyCards: ["lightning-bolt", "brainstorm"],
    similar: ["Kess, Dissident Mage"]
  });
});

test("a derived field left over from an earlier build is stripped, not carried", () => {
  const stale = [{ ...catalog[0], tier: "meta", worksScore: 0.01, unscored: true, edgeScore: 3, quality: { bracketFit: 0.01 } }];
  const [commander] = decodeCommanders(build(stale)["commanders.json"]);
  assert.equal(commander.edgeScore, 52.8, "the score is recomputed, not inherited");
  assert.equal("tier" in commander, false);
  assert.equal("unscored" in commander, false);
});

test("a commander with no evidence carries no score at all, rather than a zero", () => {
  const bare = [{ name: "Unknown", slug: "unknown", popularity: { edhrecRank: 1800, deckCount: 120 }, trendZscore: 0 }];
  const [commander] = decodeCommanders(build(bare)["commanders.json"]);
  assert.equal("edgeScore" in commander, false);
});

test("a combo count with no canonical link is not published", () => {
  const orphan = [{ ...catalog[0], comboCount: 12 }];
  const linked = [{ ...catalog[0], comboCount: 12, comboUrl: "https://commanderspellbook.com/search/?q=x" }];
  assert.equal("comboCount" in decodeCommanders(build(orphan)["commanders.json"])[0], false);
  assert.equal(decodeCommanders(build(linked)["commanders.json"])[0].comboCount, 12);
});

test("only the files the userscript fetches are published", () => {
  assert.deepEqual(Object.keys(build(catalog)).sort(), [
    "commander-detail.json",
    "commanders.json",
    "community-resources.json",
    "findings.json",
    "hidden-cards.json",
    "relationships/card-commander.json"
  ]);
});
