/**
 * The smallest IndexedDB wrapper that covers this script's needs.
 *
 * The catalogue is over a megabyte and grows. `localStorage` tops out around
 * 5MB and, worse, is synchronous: a `JSON.parse` of a multi-megabyte string on
 * every EDHREC page load stalls the host page. This script injects itself into
 * someone else's site, so that is not acceptable.
 *
 * Every operation resolves to `null` rather than throwing. IndexedDB is
 * unavailable in some private-browsing modes and can fail on quota; in either
 * case the caller falls back to fetching, which is slower but correct.
 */

const DATABASE = "mtg-edge-lord";
const STORE = "datasets";
const VERSION = 1;

let connection = null;

function open() {
  if (connection) return connection;
  connection = new Promise((resolve) => {
    if (!globalThis.indexedDB) return resolve(null);
    let request;
    try {
      request = indexedDB.open(DATABASE, VERSION);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return connection;
}

export async function idbGet(key) {
  const database = await open();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Writes in one transaction, so a reader either sees the previous value or the
 * new one. That is the atomic replace the cache protocol calls for.
 *
 * Resolves `false` on quota or any other failure. A failed write is not an
 * error the user needs to see: the data is already in memory for this page,
 * and the next page load will fetch it again.
 */
export async function idbPut(key, value) {
  const database = await open();
  if (!database) return false;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, key);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbDelete(key) {
  const database = await open();
  if (!database) return;
  try {
    database.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
  } catch {
    // Nothing to do: a cache entry that cannot be deleted is replaced on the
    // next successful write anyway.
  }
}
