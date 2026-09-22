import { scoreCommander } from "../shared/edge-score.js";

/**
 * Commander search: index, filter, sort.
 *
 * Kept out of the UI module so it can be tested in Node without a DOM, and
 * because this is the product. The panel is a way to drive it.
 */

const COLOR_ORDER = ["W", "U", "B", "R", "G"];

/**
 * Sort options. **Popularity is never the default and never the fallback** —
 * that is the whole reason this product exists. EDHREC's own search keeps
 * pulling you back to the top; this one does not.
 */
export const SORTS = Object.freeze([
  { id: "edge", label: "Edge score" },
  { id: "momentum", label: "Momentum" },
  { id: "worksScore", label: "How well it works" },
  { id: "price", label: "Cheapest first" },
  { id: "released", label: "Most recent" },
  { id: "name", label: "Alphabetical" },
  { id: "rank", label: "EDHREC rank" },
  { id: "deckCount", label: "Deck count (popularity)" }
]);

export const DEFAULT_SORT = "edge";

export const COLOR_MODES = Object.freeze([
  { id: "includes", label: "Includes" },
  { id: "exact", label: "Exactly" },
  { id: "atMost", label: "At most" }
]);

export const DEFAULT_FILTERS = Object.freeze({
  query: "",
  colors: [],
  colorMode: "includes",
  theme: "",
  functionalTag: "",
  creatureType: "",
  tier: "",
  minBracketFit: "",
  minRank: "",
  maxRank: "",
  minManaValue: "",
  maxManaValue: "",
  maxPrice: "",
  releasedAfter: "",
  scoredOnly: false,
  sort: DEFAULT_SORT
});

/**
 * Recomputes everything the dataset leaves out.
 *
 * `commanders.json` carries the raw inputs and the headline `edgeScore`, not
 * the tier, obscurity, works score or quality components — all of which are
 * exact functions of what it does carry. Running the pipeline's own scorer
 * here costs microseconds per record and saves about 110KB on a file that
 * loads with every EDHREC page view.
 */
export function hydrateCommanders(commanders) {
  return commanders.map((commander) => {
    const score = scoreCommander(commander);
    if (score.unscored) return { ...commander, tier: score.tier };
    return {
      ...commander,
      tier: score.tier,
      obscurity: score.obscurity,
      worksScore: score.worksScore,
      quality: score.quality
    };
  });
}

/**
 * Builds the searchable text **once per dataset load**, from named fields only.
 *
 * The previous implementation ran `JSON.stringify(record)` on every keystroke
 * for every one of 6,792 records. That is slow enough to stutter while typing,
 * and it matched field names and internal values, so searching `score` matched
 * everything.
 */
export function buildSearchIndex(input) {
  const commanders = hydrateCommanders(input);
  const haystacks = commanders.map((commander) => [
    commander.name,
    ...(commander.themes ?? []),
    ...(commander.functionalTags ?? []),
    ...(commander.creatureTypes ?? []),
    ...(commander.types ?? [])
  ].join(" ").toLowerCase());

  return {
    commanders,
    haystacks,
    themes: distinctTokens(commanders, "themes"),
    functionalTags: distinctTokens(commanders, "functionalTags"),
    creatureTypes: distinctTokens(commanders, "creatureTypes")
  };
}

function distinctTokens(commanders, field) {
  const counts = new Map();
  for (const commander of commanders) {
    for (const token of commander[field] ?? []) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([token]) => token);
}

export function filterCommanders(index, filters) {
  const terms = String(filters.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];

  for (let position = 0; position < index.commanders.length; position += 1) {
    if (terms.length && !terms.every((term) => index.haystacks[position].includes(term))) continue;
    const commander = index.commanders[position];
    if (matchesFilters(commander, filters)) results.push(commander);
  }
  return results;
}

function matchesFilters(commander, filters) {
  const rank = commander.popularity?.edhrecRank;

  if (!matchesColors(commander.colorIdentity, filters.colors, filters.colorMode)) return false;
  if (filters.theme && !(commander.themes ?? []).includes(filters.theme)) return false;
  if (filters.functionalTag && !(commander.functionalTags ?? []).includes(filters.functionalTag)) return false;
  if (filters.creatureType && !(commander.creatureTypes ?? []).includes(filters.creatureType)) return false;
  if (filters.tier && commander.tier !== filters.tier) return false;
  if (filters.scoredOnly && commander.edgeScore === undefined) return false;

  // Bracket fit is the quality filter. A commander below the confidence floor
  // has no bracket fit at all, so asking for one excludes it — which is the
  // honest answer, not a zero.
  if (filters.minBracketFit !== "" && !(commander.quality?.bracketFit >= Number(filters.minBracketFit))) return false;

  if (!withinRange(rank, filters.minRank, filters.maxRank)) return false;
  if (!withinRange(commander.manaValue, filters.minManaValue, filters.maxManaValue)) return false;

  // A commander with no price is not thereby expensive. Excluding it would
  // hide every unreleased commander from a budget search.
  if (filters.maxPrice !== "" && commander.price !== undefined && commander.price > Number(filters.maxPrice)) return false;
  if (filters.releasedAfter && (commander.releasedAt ?? "") < filters.releasedAfter) return false;

  return true;
}

function withinRange(value, min, max) {
  if (min === "" && max === "") return true;
  if (!Number.isFinite(value)) return false;
  if (min !== "" && value < Number(min)) return false;
  if (max !== "" && value > Number(max)) return false;
  return true;
}

/**
 * Colour identity is a WUBRG-ordered string, so the three Magic conventions
 * fall out of string and set operations:
 *
 *   includes  the commander can cast everything in the selection
 *   exact     the commander's identity is precisely the selection
 *   atMost    the commander adds no colour outside the selection
 */
export function matchesColors(identity, colors, mode) {
  if (!colors?.length) return true;
  if (identity === undefined) return false;
  const selected = COLOR_ORDER.filter((color) => colors.includes(color));
  if (mode === "exact") return identity === selected.join("");
  if (mode === "atMost") return [...identity].every((color) => selected.includes(color));
  return selected.every((color) => identity.includes(color));
}

export function sortCommanders(commanders, sort) {
  const comparator = COMPARATORS[sort] ?? COMPARATORS[DEFAULT_SORT];
  return [...commanders].sort(comparator);
}

/**
 * An unscored commander sorts to the bottom of a score-based sort rather than
 * being treated as a zero, and keeps its place in the result count. It is
 * still a real answer to the filters; it just has nothing to rank on.
 */
const byNumberDescending = (read) => (a, b) => {
  const left = read(a);
  const right = read(b);
  if (left === undefined && right === undefined) return byRank(a, b);
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return right - left || byRank(a, b);
};

const byNumberAscending = (read) => (a, b) => {
  const left = read(a);
  const right = read(b);
  if (left === undefined && right === undefined) return byRank(a, b);
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right || byRank(a, b);
};

function byRank(a, b) {
  return (a.popularity?.edhrecRank ?? Infinity) - (b.popularity?.edhrecRank ?? Infinity);
}

const COMPARATORS = {
  edge: byNumberDescending((commander) => commander.edgeScore),
  momentum: byNumberDescending((commander) => commander.momentum),
  worksScore: byNumberDescending((commander) => commander.worksScore),
  price: byNumberAscending((commander) => commander.price),
  released: (a, b) => String(b.releasedAt ?? "").localeCompare(String(a.releasedAt ?? "")) || byRank(a, b),
  name: (a, b) => a.name.localeCompare(b.name),
  rank: byRank,
  deckCount: byNumberDescending((commander) => commander.popularity?.deckCount)
};
