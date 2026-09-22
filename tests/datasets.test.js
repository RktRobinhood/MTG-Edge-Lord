import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildDatasets } from "../src/pipeline/datasets.js";
import { decodeCommanders } from "../src/shared/catalog.js";
import { hydrateCommanders } from "../src/userscript/search.js";
import { EDGE_MODEL_VERSION, scoreCommander } from "../src/shared/edge-score.js";
import { COHORT_MODEL_VERSION } from "../src/shared/cohort-score.js";

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
  assert.equal(commander.edgeScore, 58.6, "0.4*0.576 + 0.4*0.42 + 0.2*(110/117), times an obscurity of 1");
  assert.deepEqual(commander.bracketCounts, [4, 109, 142, 11, 6]);
  assert.equal(commander.archetypeDepth, 0.42);

  for (const derivable of ["tier", "obscurity", "worksScore", "quality", "unscored", "scoreModelVersion"]) {
    assert.equal(derivable in commander, false, `${derivable} is recomputed by the client and should not be published`);
  }
});

test("model versions are dataset metadata, not a field on every commander", () => {
  const dataset = build(catalog)["commanders.json"];
  assert.equal(dataset.modelVersions.edge, EDGE_MODEL_VERSION);
  assert.equal(dataset.modelVersions.cohort, COHORT_MODEL_VERSION);
  // The version must move when the model does, or two datasets stamped the
  // same version hold scores that cannot be compared.
  assert.match(EDGE_MODEL_VERSION, /^edge-v[2-9]/);
  assert.match(COHORT_MODEL_VERSION, /^cohort-v[2-9]/);
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
  assert.equal(commander.edgeScore, 58.6, "the score is recomputed, not inherited");
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

test("a new arrival never carries both an Edge score and a cohort score", () => {
  const cohort = Array.from({ length: 20 }, (_, index) => ({
    name: `New Legend ${index}`,
    slug: `new-legend-${index}`,
    setCode: "msh",
    releasedAt: "2026-08-15",
    popularity: { edhrecRank: 2300 + index, deckCount: 390 - index },
    bracketCounts: [4, 40, 60, 10, 2],
    archetypeDepth: 0.5,
    retentionTrend: [40, 40, 40, 40, 40, 40, 40, 40]
  }));
  const published = decodeCommanders(build(cohort)["commanders.json"]);

  assert.equal(published.filter((c) => c.edgeScore !== undefined && c.cohortScore !== undefined).length, 0);
  assert.ok(published.some((c) => c.cohortScore !== undefined), "the fixture should actually produce cohort scores");
  assert.equal(published.every((c) => c.cohortScore === undefined || c.edgeScore === undefined), true);
});

test("the client never invents a score the pipeline withheld", () => {
  // A new arrival that missed the cohort bar carries no score by design.
  // The client cannot see that reasoning, so it must not re-derive one.
  const withheld = [{
    ...catalog[0],
    setCode: "msh",
    releasedAt: "2026-08-15",
    popularity: { edhrecRank: 2338, deckCount: 398, asOf: "2026-09-22" }
  }];
  const published = decodeCommanders(build(withheld)["commanders.json"]);
  assert.equal(published[0].edgeScore, undefined, "the pipeline withholds it");
  assert.equal(published[0].cohortScore, undefined, "and it missed the cohort bar");
  assert.equal(hydrateCommanders(published)[0].edgeScore, undefined, "so the client must leave it withheld");
});

test("the client reproduces the published Edge score exactly", () => {
  const published = decodeCommanders(build(catalog)["commanders.json"]);
  for (const commander of hydrateCommanders(published)) {
    if (commander.cohortScore !== undefined) continue;
    assert.equal(commander.edgeScore, scoreCommander(commander).edgeScore,
      `${commander.name}: the client and the pipeline must not disagree about the headline number`);
  }
});

/**
 * #10 removed datasets nothing fetched. Asserting that against a second
 * hardcoded list only moves the problem: both lists drift together and the
 * guard passes while the claim is false. Read what the client actually asks
 * for, so adding a dataset the userscript never fetches fails here.
 */
test("only the files the userscript fetches are published", () => {
  const client = readFileSync(new URL("../src/userscript/data-client.js", import.meta.url), "utf8");
  const fetched = [...client.matchAll(/\$\{base\}\/([a-z0-9/-]+\.json)/g)]
    .map((match) => match[1])
    .filter((name) => name !== "manifest.json");
  assert.ok(fetched.length, "no dataset URLs found in the data client");
  assert.deepEqual(Object.keys(build(catalog)).sort(), [...new Set(fetched)].sort());
});
