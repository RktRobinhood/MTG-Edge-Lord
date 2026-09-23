import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regenerates the README screenshots from the preview harness.
 *
 *   npm run build && npm run screenshots
 *
 * The screenshots are the product's shop window, and a UI change silently
 * makes them a picture of software that no longer exists — which is exactly
 * what happened to the first set. Generating them from the same harness that
 * serves this checkout's `data/` makes refreshing them a command rather than
 * an afternoon, so there is no excuse for a stale one.
 *
 * Chrome does the capturing because it is already on the machine. There is no
 * headless browser in `devDependencies` and this is not a reason to add one.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 8749;
// One Chrome per shot, each on its own debugging port: a killed process does
// not release its port in time for the next one to claim it.
let devtoolsPort = port + 1;
const size = { width: 1380, height: 900 };

/** Each shot names the tab the harness should open. No tab means the panel stays shut. */
const SHOTS = [
  { file: "search.png", open: "search" },
  { file: "finds.png", open: "discover" },
  { file: "archive.png", open: "archive" },
  { file: "commander-page.png", open: null }
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);

const chrome = await firstExisting(CHROME_CANDIDATES);
if (!chrome) {
  console.error(`No Chrome or Edge found. Set CHROME_PATH to the executable and run this again.`);
  process.exit(1);
}
await access(path.join(root, "mtg-edge-lord.user.js")).catch(() => {
  console.error("mtg-edge-lord.user.js is missing. Run `npm run build` first.");
  process.exit(1);
});

const server = await startPreview();
const out = path.join(root, "docs", "screenshots");
await mkdir(out, { recursive: true });
try {
  for (const shot of SHOTS) {
    const url = `http://localhost:${port}/${shot.open ? `?open=${shot.open}` : ""}`;
    await capture(url, path.join(out, shot.file));
    console.log(`docs/screenshots/${shot.file}`);
  }
} finally {
  server.kill();
}

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", "preview.js")], {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "inherit"]
    });
    child.stdout.on("data", (chunk) => { if (String(chunk).includes("preview on")) resolve(child); });
    child.on("exit", (code) => reject(new Error(`preview server exited with ${code}`)));
  });
}

/**
 * Drives Chrome over DevTools rather than taking a one-shot `--screenshot`.
 *
 * The panel fetches, decodes and renders 6,800 commanders, and the harness
 * then clicks its way to a tab. A one-shot capture has no way to wait for
 * that, and the first attempt photographed the word "Loading…". So the page
 * raises `data-ready` when what the shot is *of* is actually on screen, and
 * the shutter waits for it.
 */
async function capture(url, file) {
  devtoolsPort += 1;
  const chromeProcess = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${path.join(root, "node_modules", ".cache", "screenshot-profile")}`,
    `--window-size=${size.width},${size.height}`,
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${devtoolsPort}`,
    url
  ], { stdio: ["ignore", "ignore", "ignore"] });

  try {
    const socket = await connect(await pageTarget());
    // The window size Chrome is given is not the viewport it renders: the
    // shots came back 1364x805. Pinning the metrics makes every capture the
    // same size as the last one, whatever the browser decides to do.
    await socket.send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: 1, mobile: false });
    await socket.ready(`document.documentElement.dataset.ready === "true"`);
    const { data } = await socket.send("Page.captureScreenshot", { format: "png" });
    await writeFile(file, Buffer.from(data, "base64"));
    socket.close();
  } finally {
    chromeProcess.kill();
  }
}

/** The debugging endpoint comes up a moment after the process does. */
async function pageTarget(deadline = Date.now() + 15000) {
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json();
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Not listening yet.
    }
    await delay(150);
  }
  throw new Error("Chrome never opened a DevTools endpoint");
}

function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  let id = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message.result);
    pending.delete(message.id);
  });

  const send = (method, params = {}) => new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });

  /** Polls an expression in the page until it is true, or gives up and shoots anyway. */
  const ready = async (expression, deadline = Date.now() + 20000) => {
    while (Date.now() < deadline) {
      const { result } = await send("Runtime.evaluate", { expression, returnByValue: true });
      if (result?.value === true) return;
      await delay(150);
    }
    console.warn(`  timed out waiting for the page to settle; capturing as-is`);
  };

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({ send, ready, close: () => socket.close() }));
    socket.addEventListener("error", () => reject(new Error(`Could not reach ${endpoint}`)));
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Next candidate. A missing browser is only fatal once they all are.
    }
  }
  return null;
}
