import { COLUMNAR_FORMAT, decodeColumnar, encodeColumnar } from "./columnar.js";

/** Bumped when the commander dataset's shape changes; the client checks it. */
export const COMMANDER_SCHEMA_VERSION = 2;

/**
 * Decimal places per commander field, set to what the UI actually displays.
 * A field absent here keeps integers exact and rounds floats to the columnar
 * default, which is still far short of a 17-digit float.
 */
export const COMMANDER_PRECISION = Object.freeze({
  trendZscore: 3,
  momentum: 1,
  diamondScore: 1,
  edgeScore: 1,
  obscurity: 3,
  worksScore: 3,
  "quality.bracketFit": 3,
  "quality.archetypeDepth": 3,
  "quality.retention": 3,
  price: 2
});

export function encodeCommanders(commanders) {
  return {
    schemaVersion: COMMANDER_SCHEMA_VERSION,
    commanders: encodeColumnar(commanders, { precision: COMMANDER_PRECISION })
  };
}

/**
 * Reads a commander dataset in either shape. Version 1 stored an array of
 * records; version 2 stores columns. Accepting both means a stale cache or a
 * half-deployed backend degrades to old data rather than to an empty panel.
 */
export function decodeCommanders(dataset) {
  const payload = dataset?.commanders;
  if (Array.isArray(payload)) return payload;
  if (payload?.format === COLUMNAR_FORMAT) return decodeColumnar(payload);
  return [];
}

export function isColumnar(dataset) {
  return dataset?.commanders?.format === COLUMNAR_FORMAT;
}
