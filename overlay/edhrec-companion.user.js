// ==UserScript==
// @name         Commander Edgeboard EDHREC Companion
// @namespace    commander-edgeboard
// @version      0.1.0
// @description  Local commander idea overlay for EDHREC commander pages.
// @match        https://edhrec.com/commanders/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const STORE_KEY = "commanderEdgeboard.overlay.v1";
  const STATUSES = ["watch", "brew", "built", "skip"];

  const state = loadState();
  const page = getPageCommander();
  if (!page.name) return;

  const idea = state.ideas[page.key] || {
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
    deckStatus: "active",
    profileTouched: false,
    url: location.href,
    sourceTags: [],
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  idea.name = page.name;
  idea.url = location.href;
  idea.tags = Array.isArray(idea.tags) ? idea.tags : [];
  idea.likes = Array.isArray(idea.likes) ? idea.likes : [];
  idea.dislikes = Array.isArray(idea.dislikes) ? idea.dislikes : [];
  idea.rating = parseScale(idea.rating, 3);
  idea.power = parseScale(idea.power, 3);
  idea.complexity = parseScale(idea.complexity, 3);
  idea.tableHeat = parseScale(idea.tableHeat, 3);
  idea.pattern = idea.pattern || "value";
  idea.speed = idea.speed || "mid";
  idea.deckStatus = idea.deckStatus || "active";
  idea.profileTouched = Boolean(idea.profileTouched);
  idea.sourceTags = mergeTags(idea.sourceTags || [], extractVisibleTags());
  state.ideas[page.key] = idea;
  saveState();

  injectStyles();
  mountPanel();

  function mountPanel() {
    const root = document.createElement("aside");
    root.id = "ce-overlay";
    root.innerHTML = `
      <div class="ce-head">
        <strong>Edgeboard</strong>
        <button type="button" data-ce-toggle aria-label="Collapse">-</button>
      </div>
      <div class="ce-body">
        <div class="ce-name">${escapeHtml(page.name)}</div>
        <div class="ce-statuses">
          ${STATUSES.map((status) => `<button type="button" data-ce-status="${status}">${statusLabel(status)}</button>`).join("")}
        </div>
        <div class="ce-stars" aria-label="Enjoyment rating">
          ${[1, 2, 3, 4, 5].map((rating) => `<button type="button" data-ce-rating="${rating}">${rating}</button>`).join("")}
        </div>
        <div class="ce-grid">
          <label>
            <span>Power</span>
            <select data-ce-power>${scaleOptions()}</select>
          </label>
          <label>
            <span>Complexity</span>
            <select data-ce-complexity>${scaleOptions()}</select>
          </label>
          <label>
            <span>Heat</span>
            <select data-ce-heat>${scaleOptions()}</select>
          </label>
          <label>
            <span>Pattern</span>
            <select data-ce-pattern>
              <option value="value">Value</option>
              <option value="combat">Combat</option>
              <option value="combo">Combo</option>
              <option value="control">Control</option>
              <option value="politics">Politics</option>
              <option value="toolbox">Toolbox</option>
              <option value="engine">Engine</option>
              <option value="typal">Typal</option>
            </select>
          </label>
          <label>
            <span>Speed</span>
            <select data-ce-speed>
              <option value="fast">Fast</option>
              <option value="mid">Midgame</option>
              <option value="slow">Slow</option>
            </select>
          </label>
        </div>
        <label>
          <span>Tags</span>
          <input data-ce-tags type="text">
        </label>
        <label>
          <span>Likes</span>
          <input data-ce-likes type="text">
        </label>
        <label>
          <span>Dislikes</span>
          <input data-ce-dislikes type="text">
        </label>
        <label>
          <span>Notes</span>
          <textarea data-ce-notes rows="4"></textarea>
        </label>
        <div class="ce-tags" data-ce-source-tags></div>
        <div class="ce-actions">
          <button type="button" data-ce-export>Export</button>
          <button type="button" data-ce-copy>Copy JSON</button>
        </div>
      </div>
    `;
    document.body.append(root);

    const tagsInput = root.querySelector("[data-ce-tags]");
    const likesInput = root.querySelector("[data-ce-likes]");
    const dislikesInput = root.querySelector("[data-ce-dislikes]");
    const notesInput = root.querySelector("[data-ce-notes]");
    tagsInput.value = idea.tags.join(", ");
    likesInput.value = (idea.likes || []).join(", ");
    dislikesInput.value = (idea.dislikes || []).join(", ");
    notesInput.value = idea.notes || "";
    root.querySelector("[data-ce-power]").value = idea.power || 3;
    root.querySelector("[data-ce-complexity]").value = idea.complexity || 3;
    root.querySelector("[data-ce-heat]").value = idea.tableHeat || 3;
    root.querySelector("[data-ce-pattern]").value = idea.pattern || "value";
    root.querySelector("[data-ce-speed]").value = idea.speed || "mid";

    root.querySelector("[data-ce-toggle]").addEventListener("click", () => {
      root.classList.toggle("is-collapsed");
    });

    root.querySelector(".ce-statuses").addEventListener("click", (event) => {
      const button = event.target.closest("[data-ce-status]");
      if (!button) return;
      idea.status = button.dataset.ceStatus;
      idea.updatedAt = new Date().toISOString();
      state.ideas[page.key] = idea;
      saveState();
      renderStatus(root, idea);
    });

    root.querySelector(".ce-stars").addEventListener("click", (event) => {
      const button = event.target.closest("[data-ce-rating]");
      if (!button) return;
      idea.rating = parseScale(button.dataset.ceRating, 3);
      idea.profileTouched = true;
      idea.updatedAt = new Date().toISOString();
      saveState();
      renderStars(root, idea);
    });

    root.querySelector(".ce-grid").addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("[data-ce-power]")) idea.power = parseScale(target.value, 3);
      if (target.matches("[data-ce-complexity]")) idea.complexity = parseScale(target.value, 3);
      if (target.matches("[data-ce-heat]")) idea.tableHeat = parseScale(target.value, 3);
      if (target.matches("[data-ce-pattern]")) idea.pattern = target.value;
      if (target.matches("[data-ce-speed]")) idea.speed = target.value;
      idea.profileTouched = true;
      idea.updatedAt = new Date().toISOString();
      saveState();
    });

    tagsInput.addEventListener("input", () => {
      idea.tags = parseTags(tagsInput.value);
      idea.updatedAt = new Date().toISOString();
      saveState();
    });

    likesInput.addEventListener("input", () => {
      idea.likes = parseTags(likesInput.value);
      idea.profileTouched = true;
      idea.updatedAt = new Date().toISOString();
      saveState();
    });

    dislikesInput.addEventListener("input", () => {
      idea.dislikes = parseTags(dislikesInput.value);
      idea.profileTouched = true;
      idea.updatedAt = new Date().toISOString();
      saveState();
    });

    notesInput.addEventListener("input", () => {
      idea.notes = notesInput.value;
      idea.updatedAt = new Date().toISOString();
      saveState();
    });

    root.querySelector("[data-ce-export]").addEventListener("click", exportOverlay);
    root.querySelector("[data-ce-copy]").addEventListener("click", copyOverlayJson);
    renderStatus(root, idea);
    renderStars(root, idea);
    renderSourceTags(root, idea);
  }

  function renderStatus(root, current) {
    for (const button of root.querySelectorAll("[data-ce-status]")) {
      button.classList.toggle("active", button.dataset.ceStatus === current.status);
    }
  }

  function renderSourceTags(root, current) {
    const target = root.querySelector("[data-ce-source-tags]");
    target.replaceChildren(...(current.sourceTags || []).slice(0, 10).map((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = tag;
      chip.addEventListener("click", () => {
        current.tags = mergeTags(current.tags || [], [tag]);
        root.querySelector("[data-ce-tags]").value = current.tags.join(", ");
        current.updatedAt = new Date().toISOString();
        saveState();
      });
      return chip;
    }));
  }

  function renderStars(root, current) {
    for (const button of root.querySelectorAll("[data-ce-rating]")) {
      const rating = Number(button.dataset.ceRating);
      button.classList.toggle("active", rating <= Number(current.rating || 3));
      button.textContent = rating <= Number(current.rating || 3) ? "*" : String(rating);
    }
  }

  function getPageCommander() {
    const pathParts = location.pathname.split("/").filter(Boolean);
    const slug = pathParts[0] === "commanders" ? pathParts[1] || "" : "";
    const h1 = document.querySelector("h1");
    const heading = cleanHeading(h1 ? h1.textContent : "");
    const name = heading || titleFromSlug(slug);
    return { name, key: slug || slugify(name) };
  }

  function cleanHeading(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\bEDHREC\b.*$/i, "")
      .replace(/\bCommander\b.*$/i, "")
      .trim();
  }

  function extractVisibleTags() {
    const slug = page.key;
    const tags = [];
    const anchors = Array.from(document.querySelectorAll(`a[href*="/commanders/${slug}/"]`));
    for (const anchor of anchors) {
      const label = cleanTag(anchor.textContent || titleFromSlug(anchor.getAttribute("href") || ""));
      if (isUsefulTag(label)) tags.push(label);
    }
    const bodyText = document.body ? document.body.innerText || "" : "";
    const tagIndex = bodyText.search(/\bTAGS\b/i);
    if (tagIndex >= 0) {
      const segment = bodyText.slice(tagIndex, tagIndex + 900);
      for (const match of segment.matchAll(/([A-Za-z][A-Za-z '+&/.-]{2,36})\s+[0-9][0-9,.]*(?:k)?/gi)) {
        const label = cleanTag(match[1]);
        if (isUsefulTag(label)) tags.push(label);
      }
    }
    return mergeTags([], tags).slice(0, 12);
  }

  function exportOverlay() {
    const payload = overlayPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `commander-edgeboard-overlay-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyOverlayJson() {
    const text = JSON.stringify(overlayPayload(), null, 2);
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

  function overlayPayload() {
    const ideas = Object.values(state.ideas);
    return {
      exportedAt: new Date().toISOString(),
      source: "commander-edgeboard-overlay",
      ideas,
      deckProfiles: ideas
        .filter((item) => item.status === "built" || item.profileTouched)
        .map((item) => ({
          id: item.key,
          name: item.name,
          rating: item.rating || 3,
          power: item.power || 3,
          complexity: item.complexity || 3,
          tableHeat: item.tableHeat || 3,
          pattern: item.pattern || "value",
          speed: item.speed || "mid",
          status: item.status === "skip" ? "dismantled" : "active",
          tags: mergeTags(item.tags || [], item.sourceTags || []),
          likes: item.likes || [],
          dislikes: item.dislikes || [],
          notes: item.notes || "",
          sourceUrl: item.url
        }))
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? { ideas: parsed.ideas || {} } : { ideas: {} };
    } catch {
      return { ideas: {} };
    }
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #ce-overlay {
        position: fixed;
        right: 16px;
        top: 88px;
        z-index: 2147483000;
        width: 300px;
        max-width: calc(100vw - 32px);
        border: 1px solid #d8e0dc;
        border-radius: 8px;
        background: #ffffff;
        color: #14211e;
        box-shadow: 0 10px 28px rgba(20, 33, 30, 0.18);
        font: 14px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #ce-overlay * { box-sizing: border-box; }
      #ce-overlay .ce-head {
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 10px 0 12px;
        border-bottom: 1px solid #d8e0dc;
      }
      #ce-overlay .ce-head button,
      #ce-overlay button {
        min-height: 30px;
        border: 1px solid #d8e0dc;
        border-radius: 6px;
        background: #f0f4f2;
        color: #42504b;
        padding: 0 9px;
        cursor: pointer;
      }
      #ce-overlay button:hover {
        border-color: #1f6fb2;
        color: #1f6fb2;
        background: #e8f2fb;
      }
      #ce-overlay button.active {
        border-color: #26734d;
        color: #26734d;
        background: #e7f4ed;
      }
      #ce-overlay .ce-body {
        display: grid;
        gap: 9px;
        padding: 12px;
      }
      #ce-overlay.is-collapsed .ce-body { display: none; }
      #ce-overlay .ce-name {
        font-weight: 800;
        font-size: 15px;
      }
      #ce-overlay .ce-statuses,
      #ce-overlay .ce-actions,
      #ce-overlay .ce-tags,
      #ce-overlay .ce-stars {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      #ce-overlay .ce-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px;
      }
      #ce-overlay label span {
        display: block;
        margin-bottom: 4px;
        color: #6d7b75;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      #ce-overlay input,
      #ce-overlay textarea,
      #ce-overlay select {
        width: 100%;
        border: 1px solid #d8e0dc;
        border-radius: 6px;
        background: #ffffff;
        color: #14211e;
        font: inherit;
        padding: 8px;
      }
      #ce-overlay textarea {
        resize: vertical;
      }
      #ce-overlay .ce-tags button {
        min-height: 26px;
        border-radius: 999px;
        font-size: 12px;
      }
      #ce-overlay .ce-stars button {
        min-width: 36px;
        color: #a56516;
        font-weight: 800;
      }
      @media (max-width: 700px) {
        #ce-overlay {
          left: 12px;
          right: 12px;
          top: auto;
          bottom: 12px;
          width: auto;
        }
      }
    `;
    document.head.append(style);
  }

  function statusLabel(status) {
    return ({ watch: "Watch", brew: "Brew", built: "Built", skip: "Skip" })[status] || "Watch";
  }

  function scaleOptions() {
    return [1, 2, 3, 4, 5].map((value) => `<option value="${value}">${value}</option>`).join("");
  }

  function parseScale(value, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.max(1, Math.min(5, number)) : fallback;
  }

  function parseTags(value) {
    return mergeTags([], String(value || "").split(/[,;\n]+/).map(cleanTag));
  }

  function mergeTags(a, b) {
    const out = [];
    const seen = new Set();
    for (const tag of [...(a || []), ...(b || [])]) {
      const clean = cleanTag(tag);
      const key = normalizeName(clean);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
    return out;
  }

  function cleanTag(value) {
    return String(value || "")
      .replace(/^.*\/commanders\/[^/]+\//, "")
      .replace(/[?#].*$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s*[0-9][0-9,.]*(?:k)?\s*(?:decks?)?\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function isUsefulTag(label) {
    if (!label || label.length < 3 || label.length > 42) return false;
    if (/^(cards?|decks?|average deck|budget|expensive|optimized|core|new|combos?|themes?|tags?|more tags|view precon|upgraded)$/i.test(label)) return false;
    if (/https?:|www\.|edhrec|scryfall/i.test(label)) return false;
    return true;
  }

  function titleFromSlug(slug) {
    const last = String(slug || "").split(/[/?#]/)[0].split("/").filter(Boolean).pop() || "";
    return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
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

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }
})();
