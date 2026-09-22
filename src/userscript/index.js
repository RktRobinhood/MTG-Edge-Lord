import { explainCohort } from "../shared/cohort-score.js";
import { explainScore, explainUnscored } from "../shared/edge-score.js";
import { loadCommanderDetail, loadData } from "./data-client.js";
import { attributableFindings, sourceLabel, truncateSummary } from "./digest.js";
import {
  COLOR_MODES,
  DEFAULT_FILTERS,
  SORTS,
  buildSearchIndex,
  filterCommanders,
  sortCommanders
} from "./search.js";
import { styles } from "./styles.js";

/** Results rendered at once. A cap on painting, never a substitute for filtering. */
const PAGE_SIZE = 60;

/** Keystrokes settle before the list is rebuilt. */
const QUERY_DEBOUNCE_MS = 140;

/** Filters outlive tab switches and EDHREC navigations within one session. */
const FILTER_STORAGE_KEY = "mtg-edge-lord:filters";

const COLORS = [
  { id: "W", label: "W" },
  { id: "U", label: "U" },
  { id: "B", label: "B" },
  { id: "R", label: "R" },
  { id: "G", label: "G" }
];

const TIERS = [
  { id: "", label: "Any tier" },
  { id: "edge", label: "Edge (1,000–3,000)" },
  { id: "rare", label: "Rare (500–1,000)" },
  { id: "meta", label: "Meta (top 500)" },
  { id: "uncharted", label: "Uncharted (3,000+)" }
];

const state = {
  tab: "search",
  filters: { ...DEFAULT_FILTERS, ...restoreFilters() },
  shown: PAGE_SIZE,
  expanded: null,
  detail: null,
  index: null,
  data: null,
  loading: true,
  error: null
};

let queryTimer = null;

const host = document.createElement("div");
host.id = "mtg-edge-lord-root";
const shadow = host.attachShadow({ mode: "open" });
document.body.append(host);
renderShell();
refresh();

function renderShell() {
  shadow.innerHTML = `<style>${styles}</style>
    <button id="toggle" type="button" aria-label="Open MTG Edge Lord">EL</button>
    <section id="panel" aria-label="MTG Edge Lord" hidden>
      <header>
        <div><strong>MTG Edge Lord</strong><span id="status">Loading…</span></div>
        <a href="https://github.com/RktRobinhood/MTG-Edge-Lord" target="_blank" rel="noopener noreferrer">About</a>
      </header>
      <nav>${tabButton("search", "Search")}${tabButton("discover", "Recent finds")}${tabButton("card", "Card-first")}</nav>
      <main></main>
    </section>`;

  shadow.getElementById("toggle").addEventListener("click", () => {
    const panel = shadow.getElementById("panel");
    panel.hidden = !panel.hidden;
  });

  shadow.querySelector("nav").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    state.tab = button.dataset.tab;
    state.shown = PAGE_SIZE;
    render();
  });
}

async function refresh() {
  try {
    state.data = await loadData();
    state.index = buildSearchIndex(state.data.commanders.commanders);
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

// --- rendering --------------------------------------------------------------
//
// `render` rebuilds the controls; `renderResults` rebuilds only the list. They
// are separate because rebuilding the controls on every keystroke would throw
// away focus and the caret position in the search box.

function render() {
  shadow.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === state.tab));
  shadow.getElementById("status").textContent = statusText();

  const main = shadow.querySelector("main");
  if (state.loading) return void (main.innerHTML = `<div class="empty">Loading…</div>`);
  if (state.error) return void (main.innerHTML = `<div class="empty">${escapeHtml(state.error)}</div>`);

  main.innerHTML = `
    ${state.data.stale ? `<div class="notice">Live data could not be reached. Showing the last cached version.</div>` : ""}
    ${state.tab === "search" ? searchControls() : simpleControls()}
    <div class="summary" id="result-summary"></div>
    <div class="stack" id="results"></div>`;

  bindControls(main);
  renderResults();
}

function statusText() {
  if (!state.data) return "Discovery data unavailable";
  const count = state.index?.commanders.length ?? 0;
  return `${count.toLocaleString()} commanders · ${state.data.manifest.dataVersion}${state.data.stale ? " · cached" : ""}`;
}

function bindControls(main) {
  main.querySelectorAll("[data-field]").forEach((control) => {
    const event = control.tagName === "SELECT" || control.type === "checkbox" ? "change" : "input";
    control.addEventListener(event, () => {
      const value = control.type === "checkbox" ? control.checked : control.value;
      state.filters[control.dataset.field] = value;
      state.shown = PAGE_SIZE;
      persistFilters();
      if (event === "input") debounceResults(); else renderResults();
    });
  });

  main.querySelectorAll("[data-color]").forEach((button) => button.addEventListener("click", () => {
    const color = button.dataset.color;
    const colors = state.filters.colors.includes(color)
      ? state.filters.colors.filter((item) => item !== color)
      : [...state.filters.colors, color];
    state.filters.colors = colors;
    button.classList.toggle("on", colors.includes(color));
    state.shown = PAGE_SIZE;
    persistFilters();
    renderResults();
  }));

  main.querySelector("#reset")?.addEventListener("click", () => {
    state.filters = { ...DEFAULT_FILTERS };
    state.shown = PAGE_SIZE;
    persistFilters();
    render();
  });
}

function debounceResults() {
  clearTimeout(queryTimer);
  queryTimer = setTimeout(renderResults, QUERY_DEBOUNCE_MS);
}

function renderResults() {
  const results = shadow.getElementById("results");
  const summary = shadow.getElementById("result-summary");
  if (!results) return;

  if (state.tab === "discover") {
    const findings = attributableFindings(state.data.findings.findings)
      .filter((finding) => matchesText(`${finding.title} ${finding.summary}`, state.filters.query))
      .sort((a, b) => b.score.total - a.score.total);
    summary.textContent = `${findings.length} find${findings.length === 1 ? "" : "s"}`;
    results.innerHTML = findings.slice(0, state.shown).map(findingCard).join("") || empty("No finds match that search yet.");
    return bindResults(results);
  }

  if (state.tab === "card") {
    const cards = state.data.cards.cards.filter((card) => matchesText(card.name, state.filters.query));
    summary.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
    results.innerHTML = cards.slice(0, state.shown).map(hiddenCard).join("") || empty("No cards match that search yet.");
    return bindResults(results);
  }

  const matched = sortCommanders(filterCommanders(state.index, state.filters), state.filters.sort);
  const scored = matched.filter((commander) => commander.edgeScore !== undefined).length;
  summary.innerHTML = `<strong>${matched.length.toLocaleString()}</strong> commanders · ${scored.toLocaleString()} scored · sorted by ${escapeHtml(sortLabel(state.filters.sort))}`;
  results.innerHTML = matched.slice(0, state.shown).map(commanderCard).join("")
    || empty("Nothing matches those filters. Widen the rank band or clear a colour.");
  if (matched.length > state.shown) {
    results.insertAdjacentHTML("beforeend", `<button class="more" id="more" type="button">Show ${Math.min(PAGE_SIZE, matched.length - state.shown)} more of ${(matched.length - state.shown).toLocaleString()}</button>`);
  }
  bindResults(results);
}

function bindResults(results) {
  results.querySelector("#more")?.addEventListener("click", () => {
    state.shown += PAGE_SIZE;
    renderResults();
  });
  results.querySelectorAll("[data-expand]").forEach((button) => button.addEventListener("click", async () => {
    const slug = button.dataset.expand;
    state.expanded = state.expanded === slug ? null : slug;
    if (state.expanded && !state.detail) {
      state.detail = await loadCommanderDetail(state.data.manifest.dataVersion);
    }
    renderResults();
  }));
}

// --- controls ---------------------------------------------------------------

function searchControls() {
  const filters = state.filters;
  return `<div class="controls">
    <input class="query" data-field="query" value="${escapeAttr(filters.query)}" placeholder="Name, theme, mechanic, creature type" aria-label="Search">
    <div class="row colors">
      <span class="label">Colour identity</span>
      ${COLORS.map((color) => `<button type="button" class="pip ${filters.colors.includes(color.id) ? "on" : ""}" data-color="${color.id}" aria-label="${color.label}">${color.label}</button>`).join("")}
      <select data-field="colorMode" aria-label="Colour matching">${options(COLOR_MODES.map((mode) => [mode.id, mode.label]), filters.colorMode)}</select>
    </div>
    <div class="row">
      <span class="label">Rank band</span>
      <input type="number" min="1" data-field="minRank" value="${escapeAttr(filters.minRank)}" placeholder="1000">
      <span class="to">to</span>
      <input type="number" min="1" data-field="maxRank" value="${escapeAttr(filters.maxRank)}" placeholder="3000">
      <select data-field="tier" aria-label="Tier">${options(TIERS.map((tier) => [tier.id, tier.label]), filters.tier)}</select>
    </div>
    <div class="row">
      <span class="label">Mana value</span>
      <input type="number" min="0" data-field="minManaValue" value="${escapeAttr(filters.minManaValue)}" placeholder="0">
      <span class="to">to</span>
      <input type="number" min="0" data-field="maxManaValue" value="${escapeAttr(filters.maxManaValue)}" placeholder="9">
      <span class="label">Max $</span>
      <input type="number" min="0" step="0.5" data-field="maxPrice" value="${escapeAttr(filters.maxPrice)}" placeholder="any">
    </div>
    <div class="row">
      <select data-field="theme" aria-label="Theme">${options([["", "Any theme"], ...state.index.themes.map((theme) => [theme, titleCase(theme)])], filters.theme)}</select>
      <select data-field="functionalTag" aria-label="Mechanic">${options([["", "Any mechanic"], ...state.index.functionalTags.map((tag) => [tag, titleCase(tag)])], filters.functionalTag)}</select>
      <select data-field="creatureType" aria-label="Creature type">${options([["", "Any creature type"], ...state.index.creatureTypes.map((type) => [type, type])], filters.creatureType)}</select>
    </div>
    <div class="row">
      <span class="label">Bracket fit at least</span>
      <select data-field="minBracketFit" aria-label="Bracket fit">${options([["", "Any"], ["0.4", "40%"], ["0.55", "55%"], ["0.7", "70%"]], filters.minBracketFit)}</select>
      <span class="label">Released after</span>
      <input type="date" data-field="releasedAfter" value="${escapeAttr(filters.releasedAfter)}">
    </div>
    <div class="row">
      <label class="check"><input type="checkbox" data-field="scoredOnly" ${filters.scoredOnly ? "checked" : ""}> Scored only</label>
      <select data-field="sort" aria-label="Sort">${options(SORTS.map((sort) => [sort.id, sort.label]), filters.sort)}</select>
      <button type="button" id="reset" class="reset">Reset</button>
    </div>
  </div>`;
}

function simpleControls() {
  return `<div class="controls"><input class="query" data-field="query" value="${escapeAttr(state.filters.query)}" placeholder="Search" aria-label="Search"></div>`;
}

// --- cards ------------------------------------------------------------------

function commanderCard(commander) {
  const rank = commander.popularity?.edhrecRank;
  const decks = commander.popularity?.deckCount;
  const expanded = state.expanded === commander.slug;

  return `<article class="card">
    <div class="meta">
      ${scoreBadge(commander)}
      <span class="tier ${commander.tier ?? ""}">${escapeHtml(commander.tier ?? "unranked")}</span>
      ${commander.colorIdentity !== undefined ? `<span class="chip">${escapeHtml(commander.colorIdentity || "Colourless")}</span>` : ""}
      ${Number.isFinite(commander.manaValue) ? `<span class="chip">MV ${commander.manaValue}</span>` : ""}
      ${commander.price !== undefined ? `<span class="chip">$${commander.price.toFixed(2)}</span>` : ""}
      <span class="muted">#${rank?.toLocaleString() ?? "—"} · ${decks?.toLocaleString() ?? "—"} decks</span>
    </div>
    <h3>${escapeHtml(commander.name)}</h3>
    ${reasonsFor(commander)}
    ${qualityBar(commander)}
    <div class="chips">${(commander.themes ?? []).slice(0, 5).map((theme) => `<span class="chip">${escapeHtml(titleCase(theme))}</span>`).join("")}</div>
    ${resourcesFor(commander.findingIds)}
    <div class="row actions">
      <a href="https://edhrec.com/commanders/${encodeURIComponent(commander.slug)}" target="_blank" rel="noopener noreferrer">Open on EDHREC ↗</a>
      <button type="button" class="link" data-expand="${escapeAttr(commander.slug)}">${expanded ? "Hide detail" : "Why it works"}</button>
    </div>
    ${expanded ? commanderDetail(commander) : ""}
  </article>`;
}

/**
 * The Edge score, or a cohort score for a new arrival, or a dash. Never a
 * zero standing in for "we don't know".
 */
function scoreBadge(commander) {
  if (commander.edgeScore !== undefined) return `<span class="score">${commander.edgeScore}</span>`;
  if (commander.cohortScore !== undefined) return `<span class="score cohort" title="Scored against its set cohort, not the whole format">${commander.cohortScore}<small>new</small></span>`;
  return `<span class="score none" title="Not enough evidence to score">—</span>`;
}

/**
 * Why this commander scored what it did. A commander with no score says so
 * in words rather than showing a zero.
 */
function reasonsFor(commander) {
  if (commander.cohortScore !== undefined) {
    return `<p class="cohort-note">New arrival — scored against its ${escapeHtml(String(commander.cohort?.setCode ?? "").toUpperCase())} set cohort, not the whole format.</p>
      <ul class="why">${explainCohort(commander).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`;
  }
  if (commander.unscored) {
    return `<p class="insufficient">Insufficient data — ${escapeHtml(explainUnscored(commander))}</p>`;
  }
  return `<ul class="why">${explainScore(commander).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`;
}

function qualityBar(commander) {
  const quality = commander.quality;
  if (!quality) return "";
  const parts = [
    ["Bracket fit", quality.bracketFit],
    ["Archetype depth", quality.archetypeDepth],
    ["Retention", quality.retention]
  ].filter(([, value]) => value !== undefined);
  if (!parts.length) return "";
  return `<div class="chips">${parts.map(([label, value]) => `<span class="chip quality">${label} ${Math.round(value * 100)}%</span>`).join("")}${commander.partialScore ? `<span class="chip muted">partial</span>` : ""}</div>`;
}

function commanderDetail(commander) {
  const detail = state.detail?.[commander.slug];
  if (!detail) return `<div class="detail">No per-commander detail has been collected yet.</div>`;
  return `<div class="detail">
    ${detail.highSynergyCards?.length ? `<p class="label">Cards that want to be here</p><div class="chips">${detail.highSynergyCards.map((slug) => `<a class="chip" href="https://edhrec.com/cards/${encodeURIComponent(slug)}" target="_blank" rel="noopener noreferrer">${escapeHtml(titleCase(slug))}</a>`).join("")}</div>` : ""}
    ${detail.similar?.length ? `<p class="label">Plays like</p><div class="chips">${detail.similar.map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join("")}</div>` : ""}
    ${commander.comboCount ? `<p class="muted">${commander.comboCount} known combo line${commander.comboCount === 1 ? "" : "s"} — shown, never scored.</p>` : ""}
  </div>`;
}

/**
 * A finding card is a digest. The source is credited above the summary, the
 * whole card links out, and the summary is capped so it cannot grow into a
 * replacement for the original.
 */
function findingCard(finding) {
  const entities = [...finding.commanders, ...finding.cards].map((item) => `<span class="chip">${escapeHtml(item.name)}</span>`).join("");
  return `<a class="card digest" href="${escapeAttr(finding.source.url)}" target="_blank" rel="noopener noreferrer">
    <div class="credit">
      <span class="source">${escapeHtml(sourceLabel(finding.source))}</span>
      <span class="muted">${escapeHtml(finding.publishedAt)}${finding.observedAt ? ` · found ${escapeHtml(finding.observedAt.slice(0, 10))}` : ""}</span>
    </div>
    <h3>${escapeHtml(finding.title)}</h3>
    <p class="clamp">${escapeHtml(truncateSummary(finding.summary))}</p>
    <div class="chips">${entities}</div>
    <span class="readon">Read it at ${escapeHtml(sourceLabel(finding.source))} ↗</span>
  </a>`;
}

function hiddenCard(card) {
  const commanders = card.commanders.map((commander) => `<a class="chip" href="https://edhrec.com/commanders/${encodeURIComponent(commander.slug)}" target="_blank" rel="noopener noreferrer">${escapeHtml(commander.name)} · ${commander.relationshipScore}</a>`).join("");
  return `<article class="card"><h3>${escapeHtml(card.name)}</h3><div class="chips">${commanders}</div>${resourcesFor(card.findingIds)}</article>`;
}

function resourcesFor(findingIds = []) {
  const ids = new Set(findingIds);
  const resources = (state.data.resources.resources ?? [])
    .filter((resource) => ids.has(resource.findingId) && typeof resource.url === "string" && resource.url.startsWith("https://"))
    .slice(0, 3);
  if (!resources.length) return "";
  return `<p class="sources">${resources.map((resource) => `<a href="${escapeAttr(resource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.creator)} · ${label(resource.resourceDepth)} ↗</a>`).join(" · ")}</p>`;
}

// --- helpers ----------------------------------------------------------------

function matchesText(text, query) {
  const trimmed = String(query ?? "").trim().toLowerCase();
  return !trimmed || String(text).toLowerCase().includes(trimmed);
}

function persistFilters() {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state.filters));
  } catch {
    // Filters are a convenience. Losing them is not worth an error.
  }
}

function restoreFilters() {
  try {
    return JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function sortLabel(id) {
  return SORTS.find((sort) => sort.id === id)?.label ?? SORTS[0].label;
}

function titleCase(value) {
  return String(value).replaceAll("-", " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function options(pairs, selected) {
  return pairs.map(([value, text]) => `<option value="${escapeAttr(value)}" ${String(selected) === String(value) ? "selected" : ""}>${escapeHtml(text)}</option>`).join("");
}

function tabButton(id, text) { return `<button type="button" data-tab="${id}" class="${state.tab === id ? "active" : ""}">${text}</button>`; }
function label(value) { return escapeHtml(String(value).replaceAll("_", " ")); }
function empty(message) { return `<div class="empty">${escapeHtml(message)}</div>`; }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = String(value); return node.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replaceAll('"', "&quot;"); }
