import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function auditFindings(report) {
  assert(report.metadata?.vulnerabilities && report.advisories && !report.error, "Audit failed or returned an invalid report");
  return [...new Set(Object.values(report.advisories)
    .filter((advisory) => ["high", "critical"].includes(advisory.severity))
    .flatMap((advisory) => advisory.findings.map((finding) =>
      `${advisory.github_advisory_id}:${advisory.module_name}@${finding.version}`)))].sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = spawnSync("pnpm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  assert([0, 1].includes(result.status), `Could not run audit: ${result.error ?? result.stderr}`);
  const report = JSON.parse(result.stdout);
  const findings = auditFindings(report);
  const baseline = JSON.parse(readFileSync(new URL("./security-audit-baseline.json", import.meta.url), "utf8"));
  const added = findings.filter((finding) => !baseline.findings.includes(finding));
  console.log("Dependency audit totals:", report.metadata.vulnerabilities);
  if (findings.length) {
    console.log(`::warning::${findings.length} existing high/critical advisory and version pairs remain. See scripts/security-audit-baseline.json; this check does not certify the dependencies as safe.`);
  }
  assert.equal(added.length, 0, `New high/critical dependency findings:\n${added.join("\n")}`);
  console.log("No new high/critical advisory and version pairs.");
}
