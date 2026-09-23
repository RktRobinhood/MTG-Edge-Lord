import assert from "node:assert/strict";
import test from "node:test";
import { isCheckDue } from "../src/userscript/data-client.js";

/**
 * The freshness gate decides whether opening the panel reaches the network.
 *
 * It is tested apart from `loadData` because the surrounding path is IndexedDB
 * and `GM.xmlHttpRequest`, neither of which exists under `node --test`. The
 * decision is the part that can be wrong in a way nobody notices: erring open
 * costs a request, erring shut hides a published finding for a day.
 */

const HOUR = 3600000;
const now = Date.parse("2026-09-23T12:00:00.000Z");
const ago = (ms) => ({ checkedAt: new Date(now - ms).toISOString() });

test("a cache checked within the day is not re-checked", () => {
  assert.equal(isCheckDue(ago(0), now), false);
  assert.equal(isCheckDue(ago(HOUR), now), false);
  assert.equal(isCheckDue(ago(23 * HOUR), now), false);
});

test("a cache older than the interval is due", () => {
  assert.equal(isCheckDue(ago(24 * HOUR), now), true);
  assert.equal(isCheckDue(ago(25 * HOUR), now), true);
  assert.equal(isCheckDue(ago(400 * HOUR), now), true);
});

test("the boundary is inclusive, so exactly a day later checks rather than waits", () => {
  assert.equal(isCheckDue(ago(24 * HOUR - 1), now), false);
  assert.equal(isCheckDue(ago(24 * HOUR), now), true);
});

test("a cache written before checkedAt existed is due, not trusted forever", () => {
  // The upgrade path: v1.2.x cached without this field. Treating a missing
  // stamp as fresh would strand an installed script on its last catalogue.
  assert.equal(isCheckDue({}, now), true);
  assert.equal(isCheckDue({ cachedAt: "2026-09-01T00:00:00.000Z" }, now), true);
});

test("an absent or unparseable cache is due rather than throwing", () => {
  assert.equal(isCheckDue(null, now), true);
  assert.equal(isCheckDue(undefined, now), true);
  assert.equal(isCheckDue({ checkedAt: "not a date" }, now), true);
  assert.equal(isCheckDue({ checkedAt: null }, now), true);
});

test("a clock that moved backwards checks instead of waiting out the skew", () => {
  // A stamp in the future would otherwise suppress checks until real time
  // caught up to it, which on a badly set clock could be indefinitely.
  assert.equal(isCheckDue({ checkedAt: new Date(now + 400 * HOUR).toISOString() }, now), true);
});
