/**
 * Apply a curated club-sweep change set (see .claude/skills/club-sweep).
 * Dry run by default; the data file is committed next to it as the record.
 *
 *   npx tsx --env-file=.env.local scripts/apply-sweep.ts scripts/data/sweep-YYYY-MM-DD.json
 *   npx tsx --env-file=.env.local scripts/apply-sweep.ts scripts/data/sweep-YYYY-MM-DD.json --apply
 *
 * Data shape: { teams: TeamOp[], sessions: SessionOp[], verifiedClubs: string[] }.
 * Every op carries `source` + `evidence`. Validation runs BEFORE any read or
 * write and refuses the whole file on the first problem, so a bad op can never
 * land halfway through a run.
 *
 * Nothing is deleted: `deactivate` sets a team `inactive`, `hide` sets a slot
 * `rejected`. Session adds get the next free `<clubId>-tr-N` id.
 *
 * NOT idempotent for adds: re-running --apply adds the slots again. Take a
 * fresh snapshot and diff instead of re-running.
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
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));

interface Op {
  clubId: string;
  action: "update" | "add" | "deactivate" | "hide";
  source: string;
  evidence: string;
  fields: Record<string, unknown>;
}
interface TeamOp extends Op {
  docId: string | null;
  /** Adds only: a source quote for each of SOURCED_ON_ADD. No quote, no add. */
  sourced?: Record<string, string>;
}
interface SessionOp extends Op {
  id: string | null;
}
interface Data {
  teams: TeamOp[];
  sessions: SessionOp[];
  verifiedClubs: string[];
}

const ENUMS: Record<string, readonly unknown[]> = {
  discipline: ["cheer", "performance_cheer"],
  level: ["1", "2", "3", "4", "5", "6", "7", null],
  danceStyle: [
    "pom",
    "hip_hop",
    "jazz",
    "kick",
    "pom_doubles",
    "hip_hop_doubles",
    null,
  ],
  tier: ["competition", "prep", "recreational"],
  division: ["all_girl", "coed", "all_boy"],
  ageGroup: ["mini", "youth", "junior", "senior", "open"],
  status: ["active", "inactive"],
};
const TEAM_KEYS = new Set([...Object.keys(ENUMS), "name", "notes"]);
const REQUIRED_ON_ADD = ["name", "discipline", "tier", "division", "ageGroup"];
// The classification fields that get guessed. Each needs its own quote on an add.
const SOURCED_ON_ADD = ["division", "ageGroup", "tier"];
const SESSION_KEYS = new Set([
  "teamLabel",
  "byday",
  "rrule",
  "startTime",
  "endTime",
  "locationText",
  "notes",
  "price",
  "priceNote",
  "status",
  "validFrom",
  "validUntil",
]);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const BYDAY = /^(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$/;
// Words that betray an assumption; a team add carrying one was not sourced.
const GUESS = /not stated|assum|guess|unknown|copied from/i;

function validate(d: Data): string[] {
  const errs: string[] = [];
  d.teams.forEach((op, i) => {
    const at = `teams[${i}] ${op.clubId}`;
    if (!op.source) errs.push(`${at}: no source`);
    if (op.action !== "add" && !op.docId)
      errs.push(`${at}: ${op.action} needs docId`);
    for (const [k, v] of Object.entries(op.fields ?? {})) {
      if (!TEAM_KEYS.has(k)) errs.push(`${at}: unknown field ${k}`);
      if (ENUMS[k] && !ENUMS[k].includes(v))
        errs.push(`${at}: ${k}=${JSON.stringify(v)} not allowed`);
    }
    if (op.action === "add") {
      for (const k of REQUIRED_ON_ADD)
        if (op.fields[k] == null) errs.push(`${at}: add missing required ${k}`);
      for (const k of SOURCED_ON_ADD)
        if (!op.sourced?.[k]?.trim())
          errs.push(
            `${at}: add "${op.fields.name}" has no sourced.${k} quote — record it as a teamLabel instead`,
          );
      if (
        GUESS.test(
          `${op.fields.notes ?? ""} ${op.evidence} ${Object.values(op.sourced ?? {}).join(" ")}`,
        )
      )
        errs.push(
          `${at}: add "${op.fields.name}" looks guessed (notes/evidence) — record it as a teamLabel instead`,
        );
    }
  });
  d.sessions.forEach((op, i) => {
    const at = `sessions[${i}] ${op.id ?? op.clubId}`;
    const f = op.fields ?? {};
    if (!op.source) errs.push(`${at}: no source`);
    if (op.action !== "add" && !op.id)
      errs.push(`${at}: ${op.action} needs id`);
    for (const k of Object.keys(f))
      if (!SESSION_KEYS.has(k)) errs.push(`${at}: unknown field ${k}`);
    for (const k of ["startTime", "endTime"])
      if (f[k] !== undefined && !HHMM.test(String(f[k])))
        errs.push(`${at}: ${k} not HH:mm`);
    if (f.byday !== undefined && !BYDAY.test(String(f.byday)))
      errs.push(`${at}: bad byday`);
    if (
      f.status !== undefined &&
      !["published", "rejected", "pending"].includes(String(f.status))
    )
      errs.push(`${at}: bad status`);
    if (op.action === "add") {
      if (!f.byday && !f.rrule) errs.push(`${at}: add needs byday or rrule`);
      if (!f.startTime || !f.endTime)
        errs.push(`${at}: add needs startTime+endTime`);
      if (String(f.rrule ?? "").includes("INTERVAL") && !f.validFrom)
        errs.push(`${at}: INTERVAL rrule needs validFrom as the anchor date`);
    }
  });
  return errs;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** `byday` is op shorthand; the stored shape is a weekly RRULE. */
function sessionFields(f: Record<string, unknown>) {
  const { byday, ...rest } = f;
  return byday && !rest.rrule
    ? { ...rest, rrule: `FREQ=WEEKLY;BYDAY=${byday}` }
    : rest;
}

function diff(cur: Record<string, unknown>, patch: Record<string, unknown>) {
  return Object.entries(patch)
    .filter(([k, v]) => cur[k] !== v)
    .map(([k, v]) => `${k}: ${JSON.stringify(cur[k])} -> ${JSON.stringify(v)}`);
}

async function main() {
  if (!FILE) throw new Error("usage: apply-sweep.ts <data.json> [--apply]");
  const DATA: Data = JSON.parse(readFileSync(FILE, "utf8"));
  const errs = validate(DATA);
  if (errs.length) {
    console.error(
      `REFUSED — ${errs.length} problem(s):\n  ${errs.join("\n  ")}`,
    );
    process.exit(1);
  }

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
      const doc = {
        danceStyle: null,
        notes: null,
        level: null,
        ...op.fields,
        status: "active",
      };
      console.log(`   + ${op.clubId}/${id}  ${JSON.stringify(doc)}`);
      if (APPLY) await ref.set(doc);
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
    const d = diff(snap.data()!, patch);
    if (!d.length) continue;
    console.log(`   ~ ${op.clubId}/${snap.data()!.name}  ${d.join(", ")}`);
    if (APPLY) await ref.update(patch);
  }

  console.log(`\n${tag}SESSIONS`);
  const clubGeo = new Map<string, { lat: number | null; lng: number | null }>();
  const taken = new Set<string>(); // so a dry run numbers several adds correctly
  for (const op of DATA.sessions) {
    if (op.action === "add") {
      if (!clubGeo.has(op.clubId)) {
        const c = (await adminDb.doc(`clubs/${op.clubId}`).get()).data();
        if (!c) throw new Error(`club ${op.clubId} not found`);
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
          validFrom: null,
          validUntil: null,
          ...clubGeo.get(op.clubId),
          ...f,
          origin: "submission",
          confidence: 1,
          extractorVersion: 1,
          status: "published",
          locked: true,
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
    const d = diff(snap.data()!, patch);
    if (!d.length) continue;
    console.log(`   ~ ${op.id}  ${d.join(", ")}`);
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
