import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import readline from "node:readline";

const BULK_INDEX_URL = "https://api.scryfall.com/bulk-data";
const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

/**
 * Functional tag roots kept as search axes, in the vocabulary Scryfall Tagger
 * uses. Tagger's taxonomy is a tree of ~4,500 tags, most of them far too
 * granular for a filter (`tutor-creature-giant`). Each root here absorbs its
 * whole subtree, so a commander tagged `tutor-creature-giant` filters under
 * `tutor`.
 *
 * Config, not logic: add a root and it becomes a filter axis.
 */
export const FUNCTIONAL_TAG_ROOTS = Object.freeze([
  "ramp",
  "tutor",
  "removal",
  "recursion",
  "protection",
  "evasion",
  "sacrifice-outlet",
  "card-advantage",
  "graveyard-fuel",
  "counters-matter",
  "discard-outlet",
  "hand-disruption",
  "lifegain",
  "cost-reducer",
  "lockdown",
  "copy",
  "flicker",
  "untapper",
  "saboteur",
  "power-matters",
  "toughness-matters",
  "typal-coupling",
  "hate"
]);

const COLOR_ORDER = ["W", "U", "B", "R", "G"];

/**
 * The commander fields this connector owns. Nothing else may write them, and
 * the pipeline carries exactly these across a refresh of the EDHREC catalogue.
 */
export const CARD_FACT_FIELDS = Object.freeze([
  "colorIdentity",
  "manaValue",
  "types",
  "creatureTypes",
  "setCode",
  "releasedAt",
  "price",
  "functionalTags"
]);

export const scryfallBulkConnector = {
  id: "scryfall-bulk",
  network: true,

  /**
   * Joins Scryfall card facts onto the EDHREC commander catalogue.
   *
   * Per the connector contract a failure here must leave the catalogue intact,
   * so this throws rather than returning half a catalogue. Callers wrap it in
   * the pipeline's `safeCatalogEnrich` helper.
   */
  async enrichCatalog(commanders, context) {
    const diagnostics = [];
    const index = await fetchBulkIndex(context.fetch);
    const state = context.state ?? {};
    const cardsMeta = requireBulk(index, "oracle_cards");
    const tagsMeta = requireBulk(index, "oracle_tags");

    const alreadyEnriched = commanders.some((commander) => commander.colorIdentity !== undefined);
    if (alreadyEnriched && state.oracleCardsUpdatedAt === cardsMeta.updated_at && state.oracleTagsUpdatedAt === tagsMeta.updated_at) {
      diagnostics.push(`Bulk data unchanged since ${cardsMeta.updated_at}; skipped both downloads.`);
      return { commanders, diagnostics, state };
    }

    const wanted = buildNameIndex(commanders);
    const facts = await readCardFacts(cardsMeta.jsonl_download_uri, wanted, context.fetch);
    diagnostics.push(`Read ${facts.size} commander card fact(s) from the ${formatMegabytes(cardsMeta.compressed_size)} oracle_cards bulk file.`);

    const tags = await readFunctionalTags(tagsMeta.jsonl_download_uri, context.fetch);
    diagnostics.push(`Rolled ${tags.size} oracle id(s) up to ${FUNCTIONAL_TAG_ROOTS.length} functional tag root(s).`);

    const enriched = commanders.map((commander) => applyFacts(commander, facts, tags));
    const matched = enriched.filter((commander) => commander.colorIdentity !== undefined).length;
    diagnostics.push(`Attached card facts to ${matched}/${commanders.length} commanders.`);

    return {
      commanders: enriched,
      diagnostics,
      state: { oracleCardsUpdatedAt: cardsMeta.updated_at, oracleTagsUpdatedAt: tagsMeta.updated_at }
    };
  }
};

async function fetchBulkIndex(fetchImpl) {
  const response = await fetchImpl(BULK_INDEX_URL, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Scryfall bulk index request failed: HTTP ${response.status}`);
  return (await response.json()).data ?? [];
}

function requireBulk(index, type) {
  const entry = index.find((item) => item.type === type);
  if (!entry?.jsonl_download_uri) throw new Error(`Scryfall bulk index is missing a download URI for ${type}`);
  return entry;
}

/**
 * Commanders are matched by name. Scryfall's `id` is the id of one chosen
 * printing, which need not be the printing EDHREC happens to reference, so
 * joining on it loses real commanders.
 *
 * Partner and background pairings arrive from EDHREC as combined names and
 * match nothing here. That is correct: the pairing has no single card, so its
 * card facts stay absent and the UI renders them as unknown.
 */
function buildNameIndex(commanders) {
  const wanted = new Map();
  for (const commander of commanders) {
    for (const key of nameKeys(commander.name)) {
      if (!wanted.has(key)) wanted.set(key, []);
      wanted.get(key).push(commander.slug);
    }
  }
  return wanted;
}

function nameKeys(name) {
  const normalized = normalizeName(name);
  const front = normalized.split(" // ")[0];
  return front === normalized ? [normalized] : [normalized, front];
}

function normalizeName(name) {
  return String(name).normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’]/g, "'").trim().toLowerCase();
}

async function readCardFacts(url, wanted, fetchImpl) {
  const facts = new Map();
  await forEachJsonLine(url, fetchImpl, (card) => {
    for (const key of nameKeys(card.name ?? "")) {
      const slugs = wanted.get(key);
      if (!slugs) continue;
      const value = cardFacts(card);
      for (const slug of slugs) if (!facts.has(slug)) facts.set(slug, value);
    }
  });
  return facts;
}

export function cardFacts(card) {
  const { types, creatureTypes } = splitTypeLine(card.type_line ?? "");
  const price = Number.parseFloat(card.prices?.usd ?? card.prices?.usd_foil ?? "");
  return {
    oracleId: card.oracle_id,
    colorIdentity: orderColors(card.color_identity ?? []),
    manaValue: Number(card.cmc ?? 0),
    types,
    creatureTypes,
    setCode: card.set,
    releasedAt: card.released_at,
    ...(Number.isFinite(price) ? { price } : {})
  };
}

/**
 * `colorIdentity` is a WUBRG-ordered string, not an array: `"BG"`, or `""` for
 * colourless. There are only 32 possible values, so the column dictionary-
 * encodes to almost nothing, and `"BG".includes("B")` is the whole of the
 * "includes" filter semantics.
 */
export function orderColors(colors) {
  const present = new Set(colors);
  return COLOR_ORDER.filter((color) => present.has(color)).join("");
}

export function splitTypeLine(typeLine) {
  const face = String(typeLine).split(" // ")[0];
  const [before, after = ""] = face.split(/\s+[—–-]\s+/);
  const types = before.split(/\s+/).filter((word) => word && word !== "Legendary");
  const creatureTypes = types.includes("Creature") ? after.split(/\s+/).filter(Boolean) : [];
  return { types, creatureTypes };
}

/**
 * Tagger tags form a tree. For each configured root, every oracle id tagged
 * anywhere in its subtree gets the root's label.
 */
async function readFunctionalTags(url, fetchImpl) {
  const tags = [];
  await forEachJsonLine(url, fetchImpl, (tag) => { if (tag.object === "tag") tags.push(tag); });

  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const assigned = new Map();
  for (const root of FUNCTIONAL_TAG_ROOTS) {
    const start = tags.find((tag) => tag.slug === root);
    if (!start) continue;
    for (const oracleId of subtreeOracleIds(start, byId)) {
      if (!assigned.has(oracleId)) assigned.set(oracleId, new Set());
      assigned.get(oracleId).add(root);
    }
  }
  return new Map([...assigned].map(([oracleId, roots]) => [oracleId, [...roots].sort()]));
}

function subtreeOracleIds(root, byId) {
  const oracleIds = new Set();
  const seen = new Set();
  const queue = [root];
  while (queue.length) {
    const tag = queue.pop();
    if (!tag || seen.has(tag.id)) continue;
    seen.add(tag.id);
    for (const tagging of tag.taggings ?? []) if (tagging.oracle_id) oracleIds.add(tagging.oracle_id);
    for (const childId of tag.child_ids ?? []) queue.push(byId.get(childId));
  }
  return oracleIds;
}

function applyFacts(commander, facts, tags) {
  const card = facts.get(commander.slug);
  if (!card) return commander;
  const { oracleId, ...searchable } = card;
  const functionalTags = tags.get(oracleId);
  return { ...commander, ...searchable, ...(functionalTags?.length ? { functionalTags } : {}) };
}

/**
 * Scryfall publishes bulk data as gzipped JSONL. Streaming it line by line
 * keeps peak memory at one card rather than the ~150MB the decompressed
 * oracle_cards file would occupy as a single parsed array.
 */
async function forEachJsonLine(url, fetchImpl, onLine) {
  const response = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Scryfall bulk download failed: HTTP ${response.status}`);
  const stream = readline.createInterface({ input: Readable.fromWeb(response.body).pipe(createGunzip()) });
  try {
    for await (const line of stream) {
      const trimmed = line.trim().replace(/,$/, "");
      if (!trimmed || trimmed === "[" || trimmed === "]") continue;
      onLine(JSON.parse(trimmed));
    }
  } finally {
    stream.close();
  }
}

function formatMegabytes(bytes) {
  return `${(Number(bytes || 0) / 1048576).toFixed(0)}MB`;
}
