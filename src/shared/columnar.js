/**
 * Columnar encoding for the generated commander catalogue.
 *
 * An array of records costs one copy of every key name per record. At 6,800
 * commanders that is most of the file. Stored as parallel arrays keyed by
 * field path, each key is written once.
 *
 * The encoded form is self-describing: `decodeColumnar` needs no field spec,
 * so the pipeline and the userscript share this module and nothing else.
 */

export const COLUMNAR_FORMAT = "columnar/1";

/** Fields absent from a record encode as this, distinct from a real `null`. */
const ABSENT = null;

/**
 * @param {object[]} records
 * @param {{ precision?: Record<string, number> }} [options]
 *   `precision` maps a field path to its decimal places. Paths not listed keep
 *   integers exact and round other numbers to `DEFAULT_PRECISION`.
 */
export function encodeColumnar(records, options = {}) {
  const precision = options.precision ?? {};
  const paths = collectPaths(records);
  const columns = {};
  for (const path of paths) {
    const values = records.map((record) => roundValue(readPath(record, path), path, precision));
    columns[path] = chooseColumn(values);
  }
  return { format: COLUMNAR_FORMAT, count: records.length, columns };
}

/** @param {{ format: string, count: number, columns: object }} encoded */
export function decodeColumnar(encoded) {
  if (encoded?.format !== COLUMNAR_FORMAT) {
    throw new Error(`Unsupported columnar format: ${encoded?.format ?? "missing"}`);
  }
  const records = Array.from({ length: encoded.count }, () => ({}));
  for (const [path, column] of Object.entries(encoded.columns)) {
    const values = expandColumn(column, encoded.count);
    for (let index = 0; index < encoded.count; index += 1) {
      if (values[index] !== ABSENT) writePath(records[index], path, values[index]);
    }
  }
  return records;
}

/** Decimal places used for a float with no entry in the precision map. */
export const DEFAULT_PRECISION = 3;

export function roundNumber(value, decimals) {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundValue(value, path, precision) {
  if (typeof value !== "number") return value;
  if (Number.isInteger(value) && precision[path] === undefined) return value;
  return roundNumber(value, precision[path] ?? DEFAULT_PRECISION);
}

// --- column kinds -----------------------------------------------------------
//
// Three shapes, chosen per column by whichever serialises smallest:
//
//   raw     one entry per record
//   dict    few distinct values; stores each once plus an index per record.
//           Arrays and objects count, which is what makes `colorIdentity`
//           cheap: 6,792 records share at most 32 distinct colour identities.
//   sparse  one value dominates; stores that `fill` plus the exceptions
//
// `sparse` covers more than missing data. A column that is `0` for every
// commander but one, or an empty array for every commander but one, costs a
// handful of bytes rather than 6,792 entries.

function chooseColumn(values) {
  const distinct = distinctValues(values);
  const candidates = [rawColumn(values), sparseColumn(values, modalValue(values))];
  if (distinct.length * 3 < values.length) candidates.push(dictColumn(values, distinct));
  return candidates.reduce((best, candidate) => weight(candidate) < weight(best) ? candidate : best);
}

function rawColumn(values) {
  return { kind: "raw", values };
}

function sparseColumn(values, fill) {
  const index = [];
  const exceptions = [];
  const fillKey = valueKey(fill);
  values.forEach((value, position) => {
    if (valueKey(value) === fillKey) return;
    index.push(position);
    exceptions.push(value);
  });
  return { kind: "sparse", fill, index, values: exceptions };
}

function dictColumn(values, distinct) {
  const keys = distinct.filter((value) => value !== ABSENT);
  const position = new Map(keys.map((key, at) => [valueKey(key), at]));
  return { kind: "dict", keys, index: values.map((value) => value === ABSENT ? -1 : position.get(valueKey(value))) };
}

function expandColumn(column, count) {
  if (column.kind === "raw") return column.values;
  if (column.kind === "dict") return column.index.map((at) => at === -1 ? ABSENT : clone(column.keys[at]));
  if (column.kind === "sparse") {
    const values = Array.from({ length: count }, () => clone(column.fill));
    column.index.forEach((position, at) => { values[position] = column.values[at]; });
    return values;
  }
  throw new Error(`Unsupported column kind: ${column.kind}`);
}

/** The value a column holds most often, which `sparse` stores once. */
function modalValue(values) {
  const counts = new Map();
  for (const value of values) {
    const key = valueKey(value);
    const entry = counts.get(key) ?? { value, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].reduce((best, entry) => entry.count > best.count ? entry : best).value;
}

/** Arrays and objects are shared by reference once expanded, so hand out copies. */
function clone(value) {
  return typeof value === "object" && value !== null ? structuredClone(value) : value;
}

/** Serialised size, used only to pick between candidate encodings. */
function weight(column) {
  return JSON.stringify(column).length;
}

function valueKey(value) {
  return typeof value === "object" && value !== null ? `json:${JSON.stringify(value)}` : `${typeof value}:${value}`;
}

function distinctValues(values) {
  const seen = new Map();
  for (const value of values) {
    const key = valueKey(value);
    if (!seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()];
}

// --- paths ------------------------------------------------------------------
//
// Nested objects flatten to dotted paths (`popularity.edhrecRank`). Arrays are
// leaves: they stay whole rather than becoming a column per element, because
// their lengths differ per record.

function collectPaths(records) {
  const paths = new Set();
  for (const record of records) walk(record, "", paths);
  return [...paths];
}

function walk(value, prefix, paths) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) walk(child, path, paths);
    else paths.add(path);
  }
}

function readPath(record, path) {
  let current = record;
  for (const key of path.split(".")) {
    if (!isPlainObject(current) || !(key in current)) return ABSENT;
    current = current[key];
  }
  return current === undefined ? ABSENT : current;
}

function writePath(record, path, value) {
  const keys = path.split(".");
  let current = record;
  for (const key of keys.slice(0, -1)) {
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key];
  }
  current[keys.at(-1)] = value;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
