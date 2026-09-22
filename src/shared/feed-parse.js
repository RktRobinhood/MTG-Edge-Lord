/**
 * A deliberately small RSS 2.0 and Atom reader.
 *
 * Only five fields are wanted per item — id, title, link, date, categories —
 * and none of them is the article body. Pulling in a full XML parser to reach
 * five fields would be the larger risk: this file is easy to read, has no
 * dependencies, and returns nothing rather than throwing when a feed's markup
 * changes.
 *
 * Nothing here extracts `<content:encoded>` or `<description>` bodies. Article
 * prose is the creator's, and this project links to it rather than storing it.
 */

const ITEM = /<(item|entry)\b[\s\S]*?<\/\1>/gi;

export function parseFeedItems(xml) {
  const source = String(xml ?? "");
  const items = [];
  for (const [block] of source.matchAll(ITEM)) {
    const item = parseItem(block);
    if (item.link) items.push(item);
  }
  return items;
}

function parseItem(block) {
  return {
    id: tag(block, "guid") || tag(block, "id") || link(block),
    title: decode(tag(block, "title")),
    link: link(block),
    publishedAt: normalizeDate(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated")),
    categories: categories(block)
  };
}

function link(block) {
  const href = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(block);
  if (href) return decode(href[1]);
  return decode(tag(block, "link"));
}

function categories(block) {
  const found = [];
  for (const match of block.matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>/gi)) {
    found.push(decode(match[2]));
  }
  for (const match of block.matchAll(/<category\b[^>]*\bterm\s*=\s*["']([^"']+)["'][^>]*\/?>/gi)) {
    found.push(decode(match[1]));
  }
  return [...new Set(found.map((value) => value.trim()).filter(Boolean))];
}

function tag(block, name) {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return match ? match[1].trim() : "";
}

function decode(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Feeds carry the odd malformed entity; an unrenderable code point is dropped. */
function safeCodePoint(code) {
  try {
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
  } catch {
    return "";
  }
}

/** Returns an ISO date, or an empty string when the feed's date is unusable. */
export function normalizeDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}
