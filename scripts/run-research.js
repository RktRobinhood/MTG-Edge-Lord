import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline/run.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const network = process.argv.includes("--network");

// --pages=N and --commanders=N override the rotated crawl budgets for this
// run. The scheduled job leaves them unset and takes each connector's default.
const pagesPerRun = numericFlag("--pages");
const commandersPerRun = numericFlag("--commanders");

const result = await runPipeline({ root, network, pagesPerRun, commandersPerRun });
for (const diagnostic of result.diagnostics) console.log(diagnostic);
console.log(`${result.changed ? "Published" : "No meaningful changes for"} ${result.findings} findings and ${result.relationships} relationships (${result.dataVersion}).`);

function numericFlag(name) {
  const found = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (!found) return undefined;
  const value = Number(found.slice(name.length + 1));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
