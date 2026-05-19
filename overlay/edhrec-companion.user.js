// ==UserScript==
// @name         MTG Edge Lord for EDHREC
// @namespace    mtg-edge-lord
// @version      0.3.1
// @description  Auto-hiding EDHREC side panel for off-meta commander search and personal deck taste tracking.
// @match        https://edhrec.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const CONFIG = {
    storeKey: "mtgEdgeLord.overlay.v2",
    legacyStoreKey: "commanderEdgeboard.overlay.v1",
    jsonBase: "https://json.edhrec.com/pages/",
    bootstrapPath: "commanders/year.json",
    edhrecBase: "https://edhrec.com",
    maxStoredCommanders: 1400
  };

  const STATUS = ["watch", "brew", "built", "skip"];
  const COLOR_ORDER = ["W", "U", "B", "R", "G", "C"];
  const THEME_HINTS = [
    "Artifacts", "Aristocrats", "Blink", "Counters", "Discard", "Enchantress",
    "Graveyard", "Lands", "Lifegain", "Politics", "Reanimator", "Sacrifice",
    "Spellslinger", "Tokens", "Voltron", "Wheels"
  ];

  const state = loadState();
  let page = readCurrentPage();
  const extensionIconUrl = extensionAssetUrl("assets/icons/icon-48.png");
  upsertVisitedCommander(page);
  saveState();

  injectStyles();
  mountOverlay();
  annotateCommanderLinks();
  observeRouteChanges();
  observePageChanges();

  function mountOverlay() {
    if (document.getElementById("mel-root")) return;

    const root = document.createElement("aside");
    root.id = "mel-root";
    root.className = state.settings.pinned ? "is-pinned" : "";
    root.innerHTML = `
      <nav class="mel-rail" aria-label="MTG Edge Lord panels">
        <button type="button" data-tab="scout" title="Current commander">Scout</button>
        <button type="button" data-tab="search" title="Commander search">Find</button>
        <button type="button" data-tab="profile" title="Deck profile">Profile</button>
        <button type="button" data-tab="saved" title="Saved ideas">Saved</button>
      </nav>
      <section class="mel-panel">
        <header class="mel-header">
          <div class="mel-brand">
            ${extensionIconUrl ? `<img src="${escapeAttr(extensionIconUrl)}" alt="">` : `<span class="mel-brand-fallback">EL</span>`}
            <div>
              <strong>MTG Edge Lord</strong>
              <span data-mel-subtitle>EDHREC overlay</span>
            </div>
          </div>
          <button type="button" data-action="pin">${state.settings.pinned ? "Unpin" : "Pin"}</button>
        </header>
        <div class="mel-tabs">
          <div data-panel="scout"></div>
          <div data-panel="search" hidden></div>
          <div data-panel="profile" hidden></div>
          <div data-panel="saved" hidden></div>
        </div>
      </section>
    `;
    document.body.append(root);

    root.addEventListener("click", handleRootClick);
    root.addEventListener("input", handleRootInput);
    root.addEventListener("change", handleRootChange);

    setActiveTab(state.settings.activeTab || "scout");
    renderAll();
  }

  function handleRootClick(event) {
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
      setActiveTab(tabButton.dataset.tab);
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) return;

    const actionName = action.dataset.action;
    if (actionName === "pin") {
      state.settings.pinned = !state.settings.pinned;
      saveState();
      document.getElementById("mel-root").classList.toggle("is-pinned", state.settings.pinned);
      action.textContent = state.settings.pinned ? "Unpin" : "Pin";
      return;
    }
    if (actionName === "status") setCurrentIdeaStatus(action.dataset.value);
    if (actionName === "rating") setCurrentRating(Number(action.dataset.value));
    if (actionName === "add-profile") saveCurrentAsProfile();
    if (actionName === "save-manual-profile") saveManualProfile();
    if (actionName === "remove-profile") removeProfile(action.dataset.key);
    if (actionName === "select-profile") openCommander(action.dataset.slug);
    if (actionName === "load-commanders") {
      loadCommanderIndex(Number(getInput("mel-pages")?.value || 4));
      return;
    }
    if (actionName === "export") exportJson();
    if (actionName === "copy-json") copyJson();
    if (actionName === "clear-search") {
      state.search = defaultSearch();
      saveState();
      renderSearch();
    }
    if (actionName === "open-theme") window.open(`${CONFIG.edhrecBase}/themes/${slugify(action.dataset.value)}`, "_blank", "noopener");
    if (actionName === "open-typal") window.open(`${CONFIG.edhrecBase}/typal/${slugify(action.dataset.value)}`, "_blank", "noopener");
    saveState();
    renderAll();
    annotateCommanderLinks();
  }

  function handleRootInput(event) {
    const target = event.target;
    if (target.matches("[data-current-field='tags']")) currentIdea().tags = parseTags(target.value);
    if (target.matches("[data-current-field='likes']")) {
      currentIdea().likes = parseTags(target.value);
      currentIdea().profileTouched = true;
    }
    if (target.matches("[data-current-field='dislikes']")) {
      currentIdea().dislikes = parseTags(target.value);
      currentIdea().profileTouched = true;
    }
    if (target.matches("[data-current-field='notes']")) currentIdea().notes = target.value;
    if (target.matches("[data-search]")) {
      state.search[target.dataset.search] = target.type === "checkbox" ? target.checked : target.value;
      renderSearchResults();
    }
    if (target.matches("[data-profile-filter]")) {
      state.settings.profileFilter = target.value;
      renderProfileList();
    }
    stampCurrentIdea();
    saveState();
  }

  function handleRootChange(event) {
    const target = event.target;
    if (target.matches("[data-current-scale]")) {
      currentIdea()[target.dataset.currentScale] = clamp(Number(target.value), 1, 5);
      currentIdea().profileTouched = true;
    }
    if (target.matches("[data-current-select]")) {
      currentIdea()[target.dataset.currentSelect] = target.value;
      currentIdea().profileTouched = true;
    }
    if (target.matches("[data-search]")) {
      state.search[target.dataset.search] = target.type === "checkbox" ? target.checked : target.value;
      renderSearchResults();
    }
    if (target.matches("[data-import]")) importFile(target.files && target.files[0]);
    stampCurrentIdea();
    saveState();
    renderAll();
  }

  function setActiveTab(tab) {
    state.settings.activeTab = tab;
    saveState();
    const root = document.getElementById("mel-root");
    if (!root) return;
    root.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    });
    root.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab;
    });
  }

  function renderAll() {
    renderScout();
    renderSearch();
    renderProfile();
    renderSaved();
  }

  function renderScout() {
    const panel = getPanel("scout");
    const commanderPage = page.type === "commander";
    const idea = currentIdea();
    const tags = mergeTags(idea.sourceTags || [], page.tags || []);
    panel.innerHTML = `
      <div class="mel-section">
        <h2>${escapeHtml(commanderPage ? page.name : "EDHREC page")}</h2>
        <p>${commanderPage ? escapeHtml(page.meta || "Commander page detected.") : "Open a commander page to rate and profile it."}</p>
        ${commanderPage ? `<a class="mel-link" href="${escapeAttr(page.url)}">Current EDHREC page</a>` : ""}
      </div>
      ${commanderPage ? `
        <div class="mel-section">
          <div class="mel-button-row">${STATUS.map((status) => `<button type="button" class="${idea.status === status ? "is-active" : ""}" data-action="status" data-value="${status}">${statusLabel(status)}</button>`).join("")}</div>
          <div class="mel-stars">${[1, 2, 3, 4, 5].map((value) => `<button type="button" class="${value <= idea.rating ? "is-active" : ""}" data-action="rating" data-value="${value}">${value <= idea.rating ? "*" : value}</button>`).join("")}</div>
        </div>
        <div class="mel-grid">
          ${scaleField("power", "Power", idea.power)}
          ${scaleField("complexity", "Complexity", idea.complexity)}
          ${scaleField("tableHeat", "Heat", idea.tableHeat)}
          ${selectField("pattern", "Pattern", idea.pattern, ["value", "combat", "combo", "control", "politics", "toolbox", "engine", "typal"])}
          ${selectField("speed", "Speed", idea.speed, ["fast", "mid", "slow"])}
        </div>
        ${textField("tags", "Tags", idea.tags.join(", "))}
        ${textField("likes", "Likes", idea.likes.join(", "))}
        ${textField("dislikes", "Dislikes", idea.dislikes.join(", "))}
        <label class="mel-field"><span>Notes</span><textarea data-current-field="notes" rows="4">${escapeHtml(idea.notes || "")}</textarea></label>
        <div class="mel-chip-row">${tags.map((tag) => `<button type="button" data-action="open-theme" data-value="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>
        <div class="mel-button-row">
          <button type="button" data-action="add-profile">Save as owned deck</button>
          <button type="button" data-action="export">Export</button>
        </div>
        <div class="mel-section">
          <h3>Deck builders</h3>
          <div class="mel-button-row">
            ${deckBuilderLinks(page.name)}
          </div>
        </div>
      ` : ""}
    `;
  }

  function renderSearch() {
    const panel = getPanel("search");
    const search = state.search;
    panel.innerHTML = `
      <div class="mel-section">
        <h2>Commander finder</h2>
        <p>Loads EDHREC ranked commanders, then filters inside this side panel while EDHREC remains the main page.</p>
      </div>
      <div class="mel-grid">
        <label class="mel-field mel-wide"><span>Search</span><input data-search="query" value="${escapeAttr(search.query)}" placeholder="name, tag, idea"></label>
        <label class="mel-field"><span>Min rank</span><input data-search="minRank" type="number" min="1" value="${escapeAttr(search.minRank)}"></label>
        <label class="mel-field"><span>Max decks</span><input data-search="maxDecks" type="number" min="0" value="${escapeAttr(search.maxDecks)}"></label>
        <label class="mel-field"><span>Sort</span><select data-search="sort">${optionList(["edge", "taste", "offMeta", "different", "rank", "decks"], search.sort)}</select></label>
        <label class="mel-field"><span>Pages</span><input id="mel-pages" type="number" min="1" max="14" value="${escapeAttr(search.pages || 5)}"></label>
        <label class="mel-check"><input data-search="hideOwned" type="checkbox" ${search.hideOwned ? "checked" : ""}> Hide owned</label>
      </div>
      <div class="mel-button-row">
        <button type="button" data-action="load-commanders">Load EDHREC commanders</button>
        <button type="button" data-action="clear-search">Clear</button>
      </div>
      <div class="mel-small">${state.commanders.length ? `${state.commanders.length.toLocaleString()} ranked commanders cached locally.` : "No commander index loaded yet."}</div>
      <div data-search-results></div>
    `;
    renderSearchResults();
  }

  function renderSearchResults() {
    const target = document.querySelector("[data-search-results]");
    if (!target) return;
    if (!state.commanders.length) {
      target.innerHTML = `<div class="mel-empty">Click "Load EDHREC commanders" to build the local searchable index.</div>`;
      return;
    }
    const results = filteredCommanders().slice(0, 40);
    target.innerHTML = results.length ? results.map((card) => commanderResultHtml(card)).join("") : `<div class="mel-empty">No commanders match.</div>`;
  }

  function renderProfile() {
    const panel = getPanel("profile");
    const profiles = state.profiles;
    const summary = profileSummary();
    panel.innerHTML = `
      <div class="mel-section">
        <h2>Deck profile</h2>
        <p>${profiles.length ? `${profiles.length} owned deck profiles shape taste matching.` : "Save commanders as owned decks to build a taste profile."}</p>
      </div>
      ${page.type === "commander" ? `
        <div class="mel-section mel-current-profile">
          <h3>Current EDHREC commander</h3>
          <p>${escapeHtml(page.name)} is ready to save into your profile. Use Scout to tune the stars, likes, dislikes, power, complexity, and heat first.</p>
          <div class="mel-button-row">
            <button type="button" data-action="add-profile">Save current as owned</button>
            ${deckBuilderLinks(page.name)}
          </div>
        </div>
      ` : `
        <div class="mel-section">
          <h3>Build profile from EDHREC</h3>
          <p>Open a commander page, rate the deck in Scout, then save it as owned here.</p>
        </div>
      `}
      <div class="mel-metrics">
        <div><b>${profiles.length}</b><span>decks</span></div>
        <div><b>${summary.avgRating || "0"}</b><span>stars</span></div>
        <div><b>${summary.avgPower || "0"}</b><span>power</span></div>
        <div><b>${summary.avgHeat || "0"}</b><span>heat</span></div>
      </div>
      <details class="mel-section" ${profiles.length ? "" : "open"}>
        <summary>Manual profile entry</summary>
        <div class="mel-grid mel-manual-profile">
          <label class="mel-field mel-wide"><span>Commander</span><input data-manual-profile="name" placeholder="Commander name"></label>
          <label class="mel-field"><span>Stars</span><select data-manual-profile="rating">${optionList(["1", "2", "3", "4", "5"], "3")}</select></label>
          <label class="mel-field"><span>Power</span><select data-manual-profile="power">${optionList(["1", "2", "3", "4", "5"], "3")}</select></label>
          <label class="mel-field"><span>Heat</span><select data-manual-profile="tableHeat">${optionList(["1", "2", "3", "4", "5"], "3")}</select></label>
          <label class="mel-field mel-wide"><span>Tags</span><input data-manual-profile="tags" placeholder="Artifacts, Politics, Lands"></label>
          <label class="mel-field mel-wide"><span>Likes</span><input data-manual-profile="likes" placeholder="Puzzle turns, toolbox, low heat"></label>
          <label class="mel-field mel-wide"><span>Dislikes</span><input data-manual-profile="dislikes" placeholder="Linear combo, too much shuffling"></label>
          <label class="mel-field mel-wide"><span>Deck URL</span><input data-manual-profile="url" placeholder="Moxfield, Archidekt, or EDHREC URL"></label>
        </div>
        <button type="button" data-action="save-manual-profile">Save profile entry</button>
      </details>
      <div class="mel-section">
        <h3>Liked signals</h3>
        <div class="mel-chip-row">${summary.likes.map(([tag, score]) => `<button type="button" data-action="open-theme" data-value="${escapeAttr(tag)}">${escapeHtml(tag)} ${Math.round(score)}</button>`).join("") || `<span class="mel-small">No likes yet.</span>`}</div>
      </div>
      <div class="mel-section">
        <h3>Avoid signals</h3>
        <div class="mel-chip-row">${summary.dislikes.map(([tag, score]) => `<button type="button">${escapeHtml(tag)} ${Math.round(score)}</button>`).join("") || `<span class="mel-small">No dislikes yet.</span>`}</div>
      </div>
      <input data-profile-filter value="${escapeAttr(state.settings.profileFilter || "")}" placeholder="Filter owned decks">
      <div data-profile-list></div>
      <div class="mel-section">
        <h3>Import / export</h3>
        <div class="mel-button-row">
          <button type="button" data-action="export">Export JSON</button>
          <button type="button" data-action="copy-json">Copy JSON</button>
          <label class="mel-file">Import <input data-import type="file" accept="application/json,.json"></label>
        </div>
      </div>
    `;
    renderProfileList();
  }

  function renderProfileList() {
    const target = document.querySelector("[data-profile-list]");
    if (!target) return;
    const filter = normalize(state.settings.profileFilter || "");
    const profiles = state.profiles
      .filter((profile) => !filter || normalize(profileHaystack(profile)).includes(filter))
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
    target.innerHTML = profiles.length ? profiles.map((profile) => `
      <article class="mel-card">
        <strong>${escapeHtml(profile.name)}</strong>
        <span>${"*".repeat(profile.rating)}${".".repeat(5 - profile.rating)} / ${escapeHtml(profile.pattern)} / ${escapeHtml(profile.speed)}</span>
        <div class="mel-chip-row">${profile.tags.slice(0, 5).map((tag) => `<button type="button" data-action="open-theme" data-value="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>
        <div class="mel-button-row">
          <button type="button" data-action="select-profile" data-slug="${escapeAttr(profile.key)}">Open</button>
          <a class="mel-link mel-builder-link" href="${escapeAttr(profile.url || `${CONFIG.edhrecBase}/commanders/${profile.key}`)}" target="_blank" rel="noopener">Source</a>
          <button type="button" data-action="remove-profile" data-key="${escapeAttr(profile.key)}">Remove</button>
        </div>
      </article>
    `).join("") : `<div class="mel-empty">No owned deck profiles.</div>`;
  }

  function renderSaved() {
    const panel = getPanel("saved");
    const ideas = Object.values(state.ideas).sort((a, b) => statusWeight(a.status) - statusWeight(b.status) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    panel.innerHTML = `
      <div class="mel-section">
        <h2>Saved from EDHREC</h2>
        <p>These badges also appear beside commander links on EDHREC pages.</p>
      </div>
      ${ideas.length ? ideas.map((idea) => `
        <article class="mel-card">
          <strong>${escapeHtml(idea.name)}</strong>
          <span>${statusLabel(idea.status)} / ${"*".repeat(idea.rating || 3)}${".".repeat(5 - (idea.rating || 3))}</span>
          <div class="mel-chip-row">${mergeTags(idea.tags || [], idea.sourceTags || []).slice(0, 5).map((tag) => `<button type="button" data-action="open-theme" data-value="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>
          <a class="mel-link" href="${escapeAttr(idea.url || `${CONFIG.edhrecBase}/commanders/${idea.key}`)}">Open on EDHREC</a>
        </article>
      `).join("") : `<div class="mel-empty">No saved commanders yet.</div>`}
    `;
  }

  async function loadCommanderIndex(pages) {
    state.search.pages = clamp(pages || 5, 1, 14);
    const button = document.querySelector("[data-action='load-commanders']");
    if (button) button.textContent = "Loading...";
    try {
      const first = await fetchJson(CONFIG.bootstrapPath);
      const list = selectCommanderList(first);
      const cards = normalizeCommanderViews(list.cardviews || []);
      const pattern = pagePattern(list.more || "");
      for (let pageIndex = 1; pageIndex < state.search.pages; pageIndex += 1) {
        if (!pattern) break;
        const payload = await fetchJson(`${pattern.prefix}${pageIndex}${pattern.suffix}`);
        cards.push(...normalizeCommanderViews(payload.cardviews || getNested(payload, ["container", "json_dict", "cardlists", 0, "cardviews"], [])));
      }
      state.commanders = mergeCommanders(state.commanders, cards).slice(0, CONFIG.maxStoredCommanders);
      saveState();
      renderSearch();
    } catch (error) {
      const target = document.querySelector("[data-search-results]");
      if (target) target.innerHTML = `<div class="mel-empty">Load failed: ${escapeHtml(error.message || error)}</div>`;
    } finally {
      if (button) button.textContent = "Load EDHREC commanders";
    }
  }

  function filteredCommanders() {
    const search = state.search;
    const profileKeys = new Set(state.profiles.map((profile) => normalize(profile.name)));
    const list = state.commanders.filter((card) => {
      if (search.hideOwned && profileKeys.has(normalize(card.name))) return false;
      if (search.minRank && card.rank && card.rank < Number(search.minRank)) return false;
      if (search.maxDecks && card.decks && card.decks > Number(search.maxDecks)) return false;
      if (search.query && !normalize(commanderHaystack(card)).includes(normalize(search.query))) return false;
      return true;
    });
    list.sort((a, b) => sortCommanders(a, b, search.sort));
    return list;
  }

  function sortCommanders(a, b, sort) {
    if (sort === "taste") return tasteScore(b) - tasteScore(a) || edgeScore(b) - edgeScore(a);
    if (sort === "offMeta") return offMetaScore(b) - offMetaScore(a) || a.rank - b.rank;
    if (sort === "different") return differenceScore(b) - differenceScore(a) || offMetaScore(b) - offMetaScore(a);
    if (sort === "rank") return numberSort(a.rank, b.rank) || a.name.localeCompare(b.name);
    if (sort === "decks") return numberSort(a.decks, b.decks) || numberSort(a.rank, b.rank);
    return edgeScore(b) - edgeScore(a) || numberSort(a.rank, b.rank);
  }

  function commanderResultHtml(card) {
    return `
      <article class="mel-card">
        <strong>${escapeHtml(card.name)}</strong>
        <span>#${card.rank || "?"} / ${formatCompact(card.decks)} decks / ${(card.colors || []).join("") || "C"} / edge ${Math.round(edgeScore(card))} / taste ${Math.round(tasteScore(card))}</span>
        <div class="mel-chip-row">${(card.tags || []).slice(0, 5).map((tag) => `<button type="button" data-action="open-theme" data-value="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>
        <div class="mel-button-row">
          <a class="mel-link" href="${escapeAttr(card.url)}">Open on EDHREC</a>
          ${deckBuilderLinks(card.name)}
        </div>
      </article>
    `;
  }

  function annotateCommanderLinks() {
    const ideaKeys = new Set(Object.keys(state.ideas));
    const profileKeys = new Set(state.profiles.map((profile) => profile.key));
    document.querySelectorAll('a[data-mel-annotated="1"]').forEach((anchor) => {
      if (anchor.closest("#mel-root")) return;
      anchor.querySelectorAll(":scope > .mel-inline-badge").forEach((badge) => badge.remove());
      anchor.classList.remove("mel-owned-link", "mel-saved-link");
      delete anchor.dataset.melAnnotated;
    });
    document.querySelectorAll('a[href*="/commanders/"]').forEach((anchor) => {
      if (anchor.closest("#mel-root")) return;
      const slug = slugFromCommanderHref(anchor.getAttribute("href") || "");
      if (!slug || anchor.dataset.melAnnotated === "1") return;
      if (!ideaKeys.has(slug) && !profileKeys.has(slug)) return;
      anchor.dataset.melAnnotated = "1";
      anchor.classList.add(profileKeys.has(slug) ? "mel-owned-link" : "mel-saved-link");
      const badge = document.createElement("span");
      badge.className = "mel-inline-badge";
      badge.textContent = profileKeys.has(slug) ? "owned" : statusLabel(state.ideas[slug]?.status || "watch");
      anchor.append(badge);
    });
  }

  function observePageChanges() {
    let timer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        refreshCurrentPage();
        annotateCommanderLinks();
      }, 350);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function observeRouteChanges() {
    const notify = () => window.dispatchEvent(new Event("mel-location-change"));
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      notify();
      return result;
    };
    history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notify();
      return result;
    };
    window.addEventListener("popstate", notify);
    window.addEventListener("mel-location-change", () => {
      window.setTimeout(() => refreshCurrentPage(true), 150);
      window.setTimeout(() => refreshCurrentPage(true), 900);
    });
  }

  function refreshCurrentPage(force = false) {
    const next = readCurrentPage();
    if (!force && pageSignature(next) === pageSignature(page)) return;
    page = next;
    upsertVisitedCommander(page);
    if (page.type === "commander") currentIdea();
    saveState();
    renderAll();
    annotateCommanderLinks();
  }

  function pageSignature(item) {
    return [item.type, item.key, item.name, item.rank, item.decks, (item.tags || []).join("|")].join("::");
  }

  function readCurrentPage() {
    const path = location.pathname.split("/").filter(Boolean);
    const isCommander = path[0] === "commanders" && Boolean(path[1]);
    const slug = isCommander ? path[1] : "";
    const heading = cleanHeading(document.querySelector("h1")?.textContent || "");
    const name = isCommander ? heading || titleFromSlug(slug) : document.title.replace(/\s*\|\s*EDHREC.*$/i, "");
    return {
      type: isCommander ? "commander" : "page",
      key: slug || slugify(name),
      slug: slug || slugify(name),
      name,
      url: location.href,
      rank: extractNumber(document.body?.innerText.match(/Rank\s*#?\s*([0-9,]+)/i)?.[1]),
      decks: extractDeckCount(document.body?.innerText || ""),
      tags: extractVisibleTags(slug),
      meta: pageMeta()
    };
  }

  function upsertVisitedCommander(current) {
    if (current.type !== "commander") return;
    state.commanders = mergeCommanders(state.commanders, [{
      key: current.key,
      name: current.name,
      rank: current.rank,
      decks: current.decks,
      tags: current.tags,
      url: current.url,
      source: "visited"
    }]);
  }

  function currentIdea() {
    if (page.type !== "commander") return nullIdea();
    if (!state.ideas[page.key]) {
      state.ideas[page.key] = {
        key: page.key,
        name: page.name,
        status: "watch",
        tags: [],
        likes: [],
        dislikes: [],
        notes: "",
        rating: 3,
        power: 3,
        complexity: 3,
        tableHeat: 3,
        pattern: "value",
        speed: "mid",
        profileTouched: false,
        sourceTags: page.tags || [],
        url: page.url,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    const idea = state.ideas[page.key];
    idea.sourceTags = mergeTags(idea.sourceTags || [], page.tags || []);
    idea.rating = clamp(Number(idea.rating || 3), 1, 5);
    idea.power = clamp(Number(idea.power || 3), 1, 5);
    idea.complexity = clamp(Number(idea.complexity || 3), 1, 5);
    idea.tableHeat = clamp(Number(idea.tableHeat || 3), 1, 5);
    idea.tags = Array.isArray(idea.tags) ? idea.tags : [];
    idea.likes = Array.isArray(idea.likes) ? idea.likes : [];
    idea.dislikes = Array.isArray(idea.dislikes) ? idea.dislikes : [];
    return idea;
  }

  function nullIdea() {
    return { status: "watch", tags: [], likes: [], dislikes: [], notes: "", rating: 3, power: 3, complexity: 3, tableHeat: 3, pattern: "value", speed: "mid", sourceTags: [] };
  }

  function stampCurrentIdea() {
    if (page.type !== "commander") return;
    const idea = currentIdea();
    idea.name = page.name;
    idea.url = page.url;
    idea.updatedAt = new Date().toISOString();
  }

  function setCurrentIdeaStatus(status) {
    if (!STATUS.includes(status)) return;
    currentIdea().status = status;
    stampCurrentIdea();
  }

  function setCurrentRating(rating) {
    currentIdea().rating = clamp(rating, 1, 5);
    currentIdea().profileTouched = true;
    stampCurrentIdea();
  }

  function saveCurrentAsProfile() {
    if (page.type !== "commander") return;
    const idea = currentIdea();
    const profile = normalizeProfile({
      key: page.key,
      name: page.name,
      rating: idea.rating,
      power: idea.power,
      complexity: idea.complexity,
      tableHeat: idea.tableHeat,
      pattern: idea.pattern,
      speed: idea.speed,
      tags: mergeTags(idea.tags || [], idea.sourceTags || []),
      likes: idea.likes || [],
      dislikes: idea.dislikes || [],
      notes: idea.notes || "",
      url: page.url
    });
    state.profiles = mergeProfiles(state.profiles, [profile]);
  }

  function saveManualProfile() {
    const fields = {};
    document.querySelectorAll("[data-manual-profile]").forEach((input) => {
      fields[input.dataset.manualProfile] = input.value;
    });
    const name = String(fields.name || "").trim();
    if (!name) return;
    state.profiles = mergeProfiles(state.profiles, [normalizeProfile({
      key: slugify(name),
      name,
      rating: Number(fields.rating || 3),
      power: Number(fields.power || 3),
      tableHeat: Number(fields.tableHeat || 3),
      complexity: 3,
      tags: parseTags(fields.tags || ""),
      likes: parseTags(fields.likes || ""),
      dislikes: parseTags(fields.dislikes || ""),
      url: fields.url || `${CONFIG.edhrecBase}/commanders/${slugify(name)}`
    })]);
    saveState();
    renderAll();
    annotateCommanderLinks();
  }

  function removeProfile(key) {
    state.profiles = state.profiles.filter((profile) => profile.key !== key);
  }

  function openCommander(slug) {
    if (!slug) return;
    location.href = `${CONFIG.edhrecBase}/commanders/${slug}`;
  }

  function edgeScore(card) {
    const off = offMetaScore(card);
    const taste = tasteScore(card);
    const diff = differenceScore(card) * 100;
    const novelty = noveltyScore(card);
    return clamp(off * 0.32 + taste * 0.24 + diff * 0.24 + novelty * 0.2, 0, 100);
  }

  function offMetaScore(card) {
    const rankScore = card.rank ? clamp((card.rank - 350) / 25, 0, 100) : 62;
    const deckScore = card.decks ? clamp(100 - Math.log10(card.decks + 1) * 22, 0, 100) : 70;
    return rankScore * 0.62 + deckScore * 0.38;
  }

  function tasteScore(card) {
    if (!state.profiles.length) return 50;
    const tags = (card.tags || []).map(normalize);
    const nameWords = normalize(card.name).split(" ");
    let score = 50;
    const signal = profileSignal();
    for (const tag of tags) score += (signal.likes[tag] || 0) * 7;
    for (const tag of tags) score -= (signal.dislikes[tag] || 0) * 8;
    for (const word of nameWords) {
      score += (signal.likes[word] || 0) * 2;
      score -= (signal.dislikes[word] || 0) * 2;
    }
    return clamp(score, 0, 100);
  }

  function differenceScore(card) {
    if (!state.profiles.length) return 0.55;
    const features = featureSet(card);
    let best = 0;
    for (const profile of state.profiles) best = Math.max(best, jaccard(features, featureSet(profile)) * (0.55 + profile.rating * 0.09));
    return clamp(1 - best, 0, 1);
  }

  function noveltyScore(card) {
    const known = new Set(state.profiles.flatMap((profile) => [...profile.tags, ...profile.likes].map(normalize)));
    const tags = (card.tags || []).map(normalize).filter(Boolean);
    if (!tags.length) return known.size ? 40 : 60;
    if (!known.size) return 62;
    return tags.filter((tag) => !known.has(tag)).length / tags.length * 100;
  }

  function profileSignal() {
    const likes = {};
    const dislikes = {};
    for (const profile of state.profiles) {
      const love = Math.max(0.5, profile.rating - 2);
      const avoid = Math.max(0.5, 4 - profile.rating);
      for (const tag of profile.tags || []) {
        const key = normalize(tag);
        if (profile.rating >= 4) likes[key] = (likes[key] || 0) + love;
        if (profile.rating <= 2) dislikes[key] = (dislikes[key] || 0) + avoid;
      }
      for (const tag of profile.likes || []) likes[normalize(tag)] = (likes[normalize(tag)] || 0) + love + 1.5;
      for (const tag of profile.dislikes || []) dislikes[normalize(tag)] = (dislikes[normalize(tag)] || 0) + avoid + 1.5;
    }
    return { likes, dislikes };
  }

  function profileSummary() {
    const profiles = state.profiles;
    const likes = {};
    const dislikes = {};
    for (const profile of profiles) {
      for (const tag of [...(profile.likes || []), ...(profile.rating >= 4 ? profile.tags || [] : [])]) likes[tag] = (likes[tag] || 0) + profile.rating;
      for (const tag of [...(profile.dislikes || []), ...(profile.rating <= 2 ? profile.tags || [] : [])]) dislikes[tag] = (dislikes[tag] || 0) + (6 - profile.rating);
    }
    return {
      avgRating: profiles.length ? avg(profiles.map((p) => p.rating)).toFixed(1) : "",
      avgPower: profiles.length ? avg(profiles.map((p) => p.power)).toFixed(1) : "",
      avgHeat: profiles.length ? avg(profiles.map((p) => p.tableHeat)).toFixed(1) : "",
      likes: topEntries(likes, 12),
      dislikes: topEntries(dislikes, 10)
    };
  }

  function featureSet(item) {
    const set = new Set();
    for (const tag of item.tags || []) set.add(`tag:${normalize(tag)}`);
    for (const tag of item.likes || []) set.add(`tag:${normalize(tag)}`);
    for (const word of normalize(item.name).split(" ")) if (word.length > 3) set.add(`name:${word}`);
    for (const color of item.colors || []) set.add(`color:${color}`);
    if (item.pattern) set.add(`pattern:${normalize(item.pattern)}`);
    if (item.speed) set.add(`speed:${normalize(item.speed)}`);
    return set;
  }

  function loadState() {
    const empty = { ideas: {}, profiles: [], commanders: [], search: defaultSearch(), settings: { activeTab: "scout", pinned: false, profileFilter: "" } };
    const loaded = safeJson(localStorage.getItem(CONFIG.storeKey), null);
    const legacy = safeJson(localStorage.getItem(CONFIG.legacyStoreKey), null);
    const raw = loaded || legacy || empty;
    return {
      ideas: normalizeIdeas(raw.ideas || {}),
      profiles: normalizeProfiles(raw.profiles || raw.deckProfiles || []),
      commanders: mergeCommanders([], normalizeCommanderViews(raw.commanders || [])),
      search: { ...defaultSearch(), ...(raw.search || {}) },
      settings: { ...empty.settings, ...(raw.settings || {}) }
    };
  }

  function saveState() {
    localStorage.setItem(CONFIG.storeKey, JSON.stringify(state));
  }

  function exportPayload() {
    return {
      exportedAt: new Date().toISOString(),
      source: "mtg-edge-lord-edhrec-overlay",
      ideas: Object.values(state.ideas),
      deckProfiles: state.profiles,
      commanders: state.commanders
    };
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mtg-edge-lord-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
  }

  async function importFile(file) {
    if (!file) return;
    const payload = JSON.parse(await file.text());
    state.ideas = { ...state.ideas, ...normalizeIdeas(payload.ideas || payload.interests || {}) };
    state.profiles = mergeProfiles(state.profiles, normalizeProfiles(payload.deckProfiles || payload.profiles || payload.ownedProfiles || []));
    state.commanders = mergeCommanders(state.commanders, normalizeCommanderViews(payload.commanders || []));
    saveState();
    renderAll();
    annotateCommanderLinks();
  }

  async function fetchJson(path) {
    const url = /^https?:/i.test(path) ? path : CONFIG.jsonBase + path.replace(/^\/+/, "");
    const viaBackground = await fetchJsonViaBackground(url);
    if (viaBackground) return viaBackground;
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function fetchJsonViaBackground(url) {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") return null;
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "mel-fetch-json", url }, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            resolve(null);
            return;
          }
          if (!response) {
            resolve(null);
            return;
          }
          if (response.ok) resolve(response.payload);
          else reject(new Error(response.error || "Background fetch failed."));
        });
      });
    } catch {
      return null;
    }
  }

  function selectCommanderList(payload) {
    const lists = getNested(payload, ["container", "json_dict", "cardlists"], []);
    return lists.find((list) => list.tag === "past2years") || lists.find((list) => /past\s*2\s*years/i.test(list.header || "")) || lists[0] || { cardviews: [], more: "" };
  }

  function pagePattern(path) {
    const match = String(path || "").match(/^(.*?)(\d+)(\.json(?:\?.*)?)$/);
    return match ? { prefix: match[1], suffix: match[3] } : null;
  }

  function normalizeIdeas(raw) {
    const out = {};
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    for (const item of list) {
      if (!item?.name) continue;
      const key = item.key || item.slug || slugify(item.name);
      out[key] = {
        key,
        name: item.name,
        status: STATUS.includes(item.status) ? item.status : "watch",
        tags: parseTags(item.tags || []),
        likes: parseTags(item.likes || []),
        dislikes: parseTags(item.dislikes || []),
        notes: String(item.notes || ""),
        rating: clamp(Number(item.rating || 3), 1, 5),
        power: clamp(Number(item.power || 3), 1, 5),
        complexity: clamp(Number(item.complexity || 3), 1, 5),
        tableHeat: clamp(Number(item.tableHeat || 3), 1, 5),
        pattern: item.pattern || "value",
        speed: item.speed || "mid",
        profileTouched: Boolean(item.profileTouched),
        sourceTags: parseTags(item.sourceTags || []),
        url: item.url || `${CONFIG.edhrecBase}/commanders/${key}`,
        savedAt: item.savedAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      };
    }
    return out;
  }

  function normalizeProfiles(raw) {
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list.map(normalizeProfile).filter((profile) => profile.name);
  }

  function normalizeProfile(item) {
    const name = String(item?.name || item?.commander || "").trim();
    const key = item?.key || item?.id || item?.slug || slugify(name);
    return {
      key,
      name,
      rating: clamp(Number(item?.rating || item?.stars || 3), 1, 5),
      power: clamp(Number(item?.power || 3), 1, 5),
      complexity: clamp(Number(item?.complexity || 3), 1, 5),
      tableHeat: clamp(Number(item?.tableHeat || item?.heat || 3), 1, 5),
      pattern: item?.pattern || "value",
      speed: item?.speed || "mid",
      tags: parseTags(item?.tags || []),
      colors: Array.isArray(item?.colors) ? item.colors : [],
      likes: parseTags(item?.likes || []),
      dislikes: parseTags(item?.dislikes || []),
      notes: String(item?.notes || ""),
      url: item?.url || item?.sourceUrl || `${CONFIG.edhrecBase}/commanders/${key}`
    };
  }

  function normalizeCommanderViews(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item) => {
      const name = String(item.name || item.card_name || "").trim();
      if (!name) return null;
      const key = item.key || item.slug || item.sanitized || slugify(name);
      return {
        key,
        name,
        rank: Number(item.rank || 0),
        decks: Number(item.decks || item.num_decks || item.inclusion || item.count || 0),
        tags: parseTags(item.tags || item.sourceTags || []),
        colors: Array.isArray(item.color_identity) ? item.color_identity : Array.isArray(item.colors) ? item.colors : [],
        url: item.url && /^https?:/i.test(item.url) ? item.url : `${CONFIG.edhrecBase}${item.url || `/commanders/${key}`}`,
        source: item.source || "edhrec"
      };
    }).filter(Boolean);
  }

  function mergeCommanders(base, incoming) {
    const map = new Map();
    for (const card of [...(base || []), ...(incoming || [])]) {
      const normalized = normalizeCommanderViews([card])[0];
      if (!normalized) continue;
      const existing = map.get(normalized.key);
      map.set(normalized.key, existing ? {
        ...existing,
        ...normalized,
        tags: mergeTags(existing.tags || [], normalized.tags || []),
        colors: normalized.colors.length ? normalized.colors : existing.colors || []
      } : normalized);
    }
    return Array.from(map.values()).sort((a, b) => numberSort(a.rank, b.rank) || a.name.localeCompare(b.name));
  }

  function mergeProfiles(base, incoming) {
    const map = new Map();
    for (const profile of [...(base || []), ...(incoming || [])]) {
      const normalized = normalizeProfile(profile);
      if (!normalized.name) continue;
      const existing = map.get(normalized.key);
      map.set(normalized.key, existing ? {
        ...existing,
        ...normalized,
        tags: mergeTags(existing.tags || [], normalized.tags || []),
        likes: mergeTags(existing.likes || [], normalized.likes || []),
        dislikes: mergeTags(existing.dislikes || [], normalized.dislikes || [])
      } : normalized);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function extractVisibleTags(slug) {
    if (!slug) return [];
    const tags = [];
    document.querySelectorAll(`a[href*="/commanders/${slug}/"]`).forEach((anchor) => {
      const text = cleanTag(anchor.textContent || "");
      if (isUsefulTag(text)) tags.push(text);
    });
    const body = document.body?.innerText || "";
    const start = body.search(/\bTags\b/i);
    if (start >= 0) {
      const segment = body.slice(start, start + 800);
      for (const match of segment.matchAll(/([A-Za-z][A-Za-z '+&/.-]{2,36})\s+[0-9][0-9,.]*(?:K)?/g)) {
        const tag = cleanTag(match[1]);
        if (isUsefulTag(tag)) tags.push(tag);
      }
    }
    return mergeTags([], tags).slice(0, 12);
  }

  function pageMeta() {
    const body = document.body?.innerText || "";
    const rank = body.match(/Rank\s*#?\s*([0-9,]+)/i)?.[0] || "";
    const decks = body.match(/[0-9][0-9,.]*K?\s+decks/i)?.[0] || "";
    return [rank, decks].filter(Boolean).join(" / ");
  }

  function extractDeckCount(text) {
    const match = String(text || "").match(/([0-9][0-9,.]*)(K)?\s+decks/i);
    if (!match) return 0;
    const num = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(num) ? Math.round(num * (match[2] ? 1000 : 1)) : 0;
  }

  function commanderHaystack(card) {
    return [card.name, card.rank, card.decks, (card.colors || []).join(" "), ...(card.tags || [])].join(" ");
  }

  function profileHaystack(profile) {
    return [profile.name, profile.rating, profile.power, profile.complexity, profile.tableHeat, profile.pattern, profile.speed, profile.tags.join(" "), profile.likes.join(" "), profile.dislikes.join(" "), profile.notes].join(" ");
  }

  function cleanHeading(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s*\((?:Commander|Card)\)\s*$/i, "")
      .replace(/\bEDHREC\b.*$/i, "")
      .replace(/\s+\bCommander\b.*$/i, "")
      .replace(/[([]\s*$/g, "")
      .trim();
  }

  function cleanTag(value) {
    return String(value || "").replace(/[-_]+/g, " ").replace(/\s*[0-9][0-9,.]*(?:K)?\s*(?:decks?)?\s*$/i, "").replace(/\s+/g, " ").trim().replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function isUsefulTag(tag) {
    return Boolean(tag && tag.length >= 3 && tag.length <= 44 && !/^(tags?|decks?|cards?|budget|expensive|optimized|average deck|as commander|as card|view precon|clear|filter)$/i.test(tag));
  }

  function slugFromCommanderHref(href) {
    const path = href.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0].split("/").filter(Boolean);
    return path[0] === "commanders" ? path[1] || "" : "";
  }

  function scaleField(key, label, value) {
    return `<label class="mel-field"><span>${label}</span><select data-current-scale="${key}">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(value) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>`;
  }

  function selectField(key, label, value, options) {
    return `<label class="mel-field"><span>${label}</span><select data-current-select="${key}">${optionList(options, value)}</select></label>`;
  }

  function textField(key, label, value) {
    return `<label class="mel-field"><span>${label}</span><input data-current-field="${key}" value="${escapeAttr(value)}"></label>`;
  }

  function optionList(options, selected) {
    return options.map((option) => `<option value="${escapeAttr(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(labelize(option))}</option>`).join("");
  }

  function getPanel(name) {
    return document.querySelector(`[data-panel="${name}"]`);
  }

  function deckBuilderLinks(name) {
    const query = encodeURIComponent(name || "");
    if (!query) return "";
    return [
      ["Moxfield", `https://www.moxfield.com/decks/public/advanced?commanderCardName=${query}`],
      ["Archidekt", `https://archidekt.com/search/decks?commander=${query}`],
      ["Scryfall", `https://scryfall.com/search?q=${query}+is%3Acommander`]
    ].map(([label, url]) => `<a class="mel-link mel-builder-link" href="${url}" target="_blank" rel="noopener">${label}</a>`).join("");
  }

  function getInput(id) {
    return document.getElementById(id);
  }

  function extensionAssetUrl(path) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
        return chrome.runtime.getURL(path);
      }
    } catch {
      return "";
    }
    return "";
  }

  function defaultSearch() {
    return { query: "", minRank: "500", maxDecks: "", sort: "edge", pages: 5, hideOwned: true };
  }

  function statusLabel(status) {
    return ({ watch: "Watch", brew: "Brew", built: "Built", skip: "Skip" })[status] || "Watch";
  }

  function statusWeight(status) {
    return ({ brew: 0, watch: 1, built: 2, skip: 3 })[status] ?? 4;
  }

  function labelize(value) {
    return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function parseTags(value) {
    const list = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/);
    return mergeTags([], list.map(cleanTag));
  }

  function mergeTags(a, b) {
    const out = [];
    const seen = new Set();
    for (const value of [...(a || []), ...(b || [])]) {
      const text = cleanTag(value);
      const key = normalize(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }

  function topEntries(map, limit) {
    return Object.entries(map || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  }

  function titleFromSlug(slug) {
    return String(slug || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function slugify(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }

  function extractNumber(value) {
    const num = Number(String(value || "").replace(/,/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
  }

  function avg(values) {
    const nums = values.map(Number).filter(Number.isFinite);
    return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : 0;
  }

  function jaccard(a, b) {
    let intersection = 0;
    for (const item of a) if (b.has(item)) intersection += 1;
    const union = new Set([...a, ...b]).size;
    return union ? intersection / union : 0;
  }

  function numberSort(a, b) {
    const na = Number(a) || Number.MAX_SAFE_INTEGER;
    const nb = Number(b) || Number.MAX_SAFE_INTEGER;
    return na - nb;
  }

  function formatCompact(value) {
    const num = Number(value || 0);
    if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(num || 0);
  }

  function safeJson(text, fallback) {
    try { return text ? JSON.parse(text) : fallback; } catch { return fallback; }
  }

  function getNested(value, path, fallback) {
    let current = value;
    for (const part of path) {
      if (!current || typeof current !== "object" || !(part in current)) return fallback;
      current = current[part];
    }
    return current;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #mel-root {
        position: fixed;
        top: 84px;
        right: 0;
        z-index: 2147483000;
        width: min(420px, calc(100vw - 16px));
        height: min(760px, calc(100vh - 104px));
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        color: #16201d;
        font: 13px/1.42 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transform: translateX(calc(100% - 42px));
        transition: transform 160ms ease;
      }
      #mel-root:hover,
      #mel-root:focus-within,
      #mel-root.is-pinned { transform: translateX(0); }
      #mel-root * { box-sizing: border-box; }
      #mel-root button,
      #mel-root input,
      #mel-root select,
      #mel-root textarea { font: inherit; }
      #mel-root button,
      #mel-root .mel-file {
        min-height: 30px;
        border: 1px solid #d7ded9;
        border-radius: 6px;
        background: #fff;
        color: #40504a;
        padding: 0 9px;
        cursor: pointer;
      }
      #mel-root button:hover,
      #mel-root .mel-file:hover,
      #mel-root button.is-active {
        border-color: #236fae;
        background: #e8f2fb;
        color: #236fae;
      }
      #mel-root input,
      #mel-root select,
      #mel-root textarea {
        width: 100%;
        border: 1px solid #d7ded9;
        border-radius: 6px;
        background: #fff;
        color: #16201d;
        padding: 7px 8px;
      }
      #mel-root textarea { resize: vertical; }
      #mel-root .mel-rail {
        display: grid;
        align-content: start;
        gap: 6px;
        padding: 8px 5px;
        border: 1px solid #d7ded9;
        border-right: 0;
        border-radius: 8px 0 0 8px;
        background: #16201d;
        box-shadow: 0 10px 28px rgba(0,0,0,.2);
      }
      #mel-root .mel-rail button {
        min-height: 54px;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        border-color: rgba(255,255,255,.18);
        background: transparent;
        color: #fff;
        padding: 7px 0;
      }
      #mel-root .mel-rail button.is-active {
        background: #e8f2fb;
        color: #16201d;
      }
      #mel-root .mel-panel {
        min-width: 0;
        overflow: hidden;
        border: 1px solid #d7ded9;
        border-radius: 8px 0 0 8px;
        background: #f7f8f5;
        box-shadow: 0 10px 28px rgba(0,0,0,.2);
      }
      #mel-root .mel-header {
        min-height: 52px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 9px 12px;
        border-bottom: 1px solid #d7ded9;
        background: #fff;
      }
      #mel-root .mel-brand {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
      }
      #mel-root .mel-brand img,
      #mel-root .mel-brand-fallback {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 7px;
        background: #080909;
      }
      #mel-root .mel-brand img {
        display: block;
        object-fit: cover;
      }
      #mel-root .mel-brand-fallback {
        display: grid;
        place-items: center;
        color: #e8ff00;
        border: 1px solid #ff0081;
        font-weight: 900;
      }
      #mel-root .mel-header strong,
      #mel-root h2,
      #mel-root h3 { display: block; margin: 0; color: #16201d; }
      #mel-root .mel-header span,
      #mel-root p,
      #mel-root .mel-small,
      #mel-root .mel-card span { color: #65736d; font-size: 12px; }
      #mel-root .mel-tabs {
        height: calc(100% - 52px);
        overflow: auto;
        padding: 12px;
      }
      #mel-root .mel-section,
      #mel-root .mel-card,
      #mel-root .mel-empty {
        border: 1px solid #d7ded9;
        border-radius: 8px;
        background: #fff;
        padding: 10px;
        margin-bottom: 9px;
      }
      #mel-root details.mel-section summary {
        cursor: pointer;
        color: #16201d;
        font-weight: 800;
        margin-bottom: 8px;
      }
      #mel-root .mel-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 9px;
      }
      #mel-root .mel-wide { grid-column: 1 / -1; }
      #mel-root .mel-field span {
        display: block;
        margin-bottom: 3px;
        color: #65736d;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }
      #mel-root .mel-check {
        min-height: 34px;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 8px;
        border: 1px solid #d7ded9;
        border-radius: 6px;
        background: #fff;
      }
      #mel-root .mel-check input { width: auto; }
      #mel-root .mel-button-row,
      #mel-root .mel-chip-row,
      #mel-root .mel-stars {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 9px;
      }
      #mel-root .mel-chip-row button {
        min-height: 26px;
        border-radius: 999px;
        background: #eef3f0;
        font-size: 12px;
      }
      #mel-root .mel-stars button {
        min-width: 34px;
        color: #9a631d;
        font-weight: 800;
      }
      #mel-root .mel-card {
        display: grid;
        gap: 6px;
      }
      #mel-root .mel-card strong { font-size: 14px; }
      #mel-root .mel-metrics {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
        margin-bottom: 9px;
      }
      #mel-root .mel-metrics div {
        border: 1px solid #d7ded9;
        border-radius: 8px;
        background: #fff;
        padding: 8px;
      }
      #mel-root .mel-metrics b { display: block; font-size: 16px; }
      #mel-root .mel-metrics span { color: #65736d; font-size: 10px; text-transform: uppercase; }
      #mel-root .mel-link { color: #236fae; font-size: 12px; }
      #mel-root .mel-builder-link {
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #d7ded9;
        border-radius: 6px;
        background: #fff;
        padding: 0 9px;
        text-decoration: none;
      }
      #mel-root .mel-builder-link:hover {
        border-color: #236fae;
        background: #e8f2fb;
      }
      #mel-root .mel-file input { display: none; }
      .mel-inline-badge {
        display: inline-flex;
        margin-left: 5px;
        padding: 1px 6px;
        border-radius: 999px;
        background: #e8f2fb;
        color: #236fae;
        font-size: 10px;
        font-weight: 800;
        vertical-align: middle;
      }
      a.mel-owned-link .mel-inline-badge {
        background: #e7f4ed;
        color: #26734d;
      }
      @media (max-width: 720px) {
        #mel-root {
          top: auto;
          bottom: 10px;
          height: min(620px, calc(100vh - 20px));
          width: calc(100vw - 8px);
        }
      }
    `;
    document.head.append(style);
  }
})();
