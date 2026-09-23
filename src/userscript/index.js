import { explainCohort } from "../shared/cohort-score.js";
import { explainScore, explainUnscored } from "../shared/edge-score.js";
import { syncCommanderInsight } from "./commander-page.js";
import { loadCommanderDetail, loadData } from "./data-client.js";
import { manaCostHtml } from "./mana.js";
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

const panelHost = document.createElement("div");
panelHost.id = "mtg-edge-lord-root";
const shadow = panelHost.attachShadow({ mode: "open" });

/**
 * The opener lives in EDHREC's own navbar, so it gets its own host and its own
 * shadow root: the panel stays a fixed overlay on `body`, where nothing in the
 * page's layout can clip it, while the button is free to sit inside an element
 * we do not control.
 */
const buttonHost = document.createElement("div");
buttonHost.id = "mtg-edge-lord-button";
const buttonShadow = buttonHost.attachShadow({ mode: "open" });

document.body.append(panelHost);
renderShell();
mountButton();
watchNavbar();
refresh();

function renderShell() {
  buttonShadow.innerHTML = `<style>${styles}</style>
    <button id="toggle" type="button" aria-expanded="false" aria-label="MTG Edge Lord advanced search">Advanced</button>`;

  shadow.innerHTML = `<style>${styles}</style>
    <section id="panel" aria-label="MTG Edge Lord" hidden>
      <header>
        <div><strong>MTG Edge Lord</strong><span id="status">Loading…</span></div>
        <a href="https://github.com/RktRobinhood/MTG-Edge-Lord" target="_blank" rel="noopener noreferrer">About</a>
      </header>
      <nav>${tabButton("search", "Search")}${tabButton("discover", "Recent finds")}${tabButton("card", "Card-first")}${tabButton("archive", "Archive")}</nav>
      <main></main>
    </section>`;

  buttonShadow.getElementById("toggle").addEventListener("click", togglePanel);

  shadow.querySelector("nav").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    state.tab = button.dataset.tab;
    state.shown = PAGE_SIZE;
    render();
  });
}

// --- placement --------------------------------------------------------------
//
// The opener sits in EDHREC's navbar, between its search box and its account
// buttons, and the panel falls from underneath it. EDHREC is the host, so
// every selector here is a guess that has to be allowed to fail: the fallback
// is a floating button, never a missing one.

/**
 * EDHREC's own navbar search box.
 *
 * The class names are hashed per build (`Navbar_search___AXHe`), so they are a
 * hint rather than a contract. What holds across builds is that the navbar
 * carries a labelled search input inside a Bootstrap input group. The narrow
 * layout keeps a second, hidden copy of that search box, so a candidate only
 * counts once it has been laid out.
 */
function navbarSearchGroup() {
  for (const input of document.querySelectorAll(`header nav input[aria-label="Search"], header nav input.rbt-input-main`)) {
    const group = input.closest(`[class*="Navbar_search"], .input-group`);
    if (group?.getBoundingClientRect().width) return group;
  }
  return null;
}

/**
 * Put the button after EDHREC's search box, or fall back to floating it.
 *
 * Idempotent, because it runs again on every navbar mutation: if the button is
 * already in place this changes nothing, which is also what keeps the observer
 * from re-triggering itself.
 */
function mountButton() {
  const group = navbarSearchGroup();
  if (group) {
    buttonHost.classList.remove("floating");
    if (buttonHost.previousElementSibling !== group) group.after(buttonHost);
    return;
  }
  // Narrow viewport, or a navbar we no longer recognise. Either way the
  // product still has to be reachable, so it floats rather than disappears.
  buttonHost.classList.add("floating");
  if (buttonHost.parentElement !== document.body) document.body.append(buttonHost);
}

/**
 * EDHREC is a client-routed app, so its navbar can be replaced under us and
 * take the button with it. Re-mounting is cheap and re-mounting in place is
 * free, so the cure for both a re-render and a breakpoint change is the same.
 */
function watchNavbar() {
  let pending = null;
  const remount = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      mountButton();
      syncCommanderInsight(state.index?.commanders);
      if (!shadow.getElementById("panel").hidden) positionPanel();
    }, 100);
  };
  new MutationObserver(remount).observe(document.body, { childList: true, subtree: true });
  addEventListener("resize", remount);
}

function togglePanel() {
  const panel = shadow.getElementById("panel");
  const opening = panel.hidden;
  if (opening) positionPanel();
  panel.hidden = !opening;
  const toggle = buttonShadow.getElementById("toggle");
  toggle.setAttribute("aria-expanded", String(opening));
  toggle.classList.toggle("on", opening);
}

/**
 * Hang the panel off the button. Positioning is written as custom properties
 * rather than `top`/`right` so the narrow-screen rules, which take the panel
 * full-bleed, can still win against what we set inline here.
 */
function positionPanel() {
  const panel = shadow.getElementById("panel");
  const rect = buttonHost.getBoundingClientRect();
  const anchored = !buttonHost.classList.contains("floating");
  panel.style.setProperty("--mel-top", `${anchored ? Math.round(rect.bottom) + 8 : 14}px`);
  panel.style.setProperty("--mel-right", `${anchored ? Math.max(8, Math.round(innerWidth - rect.right)) : 14}px`);
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
    syncCommanderInsight(state.index?.commanders);
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

  // A card is its own link out. The listener lives on `main`, which is rebuilt
  // by every `render`, so it is never bound twice to the same element — and it
  // stands aside for anything that is already interactive, so the `?` toggle
  // and the credited source links keep their own behaviour.
  main.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input, select, label")) return;
    const card = event.target.closest("[data-open]");
    if (card) open(card.dataset.open, "_blank", "noopener");
  });

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

  if (state.tab === "archive") {
    const archived = (state.data.archive?.archive ?? [])
      .filter((entry) => matchesText(entry.name, state.filters.query));
    summary.textContent = archived.length
      ? `${archived.length} commander${archived.length === 1 ? "" : "s"} surfaced to date`
      : "Nothing surfaced yet";
    results.innerHTML = archived.slice(0, state.shown).map(archiveCard).join("")
      || empty("No commander has been surfaced under that name yet.");
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

/**
 * One commander, at a glance.
 *
 * The card carries what decides whether to look further — name, what it costs,
 * the verdict, how obscure it is, what it plays like — and nothing else. The
 * reasoning behind the verdict is a click away under the `?`, because a wall
 * of justification on every row is how a list stops being readable.
 *
 * The whole card opens EDHREC. An "Open on EDHREC" button said out loud what
 * the card was already going to do, and cost a row to say it.
 */
function commanderCard(commander) {
  const expanded = state.expanded === commander.slug;
  const url = commanderUrl(commander.slug);
  const themes = (commander.themes ?? []).slice(0, 3);
  return `<article class="card commander" data-open="${escapeAttr(url)}">
    <div class="head">
      <h3><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(commander.name)}</a></h3>
      ${costOf(commander)}
    </div>
    <div class="line">
      ${scoreBadge(commander)}
      ${commander.tier ? `<span class="tier ${escapeAttr(commander.tier)}">${escapeHtml(commander.tier)}</span>` : ""}
      <span class="muted">${escapeHtml(factLine(commander))}</span>
    </div>
    ${resourcesFor(commander.findingIds)}
    <div class="foot">
      <div class="chips">${themes.map((theme) => `<span class="chip">${escapeHtml(titleCase(theme))}</span>`).join("")}</div>
      <button type="button" class="why-toggle${expanded ? " on" : ""}" data-expand="${escapeAttr(commander.slug)}" aria-expanded="${expanded}" aria-label="Why it works" title="Why it works">?</button>
    </div>
    ${expanded ? whyItWorks(commander) : ""}
  </article>`;
}

function commanderUrl(slug) {
  return `https://edhrec.com/commanders/${encodeURIComponent(slug)}`;
}

/**
 * The printed cost, in symbols. A commander whose card facts never arrived —
 * a partner pairing has no single card — falls back to its colour identity,
 * which is the most the catalogue knows about what it costs to cast.
 */
function costOf(commander) {
  const cost = manaCostHtml(commander.manaCost);
  if (cost) return cost;
  if (commander.colorIdentity === undefined) return "";
  return `<span class="chip">${escapeHtml(commander.colorIdentity || "Colourless")}</span>`;
}

/** Rank, decks, price: the three numbers the eye actually uses to triage. */
function factLine(commander) {
  const rank = commander.popularity?.edhrecRank;
  const decks = commander.popularity?.deckCount;
  return [
    rank ? `#${rank.toLocaleString()}` : null,
    decks ? `${decks.toLocaleString()} decks` : null,
    commander.price !== undefined ? `$${commander.price.toFixed(2)}` : null
  ].filter(Boolean).join(" · ");
}

/** Everything the card deliberately does not say until it is asked. */
function whyItWorks(commander) {
  return `<div class="detail">
    ${reasonsFor(commander)}
    ${qualityBar(commander)}
    ${commanderDetail(commander)}
  </div>`;
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
 *
 * The branch is on the **absence of a score**, not on the `unscored` flag.
 * A backend mid-deploy can serve a record with neither, and explaining a
 * score that is not there would print "the evidence is weak" about a
 * commander nobody has evaluated.
 */
function reasonsFor(commander) {
  if (commander.cohortScore !== undefined) {
    return `<p class="cohort-note">New arrival — scored against its ${escapeHtml(String(commander.cohort?.setCode ?? "").toUpperCase())} set cohort, not the whole format.</p>
      <ul class="why">${explainCohort(commander).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`;
  }
  if (commander.edgeScore === undefined) {
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
  if (!detail) return "";
  return `<div class="more-detail">
    ${detail.highSynergyCards?.length ? `<p class="label">Cards that want to be here</p><div class="chips">${detail.highSynergyCards.map((slug) => `<a class="chip" href="https://edhrec.com/cards/${encodeURIComponent(slug)}" target="_blank" rel="noopener noreferrer">${escapeHtml(titleCase(slug))}</a>`).join("")}</div>` : ""}
    ${detail.similar?.length ? `<p class="label">Plays like</p><div class="chips">${detail.similar.map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join("")}</div>` : ""}
    ${commander.comboCount && commander.comboUrl
      ? `<p class="muted"><a href="${escapeAttr(commander.comboUrl)}" target="_blank" rel="noopener noreferrer">${commander.comboCount} known combo line${commander.comboCount === 1 ? "" : "s"} on Commander Spellbook ↗</a> — shown, never scored.</p>`
      : ""}
    ${cedhListing(commander)}
    ${commander.dedicatedCommunity
      ? `<p class="muted"><a href="${escapeAttr(commander.dedicatedCommunity.url)}" target="_blank" rel="noopener noreferrer">Has a dedicated community ↗</a> — via ${escapeHtml(commander.dedicatedCommunity.source)}.</p>`
      : ""}
  </div>`;
}

/**
 * A finding card is a digest. The source is credited above the summary, the
 * whole card links out, and the summary is capped so it cannot grow into a
 * replacement for the original.
 */
/**
 * Which list the cEDH Decklist Database keeps this commander on.
 *
 * **Shown, never scored** — the same rule as combo presence, for the same
 * reason: presence on a cEDH database correlates with cEDH, and scoring it
 * would pull recommendations back toward the meta this product exists to
 * escape. The Brewer's Corner is nonetheless the most interesting line here,
 * because it is where the database puts a commander that does not fit any
 * archetype it already tracks.
 */
function cedhListing(commander) {
  const listing = commander.cedhListing;
  if (!listing?.sourceUrl) return "";
  const label = {
    brew: "In the Brewer's Corner",
    competitive: "Listed as an established competitive deck",
    outdated: "Listed, but its entry is marked outdated"
  }[listing.section];
  if (!label) return "";
  const seen = listing.updatedAt ? ` · entry updated ${escapeHtml(listing.updatedAt.slice(0, 10))}` : "";
  return `<p class="muted"><a href="${escapeAttr(listing.sourceUrl)}" target="_blank" rel="noopener noreferrer">${label} on the cEDH Decklist Database ↗</a>${seen} — shown, never scored.</p>`;
}

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

/**
 * One commander the feed has surfaced, and when.
 *
 * The rank shown is the one recorded the day it was first surfaced, not the
 * rank now. A commander that was 2,400 when we found it and is 700 today is
 * the archive earning its keep, so the card says "when found" rather than
 * quietly showing a number that has moved.
 */
function archiveCard(entry) {
  const found = entry.popularityAtFirstSurface?.edhrecRank;
  const links = (entry.sources ?? [])
    .filter((source) => typeof source.url === "string" && source.url.startsWith("https://"))
    .map((source) => `<a class="chip" href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.creator || source.name)} ↗</a>`)
    .join("");
  const again = entry.timesSurfaced > 1 ? ` · surfaced ${entry.timesSurfaced} times` : "";
  return `<article class="card" data-open="${escapeAttr(commanderUrl(entry.slug))}">
    <div class="credit">
      <span class="muted">First surfaced ${escapeHtml(entry.firstSurfacedAt)}${again}</span>
    </div>
    <h3><a href="${escapeAttr(commanderUrl(entry.slug))}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.name)}</a></h3>
    ${found ? `<p class="muted">Rank ${found.toLocaleString()} when found${entry.popularityAtFirstSurface.deckCount ? ` · ${entry.popularityAtFirstSurface.deckCount.toLocaleString()} decks` : ""}</p>` : ""}
    <div class="chips">${links}</div>
  </article>`;
}

function hiddenCard(card) {
  const commanders = card.commanders.map((commander) => `<a class="chip" href="${escapeAttr(commanderUrl(commander.slug))}" target="_blank" rel="noopener noreferrer">${escapeHtml(commander.name)} · ${commander.relationshipScore}</a>`).join("");
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
