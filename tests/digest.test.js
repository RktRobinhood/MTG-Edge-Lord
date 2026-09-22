import assert from "node:assert/strict";
import test from "node:test";
import { SUMMARY_LIMIT, attributableFindings, isAttributable, sourceLabel, truncateSummary } from "../src/userscript/digest.js";

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
