import { DETAIL_FACT_FIELDS } from "../connectors/edhrec-pages.js";
import { encodeCommanders } from "../shared/catalog.js";
import { EDGE_MODEL_VERSION, scoreCommander } from "../shared/edge-score.js";
import { COHORT_MODEL_VERSION, applyCohortScores } from "../shared/cohort-score.js";
import { updateArchive } from "./archive.js";

/**
 * Builds the **published** backend: every file here is fetched by the
 * userscript, eagerly or on demand. Nothing is written speculatively.
 *
 * Two datasets were removed in #10. `trending/{7d,30d,90d}.json` were pure
 * date-filtered projections of `findings.json` that nothing fetched; the
 * client can filter by date itself. `commander-history.json` is real, but it
 * is read by the momentum pipeline rather than by any client, so it lives in
 * `state/` with the other pipeline bookkeeping.
 */
export function buildDatasets(findings, relationships, catalog = [], today = new Date().toISOString().slice(0, 10), previousArchive = null) {
  const scored = mergeCommanderCatalog(catalog, aggregateEntities(findings, "commanders")).map(withEdgeScore);
  // Cohort scoring runs after Edge scoring and only touches commanders that
  // have not graduated, so a record never carries both.
  const commanders = applyCohortScores(scored, today).commanders;
  const cards = aggregateEntities(findings, "cards");
  const communityResources = findings
    .filter((finding) => finding.source.resourceDepth !== "mention")
    .map((finding) => ({
      findingId: finding.id,
      title: finding.title,
      summary: finding.summary,
      ...finding.source,
      commanders: finding.commanders,
      cards: finding.cards,
      publishedAt: finding.publishedAt
    }));
  const hiddenCards = cards
    .map((card) => ({
      ...card,
      commanders: relationships.filter((edge) => edge.card.slug === card.slug).map((edge) => ({
        ...edge.commander,
        relationshipScore: edge.relationshipScore,
        findingIds: edge.findingIds
      }))
    }))
    .filter((card) => card.commanders.length);

  const { search, detail } = splitCommanderDetail(commanders);

  return {
    "findings.json": { schemaVersion: 1, findings },
    "commanders.json": encodeCommanders(search, { edge: EDGE_MODEL_VERSION, cohort: COHORT_MODEL_VERSION }),
    "commander-detail.json": { schemaVersion: 1, detail },
    "hidden-cards.json": { schemaVersion: 1, cards: hiddenCards },
    "community-resources.json": { schemaVersion: 1, resources: communityResources },
    "relationships/card-commander.json": { schemaVersion: 1, relationships },
    // Append-only, and the only dataset that carries anything from before this
    // run. Everything else here is rebuilt from the current findings.
    "archive.json": updateArchive(previousArchive, findings, today, commanders)
  };
}

/**
 * Attaches the Edge score, or leaves the commander without one.
 *
 * **The absence of `edgeScore` is the signal.** There is no `unscored: true`
 * flag, because a flag can disagree with the number beside it; nothing here
 * ever writes `edgeScore: 0` to mean "we don't know".
 *
 * **Only the raw inputs and the headline number are stored.** `tier`,
 * `obscurity`, `worksScore` and every `quality` component are exact functions
 * of `bracketCounts`, `archetypeDepth`, `retentionTrend` and the rank, all of
 * which the record already carries. The client runs the same `scoreCommander`
 * over them at load and gets identical values, so transmitting them would be
 * paying ~110KB to avoid a few microseconds of arithmetic.
 *
 * Model versions live in the dataset header rather than on every record.
 *
 * Components and raw inputs are recoverable; the human-readable reasons are
 * They quote each commander's own rank and deck counts, so they are close to
 * unique per record and cost about 700KB on the file that loads with every
 * EDHREC page view. They are a pure function of the retained components, and
 * the userscript derives them at render time through `explainScore` in the
 * same module that produced the score.
 */
/**
 * Fields the client recomputes. Stripped on every build, because a run reads
 * the previous `commanders.json` as its starting catalogue: without this, a
 * field that used to be published would persist forever as whatever the last
 * build that emitted it happened to say.
 */
const DERIVED_FIELDS = Object.freeze([
  "tier", "obscurity", "worksScore", "quality", "unscored",
  "scoreModelVersion", "cohortModelVersion", "edgeReasons", "unscoredReason", "cohortReasons"
]);

function withEdgeScore(commander) {
  const record = { ...commander };
  for (const field of DERIVED_FIELDS) delete record[field];

  // A combo count with no canonical link is unattributable, so it is not
  // published — the same rule the finding feed applies. This drops counts
  // left behind by an earlier build that sourced them elsewhere; Commander
  // Spellbook repopulates both fields together on its next pass.
  if (record.comboUrl === undefined) delete record.comboCount;
  delete record.edgeScore;
  delete record.partialScore;

  const score = scoreCommander(commander);
  if (score.unscored) return record;
  return {
    ...record,
    edgeScore: score.edgeScore,
    ...(score.partial ? { partialScore: true } : {})
  };
}

/**
 * `commanders.json` is loaded on every EDHREC page view, so it carries only
 * what filtering and scoring need. The high-synergy pool and the similar-
 * commander list are per-commander detail: they are read when someone opens a
 * commander, which is rare enough that half a megabyte does not belong in the
 * page-load path.
 */
function splitCommanderDetail(commanders) {
  const detail = {};
  const search = commanders.map((commander) => {
    const kept = {};
    const stripped = { ...commander };
    for (const field of DETAIL_FACT_FIELDS) {
      if (stripped[field] === undefined) continue;
      kept[field] = stripped[field];
      delete stripped[field];
    }
    if (Object.keys(kept).length) detail[commander.slug] = kept;
    return stripped;
  });
  return { search, detail };
}

function mergeCommanderCatalog(catalog, researched) {
  const bySlug = new Map(catalog.map((commander) => [commander.slug, {
    ...commander,
    findingIds: [],
    diamondScore: 0,
    momentum: Math.max(0, Math.min(100, 50 + commander.trendZscore * 10))
  }]));
  for (const commander of researched) {
    const existing = bySlug.get(commander.slug) ?? {};
    bySlug.set(commander.slug, { ...existing, ...commander, popularity: commander.popularity ?? existing.popularity });
  }
  return [...bySlug.values()].sort((a, b) => b.diamondScore - a.diamondScore || (a.popularity?.edhrecRank ?? Infinity) - (b.popularity?.edhrecRank ?? Infinity));
}

function aggregateEntities(findings, field) {
  const entities = new Map();
  for (const finding of findings) {
    for (const entity of finding[field]) {
      const current = entities.get(entity.slug) ?? { ...entity, findingIds: [], diamondScore: 0, momentum: 0 };
      current.findingIds.push(finding.id);
      current.diamondScore = Math.max(current.diamondScore, finding.score.total);
      current.momentum = Math.max(current.momentum, ...Object.values(finding.movement ?? {}).map(Number));
      if (field === "commanders" && finding.popularity) current.popularity = finding.popularity;
      entities.set(entity.slug, current);
    }
  }
  return [...entities.values()].map((item) => ({ ...item, findingIds: [...new Set(item.findingIds)] }))
    .sort((a, b) => b.diamondScore - a.diamondScore || a.name.localeCompare(b.name));
}
