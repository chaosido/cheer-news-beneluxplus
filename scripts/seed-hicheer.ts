/**
 * New club: Hilversum International Cheerleading Academy (HIC / "hicheer").
 *
 * FOUND VIA: Everest's Instagram following list, searched for "hilversum" —
 * global Instagram search never surfaced it because the handle is `hicheer.nl`
 * (one c) and the city only appears in the display name. Brand new: 8 posts.
 *
 * SOURCES: instagram.com/hicheer.nl and www.hicheer.nl, both read 2026-08-21.
 *
 * NOT SET, deliberately:
 *   - Street address. The site shows only "Hilversum, Netherlands"; its Google
 *     Maps embed did not render, and the venue on their open-day post was
 *     unreadable. Coordinates are the HILVERSUM CITY CENTROID, and the training
 *     locationText says the venue is unconfirmed so the pin cannot be mistaken
 *     for a real address.
 *   - A `teams` subcollection. Team.division and Team.level are required and
 *     neither is published — the four squads are recorded as trainings with a
 *     teamLabel instead, which needs no invented classification.
 */
import { spawnSync } from "node:child_process";
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

const CLUB_ID = "hilversum-international-cheerleading";
/** Hilversum city centre — provisional, see header. */
const LAT = 52.2292,
  LNG = 5.1669;
const VENUE = "Hilversum (exacte locatie nog niet bevestigd)";

/** Squads, from hicheer.nl. Recreational starts 5 Sep, competition 4 Sep. */
const TRAININGS = [
  {
    id: `${CLUB_ID}-tr-mini-star`,
    team: "Mini Star (5–7 jaar)",
    byday: "SA",
    start: "14:00",
    end: "15:00",
    from: "2026-09-05",
    note: "Recreatief. Seizoen start 5 september.",
  },
  {
    id: `${CLUB_ID}-tr-sparkle`,
    team: "Sparkle (8–12 jaar)",
    byday: "SA",
    start: "15:15",
    end: "16:15",
    from: "2026-09-05",
    note: "Recreatief. Seizoen start 5 september.",
  },
  {
    id: `${CLUB_ID}-tr-princesses`,
    team: "Princesses (8–12 jaar)",
    byday: "FR",
    start: "18:30",
    end: "20:00",
    from: "2026-09-04",
    note: "Wedstrijdteam. Seizoen start 4 september.",
  },
  {
    id: `${CLUB_ID}-tr-duchess`,
    team: "Duchess (13–16 jaar)",
    byday: "SA",
    start: "16:30",
    end: "18:00",
    from: "2026-09-05",
    note: "Wedstrijdteam. Seizoen start 4 september.",
  },
];

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { Timestamp, FieldValue } = await import("firebase-admin/firestore");
  const tag = APPLY ? "" : "[dry run] ";

  const existing = await adminDb.doc(`clubs/${CLUB_ID}`).get();
  console.log(
    `${tag}clubs/${CLUB_ID} ${existing.exists ? "(EXISTS — would merge)" : "(new)"}`,
  );
  if (APPLY) {
    await adminDb.doc(`clubs/${CLUB_ID}`).set(
      {
        name: "Hilversum International Cheerleading Academy",
        slug: CLUB_ID,
        websiteUrl: "https://www.hicheer.nl",
        city: "Hilversum",
        address: null,
        country: "NL",
        region: "Noord-Holland",
        lat: LAT,
        lng: LNG,
        instagramUrl: "https://www.instagram.com/hicheer.nl/",
        tiktokUrl: null,
        facebookUrl: null,
        youtubeUrl: null,
        logoUrl: null,
        blurb:
          "Engelstalige cheerleadingacademie in Hilversum voor jongens en meisjes van 5 t/m 16 jaar, " +
          "met zowel recreatieve teams als wedstrijdteams. Nieuw opgericht in 2026.",
        foundedYear: 2026,
        primaryChannel: "website",
        clubType: "club",
        status: "active",
        locked: true,
        csnMember: false,
        contactEmail: "info@hicheer.nl",
        email: "info@hicheer.nl",
        trainingLocation: null,
        coaches: [],
        achievements: [],
        lastVerifiedAt: Timestamp.fromDate(
          new Date("2026-08-21T00:00:00+02:00"),
        ),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  console.log(`\n${tag}trainings:`);
  for (const t of TRAININGS) {
    console.log(`  ${t.id}  ${t.byday} ${t.start}–${t.end}  ${t.team}`);
    if (!APPLY) continue;
    await adminDb.doc(`open_gyms/${t.id}`).set(
      {
        clubId: CLUB_ID,
        dedupKey: t.id,
        sessionType: "training",
        teamLabel: t.team,
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${t.byday}`,
        exdates: [],
        startTime: t.start,
        endTime: t.end,
        tz: "Europe/Amsterdam",
        locationText: VENUE,
        lat: LAT,
        lng: LNG,
        notes: t.note,
        origin: "submission",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        locked: true,
        validFrom: Timestamp.fromDate(new Date(`${t.from}T00:00:00+02:00`)),
        validUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  // Open day announced on Instagram for Saturday 29 August, 10:00–11:00.
  const OPEN_DAY = `${CLUB_ID}-open-day-2026-08-29`;
  console.log(`\n${tag}events/${OPEN_DAY}  29-08-2026 10:00–11:00  Open Day`);
  if (APPLY) {
    await adminDb.doc(`events/${OPEN_DAY}`).set(
      {
        canonicalEventId: OPEN_DAY,
        clubId: CLUB_ID,
        title: "Open Day — Hilversum International Cheerleading",
        description:
          "Kennismaken met de nieuwe Engelstalige cheerleadingacademie in Hilversum. " +
          "Voor jongens en meisjes van 5 t/m 16 jaar, recreatief en wedstrijd. " +
          "Kom langs voor vragen en om het team te ontmoeten. Exacte locatie via hicheer.nl.",
        type: "other",
        allDay: false,
        startsAt: Timestamp.fromDate(new Date("2026-08-29T10:00:00+02:00")),
        endsAt: Timestamp.fromDate(new Date("2026-08-29T11:00:00+02:00")),
        locationText: VENUE,
        lat: LAT,
        lng: LNG,
        url: "https://www.hicheer.nl",
        ticketUrl: null,
        origin: "submission",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        locked: true,
        sources: [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written.");
}
main().catch((e) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
