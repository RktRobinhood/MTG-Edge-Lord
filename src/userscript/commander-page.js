import { explainCohort } from "../shared/cohort-score.js";
import { explainScore, explainUnscored } from "../shared/edge-score.js";
import { manaCostHtml } from "./mana.js";
import { styles } from "./styles.js";

/**
 * What this project knows about the commander whose EDHREC page you are on.
 *
 * The panel answers "which commander should I look at"; this answers "you are
 * looking at one — here is why we put it in front of you". It is the same
 * verdict the card in the panel carries, shown at the moment it is actually
 * being acted on, which is the moment it is worth reading.
 *
 * Everything about EDHREC's DOM here is a guess that must be allowed to fail.
 * A missing insight is a non-event; a broken commander page is not.
 */

const host = document.createElement("div");
host.id = "mtg-edge-lord-insight";
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `<style>${styles}</style><div id="insight"></div>`;

/** The slug currently drawn, so a re-render of EDHREC's page costs nothing. */
let drawn = null;

/** Slugs dismissed this session. Closing it means closing it, not for a second. */
const dismissed = new Set();

/** Rebuilt only when the catalogue array itself changes. */
let lookup = { source: null, bySlug: new Map() };

/**
 * Called on load and on every navbar mutation, so it runs many times per page
 * and has to be cheap and idempotent. EDHREC is client-routed: the slug can
 * change with no page load, and React can drop our node on a re-render, which
 * is why re-appending is part of the normal path rather than error handling.
 *
 * @param {object[]} commanders hydrated catalogue, or nothing while it loads
 */
export function syncCommanderInsight(commanders) {
  const slug = commanderSlug(location.pathname);
  if (!slug || !commanders?.length || dismissed.has(slug)) return remove();

  const commander = index(commanders).get(slug);
  if (!commander) return remove();

  if (drawn !== slug) {
    shadow.getElementById("insight").innerHTML = insightHtml(commander);
    shadow.querySelector("#dismiss")?.addEventListener("click", () => {
      dismissed.add(slug);
      remove();
    });
    drawn = slug;
  }
  if (!host.isConnected) mount();
}

function index(commanders) {
  if (lookup.source !== commanders) {
    lookup = { source: commanders, bySlug: new Map(commanders.map((commander) => [commander.slug, commander])) };
  }
  return lookup.bySlug;
}

/**
 * `/commanders/<slug>` and its theme sub-pages, and nothing else. EDHREC uses
 * the same slugs this catalogue is keyed by, so no translation is needed.
 */
export function commanderSlug(pathname) {
  const [, section, slug] = String(pathname).split("/");
  return section === "commanders" && slug ? decodeURIComponent(slug) : null;
}

/**
 * Between EDHREC's header and its content, rather than inside either. React
 * owns what is inside `main`, and a foreign first child of a container it is
 * reconciling is a fight worth not picking.
 */
function mount() {
  const main = document.querySelector("main");
  if (main?.parentElement) main.parentElement.insertBefore(host, main);
  else document.body.prepend(host);
}

function remove() {
  host.remove();
  drawn = null;
}

function insightHtml(commander) {
  const rank = commander.popularity?.edhrecRank;
  const decks = commander.popularity?.deckCount;
  return `<article>
    <div class="head">
      <span class="brand">MTG Edge Lord</span>
      <button id="dismiss" type="button" aria-label="Hide this">×</button>
    </div>
    <div class="line">
      ${verdict(commander)}
      ${manaCostHtml(commander.manaCost)}
      <span class="muted">#${rank?.toLocaleString() ?? "—"}${decks ? ` · ${decks.toLocaleString()} decks` : ""}${commander.price !== undefined ? ` · $${commander.price.toFixed(2)}` : ""}</span>
    </div>
    ${reasons(commander)}
  </article>`;
}

function verdict(commander) {
  if (commander.edgeScore !== undefined) return `<span class="score">${commander.edgeScore}</span><span class="tier ${escapeAttr(commander.tier ?? "")}">${escapeHtml(commander.tier ?? "scored")}</span>`;
  if (commander.cohortScore !== undefined) return `<span class="score cohort">${commander.cohortScore}<small>new</small></span>`;
  return `<span class="score none">—</span>`;
}

function reasons(commander) {
  if (commander.cohortScore !== undefined) {
    return `<ul class="why">${explainCohort(commander).map(item).join("")}</ul>`;
  }
  if (commander.edgeScore === undefined) {
    return `<p class="insufficient">Not scored — ${escapeHtml(explainUnscored(commander))}</p>`;
  }
  return `<ul class="why">${explainScore(commander).map(item).join("")}</ul>`;
}

function item(reason) {
  return `<li>${escapeHtml(reason)}</li>`;
}

function escapeHtml(value) { const node = document.createElement("span"); node.textContent = String(value); return node.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replaceAll('"', "&quot;"); }
