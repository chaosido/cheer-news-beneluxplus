/**
 * Ravens de-duplication and Inferno schedule correction (31 Aug 2026).
 *
 * RAVENS: `og-0/og-1` and `tr-0/tr-1` describe the same Tuesday and Saturday
 * slots. The `og` pair is kept because Ravens' own site calls these sessions
 * "all-level open practice" and "open gym", and that pair carries the real
 * €7,50 drop-in price — they are public drop-ins, not closed team trainings.
 * The `tr` pair is hidden. `tr-2` (Crows, Thursday) is a genuinely separate
 * session and is untouched.
 *
 * INFERNO: our stored times matched nothing the club publishes. Replaced with
 * the homepage schedule, which lists all three teams and both weekly slots.
 * NOTE: their /over page disagrees, giving Flare 20:30–21:30 rather than
 * 20:30–22:30. The homepage is used as the fuller and more internally
 * consistent source; the discrepancy is recorded in the notes field so the next
 * person does not silently "fix" it back.
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

const DAALHOF = "Sporthal Daalhof, Veldwezeltstraat, Maastricht";
const FLARE_NOTE =
  "Let op: de website van de club noemt op de homepage 20:30–22:30 en op de pagina 'Over ons' 20:30–21:30. Hier is de homepage aangehouden.";

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const tag = APPLY ? "" : "[dry run] ";

  // ---- Ravens: hide the duplicated training pair, enrich the open gyms ----
  console.log(`${tag}Ravens — hide duplicate trainings, keep the open gyms:`);
  for (const id of [
    "ravens-cheerleading-utrecht-tr-0",
    "ravens-cheerleading-utrecht-tr-1",
  ]) {
    const ref = adminDb.doc(`open_gyms/${id}`);
    const s = await ref.get();
    if (!s.exists) {
      console.log(`   ${id} — not found`);
      continue;
    }
    console.log(
      `   ${id}  ${s.data()!.startTime}-${s.data()!.endTime}  -> status rejected (duplicate of the og slot)`,
    );
    if (APPLY)
      await ref.update({
        status: "rejected",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }
  // Venues come from the club's own join-us page; it warns they can change.
  const RAVENS_VENUES: Record<string, string> = {
    "ravens-cheerleading-utrecht-og-0": "Schoolplein 6, 3581 PP Utrecht",
    "ravens-cheerleading-utrecht-og-1": "Cremerstraat 253, 3532 BS Utrecht",
  };
  for (const [id, loc] of Object.entries(RAVENS_VENUES)) {
    const ref = adminDb.doc(`open_gyms/${id}`);
    if (!(await ref.get()).exists) {
      console.log(`   ${id} — not found`);
      continue;
    }
    console.log(`   ${id}  locationText -> ${loc}`);
    if (APPLY)
      await ref.update({
        locationText: loc,
        notes: "Locatie kan wijzigen; controleer de website van de club.",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  // ---- Inferno: replace with the club's published schedule ----
  console.log(`\n${tag}Inferno — adopt the club's published times:`);
  const INFERNO = [
    {
      id: "inferno-athletics-tr-0",
      team: "Flame",
      byday: "MO",
      start: "19:00",
      end: "20:30",
      note: null as string | null,
    },
    {
      id: "inferno-athletics-tr-1",
      team: "Flame",
      byday: "SA",
      start: "10:00",
      end: "12:00",
      note: null,
    },
    {
      id: "inferno-athletics-tr-2",
      team: "Sparks",
      byday: "SA",
      start: "12:00",
      end: "13:00",
      note: null,
    },
    {
      id: "inferno-athletics-tr-3",
      team: "Flare",
      byday: "MO",
      start: "20:30",
      end: "22:30",
      note: FLARE_NOTE,
    },
  ];
  for (const t of INFERNO) {
    const ref = adminDb.doc(`open_gyms/${t.id}`);
    const prev = (await ref.get()).data();
    console.log(
      `   ${t.id}  ${prev ? `${prev.startTime}-${prev.endTime} (${prev.teamLabel ?? "-"})` : "(new)"} -> ${t.byday} ${t.start}-${t.end} (${t.team})`,
    );
    if (!APPLY) continue;
    await ref.set(
      {
        clubId: "inferno-athletics",
        dedupKey: t.id,
        sessionType: "training",
        teamLabel: t.team,
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${t.byday}`,
        exdates: [],
        startTime: t.start,
        endTime: t.end,
        tz: "Europe/Amsterdam",
        locationText: DAALHOF,
        lat: prev?.lat ?? 50.8514,
        lng: prev?.lng ?? 5.691,
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

  console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written.");
}
main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
