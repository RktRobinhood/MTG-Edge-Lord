import { COVERAGE_TREND_DAYS, coverageTrend } from "./coverage.js";
import { MAX_SCORED_RANK } from "../shared/edge-score.js";

export function updateCommanderHistory(previous, catalog, date) {
  const snapshots = [...(previous?.snapshots ?? [])].filter((snapshot) => snapshot.date !== date && snapshot.date >= dateBefore(date, 90));
  snapshots.push({
    date,
    commanders: Object.fromEntries(catalog.map((commander) => [commander.slug, {
      rank: commander.popularity.edhrecRank,
      decks: commander.popularity.deckCount
    }]))
  });
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  return { schemaVersion: 1, snapshots };
}

export function deriveMomentumFindings(catalog, history, observedAt) {
  if (history.snapshots.length < 2) return [];
  const latest = history.snapshots.at(-1);
  const previous = history.snapshots.at(-2);
  return catalog.map((commander) => {
    const current = latest.commanders[commander.slug];
    const prior = previous.commanders[commander.slug];
    if (!current || !prior || commander.popularity.edhrecRank < 250) return null;
    const rankGain = prior.rank - current.rank;
    const deckGain = current.decks - prior.decks;
    const deckGrowthPct = prior.decks ? deckGain / prior.decks * 100 : 0;
    if (rankGain < 20 && (deckGain < 25 || deckGrowthPct < 1)) return null;
    const signal = Math.min(100, Math.max(rankGain, 0) * 0.7 + Math.max(deckGrowthPct, 0) * 5);
    return {
      signal,
      finding: {
        id: `${commander.slug}-edhrec-momentum-${latest.date}`,
        findingType: "discovery_signal",
        title: `${commander.name} is moving above its recent baseline`,
        summary: `${commander.name} moved ${rankGain > 0 ? `${rankGain} rank places` : "in deck count"} while adding ${Math.max(deckGain, 0)} indexed decks since the previous snapshot. This is an aggregate momentum signal for investigation, not proof of a community consensus or competitive result.`,
        source: {
          name: "EDHREC commander index",
          type: "other",
          url: `https://edhrec.com/commanders/${commander.slug}`,
          creator: "EDHREC",
          resourceDepth: "mention"
        },
        publishedAt: latest.date,
        observedAt,
        commanders: [{ name: commander.name, slug: commander.slug, ...(commander.scryfallId ? { scryfallId: commander.scryfallId } : {}) }],
        cards: [],
        evidence: {
          strength: Math.min(0.7, 0.25 + signal / 250),
          independentSourceCount: 1,
          conversationDepth: "mention",
          communityReasoned: false,
          tested: false,
          notes: ["Automatically derived from consecutive EDHREC commander index snapshots; editorial follow-up is still needed."]
        },
        tags: ["momentum", "needs-research"],
        popularity: commander.popularity,
        movement: movementFor(commander.slug, history)
      }
    };
  }).filter(Boolean).sort((a, b) => b.signal - a.signal).slice(0, 10).map((item) => item.finding);
}

/**
 * Discussion momentum: coverage climbing while the deck count stays flat.
 *
 * This is a different axis from `deriveMomentumFindings`, which measures rank
 * and deck movement between snapshots. That is adoption — it fires once people
 * are already building the commander. This fires before: people are talking
 * and nobody has committed yet. `docs/PRD.md` states the two as axes that must
 * not be collapsed, so coverage and decks rising together is deliberately not
 * reported here. The existing lane already has it, and reporting it twice
 * would make one commander look like two signals.
 *
 * A finding, never a scoring component. `docs/SCORING.md` keeps momentum at
 * 10% of the finding score and out of the Edge score, and this does not
 * quietly change that.
 */
export function deriveDiscussionMomentumFindings(catalog, coverage, history, observedAt) {
  const today = observedAt.slice(0, 10);
  // Without a baseline snapshot there is no way to tell coverage rising
  // against flat decks from coverage rising with them, and the whole claim is
  // the divergence. No baseline, no finding.
  if (!history?.snapshots?.length || history.snapshots.length < 2) return [];
  const latest = history.snapshots.at(-1);

  return catalog.map((commander) => {
    const rank = commander.popularity?.edhrecRank;
    if (!rank || rank < 250 || rank > MAX_SCORED_RANK) return null;

    const trend = coverageTrend(coverage?.[commander.slug], today);
    // Every gate here is a count, so the mostly-empty window this ships into
    // produces nothing rather than producing noise.
    if (!trend) return null;
    if (trend.independentSources < 2) return null;   // one prolific creator is not a community
    if (trend.activeDays < 2) return null;           // a single day is a spike, not a trend
    if (trend.recent < 3 || trend.ratio < 1.75) return null;

    const decks = deckGrowth(commander.slug, history, COVERAGE_TREND_DAYS);
    if (decks === null) return null;
    if (decks > 1) return null;                      // rising together is adoption; the other lane has it

    const signal = Math.min(100, trend.ratio * 12 + trend.independentSources * 8);
    return {
      signal,
      finding: {
        id: `${commander.slug}-discussion-momentum-${today}`,
        findingType: "discovery_signal",
        title: `${commander.name} is being discussed faster than it is being built`,
        summary: `${commander.name} was named by ${trend.independentSources} independent sources across ${trend.activeDays} days in the last ${COVERAGE_TREND_DAYS}, against ${trend.prior} coverage record${trend.prior === 1 ? "" : "s"} in the ${COVERAGE_TREND_DAYS} before, while its indexed deck count moved ${decks.toFixed(1)}%. Interest running ahead of adoption is an early signal for investigation, not proof of a community consensus or a competitive result.`,
        source: {
          name: "Community coverage trend",
          type: "other",
          url: `https://edhrec.com/commanders/${commander.slug}`,
          creator: "MTG Edge Lord",
          resourceDepth: "mention"
        },
        publishedAt: latest.date,
        observedAt,
        commanders: [{ name: commander.name, slug: commander.slug, ...(commander.scryfallId ? { scryfallId: commander.scryfallId } : {}) }],
        cards: [],
        evidence: {
          // Capped below the adoption lane's ceiling. Interest is the weaker
          // claim of the two: it is what people are saying, not what they built.
          strength: Math.min(0.5, 0.2 + signal / 400),
          independentSourceCount: trend.independentSources,
          conversationDepth: "mention",
          communityReasoned: false,
          tested: false,
          notes: [`Derived from ${trend.recent} coverage records across ${trend.independentSources} independent sources in the ${COVERAGE_TREND_DAYS} days to ${today}. Each source is linked from its own finding; this one aggregates dates and attribution only.`]
        },
        tags: ["discussion-momentum", "momentum", "needs-research"],
        popularity: commander.popularity,
        movement: movementFor(commander.slug, history)
      }
    };
  }).filter(Boolean).sort((a, b) => b.signal - a.signal).slice(0, 10).map((item) => item.finding);
}

/** Deck-count growth over `days`, as a percentage. `null` where no baseline exists. */
export function deckGrowth(slug, history, days) {
  const latest = history.snapshots.at(-1);
  const current = latest?.commanders[slug];
  if (!current) return null;
  const baseline = [...history.snapshots].reverse().find((snapshot) => snapshot.date <= dateBefore(latest.date, days) && snapshot.commanders[slug]);
  const prior = baseline?.commanders[slug];
  if (!prior || !prior.decks) return null;
  return (current.decks - prior.decks) / prior.decks * 100;
}

export function movementFor(slug, history) {
  const latest = history.snapshots.at(-1);
  if (!latest?.commanders[slug]) return {};
  return Object.fromEntries([7, 30, 90].map((days) => {
    const baseline = [...history.snapshots].reverse().find((snapshot) => snapshot.date <= dateBefore(latest.date, days)) ?? history.snapshots[0];
    const current = latest.commanders[slug];
    const prior = baseline?.commanders[slug];
    if (!prior) return [`${days}d`, 0];
    const deckGrowth = prior.decks ? (current.decks - prior.decks) / prior.decks * 100 : 0;
    const rankGain = prior.rank - current.rank;
    return [`${days}d`, Math.round(Math.max(0, Math.min(100, deckGrowth * 4 + rankGain * 0.5)) * 10) / 10];
  }));
}

function dateBefore(date, days) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - days * 86400000).toISOString().slice(0, 10);
}
