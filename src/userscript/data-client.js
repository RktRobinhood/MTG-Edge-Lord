import { decodeCommanders } from "../shared/catalog.js";
import { idbDelete, idbGet, idbPut } from "./idb.js";

const PRIMARY_BASE = "https://rktrobinhood.github.io/MTG-Edge-Lord/data";
const FALLBACK_BASE = "https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data";

const CACHE_KEY = "datasets:v2";
const DETAIL_KEY = "commander-detail:v2";

/**
 * How long a cache is trusted before the backend is asked whether it moved.
 *
 * The publish cadence is the scheduled build, which runs once a day, so
 * checking more often than that cannot find anything. This used to request the
 * manifest on every EDHREC page view — correct, and far chattier than the data
 * it was checking on.
 *
 * A cache older than this is still *served*; the interval only decides whether
 * a check happens, never whether the tool works.
 */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * An old cache predates `checkedAt`, so `NaN` here correctly means "check".
 *
 * The age is required to be non-negative as well as short. A stamp in the
 * future — a clock set wrong, or a machine that corrected itself after the
 * cache was written — would otherwise read as permanently fresh and suppress
 * every check until real time caught up to it.
 */
export function isCheckDue(cached, now) {
  const age = now - Date.parse(cached?.checkedAt);
  return !(age >= 0 && age < CHECK_INTERVAL_MS);
}

/** The pre-IndexedDB cache. Removed on first run so it stops occupying quota. */
const LEGACY_LOCAL_STORAGE_KEY = "mtg-edge-lord:data:v1";

/**
 * Loads the published backend, preferring the cache.
 *
 * Protocol, per `docs/ARCHITECTURE.md`:
 *   0. a cache checked within `CHECK_INTERVAL_MS` is served without any request
 *   1. request the manifest with cache-busting
 *   2. matching `dataVersion` — use the cache, download nothing
 *   3. new version — fetch datasets in parallel, then replace the cache atomically
 *   4. network failure — render the last valid cache, labelled as cached
 *   5. Pages failure — retry against raw GitHub
 *
 * `checkRemote: false` is the page-load path: serve whatever is cached and do
 * not touch the network at all. The check belongs to opening the panel, so
 * someone reading an EDHREC page pays nothing for a tool they did not open.
 * With no cache to serve there is nothing to defer, so it fetches regardless.
 */
export async function loadData({ force = false, checkRemote = true } = {}) {
  discardLegacyCache();
  const cached = await idbGet(CACHE_KEY);
  const now = Date.now();
  if (cached && !force && (!checkRemote || !isCheckDue(cached, now))) return { ...cached, stale: false };

  try {
    let backend;
    try {
      backend = await loadBackend(PRIMARY_BASE, cached, force);
    } catch {
      backend = await loadBackend(FALLBACK_BASE, cached, force);
    }
    const checkedAt = new Date(now).toISOString();
    // Unchanged backend still counts as a check: stamp it, or every open
    // re-asks and the interval buys nothing.
    if (backend.cached) {
      const confirmed = { ...cached, checkedAt };
      await idbPut(CACHE_KEY, confirmed);
      return { ...confirmed, stale: false };
    }

    const data = { manifest: backend.manifest, ...backend.datasets, cachedAt: new Date(now).toISOString(), checkedAt };
    // A cache write that fails on quota is not fatal — this page already has
    // the data, and the next load fetches it again.
    await idbPut(CACHE_KEY, data);
    if (cached?.manifest?.dataVersion !== backend.manifest.dataVersion) await idbDelete(DETAIL_KEY);
    return { ...data, stale: false };
  } catch (error) {
    if (cached) return { ...cached, stale: true, error: error.message };
    throw error;
  }
}

/**
 * Per-commander high-synergy pools and similar commanders.
 *
 * Deliberately not part of `loadData`: it is around half a megabyte and is
 * only wanted once someone opens a commander, so paying for it on every
 * EDHREC page view would undo the reason `commanders.json` is kept lean.
 */
export async function loadCommanderDetail(dataVersion) {
  const cached = await idbGet(DETAIL_KEY);
  if (cached?.dataVersion === dataVersion) return cached.detail;
  for (const base of [PRIMARY_BASE, FALLBACK_BASE]) {
    try {
      const { detail } = await requestJson(`${base}/commander-detail.json`);
      await idbPut(DETAIL_KEY, { dataVersion, detail });
      return detail;
    } catch {
      // Try the fallback base before giving up.
    }
  }
  return cached?.detail ?? {};
}

async function loadBackend(base, cached, force) {
  const manifest = await requestJson(`${base}/manifest.json?ts=${Date.now()}`);
  if (!force && cached?.manifest?.dataVersion === manifest.dataVersion) return { cached: true };
  const [findings, commanders, cards, resources, relationships, archive] = await Promise.all([
    requestJson(`${base}/findings.json`),
    requestJson(`${base}/commanders.json`).then(toCommanderList),
    requestJson(`${base}/hidden-cards.json`),
    requestJson(`${base}/community-resources.json`),
    requestJson(`${base}/relationships/card-commander.json`),
    // The archive is the newest dataset, so a backend that predates it is a
    // real state: an installed script must not break against one. An empty
    // archive is the honest answer, and it costs the Archive tab alone
    // rather than every tab.
    requestJson(`${base}/archive.json`).catch(() => ({ schemaVersion: 1, archive: [] }))
  ]);
  return { manifest, datasets: { findings, commanders, cards, resources, relationships, archive } };
}

/**
 * The catalogue arrives columnar (see `src/shared/catalog.js`). Decoding here
 * means the rest of the userscript only ever sees plain records, and a backend
 * still serving the old array shape keeps working.
 */
function toCommanderList(dataset) {
  return { schemaVersion: dataset?.schemaVersion ?? 1, commanders: decodeCommanders(dataset) };
}

function discardLegacyCache() {
  try {
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
  } catch {
    // Storage can be blocked entirely. Nothing to migrate in that case.
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
