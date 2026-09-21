const PRIMARY_BASE = "https://rktrobinhood.github.io/MTG-Edge-Lord/data";
const FALLBACK_BASE = "https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data";
const CACHE_KEY = "mtg-edge-lord:data:v1";

export async function loadData({ force = false } = {}) {
  const cached = readCache();
  try {
    const { manifest, base } = await loadManifest();
    if (!force && cached?.manifest?.dataVersion === manifest.dataVersion) return { ...cached, stale: false };
    const [findings, commanders, cards, resources, relationships] = await Promise.all([
      requestJson(`${base}/findings.json`),
      requestJson(`${base}/commanders.json`),
      requestJson(`${base}/hidden-cards.json`),
      requestJson(`${base}/community-resources.json`),
      requestJson(`${base}/relationships/card-commander.json`)
    ]);
    const data = { manifest, findings, commanders, cards, resources, relationships, cachedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return { ...data, stale: false };
  } catch (error) {
    if (cached) return { ...cached, stale: true, error: error.message };
    throw error;
  }
}

async function loadManifest() {
  try {
    return { manifest: await requestJson(`${PRIMARY_BASE}/manifest.json?ts=${Date.now()}`), base: PRIMARY_BASE };
  } catch {
    return { manifest: await requestJson(`${FALLBACK_BASE}/manifest.json?ts=${Date.now()}`), base: FALLBACK_BASE };
  }
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
