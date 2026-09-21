import { loadData } from "./data-client.js";
import { styles } from "./styles.js";

const state = { tab: "discover", query: "", sort: "diamond", minRank: "", maxDecks: "", data: null, loading: true, error: null };
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
      <header><div><strong>MTG Edge Lord</strong><span id="status">Loading discovery data…</span></div><a href="https://github.com/RktRobinhood/MTG-Edge-Lord" target="_blank" rel="noopener">About</a></header>
      <nav>${tabButton("discover", "Recent finds")}${tabButton("commander", "Commanders")}${tabButton("card", "Card-first")}</nav>
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
    render();
  });
}

async function refresh() {
  try {
    state.data = await loadData();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  shadow.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === state.tab));
  const status = shadow.getElementById("status");
  status.textContent = state.data ? `Data ${state.data.manifest.dataVersion}${state.data.stale ? " · cached" : ""}` : "Discovery data unavailable";
  const main = shadow.querySelector("main");
  if (state.loading) return void (main.innerHTML = `<div class="empty">Loading…</div>`);
  if (state.error) return void (main.innerHTML = `<div class="empty">${escapeHtml(state.error)}</div>`);
  main.innerHTML = `${state.data.stale ? `<div class="notice">Live data could not be reached. Showing the last cached version.</div>` : ""}${controls()}<div class="stack">${renderResults()}</div>`;
  main.querySelectorAll("[data-field]").forEach((control) => control.addEventListener(control.tagName === "SELECT" ? "change" : "input", (event) => {
    state[event.target.dataset.field] = event.target.value;
    render();
  }));
}

function controls() {
  const commanderFilters = state.tab === "commander" ? `<input data-field="minRank" type="number" min="1" value="${escapeAttr(state.minRank)}" placeholder="Min rank"><input data-field="maxDecks" type="number" min="0" value="${escapeAttr(state.maxDecks)}" placeholder="Max decks">` : "";
  return `<div class="controls ${state.tab === "commander" ? "commander" : ""}"><input data-field="query" value="${escapeAttr(state.query)}" placeholder="Search names, cards, tags, reasons">${commanderFilters}<select data-field="sort">${option("diamond", "Diamond score")}${option("momentum", "Momentum")}${option("name", "Alphabetical")}${option("rank", "EDHREC rank")}</select></div>`;
}

function renderResults() {
  if (state.tab === "discover") return filteredFindings().map(findingCard).join("") || empty();
  if (state.tab === "commander") return filteredCommanders().map(commanderCard).join("") || empty();
  return filteredCards().map(hiddenCard).join("") || empty();
}

function filteredFindings() {
  return state.data.findings.findings.filter(matchesQuery).sort((a, b) => b.score.total - a.score.total).slice(0, 40);
}

function filteredCommanders() {
  const current = currentCommanderSlug();
  return state.data.commanders.commanders.filter((item) => {
    const matches = matchesQuery(item) || item.slug === current;
    const rank = item.popularity?.edhrecRank;
    const decks = item.popularity?.deckCount;
    const rankAllowed = !state.minRank || (Number.isFinite(rank) && rank >= Number(state.minRank));
    const decksAllowed = !state.maxDecks || (Number.isFinite(decks) && decks <= Number(state.maxDecks));
    return matches && rankAllowed && decksAllowed;
  }).sort(sortEntities).slice(0, 60);
}

function filteredCards() {
  return state.data.cards.cards.filter(matchesQuery).sort((a, b) => b.commanders[0].relationshipScore - a.commanders[0].relationshipScore).slice(0, 60);
}

function findingCard(finding) {
  const entities = [...finding.commanders, ...finding.cards].map((item) => `<span class="chip">${escapeHtml(item.name)}</span>`).join("");
  return `<article class="card"><div class="meta"><span class="score">${finding.score.total}</span><span class="chip">${label(finding.findingType)}</span><span class="muted">${finding.publishedAt}</span></div><h3>${escapeHtml(finding.title)}</h3><p>${escapeHtml(finding.summary)}</p><div class="chips">${entities}</div><ul class="why">${finding.score.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul><a href="${escapeAttr(finding.source.url)}" target="_blank" rel="noopener">${escapeHtml(finding.source.creator)} · ${label(finding.source.resourceDepth)} ↗</a></article>`;
}

function commanderCard(commander) {
  const edges = state.data.relationships.relationships.filter((edge) => edge.commander.slug === commander.slug).slice(0, 5);
  const tech = edges.map((edge) => `<span class="chip">${escapeHtml(edge.card.name)} · ${edge.relationshipScore}</span>`).join("");
  const popularity = commander.popularity ? `#${commander.popularity.edhrecRank} · ${commander.popularity.deckCount.toLocaleString()} decks` : "Popularity awaiting snapshot";
  return `<article class="card"><div class="meta"><span class="score">${commander.diamondScore}</span><span class="muted">${popularity}</span></div><h3>${escapeHtml(commander.name)}</h3><div class="chips">${tech}</div><p><a href="https://edhrec.com/commanders/${commander.slug}">Open on EDHREC ↗</a></p></article>`;
}

function hiddenCard(card) {
  const commanders = card.commanders.map((commander) => `<a class="chip" href="https://edhrec.com/commanders/${commander.slug}">${escapeHtml(commander.name)} · ${commander.relationshipScore}</a>`).join("");
  return `<article class="card"><h3>${escapeHtml(card.name)}</h3><div class="chips">${commanders}</div></article>`;
}

function matchesQuery(item) {
  if (!state.query.trim()) return true;
  return JSON.stringify(item).toLowerCase().includes(state.query.trim().toLowerCase());
}

function sortEntities(a, b) {
  if (state.sort === "name") return a.name.localeCompare(b.name);
  if (state.sort === "rank") return (a.popularity?.edhrecRank ?? Infinity) - (b.popularity?.edhrecRank ?? Infinity);
  if (state.sort === "momentum") return b.momentum - a.momentum;
  return b.diamondScore - a.diamondScore;
}

function currentCommanderSlug() {
  return location.pathname.match(/^\/commanders\/([^/]+)/)?.[1] ?? "";
}

function tabButton(id, text) { return `<button type="button" data-tab="${id}" class="${state.tab === id ? "active" : ""}">${text}</button>`; }
function option(value, text) { return `<option value="${value}" ${state.sort === value ? "selected" : ""}>${text}</option>`; }
function label(value) { return String(value).replaceAll("_", " "); }
function empty() { return `<div class="empty">No matching discoveries yet.</div>`; }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = String(value); return node.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replaceAll('"', "&quot;"); }
