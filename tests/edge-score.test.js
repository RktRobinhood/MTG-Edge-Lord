import assert from "node:assert/strict";
import test from "node:test";
import {
  BRACKET_CONFIDENCE_FLOOR,
  EDGE_MODEL_VERSION,
  bracketFit,
  obscurityForRank,
  retention,
  scoreCommander,
  tierForRank
} from "../src/shared/edge-score.js";

const massimo = {
  name: "Massimo, the Magician",
  slug: "massimo-the-magician",
  popularity: { edhrecRank: 1050, deckCount: 2200 },
  bracketCounts: [4, 109, 142, 11, 6],
  archetypeDepth: 0.42,
  retentionTrend: [66, 71, 86, 105, 114, 91, 103, 117]
};

test("the worked example from docs/SCORING.md", () => {
  assert.equal(bracketFit([4, 109, 142, 11, 6]), 0.576);
});

test("brackets 1 and 2 drag the fit down without a special case", () => {
  assert.equal(bracketFit([0, 0, 100, 0, 0]), 1);
  assert.equal(bracketFit([100, 100, 0, 0, 0]), 0);
  assert.equal(bracketFit([0, 100, 100, 0, 0]), 0.5);
});

test("a pure-cEDH commander cannot top the chart", () => {
  const cedh = bracketFit([0, 0, 0, 0, 200]);
  const bracketFour = bracketFit([0, 0, 0, 200, 0]);
  assert.equal(cedh, 0.6);
  assert.ok(bracketFour > cedh, "bracket 4 presence should beat pure cEDH");
});

test("below the confidence floor bracket fit is absent, not zero", () => {
  assert.equal(bracketFit([1, 2, 3, 1, 1]), null);
  assert.equal(bracketFit([0, 0, BRACKET_CONFIDENCE_FLOOR, 0, 0]), 1);
  assert.equal(bracketFit(undefined), null);
  assert.equal(bracketFit([1, 2, 3]), null);
});

test("obscurity is a curve: zero in the top 500, peaking across the Edge tier", () => {
  assert.equal(obscurityForRank(1), 0);
  assert.equal(obscurityForRank(500), 0);
  assert.equal(obscurityForRank(750), 0.5);
  assert.equal(obscurityForRank(1000), 1);
  assert.equal(obscurityForRank(3000), 1);
  assert.equal(obscurityForRank(3001), 0);
});

test("tiers come from rank", () => {
  assert.equal(tierForRank(5), "meta");
  assert.equal(tierForRank(800), "rare");
  assert.equal(tierForRank(2000), "edge");
  assert.equal(tierForRank(5000), "uncharted");
  assert.equal(tierForRank(undefined), "uncharted");
});

test("retention reads the trend, and one week of data says nothing", () => {
  assert.equal(retention([10, 10, 10, 10]), 0.5);
  assert.ok(retention([10, 10, 40, 40]) > 0.5);
  assert.ok(retention([40, 40, 10, 10]) < 0.5);
  assert.equal(retention([10, 10]), null);
  assert.equal(retention(undefined), null);
});

test("the edge score is multiplicative, so both halves must hold", () => {
  const obscureAndGood = scoreCommander(massimo);
  const popularAndGood = scoreCommander({ ...massimo, popularity: { edhrecRank: 120 } });
  const obscureAndBad = scoreCommander({ ...massimo, bracketCounts: [200, 400, 10, 0, 0], archetypeDepth: 0.02, retentionTrend: [200, 150, 40, 20] });

  assert.ok(obscureAndGood.edgeScore > 30, `expected a real score, got ${obscureAndGood.edgeScore}`);
  assert.equal(popularAndGood.edgeScore, 0, "a top-500 commander scores zero however good it is");
  assert.ok(obscureAndBad.edgeScore < obscureAndGood.edgeScore / 3, "an obscure but unconvincing commander scores near the bottom");
});

test("components and raw inputs survive next to the total", () => {
  const score = scoreCommander(massimo);
  assert.equal(score.quality.bracketFit, 0.576);
  assert.equal(score.quality.archetypeDepth, 0.42);
  assert.ok(score.quality.retention > 0);
  assert.equal(score.obscurity, 1);
  assert.equal(score.tier, "edge");
  assert.equal(score.modelVersion, EDGE_MODEL_VERSION);
  assert.ok(score.reasons.length > 0);
  assert.ok(score.reasons.some((reason) => reason.includes("Bracket 3")));
});

test("a commander past rank 3,000 is not scored at all", () => {
  const score = scoreCommander({ ...massimo, popularity: { edhrecRank: 4200 } });
  assert.equal(score.unscored, true);
  assert.equal(score.edgeScore, undefined);
  assert.equal(score.tier, "uncharted");
  assert.match(score.reason, /3000/);
});

test("below the floor the commander is unscored and its bracket counts are still shown", () => {
  const score = scoreCommander({ ...massimo, bracketCounts: [1, 2, 3, 1, 1] });
  assert.equal(score.unscored, true);
  assert.equal(score.edgeScore, undefined);
  assert.deepEqual(score.bracketCounts, [1, 2, 3, 1, 1]);
  assert.match(score.reason, /below the floor/);
});

test("a missing non-gating component is dropped rather than counted as zero", () => {
  const full = scoreCommander({ ...massimo, archetypeDepth: 0.576, retentionTrend: undefined });
  assert.equal(full.quality.retention, undefined);
  assert.equal(full.partial, true);
  assert.equal(full.worksScore, 0.576, "two equal components renormalise to their shared value");
});

test("bracket fit is the gating component: without it there is no score at all", () => {
  const noBrackets = scoreCommander({ ...massimo, bracketCounts: [1, 2, 3, 1, 1] });
  assert.equal(noBrackets.unscored, true);
  assert.equal(noBrackets.edgeScore, undefined);
  assert.match(noBrackets.reason, /below the floor/);
});

test("a commander we know least about cannot top a commander with real bracket evidence", () => {
  const thin = scoreCommander({ ...massimo, bracketCounts: [0, 0, 8, 0, 0], archetypeDepth: 1, retentionTrend: [10, 10, 40, 40] });
  const evidenced = scoreCommander({ ...massimo, archetypeDepth: 0.5, retentionTrend: [10, 10, 12, 12] });
  assert.equal(thin.unscored, true);
  assert.ok(evidenced.edgeScore > 0);
});

test("combo presence never reaches the score", () => {
  const withCombos = scoreCommander({ ...massimo, comboCount: 40 });
  const without = scoreCommander({ ...massimo, comboCount: 0 });
  assert.equal(withCombos.edgeScore, without.edgeScore);
});

test("an uncrawled commander inside the band is unscored, not zero", () => {
  const score = scoreCommander({ name: "Unknown", slug: "unknown", popularity: { edhrecRank: 1800 } });
  assert.equal(score.unscored, true);
  assert.equal(score.tier, "edge");
  assert.match(score.reason, /no EDHREC page data/i);
});
