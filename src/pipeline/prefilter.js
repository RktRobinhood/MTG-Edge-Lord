import { SCORED_BAND } from "../connectors/edhrec-pages.js";

/**
 * The free, deterministic half of finding selection.
 *
 * Connectors produce thousands of candidates a day. Sending all of them to a
 * model would cost real money to reject items a rank check rejects for
 * nothing, so this runs first and no model call is made on anything it drops.
 *
 * It answers only questions that have a definite answer. Whether a candidate
 * is genuine brewing effort or a passing mention is semantic, and that
 * judgement belongs to `judge.js`.
 */

/**
 * Top-500 commanders are dropped outright. An article about a meta commander
 * is not a discovery however well written it is.
 */
export const MIN_RANK = SCORED_BAND.minRank;

/** Past this rank the evidence to say "this works" does not exist. */
export const MAX_RANK = SCORED_BAND.maxRank;

/** Candidates surviving per run, most obscure first. A ceiling on model spend. */
export const MAX_SURVIVORS = 60;

/**
 * @param {object[]} candidates connector output
 * @param {object[]} commanders the catalogue, for rank lookup
 */
export function prefilter(candidates, commanders, options = {}) {
  const byName = new Map(commanders.map((commander) => [commander.slug, commander]));
  const limit = options.limit ?? MAX_SURVIVORS;
  const rejected = { noCommanderMatch: 0, tooPopular: 0, tooObscure: 0, duplicate: 0 };
  const seen = new Set();
  const survivors = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) {
      rejected.duplicate += 1;
      continue;
    }
    seen.add(candidate.id);

    const matched = (candidate.commanders ?? [])
      .map((entity) => byName.get(entity.slug))
      .filter(Boolean);

    if (!matched.length) {
      rejected.noCommanderMatch += 1;
      continue;
    }

    const ranks = matched.map((commander) => commander.popularity?.edhrecRank).filter(Number.isFinite);
    if (!ranks.length) {
      rejected.noCommanderMatch += 1;
      continue;
    }

    // The best case across the candidate's commanders decides. An article
    // covering a meta commander *and* an obscure one is about the obscure one
    // as far as this product is concerned.
    const inBand = ranks.filter((rank) => rank >= MIN_RANK && rank <= MAX_RANK);
    if (!inBand.length) {
      if (Math.min(...ranks) < MIN_RANK) rejected.tooPopular += 1;
      else rejected.tooObscure += 1;
      continue;
    }

    survivors.push({ ...candidate, commanders: matched.map(toEntity), bestRank: Math.max(...inBand) });
  }

  survivors.sort((a, b) => b.bestRank - a.bestRank);
  return {
    survivors: survivors.slice(0, limit),
    rejected,
    diagnostics: [
      `Pre-filter kept ${Math.min(survivors.length, limit)} of ${candidates.length} candidate(s).`,
      `Dropped: ${rejected.noCommanderMatch} with no catalogued commander, ${rejected.tooPopular} inside the top ${MIN_RANK}, ${rejected.tooObscure} past rank ${MAX_RANK}, ${rejected.duplicate} duplicate.`
    ]
  };
}

function toEntity(commander) {
  return { name: commander.name, slug: commander.slug, ...(commander.scryfallId ? { scryfallId: commander.scryfallId } : {}) };
}
