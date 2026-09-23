/**
 * The "have we had this already?" check, for the daily finds run.
 *
 * `docs/agents/daily-finds.md` describes a research pass whose expensive
 * mistake is re-surfacing a commander the feed has already had, or spending a
 * run on one the product will never surface. Both are answerable from files
 * already in this repository, so they are answered here rather than by a model
 * reading four datasets and doing arithmetic on a columnar encoding.
 *
 * Usage:
 *   node scripts/check-candidate.js "Massimo, the Magician" "Another Commander"
 *   node scripts/check-candidate.js --url https://example.com/a-primer
 *   node scripts/check-candidate.js --json "Massimo, the Magician"
 *
 * Read-only. It never writes the ledger; a run does that when it files.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeCommanders } from "../src/shared/catalog.js";
import { slugify } from "../src/shared/slug.js";

/** `docs/PRD.md`: meta is the baseline and is never surfaced as a find. */
const META_RANK = 500;
/** `AGENTS.md`: past 3,000 the evidence to say "this works" does not exist. */
const SURFACING_LIMIT = 3000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const urlMode = args.includes("--url");
const subjects = args.filter((value) => !value.startsWith("--"));

if (!subjects.length) {
  console.error("Usage: node scripts/check-candidate.js [--url] [--json] <commander name | source url> ...");
  process.exit(2);
}

const history = await loadHistory();
const results = subjects.map((subject) => (urlMode ? checkUrl(subject) : checkCommander(subject)));

if (asJson) console.log(JSON.stringify(results, null, 2));
else for (const result of results) console.log(render(result));

/**
 * Everything this repository already knows about what has been surfaced.
 * The published feed and the archive are the authority; the ledger adds the
 * runs' own rejections, which are nowhere else and are the reason a second run
 * does not re-chase a lead the first one already dismissed.
 */
async function loadHistory() {
  const [findings, archive, inbox, candidates, ledger] = await Promise.all([
    readJson("data/findings.json", { findings: [] }),
    readJson("data/archive.json", { archive: [] }),
    readDirectory(path.join(root, "research", "inbox")),
    readDirectory(path.join(root, "research", "candidates")),
    readJson("research/candidates/seen.json", { commanders: [], sources: [] })
  ]);
  const catalogue = decodeCommanders(await readJson("data/commanders.json", {}));
  return { findings: findings.findings ?? [], archive: archive.archive ?? [], inbox, candidates, ledger, catalogue };
}

function checkCommander(subject) {
  const slug = slugify(subject);
  const commander = history.catalogue.find((row) => row.slug === slug)
    ?? history.catalogue.find((row) => row.name.toLowerCase() === subject.toLowerCase())
    ?? history.catalogue.find((row) => row.name.toLowerCase().startsWith(`${subject.toLowerCase()},`));

  const seen = {
    findings: history.findings.filter((finding) => finding.commanders?.some((entity) => entity.slug === slug)).map((finding) => finding.id),
    archive: history.archive.find((entry) => entry.slug === slug) ?? null,
    inbox: history.inbox.filter((record) => record.commanders?.some((entity) => entity.slug === slug)).map((record) => record.id),
    candidates: history.candidates.filter((record) => record.commanders?.some((entity) => entity.slug === slug)).map((record) => record.id),
    ledger: history.ledger.commanders?.filter((entry) => entry.slug === slug) ?? []
  };

  const rank = commander?.popularity?.edhrecRank ?? null;
  return { subject, slug, commander: describe(commander), seen, verdict: verdict(commander, rank, seen) };
}

function checkUrl(subject) {
  const normalized = normalizeUrl(subject);
  const ledger = history.ledger.sources?.filter((entry) => normalizeUrl(entry.url) === normalized) ?? [];
  const published = history.findings.filter((finding) => sourceUrls(finding).some((url) => normalizeUrl(url) === normalized)).map((finding) => finding.id);
  const filed = [...history.inbox, ...history.candidates].filter((record) => sourceUrls(record).some((url) => normalizeUrl(url) === normalized)).map((record) => record.id);
  const hit = Boolean(ledger.length || published.length || filed.length);
  return {
    subject,
    url: normalized,
    seen: { ledger, findings: published, filed },
    verdict: hit
      ? { action: "SKIP", reason: `this URL has been seen before — ${ledger[0]?.status ?? "already filed"}${ledger[0]?.reason ? `: ${ledger[0].reason}` : ""}` }
      : { action: "NEW", reason: "no record of this URL" }
  };
}

/**
 * Returns the one action the run should take, so the decision is made in one
 * place rather than re-derived from the fields above at each call site.
 */
function verdict(commander, rank, seen) {
  if (!commander) return { action: "UNKNOWN", reason: "not in data/commanders.json — check the spelling, or it is newer than the last catalogue refresh" };
  if (seen.findings.length || seen.archive) return { action: "SKIP", reason: "already surfaced by the feed; the archive keeps it" };
  if (seen.inbox.length) return { action: "SKIP", reason: "already filed in research/inbox/" };
  if (seen.candidates.length) return { action: "SKIP", reason: "already proposed and awaiting review in research/candidates/" };
  if (seen.ledger.length) return { action: seen.ledger.at(-1).status === "rejected" ? "SKIP" : "REVIEW", reason: `the ledger has it: ${seen.ledger.at(-1).status}${seen.ledger.at(-1).reason ? ` — ${seen.ledger.at(-1).reason}` : ""}` };
  if (rank === null) return { action: "SKIP", reason: "no EDHREC rank, so nothing supports a quality judgement" };
  if (rank <= META_RANK) return { action: "SKIP", reason: `rank ${count(rank)} is the meta baseline, never surfaced as a find` };
  if (rank > SURFACING_LIMIT) return { action: "SKIP", reason: `rank ${count(rank)} is past the ${count(SURFACING_LIMIT)} surfacing limit` };
  return { action: "NEW", reason: `rank ${count(rank)} is inside the surfacing band and nothing has surfaced it` };
}

/** The host locale is not the reader here; ranks read as numbers, always. */
function count(value) {
  return typeof value === "number" ? value.toLocaleString("en-US") : "?";
}

function describe(commander) {
  if (!commander) return null;
  return {
    name: commander.name,
    slug: commander.slug,
    edhrecRank: commander.popularity?.edhrecRank ?? null,
    deckCount: commander.popularity?.deckCount ?? null,
    asOf: commander.popularity?.asOf ?? null,
    colorIdentity: commander.colorIdentity ?? "C",
    manaValue: commander.manaValue ?? null,
    manaCost: commander.manaCost ?? null,
    edgeScore: commander.edgeScore ?? null,
    cohortScore: commander.cohortScore ?? null,
    momentum: commander.momentum ?? null,
    themes: commander.themes ?? [],
    setCode: commander.setCode ?? null,
    releasedAt: commander.releasedAt ?? null
  };
}

function render(result) {
  const lines = [`${result.verdict.action}  ${result.subject}`];
  if (result.commander) {
    const card = result.commander;
    lines.push(`  ${card.name} · ${card.manaCost ?? `MV ${card.manaValue}`} · ${card.colorIdentity}`);
    lines.push(`  rank ${card.edhrecRank === null ? "none" : count(card.edhrecRank)} · ${count(card.deckCount)} decks (as of ${card.asOf ?? "?"}) · edge ${card.edgeScore ?? "unscored"}${card.momentum === null ? "" : ` · momentum ${card.momentum}`}`);
    if (card.themes.length) lines.push(`  themes: ${card.themes.slice(0, 6).join(", ")}`);
  }
  const seenLines = [
    result.seen.findings?.length ? `published: ${result.seen.findings.join(", ")}` : "",
    result.seen.archive ? `archived: first surfaced ${result.seen.archive.firstSurfacedAt} at rank ${result.seen.archive.popularityAtFirstSurface?.edhrecRank ?? "?"}` : "",
    result.seen.inbox?.length ? `inbox: ${result.seen.inbox.join(", ")}` : "",
    result.seen.candidates?.length ? `candidates: ${result.seen.candidates.join(", ")}` : "",
    result.seen.filed?.length ? `filed: ${result.seen.filed.join(", ")}` : "",
    result.seen.ledger?.length ? `ledger: ${result.seen.ledger.map((entry) => `${entry.status} ${entry.lastSeenAt ?? entry.firstSeenAt ?? ""}`.trim()).join("; ")}` : ""
  ].filter(Boolean);
  for (const line of seenLines) lines.push(`  ${line}`);
  lines.push(`  → ${result.verdict.reason}`);
  return lines.join("\n");
}

/** Trailing slashes, `www.` and tracking query strings are not identity. */
function normalizeUrl(value) {
  try {
    const url = new URL(String(value));
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./, "");
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value).trim().toLowerCase();
  }
}

function sourceUrls(record) {
  return [record.source?.url, ...(record.evidence?.corroboratingSources ?? []).map((source) => source.url)].filter(Boolean);
}

async function readDirectory(directory) {
  const names = await readdir(directory).catch(() => []);
  const records = [];
  for (const name of names.filter((name) => name.endsWith(".json") && name !== "seen.json").sort()) {
    try {
      const payload = JSON.parse(await readFile(path.join(directory, name), "utf8"));
      records.push(...(Array.isArray(payload) ? payload : payload.findings ?? [payload]));
    } catch {
      // An unreadable input must not take the check down with it; the run that
      // wrote it is the one that needs to hear about it, and `npm run research`
      // already reports it.
    }
  }
  return records;
}

function readJson(relative, fallback) {
  return readFile(path.join(root, relative), "utf8").then(JSON.parse).catch(() => fallback);
}
