import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedItems } from "../src/shared/feed-parse.js";
import { rssConnector } from "../src/connectors/rss.js";
import { spellbookConnector } from "../src/connectors/spellbook.js";
import { edhtop16Connector } from "../src/connectors/edhtop16.js";
import { cedhDdbConnector, parseCommunities } from "../src/connectors/cedh-ddb.js";
import { archidektConnector, primerCandidates } from "../src/connectors/archidekt.js";
import { CHANNELS, uploadsPlaylistId, youtubeConnector } from "../src/connectors/youtube.js";

const commanders = [
  { name: "Massimo, the Magician", slug: "massimo-the-magician", popularity: { edhrecRank: 1050 } },
  { name: "Arcum Dagsson", slug: "arcum-dagsson", popularity: { edhrecRank: 1800 } },
  { name: "Krenko, Mob Boss", slug: "krenko-mob-boss", popularity: { edhrecRank: 5 } }
];

const noSleep = { sleep: async () => {} };

function response(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
    json: async () => typeof body === "string" ? JSON.parse(body) : body
  };
}

// --- RSS --------------------------------------------------------------------

const feed = (items) => `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
const item = (title, guid, link) => `<item><title>${title}</title><guid>${guid}</guid><link>${link}</link><pubDate>Mon, 21 Sep 2026 18:12:02 GMT</pubDate></item>`;

test("the feed reader takes metadata and never the article body", () => {
  const [parsed] = parseFeedItems(`<rss><channel><item>
    <title>A deck tech</title><guid>g1</guid><link>https://example.com/a</link>
    <description><![CDATA[<p>The creator's prose, which is theirs.</p>]]></description>
    <content:encoded><![CDATA[Even more of the creator's prose.]]></content:encoded>
  </item></channel></rss>`);
  assert.deepEqual(Object.keys(parsed).sort(), ["categories", "id", "link", "publishedAt", "title"]);
  assert.equal(JSON.stringify(parsed).includes("prose"), false);
});

test("an unchanged feed costs one 304 and yields nothing", async () => {
  const sent = [];
  const result = await rssConnector.collectCandidates({
    commanders, today: "2026-09-22",
    feeds: [{ id: "f", name: "Feed", url: "https://example.com/feed" }],
    state: { f: { etag: 'W/"abc"', seen: [] } },
    fetch: async (url, init) => { sent.push(init.headers["If-None-Match"]); return response("", { status: 304 }); }
  });
  assert.deepEqual(sent, ['W/"abc"']);
  assert.deepEqual(result.candidates, []);
  assert.ok(result.diagnostics[0].includes("304"));
});

test("items dedupe on GUID, never on Last-Modified", async () => {
  // This feed reports a stale site-wide Last-Modified, which is the WordPress
  // category-feed gotcha. Only the GUID decides what is new.
  const xml = feed(item("Arcum Dagsson brews", "guid-1", "https://example.com/1") + item("Massimo, the Magician goes off", "guid-2", "https://example.com/2"));
  const context = {
    commanders, today: "2026-09-22",
    feeds: [{ id: "f", name: "Feed", url: "https://example.com/feed" }],
    fetch: async () => response(xml, { headers: { "last-modified": "Mon, 21 Sep 2026 18:12:02 GMT", etag: '"e1"' } })
  };

  const first = await rssConnector.collectCandidates({ ...context, state: {} });
  assert.deepEqual(first.candidates.map((candidate) => candidate.commanders[0].slug).sort(), ["arcum-dagsson", "massimo-the-magician"]);

  const second = await rssConnector.collectCandidates({ ...context, state: first.state });
  assert.deepEqual(second.candidates, [], "the same GUIDs are not offered twice");
});

test("one feed failing leaves the others working", async () => {
  const result = await rssConnector.collectCandidates({
    commanders, today: "2026-09-22", state: {},
    feeds: [
      { id: "bad", name: "Bad", url: "https://bad.example/feed" },
      { id: "good", name: "Good", url: "https://good.example/feed" }
    ],
    fetch: async (url) => String(url).includes("bad")
      ? response("", { status: 500 })
      : response(feed(item("Arcum Dagsson brews", "g", "https://example.com/1")))
  });
  assert.equal(result.candidates.length, 1);
  assert.ok(result.diagnostics.some((line) => line.includes("Bad: FAILED")));
});

test("an item naming no catalogued commander is not a candidate", async () => {
  const result = await rssConnector.collectCandidates({
    commanders, today: "2026-09-22", state: {},
    feeds: [{ id: "f", name: "Feed", url: "https://example.com/feed" }],
    fetch: async () => response(feed(item("This week in Standard", "g", "https://example.com/1")))
  });
  assert.deepEqual(result.candidates, []);
});

// --- Commander Spellbook ----------------------------------------------------

const variantPage = {
  next: null,
  results: [
    { id: "1", uses: [{ card: { name: "Massimo, the Magician" } }, { card: { name: "Lightning Bolt" } }] },
    { id: "2", uses: [{ card: { name: "Massimo, the Magician" } }] },
    { id: "3", uses: [{ card: { name: "Sol Ring" } }] }
  ]
};

test("combo counts attach only to commanders the line actually uses", async () => {
  const result = await spellbookConnector.enrichCatalog(commanders, { today: "2026-09-22", state: {}, fetch: async () => response(variantPage) });
  const [massimo, arcum] = result.commanders;
  assert.equal(massimo.comboCount, 2);
  assert.ok(massimo.comboUrl.startsWith("https://commanderspellbook.com/search/"));
  assert.equal(arcum.comboCount, undefined);
});

test("a full pass is not repeated inside the refresh window", async () => {
  let requests = 0;
  const result = await spellbookConnector.enrichCatalog(commanders, {
    today: "2026-09-22",
    state: { lastPassAt: "2026-09-20" },
    fetch: async () => { requests += 1; return response(variantPage); }
  });
  assert.equal(requests, 0);
  assert.deepEqual(result.commanders, commanders);
});

test("combo data never reaches the score", async () => {
  const { scoreCommander } = await import("../src/shared/edge-score.js");
  const base = { popularity: { edhrecRank: 1500 }, bracketCounts: [0, 10, 40, 10, 0], archetypeDepth: 0.4 };
  assert.equal(scoreCommander({ ...base, comboCount: 99 }).edgeScore, scoreCommander(base).edgeScore);
});

// --- EDHTop16 ---------------------------------------------------------------

test("tournament data is evidence with provenance, and a partner pairing credits both halves", async () => {
  const result = await edhtop16Connector.enrichCatalog(commanders, {
    today: "2026-09-22", state: {},
    fetch: async () => response({
      data: {
        commanders: {
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [{ node: { name: "Massimo, the Magician / Krenko, Mob Boss", colorId: "WUR", breakdownUrl: "/commander/x", stats: { count: 12, topCuts: 3, conversionRate: 0.25 } } }]
        }
      }
    })
  });
  const [massimo, arcum, krenko] = result.commanders;
  assert.equal(massimo.tournament.tournamentEntries, 12);
  assert.equal(massimo.tournament.url, "https://edhtop16.com/commander/x");
  assert.equal(krenko.tournament.topCuts, 3);
  assert.equal(arcum.tournament, undefined, "no tournament data is the norm, not a penalty");
});

test("a GraphQL error throws rather than silently zeroing tournament data", async () => {
  await assert.rejects(
    edhtop16Connector.enrichCatalog(commanders, { today: "2026-09-22", state: {}, fetch: async () => response({ errors: ["nope"] }) }),
    /EDHTop16 rejected the query/
  );
});

// --- cEDH Decklist Database -------------------------------------------------

const ddbHtml = `
<div class="ddb-images"><img data-src="a.webp" alt="Massimo, the Magician"/></div>
<div class="ddb-links"><a class="ddb-discord btn" href="https://discord.gg/AAA">Discord</a></div>
<div class="ddb-images"><img data-src="b.webp" alt="Rograkh, Son of Rohgahh"/><img data-src="c.webp" alt="Arcum Dagsson"/></div>
<div class="ddb-links"><a class="ddb-discord btn" href="https://discord.gg/BBB">Discord</a></div>
<div class="ddb-images"><img data-src="d.webp" alt="Krenko, Mob Boss"/></div>
<div class="ddb-images"><img data-src="e.webp" alt="Someone Else"/></div>
<div class="ddb-links"><a class="ddb-discord btn" href="https://discord.gg/CCC">Discord</a></div>`;

test("commander-to-community pairs are parsed, and a partner pair credits both", () => {
  const pairs = parseCommunities(ddbHtml);
  assert.deepEqual(pairs.find((pair) => pair.commander === "Massimo, the Magician").invite, "https://discord.gg/AAA");
  assert.deepEqual(pairs.filter((pair) => pair.invite === "https://discord.gg/BBB").map((pair) => pair.commander), ["Rograkh, Son of Rohgahh", "Arcum Dagsson"]);
});

test("an entry with no community does not borrow the next entry's invite", () => {
  const pairs = parseCommunities(ddbHtml);
  assert.equal(pairs.some((pair) => pair.commander === "Krenko, Mob Boss"), false);
});

test("changed markup yields fewer pairs rather than an exception", () => {
  assert.deepEqual(parseCommunities("<div>totally different</div>"), []);
  assert.deepEqual(parseCommunities(undefined), []);
});

test("only the invite link is stored, never community content", async () => {
  const result = await cedhDdbConnector.enrichCatalog(commanders, { today: "2026-09-22", state: {}, fetch: async () => response(ddbHtml) });
  const [massimo] = result.commanders;
  assert.deepEqual(Object.keys(massimo.dedicatedCommunity).sort(), ["source", "sourceUrl", "url"]);
});

// --- Archidekt --------------------------------------------------------------

test("hasPrimer is filtered client-side, and private or theorycrafted decks are skipped", () => {
  const candidates = primerCandidates([
    { id: 1, name: "Real primer", hasPrimer: true, owner: { username: "brewer" }, viewCount: 90, updatedAt: "2026-09-01T00:00:00Z" },
    { id: 2, name: "No primer", hasPrimer: false, owner: { username: "other" } },
    { id: 3, name: "Private", hasPrimer: true, private: true, owner: { username: "other" } },
    { id: 4, name: "Theorycraft", hasPrimer: true, theorycrafted: true, owner: { username: "other" } }
  ], commanders[0], "2026-09-22");

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source.creator, "brewer");
  assert.equal(candidates[0].source.url, "https://archidekt.com/decks/1");
  assert.equal(candidates[0].source.resourceDepth, "primer");
});

test("the deck count caps at 1,000, which marks the meta band", async () => {
  const result = await archidektConnector.enrichCatalog(commanders, {
    ...noSleep, today: "2026-09-22", state: {}, commandersPerRun: 2,
    fetch: async () => response({ count: 4000, results: [] })
  });
  assert.equal(result.commanders[0].archidektDecks, 1000);
});

test("only the scored band is queried, so the meta commander is skipped", async () => {
  const queried = [];
  await archidektConnector.enrichCatalog(commanders, {
    ...noSleep, today: "2026-09-22", state: {}, commandersPerRun: 10,
    fetch: async (url) => { queried.push(decodeURIComponent(String(url))); return response({ count: 4, results: [] }); }
  });
  assert.equal(queried.length, 2);
  assert.equal(queried.some((url) => url.includes("Krenko")), false);
});

// --- YouTube ----------------------------------------------------------------

test("an absent API key disables the lane without failing the run", async () => {
  const result = await youtubeConnector.collectCandidates({ commanders, today: "2026-09-22", state: {}, env: {} });
  assert.deepEqual(result.candidates, []);
  assert.ok(result.diagnostics[0].includes("disabled"));
});

test("uploads are read from the UU playlist, never from search.list", async () => {
  const urls = [];
  await youtubeConnector.collectCandidates({
    commanders, today: "2026-09-22", state: {}, apiKey: "k",
    channels: [{ id: "UCabc", name: "A Channel" }],
    fetch: async (url) => {
      urls.push(String(url));
      return response({ items: [{ snippet: { title: "Arcum Dagsson deck tech", publishedAt: "2026-09-20T00:00:00Z", resourceId: { videoId: "v1" } } }] });
    }
  });
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes("playlistItems"));
  assert.ok(urls[0].includes("playlistId=UUabc"));
  assert.equal(urls[0].includes("search"), false);
});

test("a video naming a catalogued commander becomes a candidate crediting the channel", async () => {
  const result = await youtubeConnector.collectCandidates({
    commanders, today: "2026-09-22", state: {}, apiKey: "k",
    channels: [{ id: "UCabc", name: "A Channel" }],
    fetch: async () => response({ items: [{ snippet: { title: "Arcum Dagsson deck tech", publishedAt: "2026-09-20T00:00:00Z", resourceId: { videoId: "v1" } } }] })
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].source.url, "https://www.youtube.com/watch?v=v1");
  assert.equal(result.candidates[0].source.creator, "A Channel");
  assert.deepEqual(result.candidates[0].commanders, [{ slug: "arcum-dagsson", name: "Arcum Dagsson" }]);
});

test("the uploads playlist id is the channel id with UC swapped for UU", () => {
  assert.equal(uploadsPlaylistId("UCkOuyDIw8W-RjfGgWdRHnDQ"), "UUkOuyDIw8W-RjfGgWdRHnDQ");
  assert.ok(CHANNELS.every((channel) => channel.id.startsWith("UC")));
});
