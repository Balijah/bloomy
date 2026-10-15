import assert from "node:assert/strict";
import { test } from "node:test";
import { auditFindings } from "./check-audit.mjs";

test("tracks vulnerable installed versions and ignores lower severity findings", () => {
  const advisory = { severity: "high", github_advisory_id: "GHSA-test", module_name: "example", findings: [{ version: "1.0.0" }, { version: "1.0.0" }] };
  const report = { metadata: { vulnerabilities: {} }, advisories: { one: advisory, two: { ...advisory, severity: "low" } } };
  assert.deepEqual(auditFindings(report), ["GHSA-test:example@1.0.0"]);
  advisory.findings.push({ version: "1.0.1" });
  assert.deepEqual(auditFindings(report), ["GHSA-test:example@1.0.0", "GHSA-test:example@1.0.1"]);
});

test("fails closed on registry errors or incomplete reports", () => {
  for (const report of [{}, { error: { message: "registry unavailable" } }]) {
    assert.throws(() => auditFindings(report), /invalid report/);
  }
});
