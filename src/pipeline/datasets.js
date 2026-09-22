import { DETAIL_FACT_FIELDS } from "../connectors/edhrec-pages.js";
import { encodeCommanders } from "../shared/catalog.js";
import { scoreCommander } from "../shared/edge-score.js";

export function buildDatasets(findings, relationships, catalog = [], commanderHistory = { schemaVersion: 1, snapshots: [] }) {
  const commanders = mergeCommanderCatalog(catalog, aggregateEntities(findings, "commanders")).map(withEdgeScore);
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
    "commanders.json": encodeCommanders(search),
    "commander-detail.json": { schemaVersion: 1, detail },
    "hidden-cards.json": { schemaVersion: 1, cards: hiddenCards },
    "community-resources.json": { schemaVersion: 1, resources: communityResources },
    "relationships/card-commander.json": { schemaVersion: 1, relationships },
    "commander-history.json": commanderHistory,
    "trending/7d.json": trending(findings, 7),
    "trending/30d.json": trending(findings, 30),
    "trending/90d.json": trending(findings, 90)
  };
}

/**
 * Attaches the Edge score, or records why the commander has none.
 *
 * An unscored commander carries `unscored` and a readable `unscoredReason`
 * rather than a zero, so the UI can say *insufficient data*. Nothing here ever
 * writes `edgeScore: 0` to mean "we don't know".
 */
function withEdgeScore(commander) {
  const score = scoreCommander(commander);
  if (score.unscored) {
    return { ...commander, tier: score.tier, unscored: true, unscoredReason: score.reason };
  }
  return {
    ...commander,
    tier: score.tier,
    obscurity: score.obscurity,
    worksScore: score.worksScore,
    edgeScore: score.edgeScore,
    quality: score.quality,
    edgeReasons: score.reasons,
    scoreModelVersion: score.modelVersion,
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

function trending(findings, days) {
  const newest = findings.reduce((latest, finding) => finding.observedAt > latest ? finding.observedAt : latest, "1970-01-01T00:00:00.000Z");
  const cutoff = new Date(new Date(newest).getTime() - days * 86400000).toISOString();
  return { schemaVersion: 1, windowDays: days, asOf: newest, findings: findings.filter((finding) => finding.observedAt >= cutoff) };
}
