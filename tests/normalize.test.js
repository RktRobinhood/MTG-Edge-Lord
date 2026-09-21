import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRelationships, mergeDuplicateFindings, normalizeFinding } from "../src/pipeline/normalize.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/minimal-finding.json", import.meta.url), "utf8"));

test("normalization supplies slugs, fingerprint, tags, and score", () => {
  const finding = normalizeFinding(fixture);
  assert.equal(finding.commanders[0].slug, "commander-example");
  assert.deepEqual(finding.tags, ["example-tag"]);
  assert.match(finding.fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(finding.score.total > 0);
});

test("duplicate source evidence collapses by stable fingerprint", () => {
  const first = normalizeFinding(fixture);
  const second = normalizeFinding({ ...fixture, evidence: { ...fixture.evidence, strength: 0.9 } });
  const merged = mergeDuplicateFindings([first, second]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].evidence.strength, 0.9);
});

test("card-first relationships preserve provenance", () => {
  const finding = normalizeFinding(fixture);
  const [edge] = buildRelationships([finding]);
  assert.equal(edge.id, "card-example--commander-example");
  assert.deepEqual(edge.findingIds, [fixture.id]);
  assert.deepEqual(edge.sourceUrls, [fixture.source.url]);
});
