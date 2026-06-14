/**
 * Idempotent Firestore seed for visiting (touring) coaches.
 *
 * Run with: `npm run seed:visiting-coaches` (tsx --env-file=.env.local
 * scripts/seed-visiting-coaches.ts).
 *
 * Submissions are free-text (see lib/submitSchema.ts); a maintainer turns an
 * approved "coach" submission into a structured entry in
 * data/visiting_coaches.seed.json and runs this script to publish it. Each
 * entry upserts one doc into `visiting_coaches`:
 *   - id        -> visiting_coaches/{id}
 *   - city      -> geocoded to lat/lng via lib/geocode.ts (Nominatim) if omitted
 *   - locked    -> true   (curated by hand)
 *
 * Ids are taken verbatim from the seed file so re-running overwrites rather
 * than duplicates.
 *
 * NOTE ON `server-only`: see scripts/seed.ts — we re-exec once with
 * `--conditions=react-server` so the firebaseAdmin import resolves.
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

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TZ = "Europe/Amsterdam";

// ---- Seed-file shape (input) ----

interface SeedCoach {
  id: string;
  name: string;
  role?: string | null;
  bio?: string | null;
  city: string;
  region?: string | null;
  startDate: string; // "YYYY-MM-DD" (arrival)
  endDate?: string | null; // "YYYY-MM-DD" (departure), or omitted for open-ended
  lat?: number | null;
  lng?: number | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "..", "data");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { geocode } = await import("../lib/geocode");
  const { fromZonedTime } = await import("date-fns-tz");
  const { FieldValue, Timestamp } = await import("firebase-admin/firestore");

  try {
    await adminDb.collection("visiting_coaches").limit(1).get();
  } catch (err) {
    console.error(
      "\nFailed to reach Firestore with the Admin SDK. Make sure credentials are set\n" +
        "(FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in .env.local).\n",
    );
    throw err;
  }

  const dayTs = (date: string, edge: "start" | "end") => {
    const wall = edge === "start" ? `${date}T00:00:00` : `${date}T23:59:59`;
    return Timestamp.fromDate(fromZonedTime(wall, TZ));
  };
  const nz = (v: string | null | undefined) =>
    v && v.trim() ? v.trim() : null;

  const coaches = readJson<SeedCoach[]>("visiting_coaches.seed.json");

  let docsWritten = 0;
  let geocoded = 0;

  for (const c of coaches) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.startDate)) {
      console.warn(
        `[seed-visiting-coaches] skipping "${c.name}" — bad startDate`,
      );
      continue;
    }
    let lat = c.lat ?? null;
    let lng = c.lng ?? null;
    if ((lat == null || lng == null) && c.city) {
      const hit = await geocode(`${c.city}, Netherlands`);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
        geocoded += 1;
      }
    }

    await adminDb
      .collection("visiting_coaches")
      .doc(c.id)
      .set(
        {
          name: c.name,
          role: nz(c.role),
          bio: nz(c.bio),
          city: c.city,
          region: c.region ?? null,
          lat,
          lng,
          startsAt: dayTs(c.startDate, "start"),
          endsAt:
            c.endDate && /^\d{4}-\d{2}-\d{2}$/.test(c.endDate)
              ? dayTs(c.endDate, "end")
              : null,
          instagramUrl: nz(c.instagramUrl),
          tiktokUrl: nz(c.tiktokUrl),
          facebookUrl: nz(c.facebookUrl),
          websiteUrl: nz(c.websiteUrl),
          contactEmail: nz(c.contactEmail),
          phone: nz(c.phone),
          origin: "submission",
          status: "published",
          locked: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    docsWritten += 1;
  }

  console.log(
    `\n[seed-visiting-coaches] done: coaches=${coaches.length} docs=${docsWritten} geocoded=${geocoded}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
