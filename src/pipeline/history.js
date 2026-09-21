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
