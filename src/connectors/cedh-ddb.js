const PAGE_URL = "https://cedh-decklist-database.com/";
const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

/**
 * Sections the database sorts its entries into, as its own `ddb-section`
 * label spells them. Config, not logic.
 *
 * `brew` is the Brewer's Corner: where a commander goes when it does not fit
 * any existing archetype entry. The database's managers describe evaluating
 * these on "optimizing the commander, rather than comparing them to existing
 * entries", and revisit each review cycle to see "how frequently they're
 * played after the initial hype". That is this project's own retention thesis,
 * applied by hand to competitive brews.
 */
const SECTIONS = Object.freeze({ BREW: "brew", COMPETITIVE: "competitive", OUTDATED: "outdated" });

/**
 * "Someone cares enough about this commander to run a dedicated community for
 * it" is a strong signal of real brewing energy. Normally you would have to
 * read Discord to measure it, which is off limits.
 *
 * The cEDH Decklist Database publishes the mapping directly on its front page:
 * commander card images paired with Discord invite links. This is ordinary
 * public web content, touches no Discord API and needs no bot.
 *
 * **Boundary:** this is the legitimate *substitute* for Discord, which is
 * excluded in `docs/SOURCES.md`. No read API exists for un-joined servers and
 * Discord's Developer Policy prohibits the use case outright. This connector
 * is not an opening to revisit that.
 *
 * Only the presence of a community, which section an entry sits in, when it
 * was last touched, and the canonical link are stored. No decklist, no
 * primer, no community content is read, mirrored or summarised — the
 * constraint is `AGENTS.md`'s attribution rule, not what the page happens to
 * expose. The database's own deck titles are its editorial work and are
 * deliberately **not** kept.
 */
export const cedhDdbConnector = {
  id: "cedh-ddb",
  network: true,

  async enrichCatalog(commanders, context) {
    const response = await context.fetch(PAGE_URL, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
    if (!response.ok) throw new Error(`cEDH Decklist Database request failed: HTTP ${response.status}`);

    const entries = parseEntries(await response.text());
    const byName = new Map();
    for (const entry of entries) {
      for (const commander of entry.commanders) byName.set(commander.toLowerCase(), entry);
    }

    let matched = 0;
    let brewing = 0;
    const enriched = commanders.map((commander) => {
      const entry = byName.get(String(commander.name).toLowerCase());
      if (!entry) return commander;
      matched += 1;
      if (entry.section === SECTIONS.BREW) brewing += 1;
      return {
        ...commander,
        ...(entry.invite ? { dedicatedCommunity: { url: entry.invite, source: "cEDH Decklist Database", sourceUrl: PAGE_URL } } : {}),
        ...(entry.section ? { cedhListing: { section: entry.section, ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}), sourceUrl: PAGE_URL } } : {})
      };
    });

    return {
      commanders: enriched,
      diagnostics: [`Parsed ${entries.length} database entr(ies); ${matched} match the catalogue, ${brewing} of them in the Brewer's Corner.`],
      state: { ...(context.state ?? {}), lastRunAt: context.today }
    };
  }
};

/**
 * One entry per `<li>`, which is how the database structures its list.
 *
 * Scoping to the element means an entry can never borrow its neighbour's
 * invite link — the failure the flat scan below has to guard against
 * explicitly — and it is the only way to associate an entry with the
 * `ddb-section` label that says which list it is on.
 *
 * Falls back to the flat scan when no `<li>` entries parse, so a markup
 * change costs the section labels rather than the whole connector.
 */
export function parseEntries(html) {
  const source = String(html ?? "");
  const entries = [];

  for (const match of source.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const [, attributes, body] = match;
    const commanders = commanderNames(body);
    if (!commanders.length) continue;

    const invite = body.match(/<a[^>]*class="[^"]*\bddb-discord\b[^"]*"[^>]*href="([^"]+)"/i)?.[1];
    const section = body.match(/<div[^>]*class="[^"]*\bddb-section\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    entries.push({
      commanders,
      ...(invite && /^https:\/\/discord\.(gg|com)\//i.test(invite) ? { invite } : {}),
      ...(SECTIONS[stripTags(section).toUpperCase()] ? { section: SECTIONS[stripTags(section).toUpperCase()] } : {}),
      ...(attributes.match(/\bdata-updated="([^"]+)"/i) ? { updatedAt: attributes.match(/\bdata-updated="([^"]+)"/i)[1] } : {})
    });
  }

  return entries.length ? entries : flatScan(source);
}

/**
 * Commander-to-community pairs, flattened.
 *
 * Kept as the connector's original shape: callers that only want "does this
 * commander have a dedicated server" should not have to know about sections.
 */
export function parseCommunities(html) {
  return parseEntries(html)
    .filter((entry) => entry.invite)
    .flatMap((entry) => entry.commanders.map((commander) => ({ commander, invite: entry.invite })));
}

/**
 * The pre-`<li>` scan, retained as the fallback.
 *
 * Deliberately forgiving: a markup change yields fewer entries, not an
 * exception. An empty result degrades this connector and nothing else.
 */
function flatScan(source) {
  const entries = [];
  for (const block of source.matchAll(/<div[^>]*class="[^"]*\bddb-images\b[^"]*"[^>]*>([\s\S]*?)<\/div>([\s\S]{0,4000}?)<a[^>]*class="[^"]*\bddb-discord\b[^"]*"[^>]*href="([^"]+)"/gi)) {
    const [, images, between, invite] = block;
    // A `ddb-images` block followed by another one before any invite link
    // means this entry has no community; skip rather than borrowing the next.
    if (/\bddb-images\b/.test(between)) continue;
    if (!/^https:\/\/discord\.(gg|com)\//i.test(invite)) continue;

    const commanders = commanderNames(images);
    if (commanders.length) entries.push({ commanders, invite });
  }
  return entries;
}

function commanderNames(fragment) {
  const block = String(fragment).match(/<div[^>]*class="[^"]*\bddb-images\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const images = block ? block[1] : String(fragment);
  return [...images.matchAll(/<img[^>]*\balt="([^"]+)"/gi)]
    .map((image) => decodeEntities(image[1]).trim())
    .filter(Boolean);
}

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "").trim();
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8217;/g, "’");
}

export const COMMUNITY_FACT_FIELDS = Object.freeze(["dedicatedCommunity", "cedhListing"]);
