/**
 * One-off migration: split the overloaded team `level` enum into the two-axis
 * model (see lib/types.ts).
 *
 * Run with: `npm run migrate:team-levels` (tsx --env-file=.env.local)
 *   --dry-run   print the planned changes but write NOTHING.
 *
 * Per team, the old `level` string is remapped:
 *   "1".."6"      -> discipline cheer, level same,   tier competition
 *   "elite"       -> discipline cheer, level "5",    tier competition
 *   "prep"        -> discipline cheer, level null,   tier prep
 *   "recreational"-> discipline cheer, level null,   tier recreational
 * `discipline` defaults to "cheer" and `danceStyle` to null for every team in
 * this pass — reclassifying genuine pom/dance teams to performance_cheer is a
 * separate, judgment-based follow-up.
 *
 * Both storage sites are updated: the authoritative `clubs/{id}/teams/*`
 * subcollection AND the denormalized `teamsSummary` array on each club doc
 * (recomputed from the migrated teams via the same `teamsToSummary` the read
 * path uses). Idempotent: a team that already carries `discipline` is left as-is.
 *
 * The re-exec guard below resolves the `server-only` marker under tsx (mirrors
 * scripts/aggregate.ts).
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

import type { CheerLevel, Discipline, Tier } from "../lib/types";

const DRY_RUN = process.argv.includes("--dry-run");

interface MigratedClassification {
  discipline: Discipline;
  level: CheerLevel | null;
  danceStyle: null;
  tier: Tier;
}

/** Map a legacy `level` value to the new two-axis fields. */
function migrateLevel(old: unknown): MigratedClassification | null {
  switch (old) {
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
      return {
        discipline: "cheer",
        level: old,
        danceStyle: null,
        tier: "competition",
      };
    case "elite":
      return {
        discipline: "cheer",
        level: "5",
        danceStyle: null,
        tier: "competition",
      };
    case "prep":
      return {
        discipline: "cheer",
        level: null,
        danceStyle: null,
        tier: "prep",
      };
    case "recreational":
      return {
        discipline: "cheer",
        level: null,
        danceStyle: null,
        tier: "recreational",
      };
    default:
      return null; // unknown / unexpected value — leave untouched, warn
  }
}

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { teamsToSummary } = await import("../lib/queries");
  const { FieldValue } = await import("firebase-admin/firestore");

  const stats = {
    clubs: 0,
    teamsMigrated: 0,
    teamsAlreadyMigrated: 0,
    teamsUnknown: 0,
    summariesRewritten: 0,
  };

  const clubsSnap = await adminDb.collection("clubs").get();
  for (const clubDoc of clubsSnap.docs) {
    stats.clubs++;
    const teamsSnap = await clubDoc.ref.collection("teams").get();

    // Build the post-migration team objects (used both to write each team doc
    // and to recompute the club's denormalized teamsSummary).
    const migratedTeams = [];
    for (const teamDoc of teamsSnap.docs) {
      const data = teamDoc.data();
      const migratedTeam = {
        id: teamDoc.id,
        name: typeof data.name === "string" ? data.name : "",
        division: data.division,
        ageGroup: data.ageGroup,
        status: data.status === "inactive" ? "inactive" : "active",
        // carried below from existing or migrated classification
        discipline: "cheer" as Discipline,
        level: null as CheerLevel | null,
        danceStyle: null as null,
        tier: "competition" as Tier,
      };

      if (typeof data.discipline === "string") {
        // Already migrated — preserve its current classification, just include
        // it in the recomputed summary.
        stats.teamsAlreadyMigrated++;
        migratedTeam.discipline = data.discipline as Discipline;
        migratedTeam.level = (data.level ?? null) as CheerLevel | null;
        migratedTeam.danceStyle = (data.danceStyle ?? null) as null;
        migratedTeam.tier = (data.tier ?? "competition") as Tier;
        migratedTeams.push(migratedTeam);
        continue;
      }

      const next = migrateLevel(data.level);
      if (!next) {
        stats.teamsUnknown++;
        console.warn(
          `  ! ${clubDoc.id}/${teamDoc.id} (${migratedTeam.name}): unexpected level=${JSON.stringify(data.level)} — left untouched`,
        );
        // Still include in summary with safe defaults so the array stays valid.
        migratedTeams.push(migratedTeam);
        continue;
      }

      Object.assign(migratedTeam, next);
      migratedTeams.push(migratedTeam);
      stats.teamsMigrated++;
      console.log(
        `  ~ ${clubDoc.id}/${teamDoc.id} (${migratedTeam.name}): level ${JSON.stringify(data.level)} -> discipline=${next.discipline} level=${JSON.stringify(next.level)} tier=${next.tier}`,
      );

      if (!DRY_RUN) {
        await teamDoc.ref.update({
          discipline: next.discipline,
          level: next.level,
          danceStyle: next.danceStyle,
          tier: next.tier,
        });
      }
    }

    // Recompute the denormalized summary from the migrated teams (same helper
    // the read path uses), so the stored copy stays valid against the new types.
    const summary = teamsToSummary(migratedTeams as never);
    stats.summariesRewritten++;
    if (!DRY_RUN) {
      await clubDoc.ref.update({
        teamsSummary: summary,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  console.log(
    `\n${DRY_RUN ? "[DRY RUN] " : ""}Done. clubs=${stats.clubs} migrated=${stats.teamsMigrated} alreadyMigrated=${stats.teamsAlreadyMigrated} unknown=${stats.teamsUnknown} summariesRewritten=${stats.summariesRewritten}`,
  );
  if (DRY_RUN)
    console.log("No writes performed. Re-run without --dry-run to apply.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
