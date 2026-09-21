import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const manualConnector = {
  id: "manual",
  async collect(context) {
    const directory = path.join(context.root, "research", "inbox");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    const findings = [];
    for (const name of names) {
      const payload = JSON.parse(await readFile(path.join(directory, name), "utf8"));
      findings.push(...(Array.isArray(payload) ? payload : [payload]));
    }
    return { findings, diagnostics: [`Loaded ${findings.length} reviewed finding(s) from ${names.length} inbox file(s).`] };
  }
};
