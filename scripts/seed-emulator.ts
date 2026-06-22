/**
 * Seed script for the local Firestore emulator.
 *
 * Writes 3 clubs (each with one team subcollection doc) and one weekly open
 * gym per club, so the home map, agenda, /clubs grid, and /clubs/[slug] pages
 * all render with realistic data.
 *
 * USAGE:
 *   1. Start emulators in another terminal:
 *        firebase emulators:start --project cheer-news-beneluxplus
 *   2. Run:
 *        FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *        GCP_PROJECT_ID=cheer-news-beneluxplus \
 *          npx tsx scripts/seed-emulator.ts
 *
 * Re-running wipes the three seeded clubs and re-inserts them; other docs are
 * left alone. Safe to run repeatedly.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    "Refusing to run: FIRESTORE_EMULATOR_HOST is not set. This script is " +
      "emulator-only — set it (e.g. localhost:8080) before running.",
  );
  process.exit(1);
}

const projectId =
  process.env.GCP_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "cheer-news-beneluxplus";

if (!getApps().length) {
  // Emulator accepts any credential, including no credential at all when the
  // FIRESTORE_EMULATOR_HOST env var is set. initializeApp with just projectId
  // works fine.
  initializeApp({ projectId });
}
const db = getFirestore();

type SeedClub = {
  id: string;
  name: string;
  slug: string;
  city: string;
  region: string;
  lat: number;
  lng: number;
  team: {
    id: string;
    name: string;
    level: "3" | "4" | "5";
    division: "all_girl" | "coed";
    ageGroup: "junior" | "senior";
  };
  gym: {
    id: string;
    weekday: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
    startTime: string;
    endTime: string;
  };
};

const CLUBS: SeedClub[] = [
  {
    id: "amsterdam-allstars",
    name: "Amsterdam Allstars",
    slug: "amsterdam-allstars",
    city: "Amsterdam",
    region: "Noord-Holland",
    lat: 52.3676,
    lng: 4.9041,
    team: {
      id: "senior-coed-5",
      name: "Senior Coed Elite",
      level: "5",
      division: "coed",
      ageGroup: "senior",
    },
    gym: {
      id: "monday-open-gym",
      weekday: "MO",
      startTime: "19:00",
      endTime: "21:00",
    },
  },
  {
    id: "rotterdam-rebels",
    name: "Rotterdam Rebels",
    slug: "rotterdam-rebels",
    city: "Rotterdam",
    region: "Zuid-Holland",
    lat: 51.9244,
    lng: 4.4777,
    team: {
      id: "junior-all-girl-4",
      name: "Junior All-Girl Advanced",
      level: "4",
      division: "all_girl",
      ageGroup: "junior",
    },
    gym: {
      id: "wednesday-open-gym",
      weekday: "WE",
      startTime: "18:30",
      endTime: "20:30",
    },
  },
  {
    id: "utrecht-united",
    name: "Utrecht United",
    slug: "utrecht-united",
    city: "Utrecht",
    region: "Utrecht",
    lat: 52.0907,
    lng: 5.1214,
    team: {
      id: "senior-all-girl-3",
      name: "Senior All-Girl Median",
      level: "3",
      division: "all_girl",
      ageGroup: "senior",
    },
    gym: {
      id: "saturday-open-gym",
      weekday: "SA",
      startTime: "10:00",
      endTime: "12:00",
    },
  },
];

async function deleteSubcollection(parentPath: string, name: string) {
  const snap = await db.collection(`${parentPath}/${name}`).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function wipePrevious() {
  for (const c of CLUBS) {
    await deleteSubcollection(`clubs/${c.id}`, "teams");
    await db.doc(`clubs/${c.id}`).delete().catch(() => {});
    await db.doc(`open_gyms/${c.id}__${c.gym.id}`).delete().catch(() => {});
  }
}

async function seed() {
  await wipePrevious();

  for (const c of CLUBS) {
    // Club doc.
    await db.doc(`clubs/${c.id}`).set({
      name: c.name,
      slug: c.slug,
      websiteUrl: null,
      city: c.city,
      address: null,
      country: "NL",
      region: c.region,
      lat: c.lat,
      lng: c.lng,
      instagramUrl: null,
      tiktokUrl: null,
      facebookUrl: null,
      logoUrl: null,
      blurb: `Seed club in ${c.city}.`,
      foundedYear: null,
      primaryChannel: "none",
      clubType: "club",
      status: "active",
      locked: true,
      lastVerifiedAt: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // One team in the subcollection.
    await db.doc(`clubs/${c.id}/teams/${c.team.id}`).set({
      name: c.team.name,
      discipline: "cheer",
      level: c.team.level,
      danceStyle: null,
      tier: "competition",
      division: c.team.division,
      ageGroup: c.team.ageGroup,
      status: "active",
    });

    // One weekly open gym per club.
    const gymDocId = `${c.id}__${c.gym.id}`;
    await db.doc(`open_gyms/${gymDocId}`).set({
      clubId: c.id,
      dedupKey: gymDocId,
      sessionType: "open_gym",
      rrule: `RRULE:FREQ=WEEKLY;BYDAY=${c.gym.weekday}`,
      exdates: [],
      startTime: c.gym.startTime,
      endTime: c.gym.endTime,
      tz: "Europe/Amsterdam",
      locationText: `${c.name} Gym`,
      lat: c.lat,
      lng: c.lng,
      notes: null,
      origin: "submission",
      confidence: 1,
      extractorVersion: 1,
      status: "published",
      locked: true,
      validFrom: null,
      validUntil: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Seeded club ${c.id} (+1 team, +1 open gym)`);
  }
}

seed()
  .then(() => {
    console.log("\nDone. Visit http://localhost:3000");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
