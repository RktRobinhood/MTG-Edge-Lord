import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline/run.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const network = process.argv.includes("--network");

// --pages=N overrides the EDHREC per-commander crawl budget for this run.
// The scheduled job leaves it unset and takes the connector's default.
const pagesArgument = process.argv.find((argument) => argument.startsWith("--pages="));
const pagesPerRun = pagesArgument ? Number(pagesArgument.slice("--pages=".length)) : undefined;

const result = await runPipeline({ root, network, pagesPerRun });
for (const diagnostic of result.diagnostics) console.log(diagnostic);
console.log(`${result.changed ? "Published" : "No meaningful changes for"} ${result.findings} findings and ${result.relationships} relationships (${result.dataVersion}).`);
