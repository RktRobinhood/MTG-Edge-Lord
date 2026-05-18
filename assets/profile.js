(() => {
  "use strict";

  const CONFIG = {
    storageProfile: "commanderEdgeboard.profile.v1",
    storageOwned: "commanderEdgeboard.ownedText.v1",
    storageIdeas: "commanderEdgeboard.ideas.v1"
  };

  const DEFAULT_PROFILE = {
    id: "",
    name: "",
    colors: [],
    rating: 3,
    power: 3,
    complexity: 3,
    tableHeat: 3,
    pattern: "value",
    speed: "mid",
    status: "active",
    tags: [],
    likes: [],
    dislikes: [],
    notes: "",
    sourceUrl: "",
    createdAt: "",
    updatedAt: ""
  };

  const els = {};
  const state = {
    catalog: [],
    profiles: [],
    selectedId: "",
    search: "",
    statusFilter: "all",
    draftRating: 3
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    state.catalog = (window.EdgeboardSeedCommanders || []).map(normalizeCatalogCard).filter(Boolean);
    fillCommanderOptions();
    loadProfiles();
    bindEvents();
    state.selectedId = state.profiles[0]?.id || "";
    applySelectedToForm();
    render();
  }

  function cacheElements() {
    [
      "newProfileButton", "exportProfileButton", "importProfileFile", "profileStatus",
      "commanderNameInput", "commanderOptions", "profileColorGroup", "ratingGroup",
      "powerInput", "complexityInput", "tableHeatInput", "patternSelect", "speedSelect",
      "deckStatusSelect", "deckTagsInput", "likesInput", "dislikesInput", "sourceUrlInput",
      "profileNotesInput", "saveProfileButton", "deleteProfileButton", "profileSearchInput",
      "profileStatusFilter", "profileList", "profileCount", "habitMetrics", "likedSignals",
      "dislikedSignals", "patternSignals", "searchAngles", "copyInsightsButton"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.newProfileButton.addEventListener("click", () => {
      state.selectedId = "";
      state.draftRating = 3;
      applySelectedToForm();
      setStatus("New profile.");
    });
    els.saveProfileButton.addEventListener("click", saveCurrentProfile);
    els.deleteProfileButton.addEventListener("click", deleteCurrentProfile);
    els.exportProfileButton.addEventListener("click", exportProfiles);
    els.importProfileFile.addEventListener("change", importProfiles);
    els.copyInsightsButton.addEventListener("click", copyInsights);
    els.commanderNameInput.addEventListener("change", autofillCommander);
    els.profileSearchInput.addEventListener("input", () => {
      state.search = els.profileSearchInput.value.trim();
      renderList();
    });
    els.profileStatusFilter.addEventListener("change", () => {
      state.statusFilter = els.profileStatusFilter.value;
      renderList();
    });
    els.ratingGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rating]");
      if (!button) return;
      state.draftRating = clamp(parseInt(button.dataset.rating, 10) || 3, 1, 5);
      renderStars();
    });
    els.profileList.addEventListener("click", (event) => {
      const item = event.target.closest("[data-profile-id]");
      if (!item) return;
      state.selectedId = item.dataset.profileId;
      applySelectedToForm();
      renderList();
    });
  }

  function loadProfiles() {
    const stored = normalizeProfiles(safeJsonParse(localStorage.getItem(CONFIG.storageProfile), []));
    const legacy = profilesFromOwnedText(localStorage.getItem(CONFIG.storageOwned) || "");
    state.profiles = mergeProfiles(stored, legacy);
    if (legacy.length && state.profiles.length !== stored.length) saveProfiles();
  }

  function saveProfiles() {
    localStorage.setItem(CONFIG.storageProfile, JSON.stringify(state.profiles));
  }

  function fillCommanderOptions() {
    const fragment = document.createDocumentFragment();
    for (const card of state.catalog.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      const option = document.createElement("option");
      option.value = card.name;
      fragment.append(option);
    }
    els.commanderOptions.replaceChildren(fragment);
  }

  function applySelectedToForm() {
    const profile = currentProfile() || { ...DEFAULT_PROFILE, createdAt: new Date().toISOString() };
    state.draftRating = profile.rating || 3;
    els.commanderNameInput.value = profile.name || "";
    for (const input of colorInputs()) input.checked = (profile.colors || []).includes(input.value);
    els.powerInput.value = profile.power || 3;
    els.complexityInput.value = profile.complexity || 3;
    els.tableHeatInput.value = profile.tableHeat || 3;
    els.patternSelect.value = profile.pattern || "value";
    els.speedSelect.value = profile.speed || "mid";
    els.deckStatusSelect.value = profile.status || "active";
    els.deckTagsInput.value = (profile.tags || []).join(", ");
    els.likesInput.value = (profile.likes || []).join(", ");
    els.dislikesInput.value = (profile.dislikes || []).join(", ");
    els.sourceUrlInput.value = profile.sourceUrl || "";
    els.profileNotesInput.value = profile.notes || "";
    renderStars();
  }

  function render() {
    renderList();
    renderInsights();
  }

  function renderList() {
    const visible = state.profiles.filter((profile) => {
      if (state.statusFilter !== "all" && profile.status !== state.statusFilter) return false;
      if (!state.search) return true;
      return termsPass(profileHaystack(profile), state.search);
    });
    els.profileCount.textContent = `${state.profiles.length} deck${state.profiles.length === 1 ? "" : "s"}`;
    const nodes = visible
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
      .map(profileCard);
    els.profileList.replaceChildren(...(nodes.length ? nodes : [emptyState("No profile entries match.")]));
  }

  function profileCard(profile) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "profile-card";
    card.dataset.profileId = profile.id;
    card.classList.toggle("selected", profile.id === state.selectedId);
    const top = document.createElement("span");
    top.className = "profile-card-top";
    const name = document.createElement("strong");
    name.textContent = profile.name;
    const stars = document.createElement("span");
    stars.textContent = starText(profile.rating);
    top.append(name, stars);
    const meta = document.createElement("span");
    meta.className = "profile-card-meta";
    meta.textContent = `${labelize(profile.pattern)} / ${labelize(profile.speed)} / P${profile.power} C${profile.complexity} H${profile.tableHeat}`;
    const colors = document.createElement("span");
    colors.className = "mana-row";
    colors.replaceChildren(...manaSymbols(profile.colors));
    const tags = document.createElement("span");
    tags.className = "tag-row";
    tags.replaceChildren(...tagChips([...profile.tags, ...profile.likes].slice(0, 5)));
    card.append(top, meta, colors, tags);
    return card;
  }

  function renderInsights() {
    const active = state.profiles.filter((profile) => profile.status !== "dismantled");
    const avgRating = active.length ? avg(active.map((profile) => profile.rating)) : 0;
    const avgPower = active.length ? avg(active.map((profile) => profile.power)) : 0;
    const avgHeat = active.length ? avg(active.map((profile) => profile.tableHeat)) : 0;
    els.habitMetrics.replaceChildren(
      metric(active.length, "tracked"),
      metric(avgRating ? avgRating.toFixed(1) : "0", "avg stars"),
      metric(avgPower ? avgPower.toFixed(1) : "avg", "power"),
      metric(avgHeat ? avgHeat.toFixed(1) : "avg", "heat")
    );

    const liked = weightedCounts(active.flatMap((profile) => [
      ...profile.likes.map((tag) => [tag, profile.rating + 2]),
      ...profile.tags.map((tag) => [tag, Math.max(1, profile.rating - 1)])
    ]));
    const disliked = weightedCounts(active.flatMap((profile) => [
      ...profile.dislikes.map((tag) => [tag, 6 - profile.rating + 2])
    ]));
    const patterns = weightedCounts(active.map((profile) => [`${labelize(profile.pattern)} / ${labelize(profile.speed)}`, profile.rating]));

    els.likedSignals.replaceChildren(...tagChips(topEntries(liked, 16).map(([tag, score]) => `${tag} ${Math.round(score)}`)));
    els.dislikedSignals.replaceChildren(...tagChips(topEntries(disliked, 12).map(([tag, score]) => `${tag} ${Math.round(score)}`), "warn"));
    els.patternSignals.replaceChildren(...tagChips(topEntries(patterns, 12).map(([tag, score]) => `${tag} ${Math.round(score)}`), "cool"));

    const angles = buildSearchAngles(active, liked, disliked);
    els.searchAngles.replaceChildren(...angles.map((angle) => {
      const item = document.createElement("div");
      item.className = "stack-item";
      const title = document.createElement("strong");
      title.textContent = angle.title;
      const detail = document.createElement("span");
      detail.textContent = angle.detail;
      item.append(title, detail);
      return item;
    }));
  }

  function buildSearchAngles(profiles, liked, disliked) {
    if (!profiles.length) return [{ title: "Add a deck profile", detail: "Ratings and likes will turn into search angles here." }];
    const topLiked = topEntries(liked, 3).map(([tag]) => tag);
    const topDisliked = topEntries(disliked, 2).map(([tag]) => tag);
    const lovedLowHeat = profiles.filter((profile) => profile.rating >= 4 && profile.tableHeat <= 3).map((profile) => profile.name).slice(0, 3);
    const lovedComplex = profiles.filter((profile) => profile.rating >= 4 && profile.complexity >= 4).map((profile) => profile.name).slice(0, 3);
    const angles = [
      {
        title: "High-confidence themes",
        detail: topLiked.length ? `Search for commanders tagged ${topLiked.join(", ")}.` : "Add likes to build a stronger theme map."
      },
      {
        title: "Avoidance filters",
        detail: topDisliked.length ? `Down-rank or exclude ${topDisliked.join(", ")} when browsing.` : "Add dislikes to reduce false positives."
      },
      {
        title: "Comfort zone",
        detail: lovedLowHeat.length ? `You rate low-heat decks highly: ${lovedLowHeat.join(", ")}.` : "No clear low-heat comfort signal yet."
      },
      {
        title: "Complexity appetite",
        detail: lovedComplex.length ? `You enjoy puzzle decks: ${lovedComplex.join(", ")}.` : "Highly rated complex decks have not emerged yet."
      }
    ];
    return angles;
  }

  function saveCurrentProfile() {
    const name = els.commanderNameInput.value.trim();
    if (!name) {
      setStatus("Commander name is required.", true);
      return;
    }
    const existing = currentProfile();
    const matched = findCatalogCard(name);
    const now = new Date().toISOString();
    const profile = normalizeProfile({
      ...(existing || {}),
      id: existing?.id || slugify(name),
      name,
      colors: selectedColors().length ? selectedColors() : matched?.colors || [],
      rating: state.draftRating,
      power: els.powerInput.value,
      complexity: els.complexityInput.value,
      tableHeat: els.tableHeatInput.value,
      pattern: els.patternSelect.value,
      speed: els.speedSelect.value,
      status: els.deckStatusSelect.value,
      tags: parseTags(els.deckTagsInput.value || matched?.tags.join(", ")),
      likes: parseTags(els.likesInput.value),
      dislikes: parseTags(els.dislikesInput.value),
      sourceUrl: els.sourceUrlInput.value.trim() || matched?.url || "",
      notes: els.profileNotesInput.value.trim(),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    });
    state.profiles = mergeProfiles(state.profiles.filter((item) => item.id !== profile.id), [profile]);
    state.selectedId = profile.id;
    saveProfiles();
    render();
    applySelectedToForm();
    setStatus(`${profile.name} saved.`);
  }

  function deleteCurrentProfile() {
    const profile = currentProfile();
    if (!profile) {
      applySelectedToForm();
      return;
    }
    if (!window.confirm(`Delete ${profile.name}?`)) return;
    state.profiles = state.profiles.filter((item) => item.id !== profile.id);
    state.selectedId = state.profiles[0]?.id || "";
    saveProfiles();
    applySelectedToForm();
    render();
    setStatus("Profile deleted.");
  }

  function autofillCommander() {
    const card = findCatalogCard(els.commanderNameInput.value);
    if (!card) return;
    if (!selectedColors().length) {
      for (const input of colorInputs()) input.checked = card.colors.includes(input.value);
    }
    if (!els.deckTagsInput.value.trim()) els.deckTagsInput.value = card.tags.slice(0, 5).join(", ");
    if (!els.sourceUrlInput.value.trim()) els.sourceUrlInput.value = card.url;
  }

  function exportProfiles() {
    downloadJson({
      exportedAt: new Date().toISOString(),
      source: "commander-edgeboard-profile",
      deckProfiles: state.profiles,
      ownedText: localStorage.getItem(CONFIG.storageOwned) || "",
      ideas: safeJsonParse(localStorage.getItem(CONFIG.storageIdeas), {})
    }, `commander-edgeboard-profile-${new Date().toISOString().slice(0, 10)}.json`);
    setStatus("Profile export created.");
  }

  async function importProfiles(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const imported = [
        ...normalizeProfiles(payload.deckProfiles || payload.profiles || payload.ownedProfiles || []),
        ...profilesFromIdeas(payload.ideas || []),
        ...profilesFromOwnedText(payload.ownedText || "")
      ];
      state.profiles = mergeProfiles(state.profiles, imported);
      saveProfiles();
      state.selectedId = imported[0]?.id || state.selectedId || state.profiles[0]?.id || "";
      applySelectedToForm();
      render();
      setStatus(`Imported ${imported.length} profile signal${imported.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(`Import failed: ${error.message || error}`, true);
    }
  }

  async function copyInsights() {
    const liked = Array.from(els.likedSignals.querySelectorAll(".chip")).map((chip) => chip.textContent).join(", ");
    const disliked = Array.from(els.dislikedSignals.querySelectorAll(".chip")).map((chip) => chip.textContent).join(", ");
    const patterns = Array.from(els.patternSignals.querySelectorAll(".chip")).map((chip) => chip.textContent).join(", ");
    const text = [
      `Decks tracked: ${state.profiles.length}`,
      `Liked signals: ${liked || "none"}`,
      `Disliked signals: ${disliked || "none"}`,
      `Patterns: ${patterns || "none"}`
    ].join("\n");
    await copyText(text);
    setStatus("Insight summary copied.");
  }

  function normalizeProfiles(raw) {
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list.map(normalizeProfile).filter((profile) => profile.name);
  }

  function normalizeProfile(raw) {
    const name = String(raw?.name || raw?.commander || "").trim();
    const now = new Date().toISOString();
    const matched = findCatalogCard(name);
    return {
      ...DEFAULT_PROFILE,
      id: raw?.id || raw?.key || raw?.slug || slugify(name),
      name,
      colors: parseColors(raw?.colors || raw?.colorIdentity || raw?.color_identity || matched?.colors || []),
      rating: clamp(parseInt(raw?.rating || raw?.stars || raw?.enjoyment || 3, 10), 1, 5),
      power: clamp(parseInt(raw?.power || 3, 10), 1, 5),
      complexity: clamp(parseInt(raw?.complexity || 3, 10), 1, 5),
      tableHeat: clamp(parseInt(raw?.tableHeat || raw?.heat || 3, 10), 1, 5),
      pattern: raw?.pattern || raw?.playPattern || "value",
      speed: raw?.speed || "mid",
      status: normalizeDeckStatus(raw?.deckStatus || raw?.status || "active"),
      tags: parseTags([...coerceArray(raw?.tags), ...(matched?.tags || [])].join(", ")),
      likes: parseTags(raw?.likes || raw?.liked || ""),
      dislikes: parseTags(raw?.dislikes || raw?.disliked || ""),
      notes: String(raw?.notes || ""),
      sourceUrl: raw?.sourceUrl || raw?.url || raw?.edhrecUrl || matched?.url || "",
      createdAt: raw?.createdAt || raw?.savedAt || now,
      updatedAt: raw?.updatedAt || now
    };
  }

  function profilesFromIdeas(raw) {
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list
      .filter((idea) => idea && (idea.profileTouched || idea.status === "built" || idea.deckStatus === "active"))
      .map((idea) => normalizeProfile({
        id: idea.key || idea.id,
        name: idea.name,
        rating: idea.rating || 3,
        tags: [...coerceArray(idea.tags), ...coerceArray(idea.sourceTags)],
        likes: coerceArray(idea.likes),
        dislikes: coerceArray(idea.dislikes),
        notes: idea.notes || "",
        sourceUrl: idea.url || idea.edhrecUrl,
        status: idea.deckStatus || "active"
      }));
  }

  function profilesFromOwnedText(text) {
    return String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return normalizeProfile({
        name: parts[0],
        tags: parseTags(parts[1] || ""),
        colors: parseColors(parts[2] || ""),
        rating: 3,
        status: "active"
      });
    });
  }

  function mergeProfiles(base, incoming) {
    const map = new Map();
    for (const profile of [...base, ...incoming]) {
      const normalized = normalizeProfile(profile);
      if (!normalized.name) continue;
      const key = normalizeName(normalized.name);
      const existing = map.get(key);
      map.set(key, existing ? {
        ...existing,
        ...normalized,
        tags: unique([...existing.tags, ...normalized.tags]),
        likes: unique([...existing.likes, ...normalized.likes]),
        dislikes: unique([...existing.dislikes, ...normalized.dislikes]),
        colors: normalized.colors.length ? normalized.colors : existing.colors
      } : normalized);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function currentProfile() {
    return state.profiles.find((profile) => profile.id === state.selectedId) || null;
  }

  function findCatalogCard(name) {
    const norm = normalizeName(name);
    return state.catalog.find((card) => normalizeName(card.name) === norm) || null;
  }

  function normalizeCatalogCard(raw) {
    if (!raw || !raw.name) return null;
    return {
      name: raw.name,
      colors: sortColors(raw.colors || []),
      tags: unique([...(raw.tags || []), ...(raw.mechanics || [])].map(cleanLabel)),
      url: raw.url || `https://edhrec.com/commanders/${slugify(raw.name)}`
    };
  }

  function colorInputs() {
    return Array.from(els.profileColorGroup.querySelectorAll("input[type='checkbox']"));
  }

  function selectedColors() {
    return colorInputs().filter((input) => input.checked).map((input) => input.value);
  }

  function renderStars() {
    for (const button of els.ratingGroup.querySelectorAll("[data-rating]")) {
      const rating = parseInt(button.dataset.rating, 10);
      button.classList.toggle("active", rating <= state.draftRating);
      button.textContent = rating <= state.draftRating ? "*" : `${rating}`;
    }
  }

  function profileHaystack(profile) {
    return normalizeName([
      profile.name, profile.colors.join(" "), profile.rating, profile.power, profile.complexity,
      profile.tableHeat, profile.pattern, profile.speed, profile.status,
      profile.tags.join(" "), profile.likes.join(" "), profile.dislikes.join(" "), profile.notes
    ].join(" "));
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

  function tagChips(tags, tone = "") {
    return (tags || []).filter(Boolean).slice(0, 20).map((tag) => {
      const chip = document.createElement("span");
      chip.className = `chip ${tone || "cool"}`.trim();
      chip.textContent = tag;
      return chip;
    });
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

  function emptyState(text) {
    const node = document.createElement("div");
    node.className = "empty-state";
    node.textContent = text;
    return node;
  }

  function setStatus(text, isError = false) {
    els.profileStatus.textContent = text;
    els.profileStatus.classList.toggle("error", isError);
  }

  function starText(rating) {
    return `${"*".repeat(rating)}${".".repeat(5 - rating)}`;
  }

  function labelize(value) {
    return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function parseTags(value) {
    if (Array.isArray(value)) return unique(value.map(cleanLabel));
    return unique(String(value || "").split(/[,;\n]+/).map(cleanLabel).filter(Boolean));
  }

  function coerceArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return String(value).split(/[,;\n]+/);
  }

  function normalizeDeckStatus(value) {
    if (["active", "testing", "retired", "dismantled"].includes(value)) return value;
    if (value === "built" || value === "brew" || value === "watch") return "active";
    if (value === "skip") return "dismantled";
    return "active";
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
    return String(value || "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function weightedCounts(pairs) {
    const out = {};
    for (const pair of pairs || []) {
      const label = cleanLabel(pair[0]);
      if (!label) continue;
      out[label] = (out[label] || 0) + Number(pair[1] || 1);
    }
    return out;
  }

  function topEntries(map, limit) {
    return Object.entries(map || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  }

  function termsPass(haystack, query) {
    const terms = normalizeName(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    return terms.every((term) => haystack.includes(term));
  }

  function slugify(value) {
    return normalizeName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function normalizeName(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
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

  function avg(values) {
    const nums = values.map(Number).filter(Number.isFinite);
    return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function safeJsonParse(text, fallback) {
    try {
      return text ? JSON.parse(text) : fallback;
    } catch {
      return fallback;
    }
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

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }
})();
