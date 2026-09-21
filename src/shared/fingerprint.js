import { createHash } from "node:crypto";

export function fingerprintFinding(finding) {
  const stable = {
    type: finding.findingType,
    url: finding.source.url,
    commanders: finding.commanders.map((item) => item.slug).sort(),
    cards: finding.cards.map((item) => item.slug).sort(),
    publishedAt: finding.publishedAt
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}
