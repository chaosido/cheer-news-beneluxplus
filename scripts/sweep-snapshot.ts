/**
 * Snapshot every club with its teams subcollection and its open_gyms slots.
 * First step of a club sweep (see .claude/skills/club-sweep): the output is both
 * the research input and the rollback record.
 *
 *   npx tsx --env-file=.env.local scripts/sweep-snapshot.ts tmp/sweep/snapshot-before.json
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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

const iso = (v: unknown) =>
  (v as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() ?? null;

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("usage: sweep-snapshot.ts <out.json>");
  const { adminDb } = await import("../lib/firebaseAdmin");
  const clubs = await adminDb.collection("clubs").get();
  const rows = [];
  for (const c of clubs.docs) {
    const d = c.data();
    const teams = await c.ref.collection("teams").get();
    const slots = await adminDb
      .collection("open_gyms")
      .where("clubId", "==", c.id)
      .get();
    rows.push({
      id: c.id,
      name: d.name,
      status: d.status,
      city: d.city,
      country: d.country,
      websiteUrl: d.websiteUrl,
      instagramUrl: d.instagramUrl,
      facebookUrl: d.facebookUrl,
      trainingLocation: d.trainingLocation ?? null,
      lastVerifiedAt: iso(d.lastVerifiedAt),
      teams: teams.docs.map((t) => ({ docId: t.id, ...t.data() })),
      sessions: slots.docs.map((s) => {
        const x = s.data();
        return {
          id: s.id,
          sessionType: x.sessionType ?? null,
          teamLabel: x.teamLabel ?? null,
          rrule: x.rrule,
          startTime: x.startTime,
          endTime: x.endTime,
          locationText: x.locationText,
          notes: x.notes,
          status: x.status,
          locked: x.locked,
          origin: x.origin,
          price: x.price ?? null,
          updatedAt: iso(x.updatedAt),
        };
      }),
    });
  }
  writeFileSync(out, JSON.stringify(rows, null, 1));
  const act = rows.filter((c) => c.status === "active");
  const n = (f: (c: (typeof act)[number]) => number) =>
    act.reduce((a, c) => a + f(c), 0);
  console.log(
    `clubs ${rows.length} (active ${act.length}); active teams ${n((c) => c.teams.filter((t) => (t as { status?: string }).status === "active").length)}; published slots ${n((c) => c.sessions.filter((s) => s.status === "published").length)}`,
  );
}
main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
