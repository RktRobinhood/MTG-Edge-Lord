import assert from "node:assert/strict";
import test from "node:test";
import { manaCostHtml, parseManaCost } from "../src/userscript/mana.js";

test("a printed cost parses to one disc per symbol", () => {
  assert.deepEqual(parseManaCost("{2}{U}{R}").map((symbol) => symbol.glyph), ["2", "U", "R"]);
  assert.equal(parseManaCost("{2}{U}{R}")[1].colors.length, 1);
});

test("hybrid and Phyrexian symbols keep both halves", () => {
  const [hybrid, monocolor, phyrexian] = parseManaCost("{W/U}{2/B}{U/P}");
  assert.deepEqual([hybrid.glyph, hybrid.colors.length], ["WU", 2]);
  assert.equal(monocolor.glyph, "2B");
  assert.equal(phyrexian.glyph, "Φ");
  assert.equal(phyrexian.colors.length, 1);
});

test("generic, variable and snow costs render as discs of their own", () => {
  assert.deepEqual(parseManaCost("{X}{10}{S}{C}").map((symbol) => symbol.glyph), ["X", "10", "S", "C"]);
});

// A cost we cannot read is drawn as nothing: a placeholder would claim the
// card costs something it does not.
test("an unknown or missing cost renders nothing at all", () => {
  assert.deepEqual(parseManaCost("{HALFW}{}"), []);
  assert.equal(manaCostHtml(""), "");
  assert.equal(manaCostHtml(undefined), "");
  assert.equal(manaCostHtml("no braces here"), "");
});

// Every glyph reaching the HTML has been matched against a known pattern, so
// the output needs no escaping — this is the test that keeps that true.
test("rendered symbols carry no markup out of the data", () => {
  const html = manaCostHtml("{<img src=x>}{U}");
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes(">U<"), true);
});
