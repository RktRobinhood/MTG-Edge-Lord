import { decodeCommanders } from "../shared/catalog.js";
const PRIMARY_BASE = "https://rktrobinhood.github.io/MTG-Edge-Lord/data";
const FALLBACK_BASE = "https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data";
const CACHE_KEY = "mtg-edge-lord:data:v1";

export async function loadData({ force = false } = {}) {
  const cached = readCache();
  try {
    let backend;
    try {
      backend = await loadBackend(PRIMARY_BASE, cached, force);
    } catch {
      backend = await loadBackend(FALLBACK_BASE, cached, force);
    }
    if (backend.cached) return { ...cached, stale: false };
    const data = { manifest: backend.manifest, ...backend.datasets, cachedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return { ...data, stale: false };
  } catch (error) {
    if (cached) return { ...cached, stale: true, error: error.message };
    throw error;
  }
}

async function loadBackend(base, cached, force) {
  const manifest = await requestJson(`${base}/manifest.json?ts=${Date.now()}`);
  if (!force && cached?.manifest?.dataVersion === manifest.dataVersion) return { cached: true };
  const [findings, commanders, cards, resources, relationships] = await Promise.all([
    requestJson(`${base}/findings.json`),
    requestJson(`${base}/commanders.json`).then(toCommanderList),
    requestJson(`${base}/hidden-cards.json`),
    requestJson(`${base}/community-resources.json`),
    requestJson(`${base}/relationships/card-commander.json`)
  ]);
  return { manifest, datasets: { findings, commanders, cards, resources, relationships } };
}

/**
 * The catalogue arrives columnar (see `src/shared/catalog.js`). Decoding here
 * means the rest of the userscript only ever sees plain records, and a backend
 * still serving the old array shape keeps working.
 */
function toCommanderList(dataset) {
  return { schemaVersion: dataset?.schemaVersion ?? 1, commanders: decodeCommanders(dataset) };
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

export function requestJson(url) {
  const request = globalThis.GM?.xmlHttpRequest ?? globalThis.GM_xmlhttpRequest;
  if (!request) return fetch(url).then(assertResponse).then((response) => response.json());
  return new Promise((resolve, reject) => request({
    method: "GET",
    url,
    headers: { Accept: "application/json" },
    onload: (response) => {
      if (response.status < 200 || response.status >= 300) return reject(new Error(`HTTP ${response.status}`));
      try { resolve(JSON.parse(response.responseText)); } catch { reject(new Error("Backend returned invalid JSON.")); }
    },
    onerror: () => reject(new Error("Could not reach the MTG Edge Lord data backend."))
  }));
}

function assertResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
