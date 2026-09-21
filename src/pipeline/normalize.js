import { fingerprintFinding } from "../shared/fingerprint.js";
import { scoreFinding, scoreRelationship } from "../shared/scoring.js";
import { slugify } from "../shared/slug.js";

export function normalizeFinding(input) {
  const normalized = {
    ...input,
    id: input.id || `${slugify(input.title)}-${input.publishedAt}`,
    commanders: normalizeEntities(input.commanders),
    cards: normalizeEntities(input.cards),
    tags: [...new Set((input.tags ?? []).map(slugify))].sort()
  };
  normalized.fingerprint = fingerprintFinding(normalized);
  normalized.score = scoreFinding(normalized);
  return normalized;
}

function normalizeEntities(entities = []) {
  const bySlug = new Map();
  for (const entity of entities) {
    const slug = entity.slug || slugify(entity.name);
    bySlug.set(slug, { ...entity, slug });
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeDuplicateFindings(findings) {
  const byFingerprint = new Map();
  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint);
    if (!existing || finding.evidence.strength > existing.evidence.strength) {
      byFingerprint.set(finding.fingerprint, finding);
    }
  }
  return [...byFingerprint.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.score.total - a.score.total);
}

export function buildRelationships(findings) {
  const edges = new Map();
  for (const finding of findings) {
    for (const commander of finding.commanders) {
      for (const card of finding.cards) {
        const id = `${card.slug}--${commander.slug}`;
        const existing = edges.get(id) ?? {
          id,
          card,
          commander,
          findingIds: [],
          sourceUrls: [],
          evidenceStrength: 0,
          independentSourceCount: 0,
          metrics: {}
        };
        existing.findingIds.push(finding.id);
        existing.sourceUrls.push(finding.source.url, ...(finding.evidence.corroboratingSources ?? []).map((source) => source.url));
        existing.evidenceStrength = Math.max(existing.evidenceStrength, finding.evidence.strength);
        existing.independentSourceCount = Math.max(existing.independentSourceCount, finding.evidence.independentSourceCount);
        existing.relationshipScore = scoreRelationship(existing);
        edges.set(id, existing);
      }
    }
  }
  return [...edges.values()].map((edge) => ({
    ...edge,
    findingIds: [...new Set(edge.findingIds)],
    sourceUrls: [...new Set(edge.sourceUrls)]
  })).sort((a, b) => b.relationshipScore - a.relationshipScore);
}
