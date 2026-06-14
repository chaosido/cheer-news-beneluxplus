/**
 * Daily submission digest for Cheer News BeneluxPlus.
 *
 * Run with: `npm run digest` (tsx --env-file=.env.local scripts/notify-digest.ts)
 *   --dry-run   list what WOULD be emailed, but send nothing and mark nothing.
 *
 * Sends maintainers ONE email listing every pending submission that hasn't been
 * reported yet (`digestNotifiedAt == null`), then stamps those rows so they are
 * never re-sent. If there is nothing new, it sends NOTHING — so the inbox only
 * gets a mail on days that actually had submissions ("only if relevant").
 *
 * Rows are stamped only when the mail genuinely went out (sendSubmissionDigest
 * returns true); if Gmail isn't configured or sending fails, the rows stay
 * un-notified and roll into the next day's digest.
 *
 * Intended to run on an evening cron — see .github/workflows/notify-digest.yml.
 *
 * NOTE ON `server-only`: ../lib/firebaseAdmin and ../lib/mailer import the
 * `server-only` marker package, whose default export throws outside a React
 * Server environment. We re-exec once with `--conditions=react-server` so the
 * package resolves to its no-op variant; only then do we import them. (Same
 * trick as scripts/seed.ts.)
 */
import { spawnSync } from "node:child_process";
// Type-only: erased at compile time, so this does NOT import the server-only
// module at runtime (the re-exec guard below handles the runtime import).
import type { DigestSubmission } from "../lib/mailer";

const REACT_SERVER_CONDITION = "--conditions=react-server";

// Re-exec guard. Must run before anything imports a `server-only` module.
if (!process.execArgv.includes(REACT_SERVER_CONDITION)) {
  const result = spawnSync(
    process.argv[0],
    [...process.execArgv, REACT_SERVER_CONDITION, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const { sendSubmissionDigest } = await import("../lib/mailer");

  // Pending set is small; filter the "not yet notified" rows in memory so we
  // need no composite index (status + digestNotifiedAt).
  const snap = await adminDb
    .collection("submissions")
    .where("status", "==", "pending")
    .get();

  const pending = snap.docs.filter((d) => !d.get("digestNotifiedAt"));

  if (pending.length === 0) {
    console.log("[digest] No new submissions to report. Sending nothing.");
    return;
  }

  const submissions: DigestSubmission[] = pending.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt;
    return {
      id: d.id,
      kind: data.kind,
      payload: (data.payload ?? {}) as Record<string, unknown>,
      submittedByEmail:
        typeof data.submittedByEmail === "string"
          ? data.submittedByEmail
          : null,
      createdAt:
        createdAt && typeof createdAt.toDate === "function"
          ? createdAt.toDate().toISOString()
          : null,
    };
  });

  console.log(
    `[digest] ${submissions.length} new submission(s) pending review:`,
  );
  for (const s of submissions) {
    console.log(`  - [${s.kind}] ${JSON.stringify(s.payload)}`);
  }

  if (DRY_RUN) {
    console.log("[digest] --dry-run: not sending, not marking.");
    return;
  }

  const sent = await sendSubmissionDigest(submissions);
  if (!sent) {
    console.warn(
      "[digest] Digest not sent (mail unconfigured or send failed). Rows left un-notified; will retry next run.",
    );
    return;
  }

  // Stamp the reported rows so they are never re-sent. Batched (chunks of 400,
  // well under Firestore's 500-write batch limit).
  const CHUNK = 400;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const batch = adminDb.batch();
    for (const doc of pending.slice(i, i + CHUNK)) {
      batch.update(doc.ref, { digestNotifiedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }

  console.log(
    `[digest] Sent digest of ${submissions.length} submission(s) and marked them notified.`,
  );
}

main().catch((err) => {
  console.error("[digest] failed:", err);
  process.exit(1);
});
