import { MAX_SCORED_RANK } from "./edge-score.js";

/**
 * Cohort scoring for newly released commanders.
 *
 * Global rank is meaningless for a card released three weeks ago: everything
 * new sits near rank 3,000, so the normal Edge score would either exclude
 * every new commander or score them all as unproven noise. But new-and-
 * overlooked is the biggest edge available — you are early on something with
 * no meta yet.
 *
 * So a new commander is scored **against its own set cohort** instead.
 *
 * See `docs/SCORING.md`.
 */

export const COHORT_MODEL_VERSION = "cohort-v1";

/** How long after release a commander is scored against its cohort. */
export const COHORT_WINDOW_DAYS = 120;

/** A cohort smaller than this says nothing about relative position. */
export const MIN_COHORT_SIZE = 5;

/**
 * Deck count at which a commander **graduates** to the normal Edge score.
 * Below it there is not enough of a track record for bracket data to mean
 * anything; above it, the Edge score is the better answer.
 */
export const GRADUATION_DECK_COUNT = 400;

const COMPONENT_WEIGHTS = Object.freeze({ cohortPosition: 0.6, interestToTraction: 0.4 });

const round = (value) => Math.round(value * 10) / 10;
const round3 = (value) => Math.round(value * 1000) / 1000;

export function isNewArrival(commander, today, windowDays = COHORT_WINDOW_DAYS) {
  const released = commander.releasedAt;
  if (!released || !today) return false;
  const age = (new Date(today) - new Date(released)) / 86400000;
  return age >= 0 && age <= windowDays;
}

/**
 * A commander graduates once it has enough decks for the normal score to say
 * something, or once it ages out of the cohort window.
 */
export function hasGraduated(commander, today) {
  if ((commander.popularity?.deckCount ?? 0) >= GRADUATION_DECK_COUNT) return true;
  return !isNewArrival(commander, today);
}

/**
 * Groups the catalogue into set cohorts, keeping only the sets that are new
 * enough and populous enough to compare within.
 */
export function buildCohorts(commanders, today, options = {}) {
  const windowDays = options.windowDays ?? COHORT_WINDOW_DAYS;
  const cohorts = new Map();
  for (const commander of commanders) {
    if (!commander.setCode || !isNewArrival(commander, today, windowDays)) continue;
    if (!cohorts.has(commander.setCode)) cohorts.set(commander.setCode, []);
    cohorts.get(commander.setCode).push(commander);
  }

  for (const [setCode, members] of cohorts) {
    if (members.length < (options.minSize ?? MIN_COHORT_SIZE)) cohorts.delete(setCode);
    else members.sort((a, b) => (b.popularity?.deckCount ?? 0) - (a.popularity?.deckCount ?? 0));
  }
  return cohorts;
}

/**
 * Scores one commander against its cohort.
 *
 * Two components:
 *
 * **Cohort position** — where it sits among the legends released in the same
 * set. "7th of 31 new legends, while the top three have 10x the decks" is
 * meaningful on day one.
 *
 * **Interest-to-traction** — discussion volume divided by deck count. High
 * chatter with few builds means people are intrigued but nobody has
 * committed; that is the sleeper. The high flyers score badly here precisely
 * because everyone is already building them, which is intended behaviour and
 * what keeps the feed off commodity set-review content.
 *
 * Returns `{ unscored: true, reason }` rather than a zero when there is
 * nothing to compare against.
 */
export function scoreCohort(commander, cohort, options = {}) {
  if (!cohort || cohort.length < (options.minSize ?? MIN_COHORT_SIZE)) {
    return { unscored: true, reason: "Too few legends released in the same set to compare against." };
  }

  const position = cohort.findIndex((member) => member.slug === commander.slug);
  if (position === -1) return { unscored: true, reason: "Not part of a scored set cohort." };

  // Middle of the pack scores best. The top of a cohort is the commander
  // everyone is already building; the bottom is the one nobody wanted.
  const percentile = position / (cohort.length - 1);
  const cohortPosition = round3(1 - Math.abs(percentile - 0.6) / 0.6);

  const interest = commander.mentionCount;
  const decks = commander.popularity?.deckCount ?? 0;
  const components = { cohortPosition: Math.max(0, cohortPosition) };
  const reasons = [
    `${ordinal(position + 1)} of ${cohort.length} new legends in ${String(commander.setCode).toUpperCase()}, with ${decks.toLocaleString()} decks against the set leader's ${(cohort[0].popularity?.deckCount ?? 0).toLocaleString()}.`
  ];

  if (Number.isFinite(interest) && interest > 0) {
    // Degrades gracefully: without an interest numerator this component is
    // simply absent and cohort position carries the whole score.
    const ratio = interest / Math.max(decks, 1);
    components.interestToTraction = round3(Math.min(1, ratio / 0.02));
    reasons.push(components.interestToTraction >= 0.5
      ? `${interest} deck-tech mention${interest === 1 ? "" : "s"} against only ${decks.toLocaleString()} builds — people are intrigued but nobody has committed.`
      : `${interest} mention${interest === 1 ? "" : "s"} against ${decks.toLocaleString()} builds, so interest is already converting into decks.`);
  } else {
    reasons.push("No deck-tech coverage found yet, so this is cohort position alone.");
  }

  const available = Object.entries(components);
  const totalWeight = available.reduce((sum, [name]) => sum + COMPONENT_WEIGHTS[name], 0);
  const total = available.reduce((sum, [name, value]) => sum + value * COMPONENT_WEIGHTS[name], 0) / totalWeight;

  return {
    cohortScore: round(total * 100),
    cohortSetCode: commander.setCode,
    cohortSize: cohort.length,
    cohortPosition: position + 1,
    components,
    reasons: reasons.slice(0, 3),
    partial: available.length < Object.keys(COMPONENT_WEIGHTS).length,
    modelVersion: COHORT_MODEL_VERSION
  };
}

/**
 * Reasons for a cohort score, derived at render time from the stored
 * `cohort` block rather than serialised. Same reasoning as `explainScore`:
 * the sentences quote each commander's own numbers, so storing them costs
 * far more than recomputing them.
 */
export function explainCohort(commander) {
  const cohort = commander?.cohort;
  if (!cohort) return [];
  const decks = commander.popularity?.deckCount ?? 0;
  const reasons = [
    `${ordinal(cohort.position)} of ${cohort.size} new legends in ${String(cohort.setCode).toUpperCase()}, with ${decks.toLocaleString()} deck${decks === 1 ? "" : "s"} so far.`
  ];
  const interest = commander.mentionCount;
  reasons.push(Number.isFinite(interest) && interest > 0
    ? `${interest} deck-tech mention${interest === 1 ? "" : "s"} against ${decks.toLocaleString()} build${decks === 1 ? "" : "s"}.`
    : "No deck-tech coverage found yet, so this is cohort position alone.");
  return reasons;
}

/**
 * Attaches cohort scores across the catalogue.
 *
 * A new commander is **never surfaced merely for being new**: it must clear
 * `minScore` to carry a cohort score at all. Commanders that have graduated
 * keep their Edge score and are skipped here, so the two scores never sit on
 * the same record and cannot be mistaken for one another.
 */
export function applyCohortScores(commanders, today, options = {}) {
  const cohorts = buildCohorts(commanders, today, options);
  const minScore = options.minScore ?? 35;
  let scored = 0;

  const result = commanders.map((input) => {
    // Rebuilt every run, never inherited: a commander that graduates must
    // lose its cohort score rather than carry a stale one beside an Edge score.
    const commander = { ...input };
    delete commander.cohortScore;
    delete commander.cohort;
    if (hasGraduated(commander, today)) return commander;

    // **A new arrival never keeps an Edge score.** `withEdgeScore` runs first
    // and attaches one to anything clearing the bracket gate, but inside the
    // release window the rank that score is built on is meaningless — which
    // is the whole reason cohort scoring exists. Leaving both on the record
    // let the two renderers disagree: the badge showed the Edge score while
    // every word beneath it described the cohort one, 36 points apart at
    // worst. The scores are mutually exclusive by construction here.
    delete commander.edgeScore;
    delete commander.partialScore;

    const cohort = cohorts.get(commander.setCode);
    const score = scoreCohort(commander, cohort, options);
    // Missing the cohort bar means no score at all, not a fallback to the
    // Edge score: "new commanders are never surfaced purely for being new".
    if (score.unscored || score.cohortScore < minScore) return commander;
    scored += 1;
    return {
      ...commander,
      cohortScore: score.cohortScore,
      cohort: {
        setCode: score.cohortSetCode,
        size: score.cohortSize,
        position: score.cohortPosition
      },
      ...(score.partial ? { partialScore: true } : {})
    };
  });

  return {
    commanders: result,
    diagnostics: [`Scored ${scored} new arrival(s) against ${cohorts.size} set cohort(s); commanders past ${GRADUATION_DECK_COUNT} decks use the Edge score instead.`]
  };
}

/** Rank past which nothing is scored at all, re-exported for the UI's benefit. */
export { MAX_SCORED_RANK };

function ordinal(value) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}
