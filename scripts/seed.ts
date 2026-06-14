/**
 * Idempotent Firestore seed script for Cheer News BeneluxPlus.
 *
 * Run with: `npm run seed` (tsx --env-file=.env.local scripts/seed.ts).
 *
 * Reads data/clubs.seed.json and data/federations.seed.json and upserts:
 *   - one club doc per club        -> clubs/{slugify(name)}
 *   - one team doc per team        -> clubs/{clubSlug}/teams/{teamId}
 *   - one source doc per club src  -> sources/{clubSlug}-{type}
 *   - one source doc per federation-> sources/fed-{slugify(name)}
 *
 * All writes are deterministic (id derived from name/type) so re-running the
 * script overwrites rather than duplicates.
 *
 * NOTE ON `server-only`: ../lib/firebaseAdmin imports the `server-only` marker
 * package, whose default export throws outside a React Server environment.
 * Under plain Node/tsx that would crash the import. We re-exec the process once
 * with `--conditions=react-server` so the package resolves to its no-op
 * variant; only then do we dynamically import the admin SDK wrapper.
 */
import { spawnSync } from "node:child_process";

const REACT_SERVER_CONDITION = "--conditions=react-server";

// Re-exec guard. Must run before anything imports `../lib/firebaseAdmin`.
// We keep tsx's loader flags (process.execArgv) and the --env-file flag so the
// child process behaves identically, just with the extra resolution condition.
if (!process.execArgv.includes(REACT_SERVER_CONDITION)) {
  const result = spawnSync(
    process.argv[0],
    [...process.execArgv, REACT_SERVER_CONDITION, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AgeGroup,
  Division,
  FetchStrategy,
  Level,
  PrimaryChannel,
  SourceTier,
  SourceType,
  TeamSummary,
} from "../lib/types";

// ---- Seed-file shapes (input) ----

interface SeedTeam {
  name: string;
  level: Level;
  division: Division;
  ageGroup: AgeGroup;
}

interface SeedSource {
  url: string;
  type: SourceType;
  sourceTier: SourceTier;
  fetchStrategy: FetchStrategy;
}

interface SeedClub {
  name: string;
  city: string;
  country: string;
  region: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  logoUrl: string | null;
  blurb: string | null;
  foundedYear: number | null;
  lat: number | null;
  lng: number | null;
  primaryChannel: PrimaryChannel;
  clubType: "club" | "student" | "school" | "select_team";
  teams: SeedTeam[];
  sources: SeedSource[];
}

interface SeedFederation {
  name: string;
  url: string;
  type: SourceType;
  sourceTier: SourceTier;
  fetchStrategy: FetchStrategy;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "..", "data");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { slugify } = await import("../lib/utils");
  const { FieldValue } = await import("firebase-admin/firestore");

  // Guard: surface a clear message if the Admin SDK has no usable credentials.
  // The lazy SDK only contacts the backend on the first commit, so we probe here.
  try {
    await adminDb.collection("clubs").limit(1).get();
  } catch (err) {
    console.error(
      "\nFailed to reach Firestore with the Admin SDK. Make sure credentials are set\n" +
        "(FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in .env.local).\n",
    );
    throw err;
  }

  const clubs = readJson<SeedClub[]>("clubs.seed.json");
  const federations = readJson<SeedFederation[]>("federations.seed.json");

  // Firestore batches cap at 500 writes; chunk to stay well under the limit.
  const batch = adminDb.batch();
  let opCount = 0;
  const BATCH_LIMIT = 400;
  const batches: FirebaseFirestore.WriteBatch[] = [batch];
  let current = batch;

  function nextOp(): FirebaseFirestore.WriteBatch {
    if (opCount >= BATCH_LIMIT) {
      current = adminDb.batch();
      batches.push(current);
      opCount = 0;
    }
    opCount += 1;
    return current;
  }

  let clubCount = 0;
  let teamCount = 0;
  let sourceCount = 0;

  for (const club of clubs) {
    const clubSlug = slugify(club.name);
    const clubRef = adminDb.collection("clubs").doc(clubSlug);

    const teamsSummary: TeamSummary[] = club.teams.map((t) => ({
      level: t.level,
      division: t.division,
      ageGroup: t.ageGroup,
    }));

    nextOp().set(clubRef, {
      name: club.name,
      slug: clubSlug,
      websiteUrl: club.websiteUrl,
      city: club.city,
      address: null,
      country: club.country,
      region: club.region,
      lat: club.lat,
      lng: club.lng,
      instagramUrl: club.instagramUrl,
      tiktokUrl: club.tiktokUrl,
      facebookUrl: club.facebookUrl,
      logoUrl: club.logoUrl,
      blurb: club.blurb,
      foundedYear: club.foundedYear,
      primaryChannel: club.primaryChannel,
      clubType: club.clubType,
      status: "active",
      locked: false,
      teamsSummary,
      lastVerifiedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    clubCount += 1;

    club.teams.forEach((team, idx) => {
      const teamId = slugify(team.name) || String(idx);
      const teamRef = clubRef.collection("teams").doc(teamId);
      nextOp().set(teamRef, {
        name: team.name,
        level: team.level,
        division: team.division,
        ageGroup: team.ageGroup,
        status: "active",
      });
      teamCount += 1;
    });

    for (const source of club.sources) {
      const sourceId = `${clubSlug}-${source.type}`;
      const sourceRef = adminDb.collection("sources").doc(sourceId);
      nextOp().set(sourceRef, {
        clubId: clubSlug,
        url: source.url,
        type: source.type,
        sourceTier: source.sourceTier,
        fetchStrategy: source.fetchStrategy,
        hashSelector: null,
        contentHash: null,
        lastFetchedAt: null,
        lastStatus: null,
        consecutiveMisses: 0,
      });
      sourceCount += 1;
    }
  }

  for (const fed of federations) {
    const sourceId = `fed-${slugify(fed.name)}`;
    const sourceRef = adminDb.collection("sources").doc(sourceId);
    nextOp().set(sourceRef, {
      clubId: null,
      url: fed.url,
      type: fed.type,
      sourceTier: fed.sourceTier,
      fetchStrategy: fed.fetchStrategy,
      hashSelector: null,
      contentHash: null,
      lastFetchedAt: null,
      lastStatus: null,
      consecutiveMisses: 0,
    });
    sourceCount += 1;
  }

  for (const b of batches) {
    await b.commit();
  }

  console.log("Seed complete:");
  console.log(`  clubs written:       ${clubCount}`);
  console.log(`  teams written:       ${teamCount}`);
  console.log(
    `  sources written:     ${sourceCount} (incl. ${federations.length} federations)`,
  );
  console.log(`  batches committed:   ${batches.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
