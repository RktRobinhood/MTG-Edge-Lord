import assert from "node:assert/strict";
import test from "node:test";
import { scoreFinding, scoreRelationship } from "../src/shared/scoring.js";

const base = {
  findingType: "discovery_signal",
  source: { resourceDepth: "discussion" },
  cards: [{ name: "Card" }],
  evidence: { strength: 0.5, independentSourceCount: 1, conversationDepth: "reasoned", communityReasoned: true, tested: false },
  popularity: { edhrecRank: 1500, deckCount: 500 },
  movement: { "30d": 20 }
};

test("score is explainable and bounded", () => {
  const score = scoreFinding(base);
  assert.ok(score.total >= 0 && score.total <= 100);
  assert.equal(Object.keys(score.components).length, 6);
  assert.ok(score.reasons.length > 0);
});

test("tested independent evidence scores above an unreasoned mention", () => {
  const strong = scoreFinding({ ...base, evidence: { ...base.evidence, tested: true, independentSourceCount: 3, conversationDepth: "maintained", strength: 0.9 } });
  const weak = scoreFinding({ ...base, evidence: { ...base.evidence, communityReasoned: false, conversationDepth: "mention", strength: 0.1 } });
  assert.ok(strong.total > weak.total);
});

test("relationship score rewards synergy while retaining raw inputs", () => {
  const edge = { metrics: { commanderInclusionPct: 60, edhrecSynergyPct: 45, globalPopularityPct: 4 }, evidenceStrength: 0.8 };
  assert.equal(scoreRelationship(edge), 67.7);
  assert.equal(edge.metrics.edhrecSynergyPct, 45);
});
