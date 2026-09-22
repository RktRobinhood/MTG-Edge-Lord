const PAGE_URL = "https://cedh-decklist-database.com/";
const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

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
 * Only the presence of a community and the canonical invite link are stored.
 * No community content is read, mirrored or summarised.
 */
export const cedhDdbConnector = {
  id: "cedh-ddb",
  network: true,

  async enrichCatalog(commanders, context) {
    const response = await context.fetch(PAGE_URL, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
    if (!response.ok) throw new Error(`cEDH Decklist Database request failed: HTTP ${response.status}`);

    const pairs = parseCommunities(await response.text());
    const byName = new Map(pairs.map((pair) => [pair.commander.toLowerCase(), pair.invite]));

    let matched = 0;
    const enriched = commanders.map((commander) => {
      const invite = byName.get(String(commander.name).toLowerCase());
      if (!invite) return commander;
      matched += 1;
      return { ...commander, dedicatedCommunity: { url: invite, source: "cEDH Decklist Database", sourceUrl: PAGE_URL } };
    });

    return {
      commanders: enriched,
      diagnostics: [`Parsed ${pairs.length} commander-to-community pair(s); ${matched} match the catalogue.`],
      state: { ...(context.state ?? {}), lastRunAt: context.today }
    };
  }
};

/**
 * Entries are a `ddb-images` block of card images followed by a `ddb-discord`
 * link. The commander is the `alt` text of the block's images; a partner pair
 * has two, and both get credited.
 *
 * Deliberately forgiving: a markup change yields fewer pairs, not an
 * exception. An empty result degrades this connector and nothing else.
 */
export function parseCommunities(html) {
  const source = String(html ?? "");
  const pairs = [];

  for (const block of source.matchAll(/<div[^>]*class="[^"]*\bddb-images\b[^"]*"[^>]*>([\s\S]*?)<\/div>([\s\S]{0,4000}?)<a[^>]*class="[^"]*\bddb-discord\b[^"]*"[^>]*href="([^"]+)"/gi)) {
    const [, images, between, invite] = block;
    // A `ddb-images` block followed by another one before any invite link
    // means this entry has no community; skip rather than borrowing the next.
    if (/\bddb-images\b/.test(between)) continue;
    if (!/^https:\/\/discord\.(gg|com)\//i.test(invite)) continue;

    for (const image of images.matchAll(/<img[^>]*\balt="([^"]+)"/gi)) {
      const commander = decodeEntities(image[1]).trim();
      if (commander) pairs.push({ commander, invite });
    }
  }
  return pairs;
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8217;/g, "’");
}

export const COMMUNITY_FACT_FIELDS = Object.freeze(["dedicatedCommunity"]);
