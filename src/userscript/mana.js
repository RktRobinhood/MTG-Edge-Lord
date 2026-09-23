/**
 * Mana costs, drawn here rather than fetched from anywhere.
 *
 * The obvious way to render `{2}{U}{R}` is the Mana font, or Scryfall's symbol
 * SVGs. Both are a third-party request from a user's browser, which `AGENTS.md`
 * rules out: the userscript fetches this repository's `data/` files and nothing
 * else. So a symbol here is a coloured disc with its glyph on it — the shape
 * players already read at this size — built from a string and some CSS.
 *
 * A cost we cannot parse renders as nothing at all. A commander whose card
 * facts never arrived (a partner pairing has no single card) simply has no
 * cost to show, and an empty space says that better than a placeholder would.
 */

/** Scryfall writes a cost as brace-delimited symbols: `{X}{W/U}{2}{B/P}`. */
const SYMBOL_PATTERN = /\{([^}]{1,4})\}/g;

/**
 * The five colours, at the pastel values Magic itself prints them, plus the
 * generic/colourless grey. Kept as a plain map so `styles.js` and this module
 * cannot drift: the rendered pip carries its colour inline.
 */
const COLORS = Object.freeze({
  W: "#f7f2da",
  U: "#b3dbf2",
  B: "#c0b5ad",
  R: "#f2a687",
  G: "#a4d5ae",
  C: "#cfd5d3"
});

const GENERIC = "#cbcfcd";

/**
 * One parsed symbol.
 *
 * @typedef {object} ManaSymbol
 * @property {string} glyph what is printed on the disc
 * @property {string[]} colors the colours the disc is painted in, in order
 */

/**
 * @param {string} manaCost a Scryfall mana cost, e.g. `"{2}{U}{R}"`
 * @returns {ManaSymbol[]}
 */
export function parseManaCost(manaCost) {
  const symbols = [];
  for (const [, body] of String(manaCost ?? "").matchAll(SYMBOL_PATTERN)) {
    const symbol = parseSymbol(body.toUpperCase());
    if (symbol) symbols.push(symbol);
  }
  return symbols;
}

/**
 * Anything this does not recognise is dropped rather than printed. That also
 * keeps the output injectable without escaping: every glyph that reaches the
 * HTML has been matched against the patterns below.
 */
function parseSymbol(body) {
  // Hybrid and Phyrexian: `{W/U}`, `{2/B}`, `{U/P}`, `{B/G/P}`.
  if (body.includes("/")) {
    const parts = body.split("/");
    const phyrexian = parts.at(-1) === "P";
    const paints = (phyrexian ? parts.slice(0, -1) : parts).filter((part) => COLORS[part]);
    const colors = paints.length ? paints.map((part) => COLORS[part]) : [GENERIC];
    if (phyrexian) return { glyph: "Φ", colors };
    return { glyph: parts.map(shortGlyph).join(""), colors };
  }
  if (COLORS[body]) return { glyph: body, colors: [COLORS[body]] };
  if (/^\d{1,3}$/.test(body)) return { glyph: body, colors: [GENERIC] };
  if (/^[XYZS]$/.test(body)) return { glyph: body, colors: [GENERIC] };
  return null;
}

/** A hybrid disc has room for two characters, so `{2/B}` prints as `2B`. */
function shortGlyph(part) {
  return /^[WUBRGCXYZS]$|^\d$/.test(part) ? part : "";
}

/**
 * The cost as HTML, or an empty string when there is nothing to draw.
 *
 * Deliberately string-building and DOM-free: the panel renders through
 * `innerHTML`, the commander-page banner renders through `innerHTML`, and a
 * pure function is testable in Node without either.
 */
export function manaCostHtml(manaCost) {
  // A split card writes both halves in one string: `{1}{R} // {1}{U}`. Run
  // them together and it reads as a four-symbol cost, so the slashes stay.
  const halves = String(manaCost ?? "").split("//").map(parseManaCost).filter((symbols) => symbols.length);
  if (!halves.length) return "";
  const drawn = halves.map((symbols) => symbols.map(pip).join("")).join(`<i class="pip-split">//</i>`);
  const described = halves.map(describeCost).join(" or ");
  return `<span class="mana" aria-label="Mana cost ${described}" role="img">${drawn}</span>`;
}

function pip(symbol) {
  return `<i class="pip-mana" style="background:${paint(symbol.colors)}">${symbol.glyph}</i>`;
}

/** A hybrid disc is split down the diagonal, the way the printed symbol is. */
function paint(colors) {
  if (colors.length === 1) return colors[0];
  return `linear-gradient(-45deg, ${colors[0]} 0 50%, ${colors.at(-1)} 50% 100%)`;
}

/** What a screen reader says instead of a row of discs. */
function describeCost(symbols) {
  return symbols.map((symbol) => (symbol.glyph === "Φ" ? "Phyrexian" : symbol.glyph)).join(" ");
}
