import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline/run.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const network = process.argv.includes("--network");
const result = await runPipeline({ root, network });
for (const diagnostic of result.diagnostics) console.log(diagnostic);
console.log(`${result.changed ? "Published" : "No meaningful changes for"} ${result.findings} findings and ${result.relationships} relationships (${result.dataVersion}).`);
