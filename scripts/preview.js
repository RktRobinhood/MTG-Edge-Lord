import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Serves the built userscript against this working tree's `data/`, on a
 * stand-in page.
 *
 * The point is to see the panel without deploying: the published backend only
 * updates when `main` deploys to Pages, so without this the only way to check
 * a data or UI change is to push it. The page rewrites the userscript's
 * backend URLs to this server, so what you see is what this checkout would
 * ship.
 *
 *   npm run preview
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 8731;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>MTG Edge Lord preview</title>
<style>body{margin:0;font:15px/1.55 system-ui,sans-serif;background:#f6f7f6;color:#222}
.page{max-width:720px;margin:0 auto;padding:48px 20px}h1{font-size:22px}code{background:#e6e9e7;padding:1px 5px;border-radius:4px}
header nav{position:fixed;top:0;left:0;right:0;height:50px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#212529;color:#fff}
header nav .brand{font-weight:800;margin-right:auto}
header nav input{height:38px;border:1px solid #495057;border-radius:5px;background:#2b3035;color:#fff;padding:0 10px;width:207px}
header nav a{display:inline-flex;align-items:center;height:38px;padding:0 13px;border-radius:5px;background:#f8f9fa;color:#212529;text-decoration:none;font-size:13px}
header nav a.up{background:#0d6efd;color:#fff}
body{padding-top:50px}</style>
</head><body>
<!-- A stand-in for EDHREC's navbar, in the shape the userscript anchors to:
     a labelled search input inside an input group, followed by the account
     buttons. The Advanced button belongs between the two. -->
<header><nav>
  <span class="brand">EDHREC</span>
  <div class="Navbar_search___preview input-group"><div class="rbt"><input type="text" aria-label="Search" class="rbt-input-main form-control rbt-input" placeholder="Search"></div></div>
  <div class="accounts"><a href="#">Sign In</a> <a class="up" href="#">Sign Up</a></div>
</nav></header>
<!-- The commander-page insight mounts itself between the header and the main
     element, the way EDHREC's own pages are laid out, so the stand-in has one. -->
<main>
<div class="page">
<h1>MTG Edge Lord preview</h1>
<p>A stand-in for an EDHREC page, serving this checkout's <code>data/</code> directory.
What the panel shows here is what this working tree would ship.</p>
<p>Open the <strong>Advanced</strong> button in the navbar, beside the search box.</p>
</div>
</main>
<script>
const BASES = [
  "https://rktrobinhood.github.io/MTG-Edge-Lord/data",
  "https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data"
];
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  let url = typeof input === "string" ? input : input.url;
  for (const base of BASES) if (url.startsWith(base)) url = url.replace(base, "/data");
  return realFetch(url, init);
};
// Route detection reads the path, so give it a commander page to read —
// except when a shot is of the panel, which is a thing you open anywhere on
// EDHREC. Staying on a non-commander route keeps that shot to one subject.
const open = new URLSearchParams(location.search).get("open");
if (!open) history.replaceState({}, "", "/commanders/massimo-the-magician");

// ?open=<tab> drives the panel for a repeatable screenshot — see
// scripts/screenshots.js. Everything it touches lives in a shadow root the
// userscript owns, so it polls rather than assuming anything has mounted.
const started = Date.now();
if (!open) {
  // The commander-page shot waits on the insight banner instead of the panel.
  const wait = setInterval(() => {
    if (document.getElementById("mtg-edge-lord-insight")?.shadowRoot?.querySelector("article")) {
      document.documentElement.dataset.ready = "true";
      clearInterval(wait);
    } else if (Date.now() - started > 15000) clearInterval(wait);
  }, 120);
}
if (open) {
  const tick = setInterval(() => {
    if (Date.now() - started > 15000) return clearInterval(tick);

    const toggle = document.getElementById("mtg-edge-lord-button")?.shadowRoot?.getElementById("toggle");
    const panel = document.getElementById("mtg-edge-lord-root")?.shadowRoot;
    if (!toggle || !panel) return;
    if (panel.getElementById("panel").hidden) return toggle.click();
    if (!panel.querySelector("#results")) return;
    const tab = panel.querySelector('nav button[data-tab="' + open + '"]');
    if (tab && !tab.classList.contains("active")) return tab.click();
    if (panel.querySelector("#results .card, #results .empty")) {
      document.documentElement.dataset.ready = "true";
      clearInterval(tick);
    }
  }, 120);
}
</script>
<script src="/mtg-edge-lord.user.js"></script>
</body></html>`;

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  const file = pathname.startsWith("/data/") ? pathname.slice(1)
    : pathname === "/mtg-edge-lord.user.js" ? "mtg-edge-lord.user.js"
      : null;

  if (!file) {
    response.writeHead(200, { "Content-Type": TYPES[".html"] });
    return response.end(PAGE);
  }
  try {
    const body = await readFile(path.join(root, file));
    response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end(`Not found: ${file}. Run \`npm run build\` first if the userscript is missing.`);
  }
});

// A busy port is the ordinary case — running this twice, or leaving one open
// in another terminal — so it gets an instruction rather than a stack trace.
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Either stop what is on it, or pick another:

  PORT=${port + 1} npm run preview
`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, () => console.log(`MTG Edge Lord preview on http://localhost:${port}`));
