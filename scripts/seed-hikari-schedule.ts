/**
 * One-off writer: Hikari's 2026/27 season-start schedule.
 *
 * Source: `hikari_schedule.ics` (16 flat VEVENTs, 12 Aug – 30 Sep 2026, no
 * RRULEs). Hikari's weekly pattern is ALREADY in Firestore, so this script does
 * not recreate it — an earlier draft added new recurring docs and would have
 * rendered Wednesday and Sunday twice on the club page.
 *
 * What the ICS actually contains, and where each part lands:
 *
 *   - 12 ordinary trainings. These are the existing Rivals slots (Wed evening +
 *     Sun morning). Rivals is ONE team; for these months those sessions are
 *     World Cup preparation rather than a different team, so the only change is
 *     a `notes` line saying so. No new docs, no team relabelling.
 *   - 4 genuinely special sessions → `events`. All are open to people outside
 *     the team, so they belong on the public agenda.
 *
 * Also corrects the Wednesday end time: the doc said 21:30, the club trains
 * until 22:00.
 *
 * DELIBERATELY NOT MODELLED:
 *   - The per-date asides on 12 Aug ("Jeroen might join") and 16 Aug ("+30 min,
 *     team meeting after"). `notes` is series-wide; there is no per-date note on
 *     a recurrence. Both are short-lived internal chatter, not schedule facts.
 *   - `exdates` for the three dates a special session takes over (19 Aug,
 *     23 Aug, 6 Sep). Trainings are never expanded into dated occurrences in the
 *     UI (the club page renders a weekday pattern; the agenda excludes
 *     trainings), so they would have no visible effect on a standing series.
 *
 * LEFT ALONE: tr-0..tr-3 and tr-6 (other teams), and both public open gyms
 * (`hikari-og-mon` Mon 19:00–22:00, `hikari-og-sun` Sun 14:00–16:00) — confirmed
 * current, and neither overlaps the ICS.
 *
 * The club is resolved from the LIVE club doc, so events inherit real
 * coordinates and venue text rather than hardcoded guesses.
 *
 * Run with:
 *   npm run seed:hikari              # DRY RUN — prints planned writes, writes NOTHING
 *   npm run seed:hikari -- --apply   # apply
 *
 * NOTE: unlike the older scripts (which write unless given --dry-run), this one
 * is inert by default and needs an explicit --apply, because it both creates
 * documents and mutates existing ones in production.
 *
 * Connects with the same Admin SDK credentials as the other scripts
 * (FIREBASE_SERVICE_ACCOUNT, else ADC via `gcloud auth application-default
 * login`), so it writes LIVE production data — project cheer-overview-site.
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

/** Club to attach everything to, matched on slug (falls back to a name scan). */
const CLUB_SLUG = "hikari-cheerleading";
const CLUB_NAME_HINT = "hikari";

/**
 * Patches to EXISTING recurring training docs. Keyed by doc id — the script
 * fails loudly if one is missing rather than creating it, since a missing id
 * means the schedule was restructured and this table is stale.
 */
interface TrainingPatch {
  id: string;
  /** Human label for the log line only. */
  describe: string;
  /** Corrected end time, when the stored one is wrong. */
  endTime?: string;
  notes: string;
}

const TRAINING_PATCHES: TrainingPatch[] = [
  {
    id: "hikari-cheerleading-tr-4",
    describe: "Rivals — woensdag",
    // Stored as 21:30; the club trains until 22:00.
    endTime: "22:00",
    notes:
      "Deze periode staat de woensdagtraining in het teken van de World Cup-voorbereiding.",
  },
  {
    id: "hikari-cheerleading-tr-5",
    describe: "Rivals — zondag",
    notes:
      "In augustus staat ook de zondagtraining in het teken van de World Cup-voorbereiding; vanaf 13 september weer regulier.",
  },
];

/**
 * The special sessions. All four are open to people outside the team, which is
 * why they are public `events` rather than trainings. Times carry the +02:00
 * CEST offset (the switch to CET is the last Sunday of October, after this run).
 */
interface EventSeed {
  id: string;
  title: string;
  description: string;
  type: "workshop" | "open_gym" | "tryout";
  startsAt: string; // ISO-8601 with offset
  endsAt: string;
}

const EVENTS: EventSeed[] = [
  {
    id: "hikari-2026-08-19-open-workshop",
    title: "Open training met gastcoach Evynn",
    description:
      "Skills workshop met externe coach Evynn, samen met Jeroen. Open voor alle huidige én toekomstige wedstrijdsporters.",
    type: "workshop",
    startsAt: "2026-08-19T19:00:00+02:00",
    endsAt: "2026-08-19T22:00:00+02:00",
  },
  {
    id: "hikari-2026-08-23-open-gym",
    title: "Open gym (CSN coachesselectie)",
    description:
      "Geen coaches aanwezig. Je kiest zelf: open gym bij Hikari om aan teamskills te werken, of naar de coachesselectie van CSN.",
    type: "open_gym",
    startsAt: "2026-08-23T10:00:00+02:00",
    endsAt: "2026-08-23T14:00:00+02:00",
  },
  {
    id: "hikari-2026-08-28-open-tumbling",
    title: "Open tumblingtraining voor iedereen",
    description:
      "Coach Kiki. 19:30–20:00 warming-up, 20:00–21:00 tumbling, 21:00–22:00 open gym.",
    type: "workshop",
    startsAt: "2026-08-28T19:00:00+02:00",
    endsAt: "2026-08-28T22:00:00+02:00",
  },
  // NOTE: the ICS's 6 Sep try-out is deliberately absent. Hikari already had
  // `hikari-cheerleading-rev-5` ("Tryouts Rivals 2") on that date, carrying
  // ticketing detail the ICS lacks. A first run of this script created a second
  // doc for it; that duplicate was deleted and the entry removed here so a
  // re-run cannot recreate it. The two sources disagree on the end time
  // (ICS 15:00 vs rev-5 16:00) — unresolved, see the run notes.
];

interface ClubTarget {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  locationText: string | null;
}

/** Resolve the club by slug, falling back to a case-insensitive name scan. */
async function resolveClub(
  db: FirebaseFirestore.Firestore,
): Promise<ClubTarget> {
  const bySlug = await db
    .collection("clubs")
    .where("slug", "==", CLUB_SLUG)
    .limit(1)
    .get();

  let doc = bySlug.docs[0];
  if (!doc) {
    const all = await db.collection("clubs").get();
    doc = all.docs.filter((d) =>
      String(d.data().name ?? "")
        .toLowerCase()
        .includes(CLUB_NAME_HINT),
    )[0];
  }
  if (!doc) {
    throw new Error(
      `No club found for slug "${CLUB_SLUG}" or name containing "${CLUB_NAME_HINT}". ` +
        `Nothing written — fix the matcher rather than creating a club here.`,
    );
  }

  const data = doc.data();
  return {
    id: doc.id,
    name: String(data.name ?? doc.id),
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
    // Prefer the explicit training venue; fall back to the club address.
    locationText:
      (typeof data.trainingLocation === "string" && data.trainingLocation) ||
      (typeof data.address === "string" && data.address) ||
      null,
  };
}

/** Show every recurring doc for the club, marking the ones this run touches. */
async function reportExisting(
  db: FirebaseFirestore.Firestore,
  club: ClubTarget,
): Promise<void> {
  const snap = await db
    .collection("open_gyms")
    .where("clubId", "==", club.id)
    .get();

  console.log(`\nExisting open_gyms docs for ${club.name} (${snap.size}):`);
  for (const d of snap.docs) {
    const g = d.data();
    const touched = TRAINING_PATCHES.some((t) => t.id === d.id);
    console.log(
      `  ${touched ? "→" : " "} ${d.id}  ${g.sessionType ?? "(unset)"}  ` +
        `${g.rrule ?? "(one-off)"}  ${g.startTime}–${g.endTime}  ` +
        `team=${g.teamLabel ?? "-"}${touched ? "   [PATCHED BELOW]" : ""}`,
    );
  }
  console.log("  (rows without → are left completely untouched)");
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { Timestamp, FieldValue } = await import("firebase-admin/firestore");

  const club = await resolveClub(adminDb);
  console.log(
    `\nTarget club: ${club.name} (${club.id})  lat=${club.lat} lng=${club.lng}\n` +
      `Venue text: ${club.locationText ?? "(none on the club doc)"}`,
  );

  await reportExisting(adminDb, club);

  console.log(
    `\n${APPLY ? "Patching" : "[dry run] Would patch"} existing trainings:`,
  );
  for (const t of TRAINING_PATCHES) {
    const ref = adminDb.doc(`open_gyms/${t.id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(
        `Training doc ${t.id} does not exist. The schedule was restructured — ` +
          `update TRAINING_PATCHES rather than letting this create a stray doc.`,
      );
    }
    const before = snap.data() ?? {};
    console.log(
      `  ${t.id}  (${t.describe})` +
        (t.endTime && t.endTime !== before.endTime
          ? `\n      endTime: ${before.endTime} → ${t.endTime}`
          : "") +
        `\n      notes: ${before.notes ?? "(none)"} → "${t.notes}"`,
    );
    if (!APPLY) continue;
    await ref.update({
      ...(t.endTime ? { endTime: t.endTime } : {}),
      notes: t.notes,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  console.log(`\n${APPLY ? "Writing" : "[dry run] Would write"} events:`);
  for (const e of EVENTS) {
    console.log(
      `  ${e.id}  ${e.type}  ${e.startsAt} → ${e.endsAt}  "${e.title}"`,
    );
    if (!APPLY) continue;
    await adminDb.doc(`events/${e.id}`).set(
      {
        canonicalEventId: e.id,
        clubId: club.id,
        title: e.title,
        description: e.description,
        type: e.type,
        allDay: false,
        startsAt: Timestamp.fromDate(new Date(e.startsAt)),
        endsAt: Timestamp.fromDate(new Date(e.endsAt)),
        locationText: club.locationText,
        lat: club.lat,
        lng: club.lng,
        url: null,
        ticketUrl: null,
        origin: "submission",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        // Hand-curated: aggregate.ts skips locked docs.
        locked: true,
        sources: [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  console.log(
    APPLY
      ? `\nDone. ${TRAINING_PATCHES.length} training doc(s) patched, ${EVENTS.length} event(s) written.`
      : `\nDRY RUN — nothing written. Re-run with --apply to commit.`,
  );
}

main().catch((err) => {
  console.error("Failed to seed Hikari schedule:", err);
  process.exit(1);
});
