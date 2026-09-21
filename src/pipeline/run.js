import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { manualConnector } from "../connectors/manual.js";
import { scryfallConnector } from "../connectors/scryfall.js";
import { edhrecConnector } from "../connectors/edhrec.js";
import { sha256 } from "../shared/fingerprint.js";
import { assertValid, createValidator } from "../shared/validation.js";
import { buildDatasets } from "./datasets.js";
import { deriveMomentumFindings, updateCommanderHistory } from "./history.js";
import { buildRelationships, mergeDuplicateFindings, normalizeFinding } from "./normalize.js";

export async function runPipeline({ root, network = false, now = new Date(), fetchImpl = fetch }) {
  const diagnostics = [];
  const today = now.toISOString().slice(0, 10);
  const previousFindings = (await readJson(path.join(root, "data", "findings.json")))?.findings ?? [];
  const manualResult = await manualConnector.collect({ root, fetch: fetchImpl });
  diagnostics.push(...manualResult.diagnostics.map((message) => `${manualConnector.id}: ${message}`));
  const previousCommanders = (await readJson(path.join(root, "data", "commanders.json")))?.commanders ?? [];
  const previousHistory = await readJson(path.join(root, "data", "commander-history.json"));
  const reviewedInput = manualResult.failures > 0 && manualResult.findings.length === 0
    ? previousFindings.filter((finding) => !finding.tags.includes("needs-research"))
    : manualResult.findings;
  const manual = hydrateExistingMetadata(reviewedInput, previousFindings);
  let catalog = previousCommanders.filter((commander) => commander.popularity);
  let history = previousHistory ?? { schemaVersion: 1, snapshots: [] };
  let findings = manual.map(normalizeFinding);

  if (network) {
    const catalogResult = await safeCatalog(edhrecConnector, catalog, { root, fetch: fetchImpl, today, sleep }, diagnostics);
    catalog = catalogResult.commanders;
    if (catalogResult.changed) history = updateCommanderHistory(history, catalog, today);
    findings.push(...deriveMomentumFindings(catalog, history, `${today}T00:00:00.000Z`).map(normalizeFinding));
    findings = await safeEnrich(scryfallConnector, findings, { root, fetch: fetchImpl }, diagnostics);
    findings = findings.map(normalizeFinding);
  }

  findings = mergeDuplicateFindings(findings);
  const findingSchema = JSON.parse(await readFile(path.join(root, "schema", "finding.schema.json"), "utf8"));
  const validateFinding = createValidator(findingSchema);
  for (const finding of findings) assertValid(validateFinding, finding, `finding ${finding.id}`);

  const relationships = buildRelationships(findings);
  const datasets = buildDatasets(findings, relationships, catalog, history);
  const result = await writeDatasets(root, datasets, now);
  return { ...result, findings: findings.length, relationships: relationships.length, diagnostics };
}

async function safeEnrich(connector, findings, context, diagnostics) {
  try {
    const result = await connector.enrich(findings, context);
    diagnostics.push(...result.diagnostics.map((message) => `${connector.id}: ${message}`));
    return result.findings;
  } catch (error) {
    diagnostics.push(`${connector.id}: FAILED — ${error.message}; retained unenriched findings.`);
    return findings;
  }
}

async function safeCatalog(connector, fallback, context, diagnostics) {
  try {
    const result = await connector.collectCatalog(context);
    diagnostics.push(...result.diagnostics.map((message) => `${connector.id}: ${message}`));
    return { commanders: result.commanders, changed: true };
  } catch (error) {
    diagnostics.push(`${connector.id}: FAILED — ${error.message}; retained the previous commander catalogue.`);
    return { commanders: fallback, changed: false };
  }
}

function hydrateExistingMetadata(findings, previousFindings) {
  const ids = new Map(previousFindings.flatMap((finding) => [...finding.commanders, ...finding.cards])
    .filter((entity) => entity.scryfallId)
    .map((entity) => [entity.name.toLowerCase(), entity.scryfallId]));
  const hydrate = (entity) => entity.scryfallId || !ids.has(entity.name.toLowerCase())
    ? entity
    : { ...entity, scryfallId: ids.get(entity.name.toLowerCase()) };
  return findings.map((finding) => ({
    ...finding,
    commanders: finding.commanders.map(hydrate),
    cards: finding.cards.map(hydrate)
  }));
}

async function writeDatasets(root, datasets, now) {
  const rendered = Object.fromEntries(Object.entries(datasets).map(([name, value]) => [name, `${JSON.stringify(value, null, 2)}\n`]));
  const files = Object.fromEntries(Object.entries(rendered).map(([name, content]) => [name, {
    sha256: sha256(content),
    bytes: Buffer.byteLength(content)
  }]));
  const dataVersion = sha256(JSON.stringify(files)).slice(0, 16);
  const manifestPath = path.join(root, "data", "manifest.json");
  const previous = await readJson(manifestPath);
  if (previous?.dataVersion === dataVersion) return { changed: false, dataVersion };

  for (const [name, content] of Object.entries(rendered)) {
    const destination = path.join(root, "data", name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  const generatedAt = now.toISOString();
  const manifest = { schemaVersion: 1, dataVersion, generatedAt, files };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const historyName = `${generatedAt.slice(0, 10)}-${files["findings.json"].sha256.slice(0, 16)}.json`;
  await writeFile(path.join(root, "data", "history", historyName), rendered["findings.json"]);
  return { changed: true, dataVersion };
}

async function readJson(filename) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
