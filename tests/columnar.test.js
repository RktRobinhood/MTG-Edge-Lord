import assert from "node:assert/strict";
import test from "node:test";
import { COLUMNAR_FORMAT, decodeColumnar, encodeColumnar } from "../src/shared/columnar.js";
import { COMMANDER_SCHEMA_VERSION, decodeCommanders, encodeCommanders } from "../src/shared/catalog.js";

const records = [
  { name: "Massimo, the Magician", slug: "massimo", popularity: { edhrecRank: 1050, deckCount: 2200, asOf: "2026-09-20" }, findingIds: ["a"], momentum: 44 },
  { name: "Krenko, Mob Boss", slug: "krenko", popularity: { edhrecRank: 5, deckCount: 44161, asOf: "2026-09-20" }, findingIds: [], momentum: 47.8 },
  { name: "Unranked Legend", slug: "unranked", findingIds: [], momentum: 0 }
];

test("encoding then decoding yields the same logical records", () => {
  assert.deepEqual(decodeColumnar(encodeColumnar(records)), records);
});

test("a field absent from a record stays absent, rather than becoming null", () => {
  const [, , unranked] = decodeColumnar(encodeColumnar(records));
  assert.equal("popularity" in unranked, false);
});

test("floats are stored at display precision", () => {
  const encoded = encodeColumnar([{ trendZscore: 0.16533093059812234 }, { trendZscore: -0.079435043 }], { precision: { trendZscore: 3 } });
  assert.deepEqual(decodeColumnar(encoded), [{ trendZscore: 0.165 }, { trendZscore: -0.079 }]);
});

test("integers are never rounded away", () => {
  const encoded = encodeColumnar([{ deckCount: 44161 }, { deckCount: 1 }]);
  assert.deepEqual(decodeColumnar(encoded), [{ deckCount: 44161 }, { deckCount: 1 }]);
});

test("a column with one dominant value costs a handful of bytes", () => {
  const many = Array.from({ length: 2000 }, (_, index) => ({ score: index === 7 ? 57.8 : 0 }));
  const column = encodeColumnar(many).columns.score;
  assert.equal(column.kind, "sparse");
  assert.equal(column.fill, 0);
  assert.deepEqual(column.index, [7]);
  assert.deepEqual(decodeColumnar(encodeColumnar(many)), many);
});

test("decoded records do not share a mutable fill value", () => {
  const decoded = decodeColumnar(encodeColumnar(records));
  decoded[1].findingIds.push("mutated");
  assert.deepEqual(decoded[2].findingIds, []);
});

test("a low-cardinality column stores each value once", () => {
  const many = Array.from({ length: 300 }, (_, index) => ({ setCode: index % 2 ? "blb" : "dsk", rank: index }));
  const encoded = encodeColumnar(many);
  assert.equal(encoded.columns.setCode.kind, "dict");
  assert.deepEqual([...encoded.columns.setCode.keys].sort(), ["blb", "dsk"]);
  assert.deepEqual(decodeColumnar(encoded), many);
});

test("an unknown format is refused rather than silently mis-decoded", () => {
  assert.throws(() => decodeColumnar({ format: "columnar/99", count: 0, columns: {} }), /Unsupported columnar format/);
});

test("the commander dataset round-trips through its published shape", () => {
  const dataset = encodeCommanders(records);
  assert.equal(dataset.schemaVersion, COMMANDER_SCHEMA_VERSION);
  assert.equal(dataset.commanders.format, COLUMNAR_FORMAT);
  assert.deepEqual(decodeCommanders(dataset), records);
});

test("a schemaVersion 1 catalogue still reads, so a stale cache degrades rather than empties", () => {
  assert.deepEqual(decodeCommanders({ schemaVersion: 1, commanders: records }), records);
});
