import { parseFeedItems } from "../shared/feed-parse.js";

const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

/**
 * Feeds read for discovery candidates. Config, not logic.
 *
 * **Commander's Herald is deliberately absent.** Its budget, pauper and
 * deckbuilding categories last published in April 2025, and the live feed is
 * political satire — wiring it in would inject US political commentary into a
 * Magic tool.
 */
export const FEEDS = Object.freeze([
  { id: "edhrec-articles", name: "EDHREC Articles", url: "https://edhrec.com/articles/feed" },
  { id: "mtggoldfish", name: "MTGGoldfish", url: "https://www.mtggoldfish.com/feed" },
  { id: "starcitygames", name: "StarCityGames Commander", url: "https://articles.starcitygames.com/tag/commander/feed/" }
]);

/** Item GUIDs remembered per feed. Enough to span several runs of a daily feed. */
const SEEN_LIMIT = 400;

export const rssConnector = {
  id: "rss",
  network: true,

  /**
   * Returns discovery **candidates**, not findings. A candidate is a title, a
   * canonical link, a date and the commanders its title or categories name.
   * Whether any of it is a genuine find is #18's judgement to make.
   *
   * No article body is fetched or stored. The feed's own `<description>` is
   * the creator's prose.
   */
  async collectCandidates(context) {
    const state = context.state ?? {};
    const byName = commanderIndex(context.commanders ?? []);
    const diagnostics = [];
    const candidates = [];
    const nextState = {};

    for (const feed of context.feeds ?? FEEDS) {
      const previous = state[feed.id] ?? {};
      try {
        const result = await readFeed(feed, previous, context.fetch);
        nextState[feed.id] = result.state;
        if (result.notModified) {
          diagnostics.push(`${feed.name}: unchanged (304).`);
          continue;
        }
        const fresh = result.items.filter((item) => !(previous.seen ?? []).includes(item.id));
        const matched = fresh.flatMap((item) => toCandidates(item, feed, byName, context.today));
        candidates.push(...matched);
        diagnostics.push(`${feed.name}: ${fresh.length} new item(s), ${matched.length} naming a catalogued commander.`);
      } catch (error) {
        // One feed's failure degrades only that feed.
        nextState[feed.id] = previous;
        diagnostics.push(`${feed.name}: FAILED — ${error.message}; other feeds unaffected.`);
      }
    }

    return { candidates, diagnostics, state: nextState };
  }
};

async function readFeed(feed, previous, fetchImpl) {
  const headers = { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9" };
  if (previous.etag) headers["If-None-Match"] = previous.etag;
  if (previous.lastModified) headers["If-Modified-Since"] = previous.lastModified;

  const response = await fetchImpl(feed.url, { headers });
  if (response.status === 304) return { notModified: true, state: previous };
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const items = parseFeedItems(await response.text());
  return {
    items,
    state: {
      etag: response.headers?.get?.("etag") ?? previous.etag,
      // Deliberately kept for the conditional request only. It is NOT used to
      // decide what is new: WordPress category feeds report the site-wide
      // latest post here, not the category's. One feed reported 2026-09-17
      // while its newest actual item was from April 2025. Dedupe on GUID.
      lastModified: response.headers?.get?.("last-modified") ?? previous.lastModified,
      seen: [...items.map((item) => item.id), ...(previous.seen ?? [])].slice(0, SEEN_LIMIT)
    }
  };
}

/**
 * Commander names are matched against the catalogue, longest first so
 * "Kenrith, the Returned King" wins over a commander merely called "Kenrith".
 */
function commanderIndex(commanders) {
  return commanders
    .filter((commander) => commander.name && commander.slug)
    .map((commander) => ({ slug: commander.slug, name: commander.name, needle: commander.name.toLowerCase() }))
    .sort((a, b) => b.needle.length - a.needle.length);
}

function toCandidates(item, feed, index, today) {
  const haystack = [item.title, ...item.categories].join(" | ").toLowerCase();
  const matched = [];
  for (const commander of index) {
    if (!haystack.includes(commander.needle)) continue;
    if (matched.some((found) => found.needle.includes(commander.needle))) continue;
    matched.push(commander);
  }
  if (!matched.length) return [];

  return [{
    id: `${feed.id}:${item.id}`,
    title: item.title,
    source: { name: feed.name, type: "article", url: item.link, creator: feed.name, resourceDepth: "discussion" },
    publishedAt: item.publishedAt || today,
    observedAt: today,
    commanders: matched.map(({ slug, name }) => ({ slug, name })),
    // The evidence the judge reads. It is the feed's own metadata, never the
    // article body, and it is not written to `data/`.
    signal: [item.title, ...item.categories].join(" · ")
  }];
}
