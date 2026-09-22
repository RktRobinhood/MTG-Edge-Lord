import assert from "node:assert/strict";
import test from "node:test";
import { COVERAGE_WINDOW_DAYS, applyCoverage, coverageTrend, trimCoverage, updateCoverage } from "../src/pipeline/coverage.js";

const candidate = (slug, creator = "A Channel") => ({ id: slug, commanders: [{ slug, name: slug }], source: { name: creator, creator } });
const dates = (entries) => entries.map((entry) => entry.date);

test("coverage accumulates across runs, because connectors only report what is new", () => {
  const first = updateCoverage({}, [candidate("massimo")], "2026-09-20");
  const second = updateCoverage(first, [candidate("massimo"), candidate("arcum")], "2026-09-22");
  assert.deepEqual(dates(second.massimo), ["2026-09-20", "2026-09-22"]);
  assert.deepEqual(dates(second.arcum), ["2026-09-22"]);
});

test("coverage older than the window falls out", () => {
  const stale = { massimo: ["2020-01-01"], arcum: ["2026-09-22"] };
  const trimmed = trimCoverage(stale, "2026-09-22", COVERAGE_WINDOW_DAYS);
  assert.equal(trimmed.massimo, undefined);
  assert.deepEqual(dates(trimmed.arcum), ["2026-09-22"]);
});

test("a commander with no coverage has no mentionCount, rather than a zero", () => {
  const [covered, uncovered] = applyCoverage(
    [{ slug: "massimo" }, { slug: "arcum" }],
    { massimo: [{ date: "2026-09-20" }, { date: "2026-09-22" }] }
  );
  assert.equal(covered.mentionCount, 2);
  assert.equal("mentionCount" in uncovered, false);
});

test("coverage records dates and attribution, never content", () => {
  const coverage = updateCoverage({}, [{
    id: "x",
    title: "A whole article body",
    signal: "and its categories",
    commanders: [{ slug: "massimo" }],
    source: { name: "Panzer MTG", creator: "Panzer MTG" }
  }], "2026-09-22");
  const stored = JSON.stringify(coverage);
  assert.equal(stored.includes("article"), false);
  assert.equal(stored.includes("categories"), false);
  assert.equal(coverage.massimo[0].source, "Panzer MTG");
});

test("coverage stored by an earlier version still reads, without inventing a source", () => {
  const trend = coverageTrend(["2026-09-20", "2026-09-21"], "2026-09-22");
  assert.equal(trend.recent, 2);
  assert.equal(trend.independentSources, 0);
});

test("the trend reads the shape of the window, not its total", () => {
  const spread = [
    { date: "2026-07-30", source: "One" },
    { date: "2026-09-18", source: "One" },
    { date: "2026-09-20", source: "Two" }
  ];
  const trend = coverageTrend(spread, "2026-09-22");
  assert.equal(trend.recent, 2);
  assert.equal(trend.prior, 1);
  assert.equal(trend.independentSources, 2);
  assert.equal(trend.activeDays, 2);
});

test("a first-ever mention is bounded growth, not infinite growth", () => {
  const trend = coverageTrend([{ date: "2026-09-22", source: "One" }], "2026-09-22");
  assert.equal(Number.isFinite(trend.ratio), true);
  assert.equal(trend.ratio, 2);
});

test("an empty window produces no trend at all", () => {
  assert.equal(coverageTrend(undefined, "2026-09-22"), null);
  assert.equal(coverageTrend([], "2026-09-22"), null);
});
