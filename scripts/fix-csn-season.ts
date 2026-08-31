/**
 * Correction pass over CSN's already-published 2026/27 season events.
 *
 * The 20 `csn-2627-*` event docs were imported in an earlier session and are
 * live. This script does NOT re-import them — a second import under different
 * ids would have produced 20 duplicates. It only fixes what the source
 * spreadsheets say is wrong:
 *
 *   1. NK Rehearsal is 08-05-2027, not the 9th. The website sheet said the 9th;
 *      the internal sheet and the public PDF said the 8th, and CSN confirmed the
 *      8th. The doc id encodes the date, so this is a move: write the corrected
 *      doc under a new id and delete the old one.
 *   2. Discussion session is 31-01-2027, not the 30th. Both spreadsheets agree
 *      on the 31st. Same move treatment.
 *   3. Five workshops carry no location at all. CSN has not fixed a venue, and
 *      Jesse's instruction is to place them in Utrecht for now — with location
 *      text that says the venue is unconfirmed, so it cannot be mistaken for a
 *      settled address.
 *   4. Six docs name a city but have no coordinates, so they get no map pin.
 *      Backfilled from the city centroid (Leuven and Den Bosch already had them).
 *
 * Everything else about these docs — titles, descriptions, prices, members-only
 * wording, types — is left exactly as the earlier pass wrote it.
 *
 * Run with:
 *   npm run fix:csn              # DRY RUN — prints planned changes, writes NOTHING
 *   npm run fix:csn -- --apply   # apply
 *
 * Writes LIVE production data (project cheer-overview-site) via ADC as
 * jesse@cheersport.nl — the only account with IAM on that project.
 *
 * NOTE ON `server-only`: ../lib/firebaseAdmin imports the `server-only` marker
 * package; we re-exec once with `--conditions=react-server` so it resolves to
 * its no-op variant before importing the admin SDK. (re-exec guard below.)
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

const APPLY = process.argv.includes("--apply");

/** City centroids for docs that name a city but carry no coordinates. */
const COORDS: Record<string, { lat: number; lng: number }> = {
  Breda: { lat: 51.5719, lng: 4.7683 },
  Utrecht: { lat: 52.0907, lng: 5.1214 },
};

/** A doc whose date is wrong; the id encodes the date, so it must be re-keyed. */
interface Move {
  from: string;
  to: string;
  /** Corrected local start/end, Europe/Amsterdam. */
  start: string;
  end: string;
  why: string;
}

const MOVES: Move[] = [
  {
    from: "csn-2627-nk-rehearsal-2027-05-09",
    to: "csn-2627-nk-rehearsal-2027-05-08",
    start: "2027-05-08T10:00:00+02:00",
    end: "2027-05-08T17:00:00+02:00",
    why: "CSN confirmed the 8th; the website sheet's 9th was the outlier.",
  },
  {
    from: "csn-2627-discussion-session-2027-01-30",
    to: "csn-2627-discussion-session-2027-01-31",
    start: "2027-01-31T10:00:00+01:00",
    end: "2027-01-31T12:00:00+01:00",
    why: "Both source spreadsheets say 31-01-2027.",
  },
];

/** Docs with no location, to be placed provisionally in Utrecht. */
const PLACE_IN_UTRECHT = [
  "csn-2627-workshop-2026-10-11",
  "csn-2627-workshop-under-16-2026-11-28",
  "csn-2627-workshop-over-16-2026-11-29",
  "csn-2627-workshop-tumbling-2027-01-24",
  "csn-2627-workshop-2027-06-13",
];

const UTRECHT_PROVISIONAL = {
  locationText: "Utrecht (locatie nog niet bevestigd)",
  city: "Utrecht",
  region: "Utrecht",
  ...COORDS.Utrecht,
};

/** Sentence appended to the description of provisionally-placed events. */
const PROVISIONAL_NOTE =
  "Exacte locatie is nog niet bekend; Utrecht is een voorlopige plaatsing.";

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { Timestamp, FieldValue } = await import("firebase-admin/firestore");

  const tag = APPLY ? "" : "[dry run] ";

  // ---- 1 & 2. Re-key the two mis-dated docs ----
  console.log(
    `\n${tag}Correcting dates (doc id encodes the date, so re-keyed):`,
  );
  for (const m of MOVES) {
    const fromRef = adminDb.doc(`events/${m.from}`);
    const snap = await fromRef.get();
    if (!snap.exists) {
      console.log(`  ! ${m.from} not found — already corrected? Skipping.`);
      continue;
    }
    const data = snap.data() ?? {};
    const oldStart = data.startsAt?.toDate?.().toISOString().slice(0, 10);
    console.log(
      `  ${m.from}\n      → ${m.to}\n      ${oldStart} → ${m.start.slice(0, 10)}   (${m.why})`,
    );
    if (!APPLY) continue;
    await adminDb.doc(`events/${m.to}`).set(
      {
        ...data,
        canonicalEventId: m.to,
        startsAt: Timestamp.fromDate(new Date(m.start)),
        endsAt: Timestamp.fromDate(new Date(m.end)),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await fromRef.delete();
  }

  // ---- 3. Place the venue-less workshops in Utrecht ----
  console.log(`\n${tag}Placing venue-less workshops in Utrecht (provisional):`);
  for (const id of PLACE_IN_UTRECHT) {
    const ref = adminDb.doc(`events/${id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ! ${id} not found. Skipping.`);
      continue;
    }
    const d = snap.data() ?? {};
    const desc = String(d.description ?? "");
    const needsNote = !desc.includes("voorlopige plaatsing");
    console.log(
      `  ${id}\n      location: "${d.locationText ?? "(none)"}" → "${UTRECHT_PROVISIONAL.locationText}"` +
        (needsNote
          ? `\n      + description note about the provisional venue`
          : ""),
    );
    if (!APPLY) continue;
    await ref.update({
      ...UTRECHT_PROVISIONAL,
      ...(needsNote
        ? { description: `${desc} ${PROVISIONAL_NOTE}`.trim() }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // ---- 4. Backfill coordinates wherever a city is named but coords are absent ----
  console.log(
    `\n${tag}Backfilling coordinates (city named, no lat/lng → no map pin):`,
  );
  const all = await adminDb.collection("events").get();
  const csn = all.docs.filter(
    (d) => d.id.startsWith("csn-2627-") && !MOVES.some((m) => m.from === d.id),
  );
  let fixed = 0;
  for (const doc of csn) {
    const d = doc.data();
    const city = typeof d.city === "string" ? d.city : null;
    if (!city || d.lat != null) continue;
    const c = COORDS[city];
    if (!c) {
      console.log(
        `  ? ${doc.id}: city "${city}" has no known centroid — left alone`,
      );
      continue;
    }
    console.log(`  ${doc.id}  ${city} → ${c.lat}, ${c.lng}`);
    fixed++;
    if (!APPLY) continue;
    await doc.ref.update({ ...c, updatedAt: FieldValue.serverTimestamp() });
  }
  if (fixed === 0) console.log("  (none needed)");

  console.log(
    APPLY
      ? `\nDone.`
      : `\nDRY RUN — nothing written. Re-run with --apply to commit.`,
  );
}

main().catch((err) => {
  console.error("Failed to fix CSN season:", err);
  process.exit(1);
});
