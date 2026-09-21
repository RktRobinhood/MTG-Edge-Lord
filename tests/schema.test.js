import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeFinding } from "../src/pipeline/normalize.js";
import { createValidator } from "../src/shared/validation.js";

const schema = JSON.parse(await readFile(new URL("../schema/finding.schema.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("./fixtures/minimal-finding.json", import.meta.url), "utf8"));

test("normalized fixture satisfies the public findings schema", () => {
  const validate = createValidator(schema);
  assert.equal(validate(normalizeFinding(fixture)), true, JSON.stringify(validate.errors));
});

test("non-HTTPS attribution is rejected", () => {
  const validate = createValidator(schema);
  const finding = normalizeFinding({ ...fixture, source: { ...fixture.source, url: "http://example.com" } });
  assert.equal(validate(finding), false);
});
