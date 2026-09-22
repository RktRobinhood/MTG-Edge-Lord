import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Tampermonkey decides whether to update by comparing `@version` against the
 * installed copy, so a shipped change that forgets to raise it never reaches
 * anyone. The number is read from `package.json` rather than written here: two
 * copies of a version are two chances to bump only one of them.
 */
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const metadata = `// ==UserScript==
// @name         MTG Edge Lord — EDHREC Discovery
// @namespace    https://github.com/RktRobinhood/MTG-Edge-Lord
// @version      ${version}
// @description  Advanced off-meta Commander search, recent finds, and card-first discovery on EDHREC.
// @match        https://edhrec.com/*
// @connect      rktrobinhood.github.io
// @connect      raw.githubusercontent.com
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/mtg-edge-lord.user.js
// @downloadURL  https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/mtg-edge-lord.user.js
// ==/UserScript==`;

await build({
  entryPoints: [path.join(root, "src/userscript/index.js")],
  outfile: path.join(root, "mtg-edge-lord.user.js"),
  bundle: true,
  minify: true,
  legalComments: "none",
  banner: { js: metadata },
  format: "iife",
  target: ["chrome109", "firefox115"]
});
console.log("Built mtg-edge-lord.user.js");
