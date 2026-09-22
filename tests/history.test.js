import assert from "node:assert/strict";
import test from "node:test";
import { deckGrowth, deriveDiscussionMomentumFindings, deriveMomentumFindings, movementFor, updateCommanderHistory } from "../src/pipeline/history.js";

const commander = (rank, decks) => ({ name: "Hidden Commander", slug: "hidden-commander", popularity: { edhrecRank: rank, deckCount: decks, asOf: "2026-09-21" } });

test("history derives a bounded momentum finding from consecutive snapshots", () => {
  let history = updateCommanderHistory(null, [commander(700, 100)], "2026-09-20");
  history = updateCommanderHistory(history, [commander(660, 130)], "2026-09-21");
  const findings = deriveMomentumFindings([commander(660, 130)], history, "2026-09-21T00:00:00.000Z");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].popularity.edhrecRank, 660);
  assert.ok(movementFor("hidden-commander", history)["7d"] > 0);
});

test("same-day refresh replaces rather than duplicates snapshots", () => {
  let history = updateCommanderHistory(null, [commander(700, 100)], "2026-09-21");
  history = updateCommanderHistory(history, [commander(690, 110)], "2026-09-21");
  assert.equal(history.snapshots.length, 1);
  assert.equal(history.snapshots[0].commanders["hidden-commander"].decks, 110);
});

// --- Discussion momentum: coverage rising while the deck count stays flat ---

const OBSERVED = "2026-09-22T00:00:00.000Z";
const entry = (date, source) => ({ date, source });

/** Flat adoption: one deck added over the window the coverage is measured in. */
const flatHistory = () => {
  let history = updateCommanderHistory(null, [commander(700, 100)], "2026-08-01");
  return updateCommanderHistory(history, [commander(698, 101)], "2026-09-22");
};

/** Four records, three creators, three days in the recent half; one before it. */
const risingCoverage = {
  "hidden-commander": [
    entry("2026-08-01", "Old Feed"),
    entry("2026-09-10", "Panzer MTG"),
    entry("2026-09-15", "Unpopular MTG"),
    entry("2026-09-15", "Commander Labs"),
    entry("2026-09-20", "Panzer MTG")
  ]
};

test("coverage climbing against a flat deck count is reported, and says so", () => {
  const findings = deriveDiscussionMomentumFindings([commander(698, 101)], risingCoverage, flatHistory(), OBSERVED);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidence.independentSourceCount, 3);
  assert.ok(findings[0].tags.includes("discussion-momentum"));
  assert.match(findings[0].title, /discussed faster than it is being built/);
});

test("one creator posting repeatedly is not a community", () => {
  const oneCreator = {
    "hidden-commander": [
      entry("2026-08-01", "Panzer MTG"),
      entry("2026-09-10", "Panzer MTG"),
      entry("2026-09-15", "Panzer MTG"),
      entry("2026-09-20", "Panzer MTG")
    ]
  };
  assert.deepEqual(deriveDiscussionMomentumFindings([commander(698, 101)], oneCreator, flatHistory(), OBSERVED), []);
});

test("a single day of coverage is a spike, not a trend", () => {
  const spike = {
    "hidden-commander": [
      entry("2026-09-20", "Panzer MTG"),
      entry("2026-09-20", "Unpopular MTG"),
      entry("2026-09-20", "Commander Labs"),
      entry("2026-09-20", "EDHREC")
    ]
  };
  assert.deepEqual(deriveDiscussionMomentumFindings([commander(698, 101)], spike, flatHistory(), OBSERVED), []);
});

test("coverage and decks rising together is adoption, which the other lane reports", () => {
  let rising = updateCommanderHistory(null, [commander(900, 100)], "2026-08-01");
  rising = updateCommanderHistory(rising, [commander(698, 200)], "2026-09-22");
  assert.deepEqual(deriveDiscussionMomentumFindings([commander(698, 200)], risingCoverage, rising, OBSERVED), []);
});

test("the mostly-empty window this ships into produces nothing", () => {
  const young = { "hidden-commander": [entry("2026-09-22", "Panzer MTG")] };
  assert.deepEqual(deriveDiscussionMomentumFindings([commander(698, 101)], young, flatHistory(), OBSERVED), []);
  assert.deepEqual(deriveDiscussionMomentumFindings([commander(698, 101)], {}, flatHistory(), OBSERVED), []);
});

test("without a baseline snapshot the divergence cannot be claimed, so it is not", () => {
  const single = updateCommanderHistory(null, [commander(698, 101)], "2026-09-22");
  assert.deepEqual(deriveDiscussionMomentumFindings([commander(698, 101)], risingCoverage, single, OBSERVED), []);
});

test("discussion momentum stays clear of the ranks the product does not cover", () => {
  const history = flatHistory();
  const tooPopular = [{ ...commander(120, 101), slug: "hidden-commander" }];
  assert.deepEqual(deriveDiscussionMomentumFindings(tooPopular, risingCoverage, history, OBSERVED), []);
  const tooObscure = [{ ...commander(4200, 101), slug: "hidden-commander" }];
  assert.deepEqual(deriveDiscussionMomentumFindings(tooObscure, risingCoverage, history, OBSERVED), []);
});

test("deck growth reports null where no baseline exists, rather than a zero", () => {
  const single = updateCommanderHistory(null, [commander(698, 101)], "2026-09-22");
  assert.equal(deckGrowth("hidden-commander", single, 30), null);
  assert.ok(Math.abs(deckGrowth("hidden-commander", flatHistory(), 30) - 1) < 0.0001);
});
