import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGES_PER_RUN,
  SCORED_BAND,
  archetypeDepthFrom,
  edhrecPagesConnector,
  inBand,
  normalizeBracketCounts,
  pageFacts,
  pageSlug,
  rotateSlice,
  weeklyRetention
} from "../src/connectors/edhrec-pages.js";

const page = {
  bracket_counts: { 1: 4, 2: 109, 3: 142, 4: 11, 5: 6 },
  tag_counts: [
    { count: 184, slug: "spellslinger" },
    { count: 44, slug: "unblockable" },
    { count: 43, slug: "burn" }
  ],
  savedate_counts: Object.fromEntries(
    Array.from({ length: 14 }, (_, day) => [`2026-09-${String(day + 1).padStart(2, "0")}`, day + 1])
  ),
  similar: ["Kess, Dissident Mage", "Narset, Enlightened Master"],
  panels: { combocounts: [{ value: "A + B" }, { value: "C + D" }] },
  container: {
    json_dict: {
      cardlists: [
        { tag: "topcards", cardviews: [{ slug: "sol-ring", synergy: 0.05 }] },
        {
          tag: "highsynergycards",
          cardviews: [
            { slug: "lightning-bolt", synergy: 0.72 },
            { slug: "brainstorm", synergy: 0.68 }
          ]
        }
      ]
    }
  }
};

function commandersAtRanks(...ranks) {
  return ranks.map((rank) => ({ name: `Rank ${rank}`, slug: `rank-${rank}`, popularity: { edhrecRank: rank } }));
}

test("only the scored band is crawled", () => {
  const band = inBand(commandersAtRanks(120, 499, 500, 1500, 3000, 3001, 6000));
  assert.deepEqual(band.map((commander) => commander.popularity.edhrecRank), [500, 1500, 3000]);
  assert.equal(SCORED_BAND.minRank, 500);
  assert.equal(SCORED_BAND.maxRank, 3000);
});

test("a commander with no rank is not crawled", () => {
  assert.deepEqual(inBand([{ slug: "pairing", name: "A + B" }]), []);
});

test("rotation resumes after the cursor and wraps at the end of the band", () => {
  const band = inBand(commandersAtRanks(500, 600, 700, 800));
  assert.deepEqual(rotateSlice(band, undefined, 2).map((c) => c.slug), ["rank-500", "rank-600"]);
  assert.deepEqual(rotateSlice(band, "rank-600", 2).map((c) => c.slug), ["rank-700", "rank-800"]);
  assert.deepEqual(rotateSlice(band, "rank-800", 2).map((c) => c.slug), ["rank-500", "rank-600"]);
});

test("a cursor pointing at a commander that left the band restarts rather than skipping a rotation", () => {
  const band = inBand(commandersAtRanks(500, 600));
  assert.deepEqual(rotateSlice(band, "rank-9999", 1).map((c) => c.slug), ["rank-500"]);
});

test("a band smaller than the run budget is crawled once, not repeated", () => {
  const band = inBand(commandersAtRanks(500, 600));
  assert.deepEqual(rotateSlice(band, undefined, 10).map((c) => c.slug), ["rank-500", "rank-600"]);
});

test("a full rotation covers the band in the documented number of runs", () => {
  const band = inBand(...[Array.from({ length: 2501 }, (_, index) => ({ slug: `c-${index}`, popularity: { edhrecRank: 500 + index } }))]);
  assert.equal(Math.ceil(band.length / PAGES_PER_RUN), 9);
});

test("bracket counts become a five-element array, and are absent when EDHREC reports none", () => {
  assert.deepEqual(normalizeBracketCounts({ 1: 4, 2: 109, 3: 142, 4: 11, 5: 6 }), [4, 109, 142, 11, 6]);
  assert.equal(normalizeBracketCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }), null);
  assert.equal(normalizeBracketCounts(undefined), null);
});

test("daily save counts collapse into weekly totals, oldest first", () => {
  assert.deepEqual(weeklyRetention(page.savedate_counts), [28, 77]);
  assert.deepEqual(weeklyRetention(undefined), []);
});

test("weeks are calendar windows, so a sparse series does not distort them", () => {
  // EDHREC omits days with no saves rather than reporting a zero. Grouping
  // every seven entries would let one "week" span months.
  // Five complete weeks back from 2026-09-05. The 08-01 entry falls outside
  // them and is dropped rather than padding a sixth, partial week.
  assert.deepEqual(
    weeklyRetention({ "2026-08-01": 5, "2026-08-20": 3, "2026-09-01": 2, "2026-09-05": 9 }),
    [0, 0, 3, 0, 11]
  );
  // A week with no saves at all is a real zero, not a gap. Weeks are counted
  // back from the newest day, so 09-02..09-22 is three of them and the 09-01
  // entry sits one day outside.
  assert.deepEqual(weeklyRetention({ "2026-09-02": 4, "2026-09-22": 6 }), [4, 0, 6]);
  assert.deepEqual(weeklyRetention({ "2026-09-01": 4, "2026-09-22": 6 }), [0, 0, 6]);
});

test("an incomplete trailing week is dropped rather than compared against full ones", () => {
  // 50 days is seven weeks and a spare day. Counting that day as an eighth
  // week would put a one-day total beside seven-day ones.
  const fifty = Object.fromEntries(Array.from({ length: 50 }, (_, day) => {
    const date = new Date(Date.UTC(2026, 7, 3) + day * 86400000).toISOString().slice(0, 10);
    return [date, 10];
  }));
  assert.deepEqual(weeklyRetention(fifty), [70, 70, 70, 70, 70, 70, 70]);
});

test("archetype depth scales mean synergy by how full the high-synergy list is", () => {
  const deep = archetypeDepthFrom({ container: { json_dict: { cardlists: [{ tag: "highsynergycards", cardviews: Array.from({ length: 8 }, () => ({ synergy: 0.5 })) }] } } });
  const shallow = archetypeDepthFrom(page);
  assert.ok(deep > shallow, "eight cards at 0.5 should beat two cards at 0.7");
  assert.equal(archetypeDepthFrom({}), undefined);
});

test("page facts pick out exactly the fields scoring and search need", () => {
  const facts = pageFacts(page);
  assert.deepEqual(facts.bracketCounts, [4, 109, 142, 11, 6]);
  assert.deepEqual(facts.themes, ["spellslinger", "unblockable", "burn"]);
  assert.deepEqual(facts.highSynergyCards, ["lightning-bolt", "brainstorm"]);
  assert.deepEqual(facts.similar, ["Kess, Dissident Mage", "Narset, Enlightened Master"]);
  assert.equal(facts.pageAsOf, "2026-09-14");
  assert.equal(facts.comboCount, undefined, "combo counts belong to the Spellbook connector, which covers every commander");
});

test("the colourless slug is special-cased, because `c` returns 403", () => {
  assert.equal(pageSlug("c"), "colorless");
  assert.equal(pageSlug("massimo-the-magician"), "massimo-the-magician");
});

test("a failed page leaves that commander's previous data intact", async () => {
  const commanders = [
    { slug: "rank-500", name: "A", popularity: { edhrecRank: 500 }, bracketCounts: [1, 2, 3, 4, 5] },
    { slug: "rank-600", name: "B", popularity: { edhrecRank: 600 }, bracketCounts: [9, 9, 9, 9, 9] }
  ];
  const result = await edhrecPagesConnector.enrichCatalog(commanders, {
    sleep: async () => {},
    pagesPerRun: 2,
    state: {},
    fetch: async (url) => String(url).includes("rank-500")
      ? { ok: true, json: async () => page }
      : { ok: false, status: 503 }
  });
  assert.deepEqual(result.commanders[0].bracketCounts, [4, 109, 142, 11, 6], "the page that succeeded refreshes");
  assert.deepEqual(result.commanders[1].bracketCounts, [9, 9, 9, 9, 9], "the page that failed keeps its previous data");
  assert.ok(result.diagnostics.some((line) => line.includes("503")));
});

test("the crawl sends no request headers, because a preflight gets a 403", async () => {
  const inits = [];
  await edhrecPagesConnector.enrichCatalog(commandersAtRanks(500), {
    sleep: async () => {},
    pagesPerRun: 1,
    state: {},
    fetch: async (url, init) => {
      inits.push(init);
      return { ok: true, json: async () => page };
    }
  });
  assert.deepEqual(inits, [undefined]);
});

test("the cursor advances to the last commander of the slice", async () => {
  const result = await edhrecPagesConnector.enrichCatalog(commandersAtRanks(500, 600, 700), {
    sleep: async () => {},
    pagesPerRun: 2,
    today: "2026-09-22",
    state: {},
    fetch: async () => ({ ok: true, json: async () => page })
  });
  assert.equal(result.state.cursor, "rank-600");
  assert.equal(result.state.lastRunAt, "2026-09-22");
});
