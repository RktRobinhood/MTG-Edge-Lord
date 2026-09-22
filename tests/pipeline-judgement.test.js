import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RANK, MIN_RANK, prefilter } from "../src/pipeline/prefilter.js";
import { CONFIDENCE_FLOOR, judge, parseVerdict, toFinding } from "../src/pipeline/judge.js";
import {
  COHORT_MODEL_VERSION,
  GRADUATION_DECK_COUNT,
  applyCohortScores,
  buildCohorts,
  hasGraduated,
  isNewArrival,
  scoreCohort
} from "../src/shared/cohort-score.js";
import { createValidator } from "../src/shared/validation.js";
import { normalizeFinding } from "../src/pipeline/normalize.js";
import { readFileSync } from "node:fs";

const catalogue = [
  { name: "Massimo, the Magician", slug: "massimo", popularity: { edhrecRank: 1050, deckCount: 2200 } },
  { name: "Krenko, Mob Boss", slug: "krenko", popularity: { edhrecRank: 5, deckCount: 44161 } },
  { name: "Deep Cut", slug: "deep-cut", popularity: { edhrecRank: 5200, deckCount: 40 } }
];

const candidate = (overrides = {}) => ({
  id: "rss:1",
  title: "Massimo, the Magician spellslinger primer",
  source: { name: "EDHREC Articles", type: "article", url: "https://edhrec.com/articles/a", creator: "EDHREC", resourceDepth: "discussion" },
  publishedAt: "2026-09-20",
  observedAt: "2026-09-22",
  commanders: [{ slug: "massimo", name: "Massimo, the Magician" }],
  signal: "Spellslinger · Storm",
  ...overrides
});

// --- pre-filter -------------------------------------------------------------

test("the pre-filter keeps in-band candidates and drops the rest", () => {
  const { survivors, rejected } = prefilter([
    candidate(),
    candidate({ id: "rss:2", commanders: [{ slug: "krenko", name: "Krenko, Mob Boss" }] }),
    candidate({ id: "rss:3", commanders: [{ slug: "deep-cut", name: "Deep Cut" }] }),
    candidate({ id: "rss:4", commanders: [{ slug: "unknown", name: "Unknown" }] })
  ], catalogue);

  assert.deepEqual(survivors.map((item) => item.id), ["rss:1"]);
  assert.equal(rejected.tooPopular, 1);
  assert.equal(rejected.tooObscure, 1);
  assert.equal(rejected.noCommanderMatch, 1);
  assert.equal(MIN_RANK, 500);
  assert.equal(MAX_RANK, 3000);
});

test("a candidate covering both a meta and an off-meta commander survives on the off-meta one", () => {
  const { survivors } = prefilter([candidate({
    commanders: [{ slug: "krenko", name: "Krenko" }, { slug: "massimo", name: "Massimo" }]
  })], catalogue);
  assert.equal(survivors.length, 1);
  assert.equal(survivors[0].bestRank, 1050);
});

test("duplicate candidate ids are seen once", () => {
  const { survivors, rejected } = prefilter([candidate(), candidate()], catalogue);
  assert.equal(survivors.length, 1);
  assert.equal(rejected.duplicate, 1);
});

test("survivors are capped, so model spend has a ceiling", () => {
  const many = Array.from({ length: 200 }, (_, index) => candidate({ id: `rss:${index}` }));
  assert.equal(prefilter(many, catalogue, { limit: 10 }).survivors.length, 10);
});

// --- judgement --------------------------------------------------------------

const verdictJson = (overrides = {}) => JSON.stringify({
  isFind: true,
  confidence: 0.82,
  summary: "A brewer walks through how Massimo copies its own spells and why the deck holds up past turn six.",
  conversationDepth: "reasoned",
  communityReasoned: true,
  tested: false,
  cards: ["Lightning Bolt"],
  interaction: "Massimo copies the second spell each turn, so cheap cantrips become card advantage.",
  alternatives: [{ name: "Kess, Dissident Mage", status: "rejected", reason: "Wants graveyard recursion rather than copying." }],
  ...overrides
});

function anthropicFetch(body, { status = 200 } = {}) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ content: [{ text: body }] })
  });
}

test("no API key disables the lane without failing the run", async () => {
  const result = await judge.judgeCandidates([candidate()], { env: {} });
  assert.deepEqual(result.findings, []);
  assert.ok(result.diagnostics[0].includes("disabled"));
});

test("no model call is made on a candidate the pre-filter rejected", async () => {
  let calls = 0;
  const { survivors } = prefilter([candidate({ commanders: [{ slug: "krenko", name: "Krenko" }] })], catalogue);
  await judge.judgeCandidates(survivors, { apiKey: "k", fetch: async () => { calls += 1; return { ok: true, json: async () => ({}) }; } });
  assert.equal(calls, 0);
});

test("a judged find becomes a finding that satisfies the public schema", async () => {
  const result = await judge.judgeCandidates([candidate({ bestRank: 1050 })], { apiKey: "k", fetch: anthropicFetch(verdictJson()) });
  assert.equal(result.findings.length, 1);

  const validate = createValidator(JSON.parse(readFileSync("schema/finding.schema.json", "utf8")));
  const normalized = normalizeFinding(result.findings[0]);
  assert.equal(validate(normalized), true, JSON.stringify(validate.errors));
  assert.equal(normalized.source.url, "https://edhrec.com/articles/a");
});

test("two sources publishing the same title on the same day get distinct ids", async () => {
  const result = await judge.judgeCandidates([
    candidate({ id: "a", bestRank: 1050 }),
    candidate({ id: "b", bestRank: 1050, source: { ...candidate().source, url: "https://mtggoldfish.com/x", name: "MTGGoldfish" } })
  ], { apiKey: "k", fetch: anthropicFetch(verdictJson()) });
  assert.equal(result.findings.length, 2);
  assert.notEqual(result.findings[0].id, result.findings[1].id);
});

test("a passing mention is rejected", async () => {
  const result = await judge.judgeCandidates([candidate()], { apiKey: "k", fetch: anthropicFetch(verdictJson({ isFind: false })) });
  assert.deepEqual(result.findings, []);
  assert.ok(result.diagnostics.at(-1).includes("1 were passing mentions"));
});

test("a judgement below the confidence floor is discarded rather than published", async () => {
  const result = await judge.judgeCandidates([candidate()], { apiKey: "k", fetch: anthropicFetch(verdictJson({ confidence: CONFIDENCE_FLOOR - 0.01 })) });
  assert.deepEqual(result.findings, []);
  assert.ok(result.diagnostics.at(-1).includes("below the"));
});

test("a judgement failure degrades the lane rather than the run", async () => {
  const result = await judge.judgeCandidates([candidate(), candidate({ id: "rss:2" })], {
    apiKey: "k",
    fetch: (() => { let n = 0; return async () => { n += 1; return n === 1 ? { ok: false, status: 500 } : { ok: true, json: async () => ({ content: [{ text: verdictJson() }] }) }; }; })()
  });
  assert.equal(result.findings.length, 1);
  assert.ok(result.diagnostics.some((line) => line.includes("judgement failed")));
});

test("the verdict parser refuses invented shapes rather than trusting them", () => {
  assert.throws(() => parseVerdict("no json here"), /did not return JSON/);
  const loose = parseVerdict('{"isFind":"yes","confidence":"high","conversationDepth":"wizardry","cards":"Sol Ring"}');
  assert.equal(loose.isFind, false);
  assert.equal(loose.confidence, 0);
  assert.equal(loose.conversationDepth, "mention");
  assert.deepEqual(loose.cards, []);
});

test("a finding with no canonical https source is never built", () => {
  const verdict = parseVerdict(verdictJson());
  assert.equal(toFinding(candidate({ source: { ...candidate().source, url: "http://insecure.example" } }), verdict), null);
});

test("the model sees metadata, never an article body", async () => {
  let sent = "";
  await judge.judgeCandidates([candidate({ bestRank: 1050 })], {
    apiKey: "k",
    fetch: async (url, init) => { sent = init.body; return { ok: true, json: async () => ({ content: [{ text: verdictJson() }] }) }; }
  });
  const body = JSON.parse(sent);
  const prompt = body.messages[0].content;
  assert.ok(prompt.includes("Title:"));
  assert.ok(prompt.includes("EDHREC rank"));
  assert.equal(prompt.includes("<p>"), false);
  assert.ok(body.system.includes("EFFORT, NOT MENTION"));
});

// --- cohort scoring ---------------------------------------------------------

const cohortMembers = (count, setCode = "blb") => Array.from({ length: count }, (_, index) => ({
  name: `New Legend ${index}`,
  slug: `new-legend-${index}`,
  setCode,
  releasedAt: "2026-08-15",
  popularity: { edhrecRank: 2500 + index, deckCount: 300 - index * 8 }
}));

test("a commander is a new arrival only inside the release window", () => {
  assert.equal(isNewArrival({ releasedAt: "2026-08-15" }, "2026-09-22"), true);
  assert.equal(isNewArrival({ releasedAt: "2024-01-01" }, "2026-09-22"), false);
  assert.equal(isNewArrival({}, "2026-09-22"), false);
});

test("a commander graduates to the Edge score once it has a track record", () => {
  assert.equal(hasGraduated({ releasedAt: "2026-08-15", popularity: { deckCount: GRADUATION_DECK_COUNT } }, "2026-09-22"), true);
  assert.equal(hasGraduated({ releasedAt: "2026-08-15", popularity: { deckCount: 40 } }, "2026-09-22"), false);
});

test("a cohort too small to compare within is not scored", () => {
  const cohorts = buildCohorts(cohortMembers(3), "2026-09-22");
  assert.equal(cohorts.size, 0);
});

test("cohort position rewards the overlooked middle, not the set's high flyer", () => {
  const cohort = cohortMembers(20);
  const leader = scoreCohort(cohort[0], cohort);
  const middle = scoreCohort(cohort[12], cohort);
  assert.ok(middle.cohortScore > leader.cohortScore, `middle ${middle.cohortScore} should beat leader ${leader.cohortScore}`);
  assert.equal(middle.cohortSize, 20);
  assert.ok(middle.reasons[0].includes("of 20 new legends"));
});

test("high chatter with few builds is the sleeper; high chatter with many builds is not", () => {
  const cohort = cohortMembers(20);
  const sleeper = scoreCohort({ ...cohort[12], mentionCount: 6 }, cohort);
  const commodity = scoreCohort({ ...cohort[12], mentionCount: 6, popularity: { ...cohort[12].popularity, deckCount: 6000 } }, cohort);
  assert.ok(sleeper.components.interestToTraction > commodity.components.interestToTraction);
});

test("without a coverage signal the score degrades to cohort position alone", () => {
  const cohort = cohortMembers(20);
  const score = scoreCohort(cohort[12], cohort);
  assert.equal(score.components.interestToTraction, undefined);
  assert.equal(score.partial, true);
  assert.ok(score.reasons.some((reason) => reason.includes("No deck-tech coverage")));
});

test("a new commander is not surfaced merely for being new", () => {
  const cohort = cohortMembers(20);
  const { commanders } = applyCohortScores(cohort, "2026-09-22", { minScore: 101 });
  assert.equal(commanders.some((commander) => commander.cohortScore !== undefined), false);
});

test("cohort scores are labelled distinctly, so they cannot be read as an Edge score", () => {
  const cohort = cohortMembers(20);
  const { commanders } = applyCohortScores(cohort, "2026-09-22", { minScore: 0 });
  const scored = commanders.find((commander) => commander.cohortScore !== undefined);
  assert.equal(scored.edgeScore, undefined);
  assert.ok(scored.cohort.setCode);
  assert.ok(scored.cohort.size >= scored.cohort.position);
});

test("the cohort model version is dataset metadata, not a per-record field", () => {
  const cohort = cohortMembers(20);
  const { commanders } = applyCohortScores(cohort, "2026-09-22", { minScore: 0 });
  assert.equal("cohortModelVersion" in commanders.find((c) => c.cohortScore !== undefined), false);
  assert.equal(COHORT_MODEL_VERSION.startsWith("cohort-"), true);
});
