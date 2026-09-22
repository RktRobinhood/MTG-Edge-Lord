const API_BASE = "https://www.googleapis.com/youtube/v3/playlistItems";
const USER_AGENT = "MTG-Edge-Lord/1.0 (https://github.com/RktRobinhood/MTG-Edge-Lord)";

/**
 * Channels monitored for deck-tech coverage. Config, not logic.
 *
 * **Known dead — do not re-add:** Commander's Brew (last upload 2023), Jumbo
 * Commander (2025-06), Budget EDH, King of Jank, SmoothBrainEDH.
 */
export const CHANNELS = Object.freeze([
  { id: "UCkOuyDIw8W-RjfGgWdRHnDQ", name: "Better Commander" },
  { id: "UCFHkzyWe2xm8-SlvHDlHXoQ", name: "EDH Jank Center" },
  { id: "UCjzqELhNFU3-4vDNfR_MdOA", name: "Salubrious Snail" },
  { id: "UCFCQ1uJIqTOAxMNbXfV8qHQ", name: "MTGGoldfish Commander Clash" },
  { id: "UCbtaLo9zn6T9sSUOGLC5LnQ", name: "EDHdex" },
  { id: "UC9nbYUTPBLTDMLNzOFF3sOQ", name: "Niche EDH" }
]);

/** Uploads fetched per channel per run. */
const MAX_RESULTS = 25;

/**
 * Deck-tech coverage as an **interest** signal, for the cohort score's
 * interest-to-traction ratio.
 *
 * Uses the Data API, not `youtube.com/feeds/videos.xml`: the RSS feed works
 * and needs no key, but YouTube's `robots.txt` explicitly disallows
 * `/feeds/videos.xml`, and their terms permit automated access only for
 * search engines honouring robots.txt or with written permission. The Data
 * API is the only unambiguously clean path.
 *
 * Every channel's uploads live in a playlist whose id is the channel id with
 * `UC` swapped for `UU`. `playlistItems.list` against that playlist costs
 * **1 unit**; `search.list` costs 100 and is capped at 100 calls a day under
 * the June 2026 quota model. Six channels is six units against 10,000.
 */
export const youtubeConnector = {
  id: "youtube",
  network: true,

  async collectCandidates(context) {
    const apiKey = context.apiKey ?? context.env?.YOUTUBE_API_KEY;
    if (!apiKey) {
      // An absent key disables this lane. It never fails the run: a missing
      // interest numerator degrades the cohort score to pure cohort position.
      return { candidates: [], diagnostics: ["No YOUTUBE_API_KEY; the YouTube lane is disabled for this run."], state: context.state ?? {} };
    }

    const diagnostics = [];
    const candidates = [];
    const byName = commanderIndex(context.commanders ?? []);
    const state = context.state ?? {};
    const nextState = {};
    let units = 0;

    for (const channel of context.channels ?? CHANNELS) {
      try {
        const items = await fetchUploads(channel, apiKey, context.fetch);
        units += 1;
        const seen = state[channel.id]?.seen ?? [];
        const fresh = items.filter((item) => !seen.includes(item.videoId));
        const matched = fresh.flatMap((item) => toCandidates(item, channel, byName, context.today));
        candidates.push(...matched);
        nextState[channel.id] = { seen: [...items.map((item) => item.videoId), ...seen].slice(0, 200) };
        diagnostics.push(`${channel.name}: ${fresh.length} new upload(s), ${matched.length} naming a catalogued commander.`);
      } catch (error) {
        nextState[channel.id] = state[channel.id] ?? {};
        diagnostics.push(`${channel.name}: FAILED — ${error.message}; other channels unaffected.`);
      }
    }

    diagnostics.push(`Spent ${units} quota unit(s) of a 10,000/day allowance.`);
    return { candidates, diagnostics, state: nextState };
  }
};

/** A channel's uploads playlist is its id with the `UC` prefix swapped for `UU`. */
export function uploadsPlaylistId(channelId) {
  return String(channelId).replace(/^UC/, "UU");
}

async function fetchUploads(channel, apiKey, fetchImpl) {
  const url = `${API_BASE}?part=snippet&maxResults=${MAX_RESULTS}&playlistId=${uploadsPlaylistId(channel.id)}&key=${encodeURIComponent(apiKey)}`;
  const response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.items ?? []).map((item) => ({
    videoId: item.snippet?.resourceId?.videoId ?? item.id,
    title: String(item.snippet?.title ?? "").trim(),
    publishedAt: String(item.snippet?.publishedAt ?? "").slice(0, 10)
  })).filter((item) => item.videoId && item.title);
}

function commanderIndex(commanders) {
  return commanders
    .filter((commander) => commander.name && commander.slug)
    .map((commander) => ({ slug: commander.slug, name: commander.name, needle: commander.name.toLowerCase() }))
    .sort((a, b) => b.needle.length - a.needle.length);
}

function toCandidates(item, channel, index, today) {
  const haystack = item.title.toLowerCase();
  const matched = index.filter((commander) => haystack.includes(commander.needle));
  if (!matched.length) return [];
  return [{
    id: `youtube:${item.videoId}`,
    title: item.title,
    source: {
      name: channel.name,
      type: "video",
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
      creator: channel.name,
      resourceDepth: "deep_dive"
    },
    publishedAt: item.publishedAt || today,
    observedAt: today,
    commanders: matched.slice(0, 3).map(({ slug, name }) => ({ slug, name })),
    // Titles only. No transcript, no description, no thumbnail is stored.
    signal: item.title
  }];
}
