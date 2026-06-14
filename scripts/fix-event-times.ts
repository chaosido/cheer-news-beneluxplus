/**
 * One-time backfill for event time semantics.
 *
 * Two passes over Firestore `events`:
 *
 *  1. SET `allDay` on every event doc. An event is treated as all-day when,
 *     interpreted in Europe/Amsterdam, its start is at 00:00 AND it either has
 *     no `endsAt` OR the `endsAt` is ~23:59 on the same/last day (i.e. it was
 *     originally stored as a date-only / full-day item). Everything else is a
 *     genuinely timed event (`allDay=false`).
 *
 *  2. CORRECT two known federation events (matched by title, case-insensitive
 *     contains) with accurate times from the federation pages, marking them as
 *     timed (`allDay=false`). "Skills Days 2026" is genuinely multi-day.
 *
 * Locked docs (manually edited) are never touched.
 *
 * Run with: npx tsx --env-file=.env.local scripts/fix-event-times.ts
 * See scripts/seed.ts for the `server-only` re-exec rationale.
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

import type { Timestamp as TimestampType } from "firebase-admin/firestore";

const TZ = "Europe/Amsterdam";

/** Known federation events to correct, matched by case-insensitive title contains. */
const FEDERATION_FIXES: {
  match: string;
  startIso: string;
  endIso: string;
  locationText: string;
}[] = [
  {
    match: "legends of pom",
    startIso: "2026-06-28T10:00:00+02:00",
    endIso: "2026-06-28T16:00:00+02:00",
    locationText: "Waterwinhal, Musicallaan 100, Utrecht",
  },
  {
    match: "skills days 2026",
    startIso: "2026-08-01T10:00:00+02:00",
    endIso: "2026-08-02T18:00:00+02:00", // MULTI-DAY
    locationText: "Ovvo hal, Sportparkweg 9, Maarssen",
  },
];

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { Timestamp } = await import("firebase-admin/firestore");
  const { formatInTimeZone } = await import("date-fns-tz");

  /** Local "HH:mm" for a Timestamp in Europe/Amsterdam. */
  const localTime = (ts: TimestampType) =>
    formatInTimeZone(ts.toDate(), TZ, "HH:mm");
  /** Local "yyyy-MM-dd" for a Timestamp in Europe/Amsterdam. */
  const localDay = (ts: TimestampType) =>
    formatInTimeZone(ts.toDate(), TZ, "yyyy-MM-dd");

  const snap = await adminDb.collection("events").get();

  // Firestore batches cap at 500 writes; chunk to stay well under the limit so a
  // crash mid-run can only ever lose an un-committed tail, never a partial doc.
  const BATCH_LIMIT = 400;
  const batches: FirebaseFirestore.WriteBatch[] = [adminDb.batch()];
  let opCount = 0;
  function nextOp(): FirebaseFirestore.WriteBatch {
    if (opCount >= BATCH_LIMIT) {
      batches.push(adminDb.batch());
      opCount = 0;
    }
    opCount += 1;
    return batches[batches.length - 1];
  }

  let setAllDayTrue = 0;
  let setTimed = 0;
  let lockedSkipped = 0;
  const fixedEvents: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();

    if (data.locked === true) {
      lockedSkipped++;
      continue;
    }

    const title: string = data.title ?? "";
    const lowerTitle = title.toLowerCase();

    // ---- Pass 2 (takes precedence): known federation corrections ----
    const fix = FEDERATION_FIXES.find((f) => lowerTitle.includes(f.match));
    if (fix) {
      nextOp().update(doc.ref, {
        startsAt: Timestamp.fromDate(new Date(fix.startIso)),
        endsAt: Timestamp.fromDate(new Date(fix.endIso)),
        locationText: fix.locationText,
        allDay: false,
      });
      setTimed++;
      const span =
        fix.startIso.slice(0, 10) === fix.endIso.slice(0, 10)
          ? fix.startIso.slice(0, 10)
          : `${fix.startIso.slice(0, 10)} → ${fix.endIso.slice(0, 10)} (multi-day)`;
      fixedEvents.push(`"${title}" → ${span} @ ${fix.locationText}`);
      continue;
    }

    // ---- Pass 1: derive allDay ----
    const startsAt = data.startsAt as TimestampType | undefined;
    const endsAt = (data.endsAt as TimestampType | null | undefined) ?? null;

    let allDay = false;
    if (startsAt && localTime(startsAt) === "00:00") {
      if (!endsAt) {
        allDay = true;
      } else {
        // Stored as a date-only/full-day item if the end is ~23:59 (same or last day).
        const endTime = localTime(endsAt);
        if (endTime === "23:59" || endTime === "23:58") allDay = true;
        // Some date-only items are stored end-of-day at next-midnight too.
        else if (endTime === "00:00" && localDay(endsAt) > localDay(startsAt))
          allDay = true;
      }
    }

    nextOp().update(doc.ref, { allDay });
    if (allDay) setAllDayTrue++;
    else setTimed++;
  }

  for (const b of batches) await b.commit();

  console.log("\n[fix-event-times] done:");
  console.log(`  total events scanned: ${snap.size}`);
  console.log(`  allDay=true set:      ${setAllDayTrue}`);
  console.log(`  timed (allDay=false): ${setTimed}`);
  console.log(`  locked skipped:       ${lockedSkipped}`);
  console.log(`  federation events fixed: ${fixedEvents.length}`);
  for (const f of fixedEvents) console.log(`    - ${f}`);
}

main().catch((err) => {
  console.error("[fix-event-times] fatal:", err);
  process.exit(1);
});
