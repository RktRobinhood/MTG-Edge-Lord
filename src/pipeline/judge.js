import { slugify } from "../shared/slug.js";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const API_VERSION = "2023-06-01";

/**
 * Judgements below this confidence are discarded rather than published.
 * A model that is unsure produces exactly the confidently-worded nonsense
 * `AGENTS.md` warns about, so the floor is deliberately high.
 */
export const CONFIDENCE_FLOOR = 0.6;

/** Candidates judged per run, after the pre-filter has already cut the set. */
export const MAX_JUDGEMENTS = 40;

const SYSTEM_PROMPT = `You judge whether a community signal about a Magic: The Gathering Commander is genuine brewing effort or a passing mention.

The distinction that matters is EFFORT, NOT MENTION. Genuine effort looks like: a primer, an explanation of a mechanical interaction, a report of games played, a considered deck tech. A passing mention looks like: a name in a list, a set review, a top-10 roundup, a commander named only as an example.

You are given metadata only: a title, a source, and a few tags or counts. You do NOT have the article body. Judge on what you are given and say so in your confidence. If the metadata does not establish effort, it is a mention.

Reply with a single JSON object and nothing else:
{
  "isFind": boolean,
  "confidence": number between 0 and 1,
  "summary": "2-3 sentences in your own words, under 400 characters, describing what a reader would get by following the link. Never reproduce the source's prose.",
  "conversationDepth": "mention" | "reasoned" | "tested" | "maintained" | "validated",
  "communityReasoned": boolean,
  "tested": boolean,
  "cards": ["card names explicitly named in the metadata, or an empty array"],
  "interaction": "one sentence on the mechanical interaction, or an empty string",
  "alternatives": [{ "name": "...", "status": "supporting" | "rejected", "reason": "..." }]
}

Never invent cards, results or claims that the metadata does not support. An empty array is always better than a guess.`;

/**
 * The semantic half of finding selection.
 *
 * `docs/PRD.md` sets the bar: random mentions do not become findings. That
 * distinction cannot be made by upvote counts or keyword frequency — it needs
 * reading — so a model reads the candidates the pre-filter kept.
 *
 * **Non-deterministic.** Two runs can disagree, so generated-data diffs must
 * be reviewed before they are trusted, and every finding keeps a prominent
 * canonical link so a reader can check the model's work. The daily workflow
 * enforces this by opening a PR for feed changes rather than auto-committing.
 *
 * **Compliance.** Never pass content from a source whose terms forbid it.
 * Only connector metadata reaches the model here — titles, tags and counts —
 * never an article body, a decklist or a primer's prose.
 */
export const judge = {
  id: "judge",

  async judgeCandidates(candidates, context) {
    const apiKey = context.apiKey ?? context.env?.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // An absent key disables the lane. It never fails the run.
      return { findings: [], diagnostics: ["No ANTHROPIC_API_KEY; the judgement lane is disabled for this run."] };
    }

    const diagnostics = [];
    const findings = [];
    let rejected = 0;
    let lowConfidence = 0;
    let failures = 0;

    for (const candidate of candidates.slice(0, context.maxJudgements ?? MAX_JUDGEMENTS)) {
      try {
        const verdict = await ask(candidate, apiKey, context);
        if (!verdict.isFind) {
          rejected += 1;
          continue;
        }
        if (!(verdict.confidence >= (context.confidenceFloor ?? CONFIDENCE_FLOOR))) {
          lowConfidence += 1;
          continue;
        }
        const finding = toFinding(candidate, verdict, context);
        if (finding) findings.push(finding);
      } catch (error) {
        // A judgement failure degrades this lane only.
        failures += 1;
        diagnostics.push(`${candidate.id}: judgement failed — ${error.message}`);
      }
    }

    diagnostics.push(`Judged ${candidates.length} candidate(s): ${findings.length} published, ${rejected} were passing mentions, ${lowConfidence} below the ${context.confidenceFloor ?? CONFIDENCE_FLOOR} confidence floor, ${failures} errored.`);
    return { findings, diagnostics };
  }
};

async function ask(candidate, apiKey, context) {
  const response = await (context.fetch ?? fetch)(MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION
    },
    body: JSON.stringify({
      model: context.model ?? MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: describe(candidate) }]
    })
  });
  if (!response.ok) throw new Error(`Anthropic request failed: HTTP ${response.status}`);
  const payload = await response.json();
  return parseVerdict(payload.content?.map((block) => block.text ?? "").join("") ?? "");
}

/** Metadata only. Nothing here is the creator's prose. */
function describe(candidate) {
  const lines = [
    `Source: ${candidate.source.name} (${candidate.source.type})`,
    `Creator: ${candidate.source.creator}`,
    `Title: ${candidate.title}`,
    `Published: ${candidate.publishedAt}`,
    `Commanders named: ${candidate.commanders.map((entity) => entity.name).join(", ")}`,
    `EDHREC rank of the most obscure: ${candidate.bestRank ?? "unknown"}`
  ];
  if (candidate.signal) lines.push(`Tags and metadata: ${candidate.signal}`);
  if (candidate.metrics) lines.push(`Metrics: ${JSON.stringify(candidate.metrics)}`);
  return lines.join("\n");
}

export function parseVerdict(text) {
  const match = /\{[\s\S]*\}/.exec(String(text));
  if (!match) throw new Error("the model did not return JSON");
  const verdict = JSON.parse(match[0]);
  return {
    isFind: verdict.isFind === true,
    confidence: Number(verdict.confidence) || 0,
    summary: String(verdict.summary ?? "").trim(),
    conversationDepth: ["mention", "reasoned", "tested", "maintained", "validated"].includes(verdict.conversationDepth) ? verdict.conversationDepth : "mention",
    communityReasoned: verdict.communityReasoned === true,
    tested: verdict.tested === true,
    cards: Array.isArray(verdict.cards) ? verdict.cards.filter((name) => typeof name === "string" && name.trim()).slice(0, 8) : [],
    interaction: String(verdict.interaction ?? "").trim(),
    alternatives: Array.isArray(verdict.alternatives)
      ? verdict.alternatives
        .filter((item) => item?.name && ["supporting", "rejected"].includes(item.status))
        .slice(0, 4)
        .map((item) => ({ name: String(item.name), status: item.status, reason: String(item.reason ?? "").slice(0, 280) }))
      : []
  };
}

/**
 * Builds a finding in the shape `schema/finding.schema.json` already
 * describes. Returns `null` rather than a half-formed finding when the model
 * gives too little to publish.
 */
export function toFinding(candidate, verdict, context = {}) {
  const summary = verdict.summary.slice(0, 700);
  if (summary.length < 20) return null;
  if (!/^https:\/\//.test(candidate.source.url ?? "")) return null;

  const notes = [
    verdict.interaction,
    `Judged from source metadata by ${context.model ?? MODEL} at confidence ${verdict.confidence.toFixed(2)}; follow the link to check it.`
  ].filter(Boolean).map((note) => note.slice(0, 280));

  return {
    id: `${slugify(candidate.title).slice(0, 60) || "finding"}-${candidate.publishedAt}`,
    findingType: verdict.tested ? "emerging_brew" : "discovery_signal",
    title: candidate.title.slice(0, 140),
    summary,
    source: candidate.source,
    publishedAt: candidate.publishedAt,
    observedAt: `${candidate.observedAt}T00:00:00.000Z`,
    commanders: candidate.commanders,
    cards: verdict.cards.map((name) => ({ name, slug: slugify(name) })),
    evidence: {
      strength: Math.min(1, verdict.confidence),
      independentSourceCount: 1,
      conversationDepth: verdict.conversationDepth,
      communityReasoned: verdict.communityReasoned,
      tested: verdict.tested,
      notes,
      ...(verdict.alternatives.length ? { alternatives: verdict.alternatives } : {})
    },
    tags: ["judged", slugify(candidate.source.name)].filter(Boolean)
  };
}
