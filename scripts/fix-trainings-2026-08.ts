/**
 * Training corrections from the 31 Aug 2026 sweep.
 *
 * The sweep's headline finding was that MOST clubs already had training docs —
 * so writing everything the research turned up would have duplicated them, the
 * same trap the CSN import fell into. This script therefore only:
 *   1. removes duplicates (including three I created earlier today),
 *   2. adds the one club that genuinely had nothing,
 *   3. corrects times contradicted by the clubs' own published sources.
 */
import { spawnSync } from "node:child_process";
const C = "--conditions=react-server";
if (!process.execArgv.includes(C)) {
  process.exit(
    spawnSync(
      process.argv[0],
      [...process.execArgv, C, ...process.argv.slice(1)],
      { stdio: "inherit" },
    ).status ?? 1,
  );
}
const APPLY = process.argv.includes("--apply");

/**
 * My own duplicates. E.S.T.C. Twist already had `e-s-t-c-twist-og-0`, a
 * FREQ=MONTHLY;BYDAY=1WE open gym at exactly these times — I added three dated
 * events for the same sessions before checking. The existing doc wins.
 */
const MY_DUPLICATE_EVENTS = [
  "estc-twist-2026-09-02-open-training",
  "estc-twist-2026-10-07-open-training",
  "estc-twist-2026-11-04-open-training",
];

/**
 * Djalita carries two parallel sets for the same seven sessions: a legacy
 * `og-*` set with no teamLabel that hides the team name inside locationText,
 * and a newer `tr-*` set with proper labels and real street addresses. Both are
 * sessionType=training, so the club page lists every slot twice. The legacy set
 * is hidden rather than deleted, per the project's keep-the-data convention.
 */
const DJALITA_LEGACY = [1, 2, 3, 4, 5, 6, 7].map(
  (n) => `djalita-cheerleaders-og-${n}`,
);

/** Dutch Lions had NO training docs at all. Venue and prices from their site. */
const TONIDO =
  "Gymnastiek- en Turnvereniging TONIDO, Bezaanjachtplein 245, 1034 CR Amsterdam";
const DUTCH_LIONS = [
  {
    id: "dutch-lions-cheerleading-tr-0",
    team: "Lion Cubs (7–11 jaar)",
    byday: "SU",
    start: "09:30",
    end: "11:30",
    note: "Contributie €400 voor het hele seizoen, inclusief trainingsoutfit.",
  },
  {
    id: "dutch-lions-cheerleading-tr-1",
    team: "Lion Hearts Junioren (12–15 jaar)",
    byday: "SU",
    start: "14:00",
    end: "16:00",
    note: "Contributie €400 voor het hele seizoen, inclusief trainingsoutfit.",
  },
  {
    id: "dutch-lions-cheerleading-tr-2",
    team: "Wedstrijdteam Senioren (16+)",
    byday: "SU",
    start: "11:00",
    end: "14:00",
    note: "Contributie €500 voor het hele seizoen, inclusief trainingsoutfit. Traint ook op donderdagavond.",
  },
  {
    id: "dutch-lions-cheerleading-tr-3",
    team: "Wedstrijdteam Senioren (16+)",
    byday: "TH",
    start: "19:45",
    end: "21:30",
    note: "Contributie €500 voor het hele seizoen, inclusief trainingsoutfit. Traint ook op zondag.",
  },
];

/** Invicta had only the Tuesday slot; their site lists three. */
const TILBURG_USC = "Tilburg University Sports Center, Tilburg";
const INVICTA_NEW = [
  {
    id: "invicta-tilburg-cheer-tr-1",
    team: "Beginners",
    byday: "TH",
    start: "19:00",
    end: "21:00",
  },
  {
    id: "invicta-tilburg-cheer-tr-2",
    team: "Wedstrijdteam",
    byday: "SA",
    start: "10:00",
    end: "12:00",
  },
];

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const tag = APPLY ? "" : "[dry run] ";

  console.log(
    `${tag}1. delete my own duplicate events (e-s-t-c-twist-og-0 already covers these):`,
  );
  for (const id of MY_DUPLICATE_EVENTS) {
    const ref = adminDb.doc(`events/${id}`);
    if (!(await ref.get()).exists) {
      console.log(`   ${id} — already gone`);
      continue;
    }
    console.log(`   ${id}`);
    if (APPLY) await ref.delete();
  }

  console.log(
    `\n${tag}2. hide Djalita's legacy duplicate set (7 slots listed twice):`,
  );
  for (const id of DJALITA_LEGACY) {
    const ref = adminDb.doc(`open_gyms/${id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`   ${id} — not found`);
      continue;
    }
    console.log(
      `   ${id}  ${snap.data()!.startTime}-${snap.data()!.endTime}  -> status rejected`,
    );
    if (APPLY)
      await ref.update({
        status: "rejected",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  console.log(`\n${tag}3. add Dutch Lions trainings (club had none):`);
  for (const t of DUTCH_LIONS) {
    console.log(`   ${t.id}  ${t.byday} ${t.start}-${t.end}  ${t.team}`);
    if (!APPLY) continue;
    await adminDb.doc(`open_gyms/${t.id}`).set(
      {
        clubId: "dutch-lions-cheerleading",
        dedupKey: t.id,
        sessionType: "training",
        teamLabel: t.team,
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${t.byday}`,
        exdates: [],
        startTime: t.start,
        endTime: t.end,
        tz: "Europe/Amsterdam",
        locationText: TONIDO,
        lat: 52.4022,
        lng: 4.9127,
        notes: t.note,
        origin: "submission",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        locked: true,
        validFrom: null,
        validUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  console.log(
    `\n${tag}4. add Invicta's missing slots + label the existing one:`,
  );
  for (const t of INVICTA_NEW) {
    console.log(`   ${t.id}  ${t.byday} ${t.start}-${t.end}  ${t.team}`);
    if (!APPLY) continue;
    await adminDb.doc(`open_gyms/${t.id}`).set(
      {
        clubId: "invicta-tilburg-cheer",
        dedupKey: t.id,
        sessionType: "training",
        teamLabel: t.team,
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${t.byday}`,
        exdates: [],
        startTime: t.start,
        endTime: t.end,
        tz: "Europe/Amsterdam",
        locationText: TILBURG_USC,
        lat: 51.5555,
        lng: 5.0913,
        notes: null,
        origin: "submission",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        locked: true,
        validFrom: null,
        validUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  const inv0 = adminDb.doc("open_gyms/invicta-tilburg-cheer-tr-0");
  if ((await inv0.get()).exists) {
    console.log(
      `   invicta-tilburg-cheer-tr-0  teamLabel "all" -> "Intermediate"`,
    );
    if (APPLY)
      await inv0.update({
        teamLabel: "Intermediate",
        locationText: TILBURG_USC,
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  // Everest publish 19:00–21:00 on their /classes/ page AND in their Instagram
  // bio; our doc says 20:00. Two independent sources beat one stored value.
  console.log(`\n${tag}5. correct Everest's Wednesday time:`);
  const ev0 = adminDb.doc("open_gyms/everest-cheerleading-academy-tr-0");
  const ev0s = await ev0.get();
  if (ev0s.exists) {
    console.log(
      `   everest...-tr-0  ${ev0s.data()!.startTime}-${ev0s.data()!.endTime} -> 19:00-21:00  (site + Instagram both say 19:00)`,
    );
    if (APPLY)
      await ev0.update({
        startTime: "19:00",
        endTime: "21:00",
        teamLabel: "Beginners & Intermediate",
        locationText: "Sportcentrum Olympos, Uppsalalaan 3, 3584 CT Utrecht",
        notes: "Vanaf €27,50 per maand.",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }
  const ev1 = adminDb.doc("open_gyms/everest-cheerleading-academy-tr-1");
  if ((await ev1.get()).exists) {
    console.log(
      `   everest...-tr-1  label + venue + price added (times already correct)`,
    );
    if (APPLY)
      await ev1.update({
        teamLabel: "Advanced & Tumbling",
        locationText: "Sportcentrum Olympos, Uppsalalaan 3, 3584 CT Utrecht",
        notes: "Vanaf €27,50 per maand.",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written.");
}
main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
