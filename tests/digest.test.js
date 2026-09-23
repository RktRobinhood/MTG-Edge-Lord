import assert from "node:assert/strict";
import test from "node:test";
import { FEED_PAGE_SIZE, SUMMARY_LIMIT, attributableFindings, isAttributable, recentFirst, sourceLabel, truncateSummary } from "../src/userscript/digest.js";

const finding = (overrides = {}) => ({
  id: "a",
  title: "A finding",
  summary: "Short summary.",
  source: { url: "https://example.com/post", creator: "A Brewer", name: "Archidekt" },
  ...overrides
});

test("a summary longer than the cap is truncated at a word boundary", () => {
  const long = `${"word ".repeat(100)}end`;
  const shown = truncateSummary(long);
  assert.ok(shown.length <= SUMMARY_LIMIT + 1, `expected at most ${SUMMARY_LIMIT + 1}, got ${shown.length}`);
  assert.ok(shown.endsWith("…"));
  assert.equal(shown.includes("  "), false);
});

test("a short summary is left alone, with no ellipsis", () => {
  assert.equal(truncateSummary("Short summary."), "Short summary.");
  assert.equal(truncateSummary(undefined), "");
});

test("the cap is short enough that the digest cannot replace the source", () => {
  assert.ok(SUMMARY_LIMIT <= 300, "a digest longer than a few sentences stops driving traffic to the creator");
});

test("a finding with no canonical https URL does not render", () => {
  assert.equal(isAttributable(finding()), true);
  assert.equal(isAttributable(finding({ source: { url: "http://example.com" } })), false);
  assert.equal(isAttributable(finding({ source: {} })), false);
  assert.equal(isAttributable(finding({ source: { url: "javascript:alert(1)" } })), false);
  assert.equal(isAttributable(undefined), false);
});

test("unattributable findings are dropped from the feed rather than shown uncredited", () => {
  const feed = attributableFindings([finding(), finding({ id: "b", source: { creator: "Nobody" } })]);
  assert.deepEqual(feed.map((item) => item.id), ["a"]);
});

test("the credit prefers the person, then the platform", () => {
  assert.equal(sourceLabel({ creator: "A Brewer", name: "Archidekt" }), "A Brewer · Archidekt");
  assert.equal(sourceLabel({ creator: "EDHREC", name: "EDHREC" }), "EDHREC");
  assert.equal(sourceLabel({ name: "MTGGoldfish" }), "MTGGoldfish");
  assert.equal(sourceLabel({}), "Source");
});

test("the feed leads with what was surfaced most recently, not what was written most recently", () => {
  const older = finding({ id: "older", observedAt: "2026-09-20T00:00:00.000Z", publishedAt: "2026-09-19" });
  const readToday = finding({ id: "read-today", observedAt: "2026-09-23T00:00:00.000Z", publishedAt: "2026-05-27" });
  assert.deepEqual(recentFirst([older, readToday]).map((item) => item.id), ["read-today", "older"]);
});

test("a batch surfaced on one day is ordered by the source, then by the score", () => {
  const day = "2026-09-23T00:00:00.000Z";
  const stale = finding({ id: "stale", observedAt: day, publishedAt: "2026-06-20", score: { total: 90 } });
  const fresh = finding({ id: "fresh", observedAt: day, publishedAt: "2026-09-22", score: { total: 10 } });
  const alsoFresh = finding({ id: "also-fresh", observedAt: day, publishedAt: "2026-09-22", score: { total: 50 } });
  assert.deepEqual(recentFirst([fresh, stale, alsoFresh]).map((item) => item.id), ["also-fresh", "fresh", "stale"]);
});

test("a finding with no dates sorts last instead of breaking the order", () => {
  const dated = finding({ id: "dated", observedAt: "2026-09-23T00:00:00.000Z" });
  const undatedFinding = finding({ id: "undated" });
  assert.deepEqual(recentFirst([undatedFinding, dated]).map((item) => item.id), ["dated", "undated"]);
});

test("ordering the feed does not reorder the caller's array", () => {
  const input = [finding({ id: "a", observedAt: "2026-09-01T00:00:00.000Z" }), finding({ id: "b", observedAt: "2026-09-23T00:00:00.000Z" })];
  recentFirst(input);
  assert.deepEqual(input.map((item) => item.id), ["a", "b"]);
});

test("the feed pages at a length someone will read", () => {
  assert.ok(FEED_PAGE_SIZE > 0 && FEED_PAGE_SIZE <= 20, "a feed longer than a screenful stops being a digest");
});

test("the minute of the fetch does not reorder a batch read on the same day", () => {
  const early = finding({ id: "early-fetch", observedAt: "2026-09-23T07:00:00.000Z", publishedAt: "2026-09-22" });
  const late = finding({ id: "late-fetch", observedAt: "2026-09-23T07:10:00.000Z", publishedAt: "2026-09-20" });
  assert.deepEqual(recentFirst([late, early]).map((item) => item.id), ["early-fetch", "late-fetch"]);
});
