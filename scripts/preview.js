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
.page{max-width:720px;margin:0 auto;padding:48px 20px}h1{font-size:22px}code{background:#e6e9e7;padding:1px 5px;border-radius:4px}</style>
</head><body><div class="page">
<h1>MTG Edge Lord preview</h1>
<p>A stand-in for an EDHREC page, serving this checkout's <code>data/</code> directory.
What the panel shows here is what this working tree would ship.</p>
<p>Open the <strong>EL</strong> button, bottom right.</p>
</div>
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
// Route detection reads the path, so give it a commander page to read.
history.replaceState({}, "", "/commanders/massimo-the-magician");
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
