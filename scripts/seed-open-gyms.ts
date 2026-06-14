/**
 * Idempotent Firestore seed script for club-INDEPENDENT open gyms (turn halls
 * with public drop-in sessions that have no parent club).
 *
 * Run with: `npm run seed:open-gyms` (tsx --env-file=.env.local
 * scripts/seed-open-gyms.ts).
 *
 * Reads data/open_gyms.seed.json and upserts one recurring doc per (venue,
 * weekday) into the `open_gyms` collection:
 *   - id        -> open_gyms/venue-{venueId}-{BYDAY}
 *   - clubId    -> null   (these are not owned by a club)
 *   - venueId.. -> self-describing venue fields for map pins + agenda lines
 *   - rrule     -> FREQ=WEEKLY;BYDAY={day}
 *   - locked    -> true   (curated by hand; scrapers must not overwrite them)
 *
 * Coordinates: if the seed entry omits lat/lng, we geocode its address via
 * lib/geocode.ts (Nominatim). A doc with no coordinates still lists in the
 * agenda; it just gets no map pin.
 *
 * All ids are derived from venueId/weekday so re-running overwrites rather than
 * duplicates.
 *
 * NOTE ON `server-only`: see scripts/seed.ts — we re-exec once with
 * `--conditions=react-server` so the firebaseAdmin import resolves.
 */
import { spawnSync } from "node:child_process";

const REACT_SERVER_CONDITION = "--conditions=react-server";

// Re-exec guard. Must run before anything imports `../lib/firebaseAdmin`.
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
import { EXTRACTOR_VERSION } from "../lib/types";

// ---- Seed-file shapes (input) ----

interface SeedSession {
  weekday: string; // english lowercase, e.g. "monday"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

interface SeedVenue {
  venueId: string;
  venueName: string;
  city: string;
  region: string | null;
  address: string | null;
  websiteUrl: string | null;
  lat: number | null;
  lng: number | null;
  tz?: string;
  notes: string | null;
  sessions: SeedSession[];
}

/** English weekday name → iCal BYDAY token. */
const WEEKDAY_TO_BYDAY: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "..", "data");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { geocode } = await import("../lib/geocode");
  const { FieldValue } = await import("firebase-admin/firestore");

  // Guard: surface a clear message if the Admin SDK has no usable credentials.
  try {
    await adminDb.collection("open_gyms").limit(1).get();
  } catch (err) {
    console.error(
      "\nFailed to reach Firestore with the Admin SDK. Make sure credentials are set\n" +
        "(FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in .env.local).\n",
    );
    throw err;
  }

  const venues = readJson<SeedVenue[]>("open_gyms.seed.json");

  let docsWritten = 0;
  let geocoded = 0;
  let ungeocoded = 0;

  for (const venue of venues) {
    // Resolve coordinates once per venue (shared by all its weekly docs).
    let { lat, lng } = venue;
    if ((lat == null || lng == null) && venue.address) {
      const hit =
        (await geocode(venue.address)) ??
        (await geocode(`${venue.venueName}, ${venue.city}`));
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
        geocoded += 1;
      }
    }
    if (lat == null || lng == null) {
      ungeocoded += 1;
      console.warn(
        `[seed-open-gyms] no coordinates for "${venue.venueName}" — it will list in the agenda but get no map pin.`,
      );
    }

    const tz = venue.tz ?? "Europe/Amsterdam";

    for (const session of venue.sessions) {
      const byday = WEEKDAY_TO_BYDAY[session.weekday.toLowerCase()];
      if (!byday) {
        console.warn(
          `[seed-open-gyms] skipping unknown weekday "${session.weekday}" for ${venue.venueName}`,
        );
        continue;
      }
      const docId = `venue-${venue.venueId}-${byday}`;
      await adminDb
        .collection("open_gyms")
        .doc(docId)
        .set(
          {
            clubId: null,
            venueId: venue.venueId,
            venueName: venue.venueName,
            city: venue.city,
            region: venue.region,
            address: venue.address,
            websiteUrl: venue.websiteUrl,
            dedupKey: `venue-${venue.venueId}-${byday}-${session.startTime}`,
            sessionType: "open_gym",
            teamLabel: null,
            rrule: `FREQ=WEEKLY;BYDAY=${byday}`,
            exdates: [],
            startTime: session.startTime,
            endTime: session.endTime,
            tz,
            locationText: venue.address ?? venue.venueName,
            lat,
            lng,
            notes: venue.notes,
            origin: "scrape",
            confidence: 1,
            extractorVersion: EXTRACTOR_VERSION,
            status: "published",
            locked: true,
            validFrom: null,
            validUntil: null,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      docsWritten += 1;
    }
  }

  console.log(
    `\n[seed-open-gyms] done: venues=${venues.length} docs=${docsWritten} geocoded=${geocoded} ungeocoded=${ungeocoded}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
