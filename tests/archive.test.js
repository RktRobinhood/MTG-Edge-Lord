import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVE_SOURCE_CAP, updateArchive } from "../src/pipeline/archive.js";

const finding = (id, slug = "massimo", overrides = {}) => ({
  id,
  findingType: "discovery_signal",
  source: { name: "A Source", url: `https://example.test/${id}`, creator: "A Creator" },
  commanders: [{ slug, name: "Massimo, the Magician" }],
  ...overrides
});

const catalog = (rank, decks) => [{ slug: "massimo", popularity: { edhrecRank: rank, deckCount: decks, asOf: "2026-09-20" } }];

test("the archive accumulates across runs", () => {
  let archive = updateArchive(null, [finding("one")], "2026-09-20", catalog(2400, 180));
  archive = updateArchive(archive, [finding("two")], "2026-09-22", catalog(2400, 190));
  assert.equal(archive.archive.length, 1);
  assert.deepEqual(archive.archive[0].findingIds, ["one", "two"]);
  assert.equal(archive.archive[0].timesSurfaced, 2);
});

test("the date we first surfaced a commander never moves", () => {
  let archive = updateArchive(null, [finding("one")], "2026-09-20", catalog(2400, 180));
  archive = updateArchive(archive, [finding("two")], "2026-09-22", catalog(2400, 190));
  assert.equal(archive.archive[0].firstSurfacedAt, "2026-09-20");
  assert.equal(archive.archive[0].lastSurfacedAt, "2026-09-22");
});

test("the rank recorded is the rank when found, not the rank now", () => {
  let archive = updateArchive(null, [finding("one")], "2026-09-20", catalog(2400, 180));
  archive = updateArchive(archive, [finding("two")], "2026-09-22", catalog(700, 2200));
  assert.equal(archive.archive[0].popularityAtFirstSurface.edhrecRank, 2400);
  assert.equal(archive.archive[0].popularityAtFirstSurface.deckCount, 180);
});

test("a commander this run did not surface stays archived", () => {
  let archive = updateArchive(null, [finding("one", "massimo")], "2026-09-20", catalog(2400, 180));
  archive = updateArchive(archive, [finding("two", "arcum")], "2026-09-22", []);
  assert.deepEqual(archive.archive.map((entry) => entry.slug).sort(), ["arcum", "massimo"]);
});

test("the same source twice is one link, and the newest wins", () => {
  const repeat = { ...finding("two"), source: { name: "A Source", url: "https://example.test/one", creator: "Renamed" } };
  let archive = updateArchive(null, [finding("one")], "2026-09-20", catalog(2400, 180));
  archive = updateArchive(archive, [repeat], "2026-09-22", catalog(2400, 180));
  assert.equal(archive.archive[0].sources.length, 1);
  assert.equal(archive.archive[0].sources[0].creator, "Renamed");
});

test("links are capped, so an archive entry cannot become a link farm", () => {
  let archive = null;
  for (let index = 0; index < ARCHIVE_SOURCE_CAP + 4; index += 1) {
    archive = updateArchive(archive, [finding(`find-${index}`)], "2026-09-22", catalog(2400, 180));
  }
  assert.equal(archive.archive[0].sources.length, ARCHIVE_SOURCE_CAP);
  assert.equal(archive.archive[0].timesSurfaced, ARCHIVE_SOURCE_CAP + 4);
});

test("the archive stores pointers, never a copy of anyone's work", () => {
  const wordy = { ...finding("one"), title: "A whole article title", summary: "A creator's paragraph of prose." };
  const archive = updateArchive(null, [wordy], "2026-09-20", catalog(2400, 180));
  const stored = JSON.stringify(archive);
  assert.equal(stored.includes("prose"), false);
  assert.equal(stored.includes("article title"), false);
  assert.ok(stored.includes("https://example.test/one"));
});

test("newest surfacing sorts first", () => {
  let archive = updateArchive(null, [finding("one", "older")], "2026-09-01", []);
  archive = updateArchive(archive, [finding("two", "newer")], "2026-09-22", []);
  assert.equal(archive.archive[0].slug, "newer");
});
