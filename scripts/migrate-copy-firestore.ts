/**
 * One-off migration: copy Firestore data from the SOURCE project to the TARGET
 * project (the CSN handover). Used to move the live app off Jesse's personal
 * project (`cheer-news-beneluxplus`) onto the CSN-owned project.
 *
 * Run with:
 *   npm run migrate:copy -- --dry-run     count docs per collection, write NOTHING
 *   npm run migrate:copy                  perform the copy
 *
 * Env (set in .env.local or the shell):
 *   SOURCE_SA   path to the SOURCE service-account key JSON
 *               (default ./.secrets/scraper-sa.json)
 *   TARGET_SA   path to the TARGET (CSN) service-account key JSON
 *               (default ./.secrets/csn-sa.json — created by tmp/csn-handover.sh)
 *
 * Copies these top-level collections and, recursively, every subcollection
 * (so `clubs/{id}/teams` comes along automatically):
 *   clubs, events, open_gyms, submissions, visiting_coaches, sources, auditLog
 *
 * Native Firestore types (Timestamp, GeoPoint, DocumentReference, nested maps)
 * survive because we read with the Admin SDK and write the same objects back.
 * Writes use set() (full overwrite) keyed by the SAME document id, so the copy
 * is idempotent and safe to re-run. Additive into an empty target project.
 *
 * This script does NOT import ../lib/firebaseAdmin (that is a single-project,
 * `server-only` singleton). It initializes two Admin apps directly, so there is
 * no `server-only` re-exec guard to worry about.
 */
import { readFileSync } from "node:fs";
import {
  cert,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
  type CollectionReference,
} from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");

const SOURCE_SA = process.env.SOURCE_SA ?? "./.secrets/scraper-sa.json";
const TARGET_SA = process.env.TARGET_SA ?? "./.secrets/csn-sa.json";

// Top-level collections to copy. Subcollections are discovered and copied
// recursively via listCollections(), so `clubs/{id}/teams` is included.
const TOP_LEVEL_COLLECTIONS = [
  "clubs",
  "events",
  "open_gyms",
  "submissions",
  "visiting_coaches",
  "sources",
  "auditLog",
];

const WRITE_BATCH_LIMIT = 400; // Firestore hard cap is 500; leave headroom.

function loadApp(keyPath: string, name: string): App {
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(readFileSync(keyPath, "utf8")) as ServiceAccount;
  } catch (err) {
    throw new Error(
      `Could not read service-account key at "${keyPath}" (set ${name === "source" ? "SOURCE_SA" : "TARGET_SA"}): ${(err as Error).message}`,
    );
  }
  return initializeApp(
    { credential: cert(parsed), projectId: parsed.projectId },
    name,
  );
}

/**
 * Recursively copy one collection (all its docs, then each doc's
 * subcollections) from source to target. Returns the number of docs written.
 */
async function copyCollection(
  sourceCol: CollectionReference,
  targetDb: Firestore,
  path: string,
): Promise<number> {
  const snap = await sourceCol.get();
  let written = 0;

  let batch = DRY_RUN ? null : targetDb.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    if (!DRY_RUN) {
      batch!.set(targetDb.doc(doc.ref.path), doc.data());
      pending += 1;
      if (pending >= WRITE_BATCH_LIMIT) {
        await batch!.commit();
        batch = targetDb.batch();
        pending = 0;
      }
    }
    written += 1;
  }
  if (!DRY_RUN && pending > 0) await batch!.commit();

  console.log(
    `  ${DRY_RUN ? "would copy" : "copied"} ${snap.size
      .toString()
      .padStart(4)} doc(s)  ${path}`,
  );

  // Recurse into each source doc's subcollections.
  for (const doc of snap.docs) {
    const subCols = await doc.ref.listCollections();
    for (const sub of subCols) {
      written += await copyCollection(
        sub,
        targetDb,
        `${path}/${doc.id}/${sub.id}`,
      );
    }
  }

  return written;
}

async function main(): Promise<void> {
  const sourceApp = loadApp(SOURCE_SA, "source");
  const sourceDb = getFirestore(sourceApp);
  // Dry run only reads the source, so don't require the target key to exist yet
  // (lets us validate counts before the CSN project is even provisioned).
  const targetApp = DRY_RUN ? null : loadApp(TARGET_SA, "target");
  const targetDb = targetApp
    ? getFirestore(targetApp)
    : (null as unknown as Firestore);

  console.log(
    `[migrate:copy]${DRY_RUN ? " (dry-run)" : ""}\n` +
      `  source: ${(sourceApp.options.credential as unknown as { projectId?: string })?.projectId ?? SOURCE_SA}\n` +
      `  target: ${targetApp ? ((targetApp.options.credential as unknown as { projectId?: string })?.projectId ?? TARGET_SA) : "(none — dry run)"}\n`,
  );

  if (DRY_RUN) {
    console.log("  DRY RUN — reading source counts only, no writes.\n");
  } else {
    console.log(
      "  Writing with set() (overwrite by id) — idempotent, re-runnable.\n",
    );
  }

  let total = 0;
  for (const name of TOP_LEVEL_COLLECTIONS) {
    total += await copyCollection(sourceDb.collection(name), targetDb, name);
  }

  console.log(
    `\n[migrate:copy]${DRY_RUN ? " (dry-run)" : ""} ` +
      `${total} document(s) ${DRY_RUN ? "found" : "copied"} across ` +
      `${TOP_LEVEL_COLLECTIONS.length} top-level collection(s) (+ subcollections).`,
  );
  if (DRY_RUN) console.log("[migrate:copy] Dry run — no writes performed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
