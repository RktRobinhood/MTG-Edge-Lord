import assert from "node:assert/strict";
import test from "node:test";
import { deriveMomentumFindings, movementFor, updateCommanderHistory } from "../src/pipeline/history.js";

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
