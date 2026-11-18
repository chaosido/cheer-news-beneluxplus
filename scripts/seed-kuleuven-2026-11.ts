/**
 * One-shot seed: KU Leuven Cheerteam (approved by the maintainer 2026-11-18
 * after full verification; was on hold at the Belgium intake for lack of
 * evidence). Creates the club doc, the Falcons team and the two published
 * training slots. Dry run by default; --apply writes. NOT idempotent-safe for
 * re-runs with edits (set+merge, stable ids).
 *
 * Evidence:
 * - IG @kuleuven_cheerleading bio: "KULeuven Falcons Cheer - Senior COED
 *   Advanced level 4", "National Champions '18-'19-'22", highlight "S26-27".
 * - https://www.kuleuven.be/sport/kuleuventeams/cheerleading: students-only
 *   (KU Leuven/Associatie), yearly selection, trains TU 18:00-20:00 (Gymzaal,
 *   optioneel) and TH 19:00-21:30 (Grote Zaal), competes at the BK.
 * - BCC 2026 (belgiancheer.be/nl/results-2026): "KU Leuven Falcons" rank 2
 *   Senior Coed Advanced; also BCC 2025 rank 2 Senior Coed Median.
 */
import { adminDb } from "../lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const now = Timestamp.now();
const verified = Timestamp.fromDate(new Date("2026-11-18T12:00:00+01:00"));
const ID = "ku-leuven-cheerteam";

const club = {
  id: ID,
  slug: ID,
  name: "KU Leuven Cheerteam",
  city: "Leuven",
  region: "Vlaams-Brabant",
  country: "BE",
  clubType: "club",
  csnMember: false,
  // Not on the BCF club register (belgiancheer.be/clubs), though the team
  // competes at the BK — so no BCF badge.
  bcfMember: false,
  status: "active",
  websiteUrl: "https://www.kuleuven.be/sport/kuleuventeams/cheerleading",
  instagramUrl: "https://www.instagram.com/kuleuven_cheerleading/",
  facebookUrl: null,
  tiktokUrl: null,
  contactEmail: "kulcheer@hotmail.com",
  blurb:
    "Het officiële cheerleadingteam van KU Leuven Sport: de KU Leuven Falcons (Senior Coed Level 4). Alleen voor studenten van KU Leuven en de Associatie, met jaarlijkse selecties; meervoudig Belgisch kampioen en vaste BK-deelnemer.",
  foundedYear: null,
  primaryChannel: "instagram",
  logoUrl: "/logos/ku-leuven-cheerteam.jpg",
  trainingLocation:
    "Universitair Sportcentrum KU Leuven, Tervuursevest 101, 3001 Leuven",
  // Sportkot main site; the uni page names only the halls (Gymzaal/Grote Zaal).
  geo: { lat: 50.86351, lng: 4.6951 },
  geoProvisional: true,
  locked: true,
  origin: "scrape",
  lastVerifiedAt: verified,
  updatedAt: now,
};

const team = {
  docId: `${ID}-team-1`,
  name: "KU Leuven Falcons",
  discipline: "cheer",
  level: "4",
  danceStyle: null,
  tier: "competition",
  division: "coed",
  // Student team -> "open", conform de conventie voor universiteitsteams
  // (UCA/UM/USC/ULB/UCLouvain-precedent).
  ageGroup: "open",
  status: "active",
  notes:
    'Bron: IG-bio @kuleuven_cheerleading "KULeuven Falcons Cheer - Senior COED Advanced level 4" | BCC 2026 rang 2 Senior Coed Advanced (belgiancheer.be/nl/results-2026) | sourced: {"division": "IG-bio \'Senior COED Advanced level 4\' + BCC-categorie", "ageGroup": "studententeam (kuleuven.be/sport: alleen KU Leuven/Associatie-studenten) → open", "tier": "BCC 2026 rang 2; jaarlijkse selecties (kuleuven.be/sport)"}',
  locked: true,
  origin: "scrape",
  updatedAt: now,
};

const sessions = [
  {
    id: `${ID}-tr-1`,
    sessionType: "training",
    teamLabel: "KU Leuven Falcons (optionele training)",
    rrule: "RRULE:FREQ=WEEKLY;BYDAY=TU",
    startTime: "18:00",
    endTime: "20:00",
    locationText: "Gymzaal, Universitair Sportcentrum KU Leuven",
    notes:
      "Alleen voor geselecteerde teamleden (studenten KU Leuven/Associatie). Dinsdagtraining is optioneel.",
    tz: "Europe/Brussels",
  },
  {
    id: `${ID}-tr-2`,
    sessionType: "training",
    teamLabel: "KU Leuven Falcons",
    rrule: "RRULE:FREQ=WEEKLY;BYDAY=TH",
    startTime: "19:00",
    endTime: "21:30",
    locationText: "Grote Zaal, Universitair Sportcentrum KU Leuven",
    notes:
      "Alleen voor geselecteerde teamleden (studenten KU Leuven/Associatie); jaarlijkse selectie begin oktober.",
    tz: "Europe/Brussels",
  },
];

async function main() {
  console.log(APPLY ? "APPLY" : "DRY RUN");
  console.log("club:", club.id, club.name, club.trainingLocation);
  console.log("team:", team.name, team.division, team.level, team.ageGroup);
  for (const s of sessions)
    console.log("session:", s.id, s.rrule.slice(-2), s.startTime, s.endTime);
  if (!APPLY) {
    console.log("Dry run — nothing written. Re-run with --apply.");
    return;
  }
  await adminDb.doc(`clubs/${ID}`).set(club, { merge: true });
  const { docId, ...teamFields } = team;
  await adminDb
    .doc(`clubs/${ID}/teams/${docId}`)
    .set(teamFields, { merge: true });
  for (const s of sessions) {
    const { id, ...fields } = s;
    await adminDb.doc(`open_gyms/${id}`).set(
      {
        ...fields,
        clubId: ID,
        dedupKey: id,
        exdates: [],
        lat: club.geo.lat,
        lng: club.geo.lng,
        confidence: 1,
        extractorVersion: 1,
        validFrom: null,
        validUntil: null,
        status: "published",
        locked: true,
        origin: "scrape",
        price: null,
        updatedAt: now,
      },
      { merge: true },
    );
  }
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
