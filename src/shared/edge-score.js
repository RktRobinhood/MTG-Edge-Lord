/**
 * Commander-level Edge scoring.
 *
 * The product's central claim is that an off-meta commander *demonstrably
 * works*. That needs two independent judgements — how obscure it is, and how
 * well it functions — and the score multiplies them rather than averaging,
 * because a popular-but-good commander and an obscure-but-bad one must both
 * land near zero. An additive model would put them mid-table, which is exactly
 * the wrong answer.
 *
 * See `docs/SCORING.md`.
 */

export const EDGE_MODEL_VERSION = "edge-v1";

/** Weights for the works score, exported so they can be recalibrated. */
export const WORKS_WEIGHTS = Object.freeze({
  bracketFit: 0.4,
  archetypeDepth: 0.4,
  retention: 0.2
});

/**
 * Bracket weights. Brackets 1 (Exhibition) and 2 (Core) contribute nothing to
 * the numerator but stay in the denominator, so a commander dominated by
 * precon-level builds scores low without Bracket 1 needing a special case.
 * Bracket 5 is 0.6 so cEDH presence helps without letting a pure-cEDH
 * commander top the chart: cEDH is a different meta, not an off-meta build.
 */
export const BRACKET_WEIGHTS = Object.freeze([0, 0, 1, 1, 0.6]);

/**
 * Minimum bracket-tagged decks before bracket data may influence the score.
 *
 * Roughly 12% of decks carry a bracket tag. Below this count the distribution
 * is displayed but contributes zero, and the commander is labelled
 * *insufficient data* — absence of evidence is not evidence of jank.
 */
export const BRACKET_CONFIDENCE_FLOOR = 30;

/** Rank bounds for the obscurity curve, matching the tier boundaries. */
const OBSCURITY = Object.freeze({ zeroAt: 500, peakFrom: 1000, peakTo: 3000 });

/** Past this rank there is no evidence to say a commander works, so nothing is scored. */
export const MAX_SCORED_RANK = 3000;

const TIERS = Object.freeze([
  { tier: "meta", maxRank: 500 },
  { tier: "rare", maxRank: 1000 },
  { tier: "edge", maxRank: 3000 },
  { tier: "uncharted", maxRank: Infinity }
]);

const round = (value) => Math.round(value * 10) / 10;
const round3 = (value) => Math.round(value * 1000) / 1000;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function tierForRank(rank) {
  if (!Number.isFinite(rank) || rank <= 0) return "uncharted";
  return TIERS.find((entry) => rank <= entry.maxRank).tier;
}

/**
 * Obscurity from EDHREC rank, on a curve rather than a cutoff.
 *
 * Zero inside the top 500, rising through the Rare tier, flat at 1 across the
 * Edge tier, then zero past rank 3,000 where nothing is scored at all.
 */
export function obscurityForRank(rank) {
  if (!Number.isFinite(rank) || rank <= OBSCURITY.zeroAt) return 0;
  if (rank > OBSCURITY.peakTo) return 0;
  if (rank >= OBSCURITY.peakFrom) return 1;
  return round3((rank - OBSCURITY.zeroAt) / (OBSCURITY.peakFrom - OBSCURITY.zeroAt));
}

/**
 * The share of a commander's decks built at a competitive power level.
 * Returns `null` below the confidence floor, which is how an unscored
 * commander stays unscored rather than becoming a zero.
 */
export function bracketFit(bracketCounts) {
  if (!Array.isArray(bracketCounts) || bracketCounts.length !== 5) return null;
  const counts = bracketCounts.map((count) => Math.max(0, Number(count) || 0));
  const tagged = counts.reduce((sum, count) => sum + count, 0);
  if (tagged < BRACKET_CONFIDENCE_FLOOR) return null;
  const weighted = counts.reduce((sum, count, index) => sum + count * BRACKET_WEIGHTS[index], 0);
  return round3(weighted / tagged);
}

/** Weeks compared against the peak when judging retention. */
const RECENT_WEEKS = 2;

/**
 * A final window this far above the fortnight **immediately before it** is a
 * step change rather than a trend.
 *
 * Compared against the preceding window, not the whole earlier history: a
 * commander climbing steadily for two months ends at its peak too, and
 * against a long-run mean that looks identical to a spike. At 1.5x versus the
 * long-run mean, 492 commanders on gentle upward trends were being discarded
 * as unjudgeable.
 */
const SPIKE_RATIO = 2;

/**
 * Whether saves are holding up against this commander's own peak, in 0..1.
 *
 * This catches the set-release trap: jank gets tried once, edge gets rebuilt.
 * So the question is not "is it growing" — `momentum` already answers that,
 * and rewarding growth here would count it twice — but "is the interest it
 * attracted still there".
 *
 * Measured as the recent fortnight against the highest week on record. A
 * commander holding at its peak scores 1; one that shed two thirds of a spike
 * scores about 0.3.
 *
 * Returns `null` when there is nothing to judge yet: too little history, or a
 * peak in the final window that is well above the earlier baseline. That
 * second case is a commander people have only just picked up, where no
 * retention evidence exists in either direction. Scoring it full marks — as
 * an earlier two-half comparison did — handed maximum retention to precisely
 * the untested spike this component exists to catch.
 */
export function retention(retentionTrend) {
  if (!Array.isArray(retentionTrend) || retentionTrend.length < 4) return null;
  const weeks = retentionTrend.map((count) => Math.max(0, Number(count) || 0));
  const peak = Math.max(...weeks);
  if (peak <= 0) return null;

  const recentWeeks = weeks.slice(-RECENT_WEEKS);
  const precedingWeeks = weeks.slice(-RECENT_WEEKS * 2, -RECENT_WEEKS);
  const recent = mean(recentWeeks);
  const preceding = mean(precedingWeeks);

  const stepChange = Math.max(...recentWeeks) === peak && recent > preceding * SPIKE_RATIO;
  if (stepChange) return null;

  return round3(clamp01(recent / peak));
}

/**
 * The full commander score.
 *
 * Returns `{ unscored: true, reason }` rather than a zero whenever the
 * evidence is not there. Callers must render that as *insufficient data*.
 */
export function scoreCommander(commander, weights = WORKS_WEIGHTS) {
  const rank = commander.popularity?.edhrecRank;
  const tier = tierForRank(rank);

  if (!Number.isFinite(rank) || rank <= 0) {
    return { unscored: true, reason: "No EDHREC rank yet, so obscurity cannot be judged.", tier };
  }
  if (rank > MAX_SCORED_RANK) {
    return { unscored: true, reason: `Past EDHREC rank ${MAX_SCORED_RANK}, where the evidence to say this works does not exist.`, tier };
  }

  const components = {
    bracketFit: bracketFit(commander.bracketCounts),
    archetypeDepth: commander.archetypeDepth === undefined ? null : clamp01(commander.archetypeDepth),
    retention: retention(commander.retentionTrend)
  };

  // Bracket fit is the gating component, not merely one of three. It is the
  // only direct evidence that a commander is *built to win*, so without it
  // the commander is labelled insufficient data rather than scored on the
  // other two — which is what `docs/SCORING.md` asks for, and what stops
  // commanders we know least about from topping the default sort.
  //
  // In practice this costs little: 2,457 of the 2,501 commanders in the
  // scored band clear the floor.
  if (components.bracketFit === null) {
    return {
      unscored: true,
      reason: explainUnscored(commander),
      tier,
      ...(commander.bracketCounts ? { bracketCounts: commander.bracketCounts } : {})
    };
  }

  const available = Object.entries(components).filter(([, value]) => value !== null);

  // Missing components are dropped and the remaining weights renormalised,
  // rather than counted as zero. A commander with no save history yet is not
  // thereby a commander nobody rebuilds.
  const totalWeight = available.reduce((sum, [name]) => sum + weights[name], 0);
  const worksScore = round3(available.reduce((sum, [name, value]) => sum + value * weights[name], 0) / totalWeight);
  const obscurity = obscurityForRank(rank);

  return {
    tier,
    obscurity,
    worksScore,
    edgeScore: round(obscurity * worksScore * 100),
    quality: Object.fromEntries(available),
    partial: available.length < Object.keys(components).length,
    reasons: explainScore(commander, { obscurity, worksScore, tier, components }),
    modelVersion: EDGE_MODEL_VERSION
  };
}

/**
 * Human-readable reasons for a score.
 *
 * Deliberately **not stored** in `commanders.json`. The reasons quote a
 * commander's own rank and deck counts, so they are close to unique per
 * record: serialising them cost about 700KB, most of a second megabyte, on
 * the file that loads with every EDHREC page view.
 *
 * They are a pure function of the components, which *are* retained, so the
 * userscript derives them at render time from this same module. The guarantee
 * in `AGENTS.md` holds — a reader sees why a commander scored what it did —
 * without paying to transmit a sentence that can be reconstructed exactly.
 */
export function explainScore(commander, { obscurity, worksScore, tier, components } = {}) {
  obscurity ??= commander.obscurity ?? obscurityForRank(commander.popularity?.edhrecRank);
  worksScore ??= commander.worksScore ?? 0;
  tier ??= commander.tier ?? tierForRank(commander.popularity?.edhrecRank);
  components ??= {
    bracketFit: commander.quality?.bracketFit ?? null,
    archetypeDepth: commander.quality?.archetypeDepth ?? null,
    retention: commander.quality?.retention ?? null
  };
  return buildReasons(commander, { obscurity, worksScore, tier, components });
}

/**
 * Why a commander has no score. Same reasoning as `explainScore`: derived at
 * render time rather than stored, from the `unscored` flag the dataset keeps.
 */
export function explainUnscored(commander) {
  const rank = commander.popularity?.edhrecRank;
  if (!Number.isFinite(rank) || rank <= 0) return "No EDHREC rank yet, so obscurity cannot be judged.";
  if (rank > MAX_SCORED_RANK) return `Past EDHREC rank ${MAX_SCORED_RANK.toLocaleString()}, where the evidence to say this works does not exist.`;
  const tagged = bracketTaggedDecks(commander);
  if (tagged > 0) return `Only ${tagged} bracket-tagged deck${tagged === 1 ? "" : "s"}, below the floor of ${BRACKET_CONFIDENCE_FLOOR}.`;
  return "No EDHREC page data has been collected for this commander yet.";
}

function buildReasons(commander, { obscurity, worksScore, tier, components }) {
  const reasons = [];
  if (obscurity >= 1) reasons.push(`Sits at EDHREC rank ${commander.popularity.edhrecRank}, squarely in the Edge tier.`);
  else if (obscurity > 0) reasons.push(`Rank ${commander.popularity.edhrecRank} is on the edge of the Rare tier, so obscurity counts for less.`);

  if (components.bracketFit !== null) {
    const share = Math.round(components.bracketFit * 100);
    const tagged = bracketTaggedDecks(commander);
    reasons.push(`${share}% of its ${tagged.toLocaleString()} bracket-tagged decks are built at Bracket 3 or above.`);
  } else if (commander.bracketCounts) {
    reasons.push(`Bracket data shown but not scored: only ${bracketTaggedDecks(commander)} tagged decks, below the floor of ${BRACKET_CONFIDENCE_FLOOR}.`);
  }

  if (components.archetypeDepth !== null) {
    reasons.push(components.archetypeDepth >= 0.35
      ? "A deep pool of high-synergy cards means there is an archetype here, not just goodstuff."
      : "A shallow high-synergy pool suggests the deck leans on colour-identity staples.");
  }

  if (components.retention !== null) {
    reasons.push(components.retention >= 0.5
      ? "Deck saves are holding or climbing rather than fading after release."
      : "Deck saves are falling away from their earlier level.");
  }

  if (worksScore < 0.3) reasons.push("The evidence that this works is weak, so the Edge score stays low however obscure it is.");
  if (tier === "rare" && worksScore >= 0.5) reasons.push("Known enough to have a track record, obscure enough to be worth a second look.");
  return reasons.slice(0, 5);
}

export function bracketTaggedDecks(commander) {
  if (!Array.isArray(commander.bracketCounts)) return 0;
  return commander.bracketCounts.reduce((sum, count) => sum + (Number(count) || 0), 0);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
