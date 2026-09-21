export function buildDatasets(findings, relationships) {
  const commanders = aggregateEntities(findings, "commanders");
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

  return {
    "findings.json": { schemaVersion: 1, findings },
    "commanders.json": { schemaVersion: 1, commanders },
    "hidden-cards.json": { schemaVersion: 1, cards: hiddenCards },
    "community-resources.json": { schemaVersion: 1, resources: communityResources },
    "relationships/card-commander.json": { schemaVersion: 1, relationships },
    "trending/7d.json": trending(findings, 7),
    "trending/30d.json": trending(findings, 30),
    "trending/90d.json": trending(findings, 90)
  };
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
