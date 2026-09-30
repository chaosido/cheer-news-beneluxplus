/**
 * Season 2026–27 refresh sweep (30 Sep 2026): teams, levels and training times
 * for every active club.
 *
 * The change set lives in data/refresh-sweep-2026-09.json. Every op carries the
 * source URL and quoted evidence the research pass found; nothing without a
 * source is in there. Research was per-club against the clubs' own sites first,
 * then socials, then federation lists.
 *
 * DELIBERATELY NOT WRITTEN:
 *   - HICheer teams. Division and level are still unpublished, and Team.division
 *     is required — same reasoning as seed-hicheer.ts. Its four slots were
 *     re-confirmed and keep their teamLabels.
 *   - Groningen Giants slot times. Their 20:00–22:00 looks copied from the
 *     football section, but no source gives the real cheer times. Left as is.
 *   - Djalita's alternate-Sunday group stunt / pom doubles. "Om de week" needs
 *     an INTERVAL=2 anchor date the site doesn't give; weekly would be wrong.
 *   - Hikari tiers. Nova and Nebula are renamed but stay `competition`
 *     (maintainer call, despite the site's "development team" wording).
 *   - E.C.V. Cheer Together stays a listed club; only its slots are hidden
 *     while trainings are suspended pending a new board.
 *
 * AFTER APPLY: 10 of the 11 team adds were set `inactive` straight away, since
 * their division was guessed rather than published (same rule as HICheer):
 * Inclusive's Green/Hunter/Jade/Lime/Meadow/Peachhearts, Inferno's Sparks and
 * Flare, Invicta's Inferno, Partisans' Veteranen. Only UCC Pom stays live.
 * Their training slots still show the team via teamLabel.
 *
 * Ravens' tr-0/tr-1 were hidden as duplicates of the Crows open practice; the
 * site now gives the L4 team its own times, so they are republished.
 *
 * Nothing is deleted: dropped teams go `status: "inactive"`, dropped slots go
 * `status: "rejected"`, matching the keep-the-data convention.
 *
 *   npx tsx scripts/refresh-sweep-2026-09.ts            # dry run
 *   npx tsx scripts/refresh-sweep-2026-09.ts --apply
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

interface Op {
  clubId: string;
  action: "update" | "add" | "deactivate" | "hide";
  confidence: "high" | "medium";
  source: string;
  evidence: string;
  fields: Record<string, unknown>;
}
interface TeamOp extends Op {
  docId: string | null;
}
interface SessionOp extends Op {
  id: string | null;
}
const DATA: {
  teams: TeamOp[];
  sessions: SessionOp[];
  verifiedClubs: string[];
} = JSON.parse(
  readFileSync(
    new URL("./data/refresh-sweep-2026-09.json", import.meta.url),
    "utf8",
  ),
);

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** `byday` is our op shorthand; the stored shape is a weekly RRULE. */
function sessionFields(f: Record<string, unknown>) {
  const { byday, ...rest } = f;
  return byday ? { ...rest, rrule: `FREQ=WEEKLY;BYDAY=${byday}` } : rest;
}

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const tag = APPLY ? "" : "[dry run] ";
  const now = FieldValue.serverTimestamp();

  console.log(`${tag}TEAMS`);
  for (const op of DATA.teams) {
    const col = adminDb.collection(`clubs/${op.clubId}/teams`);
    if (op.action === "add") {
      const id = slug(String(op.fields.name));
      const ref = col.doc(id);
      if ((await ref.get()).exists) {
        console.log(`   SKIP add ${op.clubId}/${id} — doc exists`);
        continue;
      }
      console.log(`   + ${op.clubId}/${id}  ${JSON.stringify(op.fields)}`);
      if (APPLY) await ref.set(op.fields);
      continue;
    }
    const ref = col.doc(op.docId!);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`   SKIP ${op.action} ${op.clubId}/${op.docId} — not found`);
      continue;
    }
    const patch =
      op.action === "deactivate" ? { status: "inactive" } : op.fields;
    const cur = snap.data()!;
    const diff = Object.entries(patch)
      .filter(([k, v]) => cur[k] !== v)
      .map(
        ([k, v]) => `${k}: ${JSON.stringify(cur[k])} -> ${JSON.stringify(v)}`,
      );
    if (!diff.length) continue;
    console.log(`   ~ ${op.clubId}/${cur.name}  ${diff.join(", ")}`);
    if (APPLY) await ref.update(patch);
  }

  console.log(`\n${tag}SESSIONS`);
  const clubGeo = new Map<string, { lat: number | null; lng: number | null }>();
  const taken = new Set<string>(); // so a dry run numbers several adds correctly
  for (const op of DATA.sessions) {
    if (op.action === "add") {
      if (!clubGeo.has(op.clubId)) {
        const c = (await adminDb.doc(`clubs/${op.clubId}`).get()).data()!;
        clubGeo.set(op.clubId, { lat: c.lat ?? null, lng: c.lng ?? null });
      }
      // Next free tr-N; ids are never reused, even for hidden slots.
      let n = 0;
      while (
        taken.has(`${op.clubId}-tr-${n}`) ||
        (await adminDb.doc(`open_gyms/${op.clubId}-tr-${n}`).get()).exists
      )
        n++;
      const id = `${op.clubId}-tr-${n}`;
      taken.add(id);
      const f = sessionFields(op.fields);
      console.log(
        `   + ${id}  ${f.rrule} ${f.startTime}-${f.endTime}  ${f.teamLabel}`,
      );
      if (APPLY)
        await adminDb.doc(`open_gyms/${id}`).set({
          clubId: op.clubId,
          dedupKey: id,
          sessionType: "training",
          exdates: [],
          tz: "Europe/Amsterdam",
          notes: null,
          ...clubGeo.get(op.clubId),
          ...f,
          origin: "submission",
          confidence: 1,
          extractorVersion: 1,
          status: "published",
          locked: true,
          validFrom: null,
          validUntil: null,
          updatedAt: now,
        });
      continue;
    }
    const ref = adminDb.doc(`open_gyms/${op.id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`   SKIP ${op.action} ${op.id} — not found`);
      continue;
    }
    const patch =
      op.action === "hide" ? { status: "rejected" } : sessionFields(op.fields);
    const cur = snap.data()!;
    const diff = Object.entries(patch)
      .filter(([k, v]) => cur[k] !== v)
      .map(
        ([k, v]) => `${k}: ${JSON.stringify(cur[k])} -> ${JSON.stringify(v)}`,
      );
    if (!diff.length) continue;
    console.log(`   ~ ${op.id}  ${diff.join(", ")}`);
    if (APPLY) await ref.update({ ...patch, locked: true, updatedAt: now });
  }

  console.log(
    `\n${tag}lastVerifiedAt -> now on ${DATA.verifiedClubs.length} clubs`,
  );
  if (APPLY)
    for (const id of DATA.verifiedClubs)
      await adminDb.doc(`clubs/${id}`).update({ lastVerifiedAt: now });

  console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written.");
}
main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
