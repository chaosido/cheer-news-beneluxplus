/**
 * Read submissions straight from prod Firestore — for the maintainer / Claude
 * Code to triage the open-format "iets melden" pile.
 *
 * Run with:
 *   npm run submissions                 # pending items, human-readable
 *   npm run submissions -- --all        # every submission, any status
 *   npm run submissions -- --status=published
 *   npm run submissions -- --json       # machine-readable (pipe into jq / Claude)
 *
 * It connects with the same Admin SDK credentials as the other scripts
 * (FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS via
 * --env-file=.env.local), so it reads LIVE production data. Read-only: it never
 * writes.
 *
 * NOTE ON `server-only`: ../lib/firebaseAdmin imports the `server-only` marker
 * package; we re-exec once with `--conditions=react-server` so it resolves to
 * its no-op variant before importing the admin SDK. (Same trick as seed.ts.)
 */
import { spawnSync } from "node:child_process";

const REACT_SERVER_CONDITION = "--conditions=react-server";

if (!process.execArgv.includes(REACT_SERVER_CONDITION)) {
  const result = spawnSync(
    process.argv[0],
    [...process.execArgv, REACT_SERVER_CONDITION, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

const args = process.argv.slice(2);
const AS_JSON = args.includes("--json");
const ALL = args.includes("--all");
const statusArg = args.find((a) => a.startsWith("--status="))?.split("=")[1];
/** Default view: the review pile. `--all` overrides to every status. */
const STATUS = ALL ? null : (statusArg ?? "pending");

function toIso(ts: unknown): string | null {
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");

  let query = adminDb.collection("submissions") as FirebaseFirestore.Query;
  if (STATUS) query = query.where("status", "==", STATUS);

  const snap = await query.get();

  const rows = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        kind: data.kind as string,
        status: data.status as string,
        payload: (data.payload ?? {}) as Record<string, unknown>,
        submittedByEmail: (data.submittedByEmail as string) ?? null,
        createdAt: toIso(data.createdAt),
        digestNotifiedAt: toIso(data.digestNotifiedAt),
      };
    })
    // Newest first (sort in memory — the set is small, no index needed).
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  if (AS_JSON) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  const label = STATUS ?? "alle";
  if (rows.length === 0) {
    console.log(`Geen inzendingen (${label}).`);
    return;
  }

  console.log(`${rows.length} inzending(en) — status: ${label}\n`);
  rows.forEach((r, i) => {
    console.log(`${i + 1}. [${r.kind}] (${r.status})  id=${r.id}`);
    console.log(
      `   ingezonden: ${r.createdAt ?? "?"} door ${r.submittedByEmail ?? "onbekend"}`,
    );
    for (const [k, v] of Object.entries(r.payload)) {
      if (v === null || v === undefined || String(v).trim() === "") continue;
      console.log(`   ${k}: ${String(v)}`);
    }
    console.log("");
  });
}

main().catch((err) => {
  console.error("Failed to read submissions:", err);
  process.exit(1);
});
