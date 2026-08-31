/**
 * Season-start camps, autumn 2026.
 *
 * SOURCES
 *   - NCA Camps: varsity-europe.com/education/nca (read in full 2026-08-21),
 *     announced via instagram.com/p/DcdSPIJDA1y. Organised by Varsity Europe;
 *     the first NCA camps ever held in Europe.
 *   - Level UP: the Belgian Cheerleading Federation calendar
 *     (belgiancheer.be/en/calendar). No detail page exists yet, so only the
 *     dates and title are confirmed — venue, times and price are unknown and
 *     are NOT invented here.
 *
 * MODELLING NOTES
 *   - clubId is null: these belong to Varsity Europe and the BCF, not to any
 *     club in our directory.
 *   - allDay, because the source gives days and level bands but no clock times.
 *   - The level split is the key fact for an athlete deciding whether to go, so
 *     it leads every description. One event per camp rather than one per day:
 *     both days share a venue, so splitting would stack two pins on one spot.
 *   - `region` is null for non-Dutch venues — it feeds the Dutch province
 *     filter, and Germany/Belgium have no province in that set (same treatment
 *     as the existing LLO Challenger in Leuven).
 *   - Coordinates are CITY CENTROIDS, not the gyms themselves; the sources give
 *     venue names without street addresses. Location text says the venue name
 *     so nobody mistakes the pin for a precise address.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/seed-camps-2026.ts            # dry run
 *   npx tsx --env-file=.env.local scripts/seed-camps-2026.ts --apply
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

interface Seed {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  locationText: string;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
}

const COMMON_NCA =
  "Aanmelden kan als group stunt, partner stunt of als heel team. " +
  "Routines en tumbling maken geen deel uit van het camp. " +
  "Deelname vanaf geboortejaar 2019 of ouder. Deelnemers onder de 18 moeten " +
  "ter plaatse begeleid worden door een volwassene uit de eigen vereniging. " +
  "Georganiseerd door Varsity Europe — de eerste NCA-camps in Europa.";

const EVENTS: Seed[] = [
  {
    id: "nca-camp-2026-09-20-schonefeld",
    title: "NCA Camp Schönefeld (Berlijn)",
    description:
      "Zondag 20 september: levels 1 t/m 7 op één dag. " +
      COMMON_NCA +
      " Early bird €75 t/m 6 september, daarna €85. Inschrijven kan t/m woensdag 16 september 23:59.",
    start: "2026-09-20T00:00:00+02:00",
    end: "2026-09-20T23:59:00+02:00",
    locationText:
      "Magic Cheer Circle Schönefeld e.V. (MCC), Schönefeld, Duitsland",
    city: "Schönefeld",
    region: null,
    lat: 52.3889,
    lng: 13.5031,
    url: "https://varsity-europe.com/education/nca",
  },
  {
    id: "nca-camp-2026-09-26-bensheim",
    title: "NCA Camp Bensheim-Auerbach",
    description:
      "Zaterdag 26 september: levels 1 t/m 3. Zondag 27 september: levels 4 t/m 7. " +
      COMMON_NCA +
      " Early bird €75 t/m 13 september, daarna €85. Inschrijven kan t/m woensdag 23 september 23:59.",
    start: "2026-09-26T00:00:00+02:00",
    end: "2026-09-27T23:59:00+02:00",
    locationText: "Cheer Strike Gym, Bensheim-Auerbach, Duitsland",
    city: "Bensheim-Auerbach",
    region: null,
    lat: 49.6875,
    lng: 8.6167,
    url: "https://varsity-europe.com/education/nca",
  },
  {
    id: "nca-camp-2026-10-03-krefeld",
    title: "NCA Camp Krefeld",
    description:
      "Zaterdag 3 oktober: levels 1 t/m 3. Zondag 4 oktober: levels 4 t/m 7. " +
      COMMON_NCA +
      " Early bird €75 t/m 20 september, daarna €85. Inschrijven kan t/m woensdag 30 september 23:59.",
    start: "2026-10-03T00:00:00+02:00",
    end: "2026-10-04T23:59:00+02:00",
    locationText: "Dolphins Gym, Krefeld, Duitsland",
    city: "Krefeld",
    region: null,
    lat: 51.3388,
    lng: 6.5853,
    url: "https://varsity-europe.com/education/nca",
  },
  {
    id: "bcf-level-up-2026-11-07",
    title: "Level UP — Train the Athlete. Shape the Person.",
    description:
      "Tweedaags camp van de Belgische cheerleadingfederatie (BCF), in hetzelfde " +
      "weekend als de Lowlands Challenger. Locatie, tijden en kosten zijn nog " +
      "niet gepubliceerd — alleen de datum staat vast in de BCF-kalender.",
    start: "2026-11-07T00:00:00+01:00",
    end: "2026-11-08T23:59:00+01:00",
    locationText: "België (locatie nog niet bekend)",
    city: null,
    region: null,
    lat: null,
    lng: null,
    url: "https://www.belgiancheer.be/en/calendar",
  },
];

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { Timestamp, FieldValue } = await import("firebase-admin/firestore");
  const tag = APPLY ? "" : "[dry run] ";

  console.log(`${tag}writing ${EVENTS.length} camp events (clubId=null):\n`);
  for (const e of EVENTS) {
    const exists = (await adminDb.doc(`events/${e.id}`).get()).exists;
    console.log(`  ${e.id}${exists ? "  [EXISTS — would overwrite]" : ""}`);
    console.log(
      `      ${e.start.slice(0, 10)} → ${e.end.slice(0, 10)}  ${e.locationText}`,
    );
    console.log(`      "${e.title}"`);
    console.log(`      pin: ${e.lat ?? "none"},${e.lng ?? ""}`);
    if (!APPLY) continue;
    await adminDb.doc(`events/${e.id}`).set(
      {
        canonicalEventId: e.id,
        clubId: null,
        title: e.title,
        description: e.description,
        type: "workshop",
        allDay: true,
        startsAt: Timestamp.fromDate(new Date(e.start)),
        endsAt: Timestamp.fromDate(new Date(e.end)),
        locationText: e.locationText,
        city: e.city,
        region: e.region,
        lat: e.lat,
        lng: e.lng,
        url: e.url,
        ticketUrl: e.url,
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

  // Stichting Dansplezier: a ballroom/salsa/zumba school whose agenda is pub
  // quizzes and bingo. No cheerleading anywhere on the site. Hidden per the
  // project's convention — status "inactive", data kept, never deleted.
  const dp = adminDb.doc("clubs/stichting-dansplezier");
  if ((await dp.get()).exists) {
    console.log(
      `\n${tag}clubs/stichting-dansplezier: status -> inactive (no cheerleading offered)`,
    );
    if (APPLY)
      await dp.update({
        status: "inactive",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written.");
}
main().catch((e) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
