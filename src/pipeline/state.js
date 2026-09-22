import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Pipeline state that must survive between scheduled runs: bulk-file
 * timestamps, crawl rotation cursors, connector cursors.
 *
 * It lives in `state/`, not `data/`. `data/` is the published backend and
 * every file in it is either fetched by the userscript or listed in the
 * manifest; state is internal bookkeeping that nothing downstream reads.
 * Committing it is what lets a run pick up where the last one stopped.
 */
const STATE_FILE = path.join("state", "connectors.json");

export async function readPipelineState(root) {
  try {
    return JSON.parse(await readFile(path.join(root, STATE_FILE), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

export async function writePipelineState(root, state) {
  const destination = path.join(root, STATE_FILE);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(state, null, 2)}\n`);
}
