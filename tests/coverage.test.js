import assert from "node:assert/strict";
import test from "node:test";
import { COVERAGE_WINDOW_DAYS, applyCoverage, trimCoverage, updateCoverage } from "../src/pipeline/coverage.js";

const candidate = (slug) => ({ id: slug, commanders: [{ slug, name: slug }] });

test("coverage accumulates across runs, because connectors only report what is new", () => {
  const first = updateCoverage({}, [candidate("massimo")], "2026-09-20");
  const second = updateCoverage(first, [candidate("massimo"), candidate("arcum")], "2026-09-22");
  assert.deepEqual(second.massimo, ["2026-09-20", "2026-09-22"]);
  assert.deepEqual(second.arcum, ["2026-09-22"]);
});

test("coverage older than the window falls out", () => {
  const stale = { massimo: ["2020-01-01"], arcum: ["2026-09-22"] };
  const trimmed = trimCoverage(stale, "2026-09-22", COVERAGE_WINDOW_DAYS);
  assert.equal(trimmed.massimo, undefined);
  assert.deepEqual(trimmed.arcum, ["2026-09-22"]);
});

test("a commander with no coverage has no mentionCount, rather than a zero", () => {
  const [covered, uncovered] = applyCoverage(
    [{ slug: "massimo" }, { slug: "arcum" }],
    { massimo: ["2026-09-20", "2026-09-22"] }
  );
  assert.equal(covered.mentionCount, 2);
  assert.equal("mentionCount" in uncovered, false);
});

test("coverage records dates, never content", () => {
  const coverage = updateCoverage({}, [{ id: "x", title: "A whole article body", commanders: [{ slug: "massimo" }] }], "2026-09-22");
  assert.equal(JSON.stringify(coverage).includes("article"), false);
});
