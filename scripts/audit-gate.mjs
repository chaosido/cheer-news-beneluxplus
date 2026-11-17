/**
 * CI dependency-audit gate with a scoped allowlist.
 *
 * Fails on any high/critical advisory that is NOT listed in
 * .github/audit-allowlist.json. The allowlist is for advisories that have no
 * patched version upstream (see each entry's "reason"); everything else must
 * be fixed, not allowlisted. Run: node scripts/audit-gate.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowlist = JSON.parse(
  readFileSync(
    new URL("../.github/audit-allowlist.json", import.meta.url),
    "utf8",
  ),
);
const allowed = new Set(allowlist.map((e) => e.id));

let out;
try {
  // npm audit exits non-zero when any vulnerability exists; we want the JSON.
  out = execSync("npm audit --json", { encoding: "utf8", maxBuffer: 64e6 });
} catch (e) {
  out = e.stdout;
}
const report = JSON.parse(out);

const failures = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    // Objects are root advisories; strings are transitive package references.
    if (typeof via !== "object") continue;
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id =
      String(via.url ?? "")
        .split("/")
        .pop() ?? "unknown";
    if (!allowed.has(id)) {
      failures.set(
        id,
        `${via.name}: ${via.title} (${via.severity}) ${via.url}`,
      );
    }
  }
}

if (failures.size > 0) {
  console.error(
    "Dependency audit gate FAILED — unallowlisted high/critical advisories:",
  );
  for (const line of failures.values()) console.error(`  - ${line}`);
  console.error(
    "\nFix the advisory (npm update / override), or — only if no patched version exists — add a scoped entry to .github/audit-allowlist.json with a reason.",
  );
  process.exit(1);
}
console.log(
  `Dependency audit gate OK (${allowed.size} allowlisted advisor${allowed.size === 1 ? "y" : "ies"}; no other high/critical findings).`,
);
