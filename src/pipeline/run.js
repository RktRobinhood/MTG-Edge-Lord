import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { manualConnector } from "../connectors/manual.js";
import { scryfallConnector } from "../connectors/scryfall.js";
import { CARD_FACT_FIELDS, scryfallBulkConnector } from "../connectors/scryfall-bulk.js";
import { edhrecConnector } from "../connectors/edhrec.js";
import { PAGE_FACT_FIELDS, edhrecPagesConnector } from "../connectors/edhrec-pages.js";
import { ARCHIDEKT_FACT_FIELDS, archidektConnector } from "../connectors/archidekt.js";
import { COMBO_FACT_FIELDS, spellbookConnector } from "../connectors/spellbook.js";
import { TOURNAMENT_FACT_FIELDS, edhtop16Connector } from "../connectors/edhtop16.js";
import { COMMUNITY_FACT_FIELDS, cedhDdbConnector } from "../connectors/cedh-ddb.js";
import { rssConnector } from "../connectors/rss.js";
import { youtubeConnector } from "../connectors/youtube.js";
import { applyCoverage, updateCoverage } from "./coverage.js";
import { prefilter } from "./prefilter.js";
import { judge } from "./judge.js";
import { readPipelineState, writePipelineState } from "./state.js";
import { sha256 } from "../shared/fingerprint.js";
import { assertValid, createValidator } from "../shared/validation.js";
import { decodeCommanders, isColumnar } from "../shared/catalog.js";
import { buildDatasets } from "./datasets.js";
import { deriveDiscussionMomentumFindings, deriveMomentumFindings, updateCommanderHistory } from "./history.js";
import { buildRelationships, mergeDuplicateFindings, normalizeFinding } from "./normalize.js";

/**
 * Fields a connector owns and the pipeline carries across a catalogue refresh.
 * The EDHREC walk returns rank and deck count only; everything else was true
 * when its lane last ran and stays true until that lane runs again.
 */
const CARRIED_FIELDS = Object.freeze([
  ...CARD_FACT_FIELDS,
  ...PAGE_FACT_FIELDS,
  ...COMBO_FACT_FIELDS,
  ...TOURNAMENT_FACT_FIELDS,
  ...COMMUNITY_FACT_FIELDS,
  ...ARCHIDEKT_FACT_FIELDS
]);

export async function runPipeline({ root, network = false, now = new Date(), fetchImpl = fetch, pagesPerRun, commandersPerRun, env = process.env }) {
  const diagnostics = [];
  const today = now.toISOString().slice(0, 10);
  const previousFindings = (await readJson(path.join(root, "data", "findings.json")))?.findings ?? [];
  const manualResult = await manualConnector.collect({ root, fetch: fetchImpl });
  diagnostics.push(...manualResult.diagnostics.map((message) => `${manualConnector.id}: ${message}`));
  const previousCommanders = mergeCommanderDetail(
    decodeCommanders(await readJson(path.join(root, "data", "commanders.json"))),
    (await readJson(path.join(root, "data", "commander-detail.json")))?.detail
  );
  const reviewedInput = manualResult.failures > 0 && manualResult.findings.length === 0
    ? previousFindings.filter((finding) => !finding.tags.includes("needs-research"))
    : manualResult.findings;
  const manual = hydrateExistingMetadata(reviewedInput, previousFindings);
  let catalog = previousCommanders.filter((commander) => commander.popularity);
  let history = { schemaVersion: 1, snapshots: [] };
  let findings = manual.map(normalizeFinding);

  if (network) {
    const pipelineState = await readPipelineState(root);
    history = pipelineState.commanderHistory ?? history;
    const context = { root, fetch: fetchImpl, sleep, today, env };

    // 1. Catalogue. Every later lane joins onto this, so it runs first and
    //    facts from earlier runs are carried across before anything enriches.
    const catalogResult = await safeCatalog(edhrecConnector, catalog, context, diagnostics);
    catalog = carryCardFacts(catalogResult.commanders, previousCommanders);

    // 2. Enrichment lanes. Each is independent: a failure degrades its own
    //    lane and leaves the catalogue as the previous lane left it.
    const candidates = [];
    for (const connector of [
      { connector: scryfallBulkConnector },
      { connector: edhrecPagesConnector, extra: { pagesPerRun } },
      { connector: spellbookConnector },
      { connector: edhtop16Connector },
      { connector: cedhDdbConnector },
      { connector: archidektConnector, extra: { commandersPerRun } }
    ]) {
      const result = await safeCatalogEnrich(connector.connector, catalog, {
        ...context,
        ...connector.extra,
        state: pipelineState[connector.connector.id] ?? {}
      }, diagnostics);
      catalog = result.commanders;
      candidates.push(...(result.candidates ?? []));
      pipelineState[connector.connector.id] = result.state;
    }

    // 3. Discovery lanes produce candidates, not findings.
    for (const connector of [rssConnector, youtubeConnector]) {
      const result = await safeCandidates(connector, {
        ...context,
        commanders: catalog,
        state: pipelineState[connector.id] ?? {}
      }, diagnostics);
      candidates.push(...result.candidates);
      pipelineState[connector.id] = result.state;
    }

    // 4. Coverage is accumulated across runs, because connectors dedupe:
    //    a video is new exactly once, so a single run sees almost nothing.
    pipelineState.coverage = updateCoverage(pipelineState.coverage, candidates, today);
    catalog = applyCoverage(catalog, pipelineState.coverage);

    // 5. The cheap deterministic filter runs before any model call.
    const filtered = prefilter(candidates, catalog);
    diagnostics.push(...filtered.diagnostics.map((message) => `prefilter: ${message}`));
    const judged = await safeJudge(filtered.survivors, { ...context, env }, diagnostics);
    findings.push(...judged.map(normalizeFinding));

    if (catalogResult.changed) history = updateCommanderHistory(history, catalog, today);
    pipelineState.commanderHistory = history;
    await writePipelineState(root, pipelineState);
    findings.push(...deriveMomentumFindings(catalog, history, `${today}T00:00:00.000Z`).map(normalizeFinding));
    // The other momentum axis: coverage climbing while the deck count is flat.
    // Adoption fires once people are building; this fires while they are still
    // only talking. Both read the same snapshots, neither reports the other.
    findings.push(...deriveDiscussionMomentumFindings(catalog, pipelineState.coverage, history, `${today}T00:00:00.000Z`).map(normalizeFinding));
    findings = await safeEnrich(scryfallConnector, findings, { root, fetch: fetchImpl }, diagnostics);
    findings = findings.map(normalizeFinding);
  }

  findings = mergeDuplicateFindings(findings);
  const findingSchema = JSON.parse(await readFile(path.join(root, "schema", "finding.schema.json"), "utf8"));
  const validateFinding = createValidator(findingSchema);
  for (const finding of findings) assertValid(validateFinding, finding, `finding ${finding.id}`);

  const relationships = buildRelationships(findings);
  const datasets = buildDatasets(findings, relationships, catalog, today);
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

/**
 * Puts the detail dataset back onto the catalogue records.
 *
 * `buildDatasets` splits the high-synergy pool and similar-commander list out
 * of `commanders.json` so the page-load path stays small. Without this, the
 * next run reads the stripped catalogue, finds no detail, and publishes an
 * empty detail file — losing data that took a full band crawl to collect.
 */
function mergeCommanderDetail(commanders, detail) {
  if (!detail) return commanders;
  return commanders.map((commander) => {
    const extra = detail[commander.slug];
    return extra ? { ...commander, ...extra } : commander;
  });
}

/**
 * A fresh EDHREC catalogue walk returns rank and deck count only. Facts from
 * earlier runs are still valid: a commander's colour identity does not change,
 * and its bracket distribution was true as of the rotation that fetched it. So
 * they are carried across before enrichment runs.
 *
 * This is what makes the rotation work at all. Only ~300 of ~2,500 in-band
 * commanders are crawled per run; the other 2,200 keep the data an earlier run
 * fetched rather than losing it every night. It is also what lets the Scryfall
 * connector skip its download when the bulk file has not moved.
 */
function carryCardFacts(fresh, previous) {
  const bySlug = new Map(previous.map((commander) => [commander.slug, commander]));
  return fresh.map((commander) => {
    const prior = bySlug.get(commander.slug);
    if (!prior) return commander;
    const facts = Object.fromEntries(CARRIED_FIELDS
      .filter((field) => prior[field] !== undefined)
      .map((field) => [field, prior[field]]));
    return { ...commander, ...facts };
  });
}

async function safeCatalogEnrich(connector, commanders, context, diagnostics) {
  try {
    const result = await connector.enrichCatalog(commanders, context);
    diagnostics.push(...result.diagnostics.map((message) => `${connector.id}: ${message}`));
    return result;
  } catch (error) {
    diagnostics.push(`${connector.id}: FAILED — ${error.message}; retained the previous card facts.`);
    return { commanders, state: context.state ?? {} };
  }
}

/** A discovery lane's failure costs its own candidates and nothing else. */
async function safeCandidates(connector, context, diagnostics) {
  try {
    const result = await connector.collectCandidates(context);
    diagnostics.push(...result.diagnostics.map((message) => `${connector.id}: ${message}`));
    return { candidates: result.candidates, state: result.state };
  } catch (error) {
    diagnostics.push(`${connector.id}: FAILED — ${error.message}; other discovery lanes unaffected.`);
    return { candidates: [], state: context.state ?? {} };
  }
}

/**
 * Judgement is non-deterministic and optional. A failure here must not cost
 * the catalogue refresh, which is deterministic and valuable on its own.
 */
async function safeJudge(candidates, context, diagnostics) {
  if (!candidates.length) return [];
  try {
    const result = await judge.judgeCandidates(candidates, context);
    diagnostics.push(...result.diagnostics.map((message) => `judge: ${message}`));
    return result.findings;
  } catch (error) {
    diagnostics.push(`judge: FAILED — ${error.message}; no findings were published this run.`);
    return [];
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
  const rendered = Object.fromEntries(Object.entries(datasets).map(([name, value]) => [name, `${serialize(value)}\n`]));
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

/**
 * Record-shaped datasets are indented so a generated diff can be reviewed, as
 * `AGENTS.md` requires. A columnar dataset gets no indentation: pretty-printed
 * it is thousands of lines holding one number each, which is worse to read and
 * three times the size.
 */
function serialize(value) {
  return isColumnar(value) ? JSON.stringify(value) : JSON.stringify(value, null, 2);
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
