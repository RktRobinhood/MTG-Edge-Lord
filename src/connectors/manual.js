import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const manualConnector = {
  id: "manual",
  async collect(context) {
    const directory = path.join(context.root, "research", "inbox");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    const findings = [];
    const diagnostics = [];
    let failures = 0;
    for (const name of names) {
      try {
        const payload = JSON.parse(await readFile(path.join(directory, name), "utf8"));
        findings.push(...(Array.isArray(payload) ? payload : [payload]));
      } catch (error) {
        failures += 1;
        diagnostics.push(`${name}: skipped unreadable input (${error.message}).`);
      }
    }
    diagnostics.push(`Loaded ${findings.length} reviewed finding(s) from ${names.length} inbox file(s).`);
    return { findings, failures, diagnostics };
  }
};
