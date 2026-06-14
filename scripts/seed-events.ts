/**
 * Idempotent Firestore seed script for club-INDEPENDENT one-off events
 * (standalone events not tied to any club — e.g. a community park session).
 *
 * Run with: `npm run seed:events` (tsx --env-file=.env.local
 * scripts/seed-events.ts).
 *
 * Reads data/events.seed.json and upserts one published doc per entry into the
 * `events` collection:
 *   - id        -> events/{id}
 *   - clubId    -> null   (no parent club)
 *   - city/region -> self-describing location for the province filter + agenda
 *   - locked    -> true   (curated by hand; scrapers must not overwrite them)
 *
 * Coordinates: if the entry omits lat/lng, we geocode `geocodeQuery` (falling
 * back to locationText / "{city}") via lib/geocode.ts (Nominatim).
 *
 * Ids are taken verbatim from the seed file so re-running overwrites rather
 * than duplicates.
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
import type { EventType } from "../lib/types";

// ---- Seed-file shape (input) ----

interface SeedEvent {
  id: string;
  title: string;
  type: EventType;
  description: string | null;
  startsAt: string; // ISO-8601 with offset
  endsAt: string | null; // ISO-8601 with offset, or null
  allDay: boolean;
  locationText: string | null;
  city: string | null;
  region: string | null;
  geocodeQuery?: string | null; // used only for geocoding, not stored
  lat?: number | null;
  lng?: number | null;
  url: string | null;
  ticketUrl: string | null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "..", "data");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { geocode } = await import("../lib/geocode");
  const { FieldValue, Timestamp } = await import("firebase-admin/firestore");

  // Guard: surface a clear message if the Admin SDK has no usable credentials.
  try {
    await adminDb.collection("events").limit(1).get();
  } catch (err) {
    console.error(
      "\nFailed to reach Firestore with the Admin SDK. Make sure credentials are set\n" +
        "(FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in .env.local).\n",
    );
    throw err;
  }

  const events = readJson<SeedEvent[]>("events.seed.json");

  let docsWritten = 0;
  let geocoded = 0;
  let ungeocoded = 0;

  for (const e of events) {
    const start = new Date(e.startsAt);
    if (Number.isNaN(start.getTime())) {
      console.warn(`[seed-events] skipping "${e.title}" — invalid startsAt`);
      continue;
    }
    const end = e.endsAt ? new Date(e.endsAt) : null;
    const endValid = end && !Number.isNaN(end.getTime());

    let lat = e.lat ?? null;
    let lng = e.lng ?? null;
    const query = e.geocodeQuery ?? e.locationText ?? e.city;
    if ((lat == null || lng == null) && query) {
      const hit = await geocode(query);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
        geocoded += 1;
      }
    }
    if (lat == null || lng == null) {
      ungeocoded += 1;
      console.warn(
        `[seed-events] no coordinates for "${e.title}" — it will list in the agenda without coordinates.`,
      );
    }

    await adminDb
      .collection("events")
      .doc(e.id)
      .set(
        {
          canonicalEventId: e.id,
          clubId: null,
          title: e.title,
          description: e.description,
          type: e.type,
          allDay: e.allDay,
          startsAt: Timestamp.fromDate(start),
          endsAt: endValid ? Timestamp.fromDate(end) : null,
          locationText: e.locationText,
          city: e.city,
          region: e.region,
          lat,
          lng,
          url: e.url,
          ticketUrl: e.ticketUrl,
          origin: "scrape",
          confidence: 1,
          extractorVersion: EXTRACTOR_VERSION,
          status: "published",
          locked: true,
          sources: [],
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    docsWritten += 1;
  }

  console.log(
    `\n[seed-events] done: events=${events.length} docs=${docsWritten} geocoded=${geocoded} ungeocoded=${ungeocoded}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
