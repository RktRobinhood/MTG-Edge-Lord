export const SCORE_MODEL_VERSION = "diamond-v1";

export const DEFAULT_WEIGHTS = Object.freeze({
  obscurity: 0.3,
  community: 0.2,
  expert: 0.2,
  mechanical: 0.15,
  momentum: 0.1,
  validation: 0.05
});

const DEPTH_SCORE = { mention: 15, reasoned: 45, tested: 65, maintained: 82, validated: 100 };
const RESOURCE_SCORE = { mention: 10, discussion: 35, decklist: 58, primer: 78, deep_dive: 92, community_hub: 84 };

const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const round = (value) => Math.round(value * 10) / 10;

export function scoreFinding(finding, weights = DEFAULT_WEIGHTS) {
  const rank = finding.popularity?.edhrecRank ?? 1;
  const decks = finding.popularity?.deckCount ?? 50000;
  const rankSignal = clamp(Math.log10(Math.max(rank, 1)) / Math.log10(2500) * 100);
  const deckSignal = clamp(100 - Math.log10(Math.max(decks, 1)) / Math.log10(100000) * 100);
  const obscurity = round(rankSignal * 0.55 + deckSignal * 0.45);

  const sources = Math.min(finding.evidence.independentSourceCount, 5);
  const depth = DEPTH_SCORE[finding.evidence.conversationDepth] ?? 0;
  const community = round(clamp(finding.evidence.strength * 45 + sources * 7 + depth * 0.2));
  const expert = round(RESOURCE_SCORE[finding.source.resourceDepth] ?? 0);
  const mechanical = round(clamp(
    (finding.evidence.communityReasoned ? 40 : 0) +
    (finding.evidence.tested ? 35 : 0) +
    Math.min((finding.cards?.length ?? 0) * 8, 25)
  ));
  const movement = finding.movement ?? {};
  const momentum = round(clamp(Math.max(movement["7d"] ?? 0, movement["30d"] ?? 0, movement["90d"] ?? 0)));
  const validation = round(clamp(
    (finding.findingType === "validation_signal" ? 60 : 0) +
    (finding.evidence.conversationDepth === "validated" ? 40 : 0)
  ));

  const components = { obscurity, community, expert, mechanical, momentum, validation };
  const total = round(Object.entries(weights).reduce((sum, [key, weight]) => sum + components[key] * weight, 0));
  const reasons = explainScore(components, finding);
  return { total, components, reasons, modelVersion: SCORE_MODEL_VERSION };
}

function explainScore(components, finding) {
  const reasons = [];
  if (components.obscurity >= 60) reasons.push("Low current popularity leaves room for genuine discovery.");
  if (finding.evidence.independentSourceCount > 1) reasons.push(`${finding.evidence.independentSourceCount} independent sources reinforce the signal.`);
  if (finding.evidence.tested) reasons.push("The relationship has tested or maintained deck evidence.");
  if (components.expert >= 70) reasons.push(`A ${finding.source.resourceDepth.replace("_", " ")} gives the idea unusual depth.`);
  if (components.momentum >= 35) reasons.push("Recent movement suggests the idea is gaining attention.");
  if (components.validation >= 60) reasons.push("Competitive or outcome evidence validates the idea beyond theory.");
  if (!reasons.length) reasons.push("Early signal retained for review; supporting evidence is still limited.");
  return reasons.slice(0, 5);
}

export function scoreRelationship(edge) {
  const inclusion = clamp(edge.metrics?.commanderInclusionPct ?? 0);
  const synergy = clamp(edge.metrics?.edhrecSynergyPct ?? 0);
  const inverseGlobal = clamp(100 - (edge.metrics?.globalPopularityPct ?? 0));
  const evidence = clamp((edge.evidenceStrength ?? 0) * 100);
  return round(inclusion * 0.25 + synergy * 0.3 + inverseGlobal * 0.2 + evidence * 0.25);
}
