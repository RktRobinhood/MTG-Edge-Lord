import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertValid, createValidator } from "../src/shared/validation.js";
import { sha256 } from "../src/shared/fingerprint.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [findingSchema, manifestSchema, findings, manifest] = await Promise.all([
  readJson("schema/finding.schema.json"),
  readJson("schema/manifest.schema.json"),
  readJson("data/findings.json"),
  readJson("data/manifest.json")
]);

const validateFinding = createValidator(findingSchema);
for (const finding of findings.findings) assertValid(validateFinding, finding, finding.id);
assertValid(createValidator(manifestSchema), manifest, "manifest");
for (const [name, metadata] of Object.entries(manifest.files)) {
  const content = await readFile(path.join(root, "data", name));
  if (content.byteLength !== metadata.bytes) throw new Error(`${name} byte count differs from manifest`);
  if (sha256(content) !== metadata.sha256) throw new Error(`${name} hash differs from manifest`);
}
console.log(`Validated ${findings.findings.length} findings and ${Object.keys(manifest.files).length} generated files.`);

function readJson(relative) {
  return readFile(path.join(root, relative), "utf8").then(JSON.parse);
}
