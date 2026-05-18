(() => {
  "use strict";

  const CONFIG = {
    edhrecBase: "https://edhrec.com",
    edhrecJsonBase: "https://json.edhrec.com/pages/",
    bootstrapPath: "commanders/year.json",
    storageIdeas: "commanderEdgeboard.ideas.v1",
    storageOwned: "commanderEdgeboard.ownedText.v1",
    storageProfile: "commanderEdgeboard.profile.v1",
    storageFilters: "commanderEdgeboard.filters.v1",
    storageSnapshot: "commanderEdgeboard.snapshot.v1"
  };

  const DEFAULT_FILTERS = {
    search: "",
    tag: "",
    sort: "edgeFit",
    minRank: "",
    maxDecks: "",
    colorMode: "any",
    colors: [],
    popularity: "all",
    edgeTarget: "fresh",
    hideOwned: false,
    hideSkipped: true
  };

  const els = {};
  const state = {
    catalog: [],
    snapshot: [],
    ideas: {},
    ownedText: "",
    filters: { ...DEFAULT_FILTERS },
    deckProfiles: [],
    selectedKey: ""
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    loadState();
    rebuildCatalog();
    bindEvents();
    applyInputs();
    if (!state.selectedKey && state.catalog[0]) state.selectedKey = state.catalog[0].key;
    updateQuickLinks();
    render();
  }

  function cacheElements() {
    [
      "syncEdhrecButton", "exportButton", "importFile", "searchInput", "sortSelect",
      "syncPagesInput", "statusText", "edgeTargetGroup", "popularityGroup", "colorGroup",
      "colorModeSelect", "tagInput", "minRankInput", "maxDecksInput", "hideOwnedInput",
      "hideSkippedInput", "metricStrip", "resultCount", "commanderGrid", "commanderTemplate",
      "selectedCommander", "selectedEdhrecLink", "ownedInput", "saveOwnedButton",
      "profileMetrics", "profileTags", "radarList", "copyRadarButton", "savedList",
      "clearSavedButton", "quickLinkInput", "quickEdhrec", "quickScryfall",
      "quickMoxfield", "quickArchidekt", "copyOverlayUrlButton"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.syncEdhrecButton.addEventListener("click", syncEdhrecSnapshot);
    els.exportButton.addEventListener("click", exportState);
    els.importFile.addEventListener("change", importState);
    els.saveOwnedButton.addEventListener("click", () => {
      state.ownedText = els.ownedInput.value;
      saveOwned();
      render();
      setStatus("Profile updated.");
    });
    els.clearSavedButton.addEventListener("click", () => {
      if (!Object.keys(state.ideas).length) return;
      if (!window.confirm("Clear saved commander ideas?")) return;
      state.ideas = {};
      saveIdeas();
      render();
      setStatus("Saved ideas cleared.");
    });
    els.copyRadarButton.addEventListener("click", copyRadar);
    els.copyOverlayUrlButton.addEventListener("click", copyOverlayUrl);
    els.quickLinkInput.addEventListener("input", updateQuickLinks);

    [
      els.searchInput, els.sortSelect, els.colorModeSelect, els.tagInput,
      els.minRankInput, els.maxDecksInput, els.hideOwnedInput, els.hideSkippedInput
    ].forEach((el) => {
      el.addEventListener("input", () => {
        readInputs();
        saveFilters();
        render();
      });
      el.addEventListener("change", () => {
        readInputs();
        saveFilters();
        render();
      });
    });

    els.colorGroup.addEventListener("change", () => {
      readInputs();
      saveFilters();
      render();
    });

    els.edgeTargetGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edge-target]");
      if (!button) return;
      state.filters.edgeTarget = button.dataset.edgeTarget;
      saveFilters();
      render();
    });

    els.popularityGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-popularity]");
      if (!button) return;
      state.filters.popularity = button.dataset.popularity;
      saveFilters();
      render();
    });

    els.commanderGrid.addEventListener("click", (event) => {
      const statusButton = event.target.closest("[data-status]");
      const cardEl = event.target.closest(".commander-card");
      if (!cardEl) return;
      const card = cardByKey(cardEl.dataset.key);
      if (!card) return;
      if (statusButton) {
        setIdeaStatus(card, statusButton.dataset.status);
        state.selectedKey = card.key;
        render();
        return;
      }
      if (event.target.closest("[data-action='select']")) {
        state.selectedKey = card.key;
        render();
      }
    });

    els.selectedCommander.addEventListener("input", (event) => {
      const card = selectedCard();
      if (!card) return;
      const target = event.target;
      const idea = ensureIdea(card, false);
      if (target.matches("[data-selected-tags]")) idea.tags = parseTags(target.value);
      if (target.matches("[data-selected-notes]")) idea.notes = target.value;
      idea.updatedAt = new Date().toISOString();
      state.ideas[card.key] = idea;
      saveIdeas();
      renderSecondary();
    });

    els.selectedCommander.addEventListener("change", (event) => {
      const card = selectedCard();
      if (!card) return;
      const target = event.target;
      if (target.matches("[data-selected-status]")) {
        setIdeaStatus(card, target.value);
        render();
      }
    });

    els.savedList.addEventListener("click", (event) => {
      const selectButton = event.target.closest("[data-select-key]");
      const removeButton = event.target.closest("[data-remove-key]");
      if (selectButton) {
        state.selectedKey = selectButton.dataset.selectKey;
        render();
      }
      if (removeButton) {
        delete state.ideas[removeButton.dataset.removeKey];
        saveIdeas();
        render();
      }
    });

    els.radarList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-radar-key]");
      if (!button) return;
      const card = cardByKey(button.dataset.radarKey);
      if (!card) return;
      state.selectedKey = card.key;
      if (button.dataset.radarAction === "watch") setIdeaStatus(card, "watch");
      render();
    });
  }

  function loadState() {
    state.ideas = normalizeIdeas(safeJsonParse(localStorage.getItem(CONFIG.storageIdeas), {}));
    state.ownedText = localStorage.getItem(CONFIG.storageOwned) || "";
    state.deckProfiles = normalizeDeckProfiles(safeJsonParse(localStorage.getItem(CONFIG.storageProfile), []));
    state.filters = { ...DEFAULT_FILTERS, ...safeJsonParse(localStorage.getItem(CONFIG.storageFilters), {}) };
    state.snapshot = normalizeSnapshot(safeJsonParse(localStorage.getItem(CONFIG.storageSnapshot), []));
  }

  function saveIdeas() {
    localStorage.setItem(CONFIG.storageIdeas, JSON.stringify(state.ideas));
  }

  function saveOwned() {
    localStorage.setItem(CONFIG.storageOwned, state.ownedText);
  }

  function saveFilters() {
    localStorage.setItem(CONFIG.storageFilters, JSON.stringify(state.filters));
  }

  function saveSnapshot() {
    localStorage.setItem(CONFIG.storageSnapshot, JSON.stringify(state.snapshot));
  }

  function saveDeckProfiles() {
    localStorage.setItem(CONFIG.storageProfile, JSON.stringify(state.deckProfiles));
  }

  function applyInputs() {
    if (!Array.isArray(state.filters.colors)) state.filters.colors = [];
    els.searchInput.value = state.filters.search || "";
    els.sortSelect.value = state.filters.sort || DEFAULT_FILTERS.sort;
    els.colorModeSelect.value = state.filters.colorMode || DEFAULT_FILTERS.colorMode;
    els.tagInput.value = state.filters.tag || "";
    els.minRankInput.value = state.filters.minRank || "";
    els.maxDecksInput.value = state.filters.maxDecks || "";
    els.hideOwnedInput.checked = Boolean(state.filters.hideOwned);
    els.hideSkippedInput.checked = state.filters.hideSkipped !== false;
    els.ownedInput.value = state.ownedText;
    for (const input of colorInputs()) input.checked = state.filters.colors.includes(input.value);
  }

  function readInputs() {
    state.filters.search = els.searchInput.value.trim();
    state.filters.sort = els.sortSelect.value;
    state.filters.colorMode = els.colorModeSelect.value;
    state.filters.tag = els.tagInput.value.trim();
    state.filters.minRank = els.minRankInput.value.trim();
    state.filters.maxDecks = els.maxDecksInput.value.trim();
    state.filters.hideOwned = els.hideOwnedInput.checked;
    state.filters.hideSkipped = els.hideSkippedInput.checked;
    state.filters.colors = colorInputs().filter((input) => input.checked).map((input) => input.value);
  }

  function colorInputs() {
    return Array.from(els.colorGroup.querySelectorAll("input[type='checkbox']"));
  }

  function rebuildCatalog() {
    const byKey = new Map();
    const seed = (window.EdgeboardSeedCommanders || []).map(normalizeCommander).filter(Boolean);
    for (const card of seed) byKey.set(card.key, card);
    for (const card of state.snapshot.map(normalizeCommander).filter(Boolean)) {
      const existing = byKey.get(card.key);
      byKey.set(card.key, existing ? mergeCommander(existing, card) : card);
    }
    state.catalog = Array.from(byKey.values()).sort((a, b) => compareNumber(a.rank, b.rank) || a.name.localeCompare(b.name));
  }

  function mergeCommander(seed, incoming) {
    return {
      ...seed,
      ...incoming,
      tags: unique([...(seed.tags || []), ...(incoming.tags || [])]),
      mechanics: unique([...(seed.mechanics || []), ...(incoming.mechanics || [])]),
      colors: incoming.colors.length ? incoming.colors : seed.colors,
      summary: seed.summary || incoming.summary,
      source: incoming.source || seed.source
    };
  }

  function normalizeCommander(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || raw.card_name || raw.label || "").trim();
    if (!name) return null;
    const slug = raw.slug || raw.sanitized || slugify(name);
    return {
      key: slug,
      name,
      slug,
      rank: toNumber(raw.rank || raw.salt || 0),
      decks: toNumber(raw.decks || raw.num_decks || raw.inclusion || raw.count || raw.deck_count || 0),
      colors: sortColors(raw.colors || raw.colorIdentity || raw.color_identity || []),
      tags: unique([...(raw.tags || []), ...(raw.edhrecTags || []), ...(raw.inferredLabels || [])].map(cleanLabel)),
      mechanics: unique((raw.mechanics || raw.keywords || []).map(cleanLabel)),
      summary: String(raw.summary || raw.description || ""),
      url: absoluteEdhrecUrl(raw.url || `/commanders/${slug}`),
      source: raw.source || "edhrec"
    };
  }

  function normalizeSnapshot(raw) {
    const list = Array.isArray(raw) ? raw : Array.isArray(raw.commanders) ? raw.commanders : [];
    return list.map(normalizeCommander).filter(Boolean);
  }

  function normalizeIdeas(raw) {
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    const values = Array.isArray(raw) ? raw : Object.values(raw);
    for (const item of values) {
      if (!item || typeof item !== "object") continue;
      const name = String(item.name || item.commander || "").trim();
      if (!name) continue;
      const key = item.key || item.slug || item.sanitized || slugify(name);
      const incomingTags = [
        ...coerceTagArray(item.tags),
        ...coerceTagArray(item.buildIntent),
        ...coerceTagArray(item.edhrecBuildTags).map((tag) => typeof tag === "object" ? tag.label || tag.name || "" : tag)
      ];
      out[key] = {
        key,
        name,
        status: validStatus(item.status) ? item.status : "watch",
        tags: parseTags(incomingTags.join(", ")),
        notes: String(item.notes || ""),
        url: item.url || item.edhrecUrl || absoluteEdhrecUrl(`/commanders/${key}`),
        savedAt: item.savedAt || item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.savedAt || new Date().toISOString()
      };
    }
    return out;
  }

  async function syncEdhrecSnapshot() {
    const pages = clamp(parseInt(els.syncPagesInput.value, 10) || 3, 1, 12);
    setStatus(`Refreshing ${pages} EDHREC page(s)...`);
    try {
      const bootstrap = await fetchEdhrecJson(CONFIG.bootstrapPath);
      const firstList = selectCommanderList(getNested(bootstrap, ["container", "json_dict", "cardlists"], []));
      const cards = [...(firstList.cardviews || [])];
      const pattern = buildPagePattern(firstList.more || "");
      for (let pageIndex = 1; pageIndex < pages; pageIndex += 1) {
        if (!pattern) break;
        const payload = await fetchEdhrecJson(`${pattern.prefix}${pageIndex}${pattern.suffix}`);
        const views = Array.isArray(payload.cardviews)
          ? payload.cardviews
          : getNested(payload, ["container", "json_dict", "cardlists", 0, "cardviews"], []);
        cards.push(...views);
      }
      state.snapshot = cards.map((card) => ({ ...card, source: "edhrec" }));
      saveSnapshot();
      rebuildCatalog();
      if (!state.selectedKey && state.catalog[0]) state.selectedKey = state.catalog[0].key;
      render();
      setStatus(`Loaded ${state.snapshot.length.toLocaleString()} EDHREC ranked commanders.`);
    } catch (error) {
      setStatus(`EDHREC refresh failed: ${error.message || error}`, true);
    }
  }

  async function fetchEdhrecJson(path) {
    const url = /^https?:/i.test(path) ? path : CONFIG.edhrecJsonBase + path.replace(/^\/+/, "");
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function selectCommanderList(cardlists) {
    if (!Array.isArray(cardlists) || !cardlists.length) return { cardviews: [], more: "" };
    return cardlists.find((list) => list.tag === "past2years")
      || cardlists.find((list) => /past\s*2\s*years/i.test(list.header || ""))
      || cardlists[0];
  }

  function buildPagePattern(firstMorePath) {
    const match = String(firstMorePath || "").match(/^(.*?)(\d+)(\.json(?:\?.*)?)$/);
    return match ? { prefix: match[1], suffix: match[3] } : null;
  }

  function render() {
    updateSegmented();
    const cards = filteredCards();
    renderMetrics(cards);
    renderCards(cards);
    renderSelected();
    renderSecondary(cards);
  }

  function renderSecondary(cards = filteredCards()) {
    renderProfile();
    renderRadar(cards);
    renderSaved();
  }

  function updateSegmented() {
    for (const button of els.edgeTargetGroup.querySelectorAll("[data-edge-target]")) {
      button.classList.toggle("active", button.dataset.edgeTarget === state.filters.edgeTarget);
      button.setAttribute("aria-pressed", String(button.dataset.edgeTarget === state.filters.edgeTarget));
    }
    for (const button of els.popularityGroup.querySelectorAll("[data-popularity]")) {
      button.classList.toggle("active", button.dataset.popularity === state.filters.popularity);
      button.setAttribute("aria-pressed", String(button.dataset.popularity === state.filters.popularity));
    }
  }

  function renderMetrics(cards) {
    const owned = parseOwnedProfiles();
    const avgEdge = cards.length ? avg(cards.map((card) => edgeScore(card, owned))) : 0;
    const avgTaste = cards.length ? avg(cards.map((card) => preferenceScore(card, owned))) : 0;
    const savedCount = Object.keys(state.ideas).filter((key) => state.ideas[key].status !== "skip").length;
    const metrics = [
      metric(`${cards.length.toLocaleString()}`, "visible"),
      metric(`${Math.round(avgEdge)}`, "avg edge"),
      metric(`${Math.round(avgTaste)}`, "avg taste"),
      metric(`${owned.length.toLocaleString()}`, "owned decks"),
      metric(`${savedCount.toLocaleString()}`, "saved ideas")
    ];
    els.metricStrip.replaceChildren(...metrics);
    els.resultCount.textContent = `${cards.length.toLocaleString()} result${cards.length === 1 ? "" : "s"}`;
  }

  function renderCards(cards) {
    const ownedNames = new Set(parseOwnedProfiles().map((profile) => normalizeName(profile.name)));
    const fragment = document.createDocumentFragment();
    const visible = cards.slice(0, 96);
    for (const card of visible) {
      const idea = state.ideas[card.key];
      const template = els.commanderTemplate.content.firstElementChild.cloneNode(true);
      template.dataset.key = card.key;
      template.classList.toggle("selected", card.key === state.selectedKey);
      template.classList.toggle("owned", ownedNames.has(normalizeName(card.name)));
      template.classList.toggle("skip", idea?.status === "skip");
      template.querySelector(".rank-pill").textContent = card.rank ? `#${card.rank}` : "local";
      template.querySelector(".commander-title").textContent = card.name;
      template.querySelector(".mana-row").replaceChildren(...manaSymbols(card.colors));
      template.querySelector(".tag-row").replaceChildren(...tagChips(displayTags(card).slice(0, 4)));
      template.querySelector(".score-row").replaceChildren(...scoreCells(card));
      for (const button of template.querySelectorAll("[data-status]")) {
        button.classList.toggle("active", idea?.status === button.dataset.status);
      }
      template.querySelector("a").href = card.url;
      fragment.append(template);
    }
    if (!visible.length) fragment.append(emptyState("No commanders match the current filters."));
    els.commanderGrid.replaceChildren(fragment);
  }

  function renderSelected() {
    const card = selectedCard();
    if (!card) {
      els.selectedCommander.textContent = "Select a commander.";
      els.selectedEdhrecLink.href = `${CONFIG.edhrecBase}/commanders`;
      return;
    }
    const idea = state.ideas[card.key] || {};
    const owned = parseOwnedProfiles();
    els.selectedEdhrecLink.href = card.url;

    const wrap = document.createElement("div");
    wrap.className = "selected-detail";

    const title = document.createElement("div");
    title.className = "selected-title";
    const titleText = document.createElement("h3");
    titleText.textContent = card.name;
    const titleMeta = document.createElement("span");
    titleMeta.textContent = `${card.rank ? `#${card.rank}` : "local"} / ${formatCompact(card.decks)} decks`;
    title.append(titleText, titleMeta);

    const mana = document.createElement("div");
    mana.className = "mana-row";
    mana.replaceChildren(...manaSymbols(card.colors));

    const tags = document.createElement("div");
    tags.className = "tag-cloud";
    tags.replaceChildren(...tagChips(displayTags(card).slice(0, 10)));

    const scores = document.createElement("div");
    scores.className = "score-row";
    scores.replaceChildren(...scoreCells(card, owned));

    const summary = document.createElement("p");
    summary.className = "selected-summary";
    summary.textContent = card.summary || "Rank-only EDHREC snapshot entry.";

    const grid = document.createElement("div");
    grid.className = "selected-grid";
    const statusLabel = labeled("Status", "select");
    statusLabel.control.dataset.selectedStatus = "true";
    ["watch", "brew", "built", "skip"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = statusLabelText(status);
      option.selected = (idea.status || "watch") === status;
      statusLabel.control.append(option);
    });
    const tagLabel = labeled("Local tags", "input");
    tagLabel.control.dataset.selectedTags = "true";
    tagLabel.control.value = (idea.tags || []).join(", ");
    grid.append(statusLabel.label, tagLabel.label);

    const notes = labeled("Notes", "textarea");
    notes.control.dataset.selectedNotes = "true";
    notes.control.value = idea.notes || "";

    wrap.append(title, mana, tags, scores, summary, grid, notes.label);
    els.selectedCommander.replaceChildren(wrap);
  }

  function renderProfile() {
    const owned = parseOwnedProfiles();
    const tagCounts = countValues(owned.flatMap((profile) => [...profile.tags, ...profile.likes]));
    const dislikeCounts = countValues(owned.flatMap((profile) => profile.dislikes));
    const colorCounts = countValues(owned.flatMap((profile) => profile.colors));
    const profileFeatures = new Set(owned.flatMap((profile) => Array.from(featuresFor(profile))));
    const avgRating = owned.length ? avg(owned.map((profile) => profile.rating || 3)) : 0;
    const avgHeat = owned.length ? avg(owned.map((profile) => profile.tableHeat || 3)) : 0;
    els.profileMetrics.replaceChildren(
      metric(owned.length, "decks"),
      metric(avgRating ? avgRating.toFixed(1) : "0", "avg stars"),
      metric(avgHeat ? avgHeat.toFixed(1) : "avg", "heat")
    );
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
    const dislikes = Object.entries(dislikeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
    const colorTags = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).map(([color, count]) => `${color} ${count}`);
    els.profileTags.replaceChildren(...tagChips([
      ...colorTags,
      ...topTags.map(([tag, count]) => `${tag} ${count}`),
      ...dislikes.map(([tag, count]) => `avoid ${tag} ${count}`)
    ]));
    if (!owned.length) els.profileTags.replaceChildren(emptyState("No existing decks analyzed."));
  }

  function renderRadar(cards) {
    const owned = parseOwnedProfiles();
    const candidates = cards
      .filter((card) => !isOwned(card.name, owned))
      .filter((card) => state.ideas[card.key]?.status !== "skip")
      .slice()
      .sort((a, b) => edgeFitScore(b, owned) - edgeFitScore(a, owned))
      .slice(0, 7);
    const nodes = candidates.map((card) => {
      const item = document.createElement("div");
      item.className = "stack-item";
      const title = document.createElement("strong");
      title.textContent = card.name;
      const meta = document.createElement("span");
      meta.textContent = `Edge ${Math.round(edgeScore(card, owned))} / off-meta ${Math.round(offMetaScore(card))} / diff ${Math.round(differenceScore(card, owned) * 100)}`;
      const chips = document.createElement("div");
      chips.className = "tag-cloud";
      chips.style.marginTop = "7px";
      chips.replaceChildren(...tagChips(displayTags(card).slice(0, 4)));
      const actions = document.createElement("div");
      actions.className = "stack-actions";
      const select = miniButton("Select");
      select.dataset.radarKey = card.key;
      const watch = miniButton("Watch");
      watch.dataset.radarKey = card.key;
      watch.dataset.radarAction = "watch";
      const link = document.createElement("a");
      link.className = "button small";
      link.href = card.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "EDHREC";
      actions.append(select, watch, link);
      item.append(title, meta, chips, actions);
      return item;
    });
    els.radarList.replaceChildren(...(nodes.length ? nodes : [emptyState("No radar candidates.")]));
  }

  function renderSaved() {
    const saved = Object.values(state.ideas).sort((a, b) => {
      const sa = statusWeight(a.status);
      const sb = statusWeight(b.status);
      if (sa !== sb) return sa - sb;
      return String(b.updatedAt || b.savedAt || "").localeCompare(String(a.updatedAt || a.savedAt || ""));
    });
    const nodes = saved.map((idea) => {
      const card = cardByKey(idea.key) || normalizeCommander(idea);
      const item = document.createElement("div");
      item.className = "stack-item";
      const title = document.createElement("strong");
      title.textContent = idea.name;
      const meta = document.createElement("span");
      meta.textContent = statusLabelText(idea.status);
      const chips = document.createElement("div");
      chips.className = "tag-cloud";
      chips.style.marginTop = "7px";
      chips.replaceChildren(...tagChips(unique([...(idea.tags || []), ...displayTags(card).slice(0, 3)])));
      const actions = document.createElement("div");
      actions.className = "stack-actions";
      const select = miniButton("Select");
      select.dataset.selectKey = idea.key;
      const remove = miniButton("Remove");
      remove.dataset.removeKey = idea.key;
      const link = document.createElement("a");
      link.className = "button small";
      link.href = idea.url || card.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "EDHREC";
      actions.append(select, remove, link);
      item.append(title, meta, chips, actions);
      return item;
    });
    els.savedList.replaceChildren(...(nodes.length ? nodes : [emptyState("No saved ideas.")]));
  }

  function filteredCards() {
    const owned = parseOwnedProfiles();
    const filtered = state.catalog.filter((card) => passesFilters(card, owned));
    filtered.sort((a, b) => sortCards(a, b, owned));
    return filtered;
  }

  function passesFilters(card, owned) {
    const f = state.filters;
    const idea = state.ideas[card.key];
    if (f.hideOwned && isOwned(card.name, owned)) return false;
    if (f.hideSkipped && idea?.status === "skip") return false;
    if (f.minRank && card.rank && card.rank < Number(f.minRank)) return false;
    if (f.maxDecks && card.decks && card.decks > Number(f.maxDecks)) return false;
    if (!passesPopularity(card, f.popularity)) return false;
    if (!passesColors(card, f.colors, f.colorMode)) return false;
    if (f.search && !termsPass(haystack(card, idea), f.search)) return false;
    if (f.tag && !termsPass(normalizeName([...displayTags(card), ...(idea?.tags || [])].join(" ")), f.tag)) return false;
    return true;
  }

  function passesPopularity(card, popularity) {
    if (popularity === "underplayed") return !card.decks || card.decks <= 7500 || card.rank >= 450;
    if (popularity === "deep") return !card.decks || card.decks <= 2000 || card.rank >= 950;
    if (popularity === "fringe") return !card.decks || card.decks <= 800 || card.rank >= 1800;
    return true;
  }

  function passesColors(card, selected, mode) {
    if (!selected || !selected.length) return true;
    const colors = card.colors.length ? card.colors : ["C"];
    const set = new Set(colors);
    if (mode === "all") return selected.every((color) => set.has(color));
    if (mode === "exact") return selected.length === colors.length && selected.every((color) => set.has(color));
    if (mode === "exclude") return selected.every((color) => !set.has(color));
    return selected.some((color) => set.has(color));
  }

  function sortCards(a, b, owned) {
    const sort = state.filters.sort;
    if (sort === "edge") return edgeScore(b, owned) - edgeScore(a, owned) || compareNumber(a.rank, b.rank);
    if (sort === "offMeta") return offMetaScore(b) - offMetaScore(a) || compareNumber(a.rank, b.rank);
    if (sort === "different") return differenceScore(b, owned) - differenceScore(a, owned) || offMetaScore(b) - offMetaScore(a);
    if (sort === "taste") return preferenceScore(b, owned) - preferenceScore(a, owned) || edgeScore(b, owned) - edgeScore(a, owned);
    if (sort === "rank") return compareNumber(a.rank, b.rank) || a.name.localeCompare(b.name);
    if (sort === "decksAsc") return compareNumber(a.decks, b.decks) || compareNumber(a.rank, b.rank);
    if (sort === "name") return a.name.localeCompare(b.name);
    return edgeFitScore(b, owned) - edgeFitScore(a, owned) || edgeScore(b, owned) - edgeScore(a, owned);
  }

  function edgeScore(card, owned = parseOwnedProfiles()) {
    const off = offMetaScore(card);
    const diff = owned.length ? differenceScore(card, owned) * 100 : 55;
    const novelty = labelNoveltyScore(card, owned);
    const taste = preferenceScore(card, owned);
    const lowDeckBonus = card.decks ? clamp(100 - Math.log10(card.decks + 1) * 23, 0, 100) : 72;
    return clamp(off * 0.3 + diff * 0.24 + novelty * 0.2 + lowDeckBonus * 0.08 + taste * 0.18, 0, 100);
  }

  function edgeFitScore(card, owned = parseOwnedProfiles()) {
    const target = state.filters.edgeTarget || "fresh";
    const edge = edgeScore(card, owned);
    const off = offMetaScore(card);
    const diff = owned.length ? differenceScore(card, owned) * 100 : 55;
    const novelty = labelNoveltyScore(card, owned);
    const taste = preferenceScore(card, owned);
    if (target === "adjacent") return taste * 0.45 + (100 - diff) * 0.25 + (100 - Math.abs(edge - 38)) * 0.22 + off * 0.08;
    if (target === "weird") return (100 - Math.abs(edge - 78)) + novelty * 0.28 + diff * 0.18 + taste * 0.08;
    if (target === "fringe") return edge + off * 0.36 + novelty * 0.18 + taste * 0.06;
    return (100 - Math.abs(edge - 61)) + diff * 0.2 + off * 0.14 + taste * 0.18;
  }

  function offMetaScore(card) {
    const rankScore = card.rank ? clamp((card.rank - 250) / 22, 0, 100) : 65;
    const deckScore = card.decks ? clamp(100 - Math.log10(card.decks + 1) * 22, 0, 100) : 72;
    return rankScore * 0.62 + deckScore * 0.38;
  }

  function differenceScore(card, owned = parseOwnedProfiles()) {
    if (!owned.length) return 0.55;
    const cardFeatures = featuresFor(card);
    let best = 0;
    for (const profile of owned) {
      const ratingWeight = 0.55 + ((profile.rating || 3) / 5) * 0.45;
      best = Math.max(best, jaccard(cardFeatures, featuresFor(profile)) * ratingWeight);
    }
    return clamp(1 - best, 0, 1);
  }

  function labelNoveltyScore(card, owned = parseOwnedProfiles()) {
    const known = new Set([
      ...owned.flatMap((profile) => [...profile.tags, ...profile.likes].map(normalizeName)),
      ...Object.values(state.ideas).flatMap((idea) => (idea.tags || []).map(normalizeName))
    ]);
    const labels = displayTags(card).map(normalizeName).filter(Boolean);
    if (!labels.length) return known.size ? 35 : 55;
    if (!known.size) return 65;
    return Math.round(labels.filter((label) => !known.has(label)).length / labels.length * 100);
  }

  function preferenceScore(card, owned = parseOwnedProfiles()) {
    if (!owned.length) return 50;
    const candidateTags = displayTags(card).map(normalizeName);
    const candidateColors = new Set(card.colors || []);
    const signal = profileSignal(owned);
    let raw = 0;
    for (const tag of candidateTags) raw += signal.likes[tag] || 0;
    for (const tag of candidateTags) raw -= signal.dislikes[tag] || 0;
    for (const color of candidateColors) raw += signal.colors[color] || 0;
    const normalized = 50 + raw * 7;
    return clamp(normalized, 0, 100);
  }

  function profileSignal(owned) {
    const likes = {};
    const dislikes = {};
    const colors = {};
    for (const profile of owned) {
      const rating = Number(profile.rating || 3);
      const loveWeight = Math.max(0.5, rating - 2);
      const dislikeWeight = Math.max(0.5, 4 - rating);
      for (const tag of profile.tags || []) {
        const key = normalizeName(tag);
        if (!key) continue;
        if (rating >= 4) likes[key] = (likes[key] || 0) + loveWeight;
        if (rating <= 2) dislikes[key] = (dislikes[key] || 0) + dislikeWeight;
      }
      for (const tag of profile.likes || []) {
        const key = normalizeName(tag);
        if (key) likes[key] = (likes[key] || 0) + loveWeight + 1.5;
      }
      for (const tag of profile.dislikes || []) {
        const key = normalizeName(tag);
        if (key) dislikes[key] = (dislikes[key] || 0) + dislikeWeight + 1.5;
      }
      for (const color of profile.colors || []) {
        colors[color] = (colors[color] || 0) + (rating - 3) * 0.4;
      }
    }
    return { likes, dislikes, colors };
  }

  function normalizeDeckProfiles(raw) {
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list.map(normalizeDeckProfile).filter((profile) => profile.name);
  }

  function normalizeDeckProfile(raw) {
    const name = String(raw?.name || raw?.commander || "").trim();
    const matched = state.catalog.find((card) => normalizeName(card.name) === normalizeName(name));
    return {
      key: raw?.key || raw?.id || raw?.slug || matched?.key || slugify(name),
      id: raw?.id || raw?.key || raw?.slug || matched?.key || slugify(name),
      name,
      colors: parseColors(raw?.colors || raw?.colorIdentity || raw?.color_identity || matched?.colors || []),
      tags: parseTags([...coerceTagArray(raw?.tags), ...(matched?.tags || [])].join(", ")),
      likes: parseTags(raw?.likes || raw?.liked || ""),
      dislikes: parseTags(raw?.dislikes || raw?.disliked || ""),
      mechanics: unique([...coerceTagArray(raw?.mechanics), ...(matched?.mechanics || [])]),
      summary: String(raw?.summary || matched?.summary || ""),
      rating: clamp(parseInt(raw?.rating || raw?.stars || raw?.enjoyment || 3, 10), 1, 5),
      power: clamp(parseInt(raw?.power || 3, 10), 1, 5),
      complexity: clamp(parseInt(raw?.complexity || 3, 10), 1, 5),
      tableHeat: clamp(parseInt(raw?.tableHeat || raw?.heat || 3, 10), 1, 5),
      pattern: raw?.pattern || raw?.playPattern || "",
      speed: raw?.speed || "",
      deckStatus: normalizeDeckStatus(raw?.deckStatus || raw?.status || "active"),
      status: normalizeDeckStatus(raw?.deckStatus || raw?.status || "active"),
      sourceUrl: raw?.sourceUrl || raw?.url || raw?.edhrecUrl || matched?.url || "",
      notes: String(raw?.notes || "")
    };
  }

  function mergeDeckProfiles(base, incoming) {
    const map = new Map();
    for (const profile of [...(base || []), ...(incoming || [])]) {
      const normalized = normalizeDeckProfile(profile);
      if (!normalized.name) continue;
      const key = normalizeName(normalized.name);
      const existing = map.get(key);
      map.set(key, existing ? {
        ...existing,
        ...normalized,
        colors: normalized.colors.length ? normalized.colors : existing.colors,
        tags: unique([...existing.tags, ...normalized.tags]),
        likes: unique([...existing.likes, ...normalized.likes]),
        dislikes: unique([...existing.dislikes, ...normalized.dislikes]),
        mechanics: unique([...existing.mechanics, ...normalized.mechanics])
      } : normalized);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function profilesFromOwnedText(text) {
    return String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return normalizeDeckProfile({
        name: parts[0],
        tags: parseTags(parts[1] || ""),
        colors: parseColors(parts[2] || ""),
        rating: 3,
        status: "active"
      });
    });
  }

  function profilesFromIdeas(raw) {
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list
      .filter((idea) => idea && (idea.profileTouched || idea.status === "built" || idea.deckStatus === "active"))
      .map((idea) => normalizeDeckProfile({
        id: idea.key || idea.id,
        name: idea.name,
        colors: idea.colors || [],
        rating: idea.rating || 3,
        power: idea.power || 3,
        complexity: idea.complexity || 3,
        tableHeat: idea.tableHeat || idea.heat || 3,
        pattern: idea.pattern || idea.playPattern || "",
        speed: idea.speed || "",
        tags: [...coerceTagArray(idea.tags), ...coerceTagArray(idea.sourceTags)],
        likes: idea.likes || [],
        dislikes: idea.dislikes || [],
        notes: idea.notes || "",
        sourceUrl: idea.url || idea.edhrecUrl,
        status: idea.deckStatus || "active"
      }));
  }

  function normalizeDeckStatus(value) {
    if (["active", "testing", "retired", "dismantled"].includes(value)) return value;
    if (value === "built" || value === "brew" || value === "watch") return "active";
    if (value === "skip") return "dismantled";
    return "active";
  }

  function parseOwnedProfiles() {
    return mergeDeckProfiles(state.deckProfiles, profilesFromOwnedText(state.ownedText));
  }

  function featuresFor(item) {
    const set = new Set();
    for (const color of item.colors || []) set.add(`color:${color}`);
    for (const tag of item.tags || []) set.add(`tag:${normalizeName(tag)}`);
    for (const tag of item.likes || []) set.add(`tag:${normalizeName(tag)}`);
    for (const mechanic of item.mechanics || []) set.add(`mechanic:${normalizeName(mechanic)}`);
    if (item.pattern) set.add(`pattern:${normalizeName(item.pattern)}`);
    if (item.speed) set.add(`speed:${normalizeName(item.speed)}`);
    if (item.power) set.add(`power:${item.power}`);
    if (item.complexity) set.add(`complexity:${item.complexity}`);
    const text = normalizeName(item.summary || "");
    for (const term of ["artifact", "graveyard", "token", "counter", "combat", "control", "combo", "land", "spell", "politics", "sacrifice", "blink", "typal"]) {
      if (text.includes(term)) set.add(`text:${term}`);
    }
    return set;
  }

  function isOwned(name, owned = parseOwnedProfiles()) {
    const norm = normalizeName(name);
    return owned.some((profile) => normalizeName(profile.name) === norm);
  }

  function displayTags(card) {
    return unique([...(card.tags || []), ...(card.mechanics || [])].filter(Boolean));
  }

  function haystack(card, idea) {
    return normalizeName([
      card.name, card.rank, card.decks, card.colors.join(" "), displayTags(card).join(" "),
      card.summary, idea?.status, (idea?.tags || []).join(" "), idea?.notes
    ].join(" "));
  }

  function setIdeaStatus(card, status) {
    if (!validStatus(status)) return;
    const idea = ensureIdea(card, true);
    idea.status = status;
    idea.updatedAt = new Date().toISOString();
    state.ideas[card.key] = idea;
    saveIdeas();
    setStatus(`${card.name}: ${statusLabelText(status)}.`);
  }

  function ensureIdea(card, markSaved) {
    const existing = state.ideas[card.key] || {};
    return {
      key: card.key,
      name: card.name,
      status: existing.status || "watch",
      tags: existing.tags || [],
      notes: existing.notes || "",
      url: card.url,
      savedAt: existing.savedAt || new Date().toISOString(),
      updatedAt: markSaved ? new Date().toISOString() : existing.updatedAt || new Date().toISOString()
    };
  }

  async function exportState() {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "commander-edgeboard",
      ideas: Object.values(state.ideas),
      deckProfiles: state.deckProfiles,
      ownedText: state.ownedText,
      filters: state.filters,
      commanders: state.snapshot
    };
    downloadJson(payload, `commander-edgeboard-${new Date().toISOString().slice(0, 10)}.json`);
    setStatus("Export created.");
  }

  async function importState(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.ideas) mergeIdeas(payload.ideas);
      if (payload.interests) mergeIdeas(Object.values(payload.interests));
      if (Array.isArray(payload.ownedNames)) {
        state.ownedText = unique([...state.ownedText.split(/\n+/), ...payload.ownedNames]).join("\n").trim();
      }
      if (payload.ownedText) state.ownedText = payload.ownedText;
      if (payload.deckProfiles || payload.profiles || payload.ownedProfiles) {
        state.deckProfiles = mergeDeckProfiles(state.deckProfiles, normalizeDeckProfiles(payload.deckProfiles || payload.profiles || payload.ownedProfiles));
        saveDeckProfiles();
      }
      const importedProfileIdeas = profilesFromIdeas(payload.ideas || payload.interests || []);
      if (importedProfileIdeas.length) {
        state.deckProfiles = mergeDeckProfiles(state.deckProfiles, importedProfileIdeas);
        saveDeckProfiles();
      }
      if (payload.commanders || Array.isArray(payload.snapshot)) {
        state.snapshot = normalizeSnapshot(payload.commanders || payload.snapshot);
        saveSnapshot();
        rebuildCatalog();
      }
      if (payload.filters) state.filters = { ...DEFAULT_FILTERS, ...state.filters, ...payload.filters };
      saveIdeas();
      saveOwned();
      saveFilters();
      applyInputs();
      render();
      setStatus("Import merged.");
    } catch (error) {
      setStatus(`Import failed: ${error.message || error}`, true);
    }
  }

  function mergeIdeas(incoming) {
    const normalized = normalizeIdeas(incoming);
    state.ideas = { ...state.ideas, ...normalized };
  }

  async function copyRadar() {
    const owned = parseOwnedProfiles();
    const text = filteredCards()
      .filter((card) => !isOwned(card.name, owned))
      .sort((a, b) => edgeFitScore(b, owned) - edgeFitScore(a, owned))
      .slice(0, 12)
      .map((card) => `${card.name} - edge ${Math.round(edgeScore(card, owned))} - ${card.url}`)
      .join("\n");
    await copyText(text, "Radar copied.");
  }

  async function copyOverlayUrl() {
    const url = new URL("overlay/edhrec-companion.user.js", window.location.href).href;
    await copyText(url, "Overlay URL copied.");
  }

  function updateQuickLinks() {
    const name = els.quickLinkInput.value.trim();
    const slug = slugify(name || selectedCard()?.name || "");
    const query = encodeURIComponent(name || selectedCard()?.name || "");
    els.quickEdhrec.href = slug ? `${CONFIG.edhrecBase}/commanders/${slug}` : `${CONFIG.edhrecBase}/commanders`;
    els.quickScryfall.href = query ? `https://scryfall.com/search?q=${query}+is%3Acommander` : "https://scryfall.com/search?q=is%3Acommander";
    els.quickMoxfield.href = query ? `https://www.moxfield.com/decks/public/advanced?commanderCardName=${query}` : "https://www.moxfield.com/decks/public/advanced";
    els.quickArchidekt.href = query ? `https://archidekt.com/search/decks?commander=${query}` : "https://archidekt.com/search/decks";
  }

  function selectedCard() {
    return cardByKey(state.selectedKey) || state.catalog[0] || null;
  }

  function cardByKey(key) {
    return state.catalog.find((card) => card.key === key) || null;
  }

  function scoreCells(card, owned = parseOwnedProfiles()) {
    return [
      scoreCell(Math.round(edgeScore(card, owned)), "edge"),
      scoreCell(Math.round(offMetaScore(card)), "off"),
      scoreCell(Math.round(differenceScore(card, owned) * 100), "diff"),
      scoreCell(Math.round(preferenceScore(card, owned)), "taste")
    ];
  }

  function scoreCell(value, label) {
    const cell = document.createElement("div");
    cell.className = "score";
    const b = document.createElement("b");
    b.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    cell.append(b, span);
    return cell;
  }

  function metric(value, label) {
    const node = document.createElement("div");
    node.className = "metric";
    const b = document.createElement("b");
    b.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    node.append(b, span);
    return node;
  }

  function manaSymbols(colors) {
    const list = colors && colors.length ? colors : ["C"];
    return list.map((color) => {
      const node = document.createElement("span");
      node.className = `mana-symbol mana-${color}`;
      node.textContent = color;
      return node;
    });
  }

  function tagChips(tags) {
    return (tags || []).filter(Boolean).slice(0, 18).map((tag, index) => {
      const chip = document.createElement("span");
      chip.className = `chip ${index < 2 ? "good" : index < 5 ? "cool" : ""}`.trim();
      chip.textContent = tag;
      return chip;
    });
  }

  function labeled(text, type) {
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = text;
    let control;
    if (type === "textarea") control = document.createElement("textarea");
    else if (type === "select") control = document.createElement("select");
    else control = document.createElement("input");
    label.append(span, control);
    return { label, control };
  }

  function emptyState(text) {
    const node = document.createElement("div");
    node.className = "empty-state";
    node.textContent = text;
    return node;
  }

  function miniButton(text) {
    const button = document.createElement("button");
    button.className = "button small";
    button.type = "button";
    button.textContent = text;
    return button;
  }

  function setStatus(text, isError = false) {
    els.statusText.textContent = text;
    els.statusText.classList.toggle("error", isError);
  }

  function statusLabelText(status) {
    return ({ watch: "Watch", brew: "Brew soon", built: "Built", skip: "Skip" })[status] || "Watch";
  }

  function statusWeight(status) {
    return ({ brew: 0, watch: 1, built: 2, skip: 3 })[status] ?? 4;
  }

  function validStatus(status) {
    return ["watch", "brew", "built", "skip"].includes(status);
  }

  function parseTags(value) {
    if (Array.isArray(value)) return unique(value.map(cleanLabel));
    return unique(String(value || "").split(/[,;\n]+/).map(cleanLabel).filter(Boolean));
  }

  function coerceTagArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return String(value).split(/[,;\n]+/);
  }

  function parseColors(value) {
    if (Array.isArray(value)) return sortColors(value);
    return sortColors(String(value || "").toUpperCase().match(/[WUBRGC]/g) || []);
  }

  function sortColors(colors) {
    const order = ["W", "U", "B", "R", "G", "C"];
    return unique((colors || []).map(String).map((color) => color.toUpperCase()).filter((color) => order.includes(color)))
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  function cleanLabel(value) {
    return String(value || "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function slugify(value) {
    return normalizeName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function normalizeName(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function termsPass(haystackText, query) {
    const terms = normalizeName(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const text = String(haystackText || "");
    return terms.every((term) => text.includes(term));
  }

  function absoluteEdhrecUrl(url) {
    if (!url) return CONFIG.edhrecBase;
    if (/^https?:\/\//i.test(url)) return url;
    return `${CONFIG.edhrecBase}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  function compareNumber(a, b) {
    const na = Number.isFinite(Number(a)) && Number(a) > 0 ? Number(a) : Number.MAX_SAFE_INTEGER;
    const nb = Number.isFinite(Number(b)) && Number(b) > 0 ? Number(b) : Number.MAX_SAFE_INTEGER;
    return na - nb;
  }

  function toNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function avg(values) {
    const nums = values.filter((value) => Number.isFinite(Number(value)));
    return nums.length ? nums.reduce((sum, value) => sum + Number(value), 0) / nums.length : 0;
  }

  function countValues(values) {
    const out = {};
    for (const value of values || []) {
      const key = String(value || "").trim();
      if (!key) continue;
      out[key] = (out[key] || 0) + 1;
    }
    return out;
  }

  function jaccard(a, b) {
    if (!a.size && !b.size) return 0;
    let intersection = 0;
    for (const item of a) if (b.has(item)) intersection += 1;
    const union = new Set([...a, ...b]).size;
    return union ? intersection / union : 0;
  }

  function unique(values) {
    const out = [];
    const seen = new Set();
    for (const value of values || []) {
      const text = String(value || "").trim();
      const key = normalizeName(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatCompact(value) {
    const number = Number(value || 0);
    if (!number) return "0";
    if (number >= 1000000) return `${(number / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(number);
  }

  function safeJsonParse(text, fallback) {
    try {
      return text ? JSON.parse(text) : fallback;
    } catch {
      return fallback;
    }
  }

  function getNested(value, path, fallback = undefined) {
    let current = value;
    for (const part of path) {
      if (current == null || typeof current !== "object" || !(part in current)) return fallback;
      current = current[part];
    }
    return current;
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text, successMessage) {
    if (!text) {
      setStatus("Nothing to copy.", true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus(successMessage);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      setStatus(successMessage);
    }
  }
})();
