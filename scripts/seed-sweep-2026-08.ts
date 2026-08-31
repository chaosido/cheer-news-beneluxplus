/**
 * Consolidated write from the 21 Aug 2026 club sweep.
 *
 * DST CARE: 25 October 2026 is the last Sunday of October, so the two Skills
 * Days that morning are already CET (+01:00), while 18 October is still CEST
 * (+02:00). Offsets below are per-event, not copy-pasted.
 *
 * COORDINATES are city/venue-level, never invented street precision. The venue
 * name always appears in locationText so a pin is never read as an address.
 *
 * DELIBERATELY EXCLUDED:
 *   - DANSJA's yoga, peuterdans and kleuterballet courses. DANSJA is a dance
 *     school; those are not cheerleading. Only the free open-lesweken go in,
 *     because the cheer class is part of them.
 *   - Everest's registration-opening dates. They are intake windows, not events
 *     you attend.
 *   - Partisans' Rabo ClubSupport and Grote Clubactie: fundraisers, one of them
 *     online-only, neither a cheer session.
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

const LEUVEN = {
  city: "Leuven",
  region: null as string | null,
  lat: 50.8631,
  lng: 4.6797,
};
const TILBURG = {
  city: "Tilburg",
  region: "Noord-Brabant" as string | null,
  lat: 51.5555,
  lng: 5.0913,
};
const EINDHOVEN = {
  city: "Eindhoven",
  region: "Noord-Brabant" as string | null,
  lat: 51.4416,
  lng: 5.4697,
};
const IJSSELSTEIN = {
  city: "IJsselstein",
  region: "Utrecht" as string | null,
  lat: 52.0206,
  lng: 5.0417,
};

interface Ev {
  id: string;
  title: string;
  description: string;
  type: "workshop" | "competition" | "tryout" | "other";
  start: string;
  end: string;
  allDay?: boolean;
  loc: string;
  geo: {
    city: string | null;
    region: string | null;
    lat: number | null;
    lng: number | null;
  };
  club: string | null;
  url: string | null;
}

const KUL = "KU Leuven Sportcentrum, Tervuursevest 101, Leuven, België";
const BCF =
  "Georganiseerd door de Belgian Cheerleading Federation. Inschrijven via member.belgiancheer.be.";

const EVENTS: Ev[] = [
  // ---- Belgian Cheerleading Federation ----
  {
    id: "bcf-2026-09-13-coaches-course-taping",
    title: "Coaches course — Taping",
    type: "other",
    start: "2026-09-13T09:30:00+02:00",
    end: "2026-09-13T13:30:00+02:00",
    description: `Coachescursus taping. Kosten €75. Inschrijven t/m 7 september 2026. ${BCF}`,
    loc: KUL,
    geo: LEUVEN,
    club: null,
    url: "https://www.belgiancheer.be/en/coaches-course-taping",
  },
  {
    id: "bcf-2026-09-13-coaches-course-tumbling",
    title: "Coaches course — Tumbling",
    type: "other",
    start: "2026-09-13T14:30:00+02:00",
    end: "2026-09-13T18:00:00+02:00",
    description: `Coachescursus tumbling. Kosten €35. Inschrijven t/m 7 september 2026. ${BCF}`,
    loc: KUL,
    geo: LEUVEN,
    club: null,
    url: "https://www.belgiancheer.be/en/coaches-course-tumbling",
  },
  {
    id: "bcf-2026-10-10-coaches-course-trainer-c",
    title: "Coaches course — Trainer C",
    type: "other",
    start: "2026-10-10T10:00:00+02:00",
    end: "2026-10-11T16:00:00+02:00",
    description: `Tweedaagse trainerscursus C, in het Nederlands en Frans. Zaterdag 10:00–17:00, zondag 10:00–16:00. Kosten €80. Inschrijven t/m 2 oktober 2026. ${BCF}`,
    loc: KUL,
    geo: LEUVEN,
    club: null,
    url: "https://www.belgiancheer.be/nl/coaches-course-trainer-c",
  },
  {
    id: "bcf-2026-10-18-skills-day-1-cheer-wallonie",
    title: "Skills day 1 CHEER — Wallonië",
    type: "workshop",
    start: "2026-10-18T09:30:00+02:00",
    end: "2026-10-18T13:00:00+02:00",
    description: `Skills day cheer in Wallonië, in het Frans. Maximaal 130 deelnemers. Kosten €20 p.p. Inschrijven t/m 9 oktober 2026. Locatie was bij publicatie nog niet bekend (TBC). ${BCF}`,
    loc: "Wallonië, België (locatie nog niet bekend)",
    geo: { city: null, region: null, lat: null, lng: null },
    club: null,
    url: "https://www.belgiancheer.be/nl/skills-day-1-wallonie",
  },
  // 25 Oct 2026 = last Sunday of October -> already CET (+01:00).
  {
    id: "bcf-2026-10-25-skills-day-1-cheer-flanders",
    title: "Skills day 1 CHEER — Vlaanderen",
    type: "workshop",
    start: "2026-10-25T09:30:00+01:00",
    end: "2026-10-25T13:00:00+01:00",
    description: `Skills day cheer in Vlaanderen. Maximaal 130 atleten. Kosten €20 p.p. Inschrijven t/m 16 oktober 2026. ${BCF}`,
    loc: "Gymnasium Sportkot KU Leuven, Tervuursevest 101, Leuven, België",
    geo: LEUVEN,
    club: null,
    url: "https://www.belgiancheer.be/en/skills-day-1",
  },
  {
    id: "bcf-2026-10-25-skills-day-pom",
    title: "Skills day 1 POM",
    type: "workshop",
    start: "2026-10-25T09:30:00+01:00",
    end: "2026-10-25T12:00:00+01:00",
    description: `Skills day performance cheer / pom. Kosten €25. Inschrijven t/m 16 oktober 2026. ${BCF}`,
    loc: "KU Leuven Sportcentrum — Multisporthal, Tervuursevest 101, Leuven, België",
    geo: LEUVEN,
    club: null,
    url: "https://www.belgiancheer.be/en/skills-day-pom",
  },
  {
    id: "bcf-2026-11-14-coaches-course-trainer-b",
    title: "Coaches course — Trainer B",
    type: "other",
    start: "2026-11-14T10:00:00+01:00",
    end: "2026-11-15T17:00:00+01:00",
    description: `Tweedaagse trainerscursus B, beide dagen 10:00–17:00. Kosten €85. Inschrijven t/m 6 november 2026. ${BCF}`,
    loc: KUL,
    geo: LEUVEN,
    club: null,
    url: "https://www.belgiancheer.be/en/coaches-course-trainer-b",
  },
  {
    id: "bcf-2026-12-13-partnerstunt-workshop",
    title: "Partnerstunt workshop",
    type: "workshop",
    start: "2026-12-13T09:30:00+01:00",
    end: "2026-12-13T13:00:00+01:00",
    description: `Partnerstunt workshop. Kosten €25. Inschrijven t/m 4 december 2026. ${BCF}`,
    loc: "KU Leuven Sportcentrum — Gymnasium, Tervuursevest 101, Leuven, België",
    geo: LEUVEN,
    club: null,
    url: "https://www.belgiancheer.be/en/skills-day-partnerstunt",
  },

  // ---- Invicta Tilburg (site invictacheer.nl, newly discovered) ----
  {
    id: "invicta-2026-09-05-season-opening",
    title: "Season Opening: Scavenger Hunt & Picnic",
    type: "other",
    start: "2026-09-05T12:00:00+02:00",
    end: "2026-09-05T15:00:00+02:00",
    description:
      "Seizoensopening met een speurtocht van ongeveer 90 minuten, gevolgd door een picknick. Gratis; eten wordt verzorgd, drinken zelf meenemen. Eindtijd is een schatting.",
    loc: "Spoorpark, Tilburg",
    geo: TILBURG,
    club: "invicta-tilburg-cheer",
    url: "https://invictacheer.nl/",
  },
  {
    id: "invicta-2026-09-27-inferno-tryouts",
    title: "Inferno Team Tryouts",
    type: "tryout",
    start: "2026-09-27T10:00:00+02:00",
    end: "2026-09-27T14:00:00+02:00",
    description:
      "Try-outs voor het wedstrijdteam. Deelname aan wedstrijden kost naar verwachting rond €100, uniform eveneens rond €100.",
    loc: "Tilburg University Sports Center, Tilburg",
    geo: TILBURG,
    club: "invicta-tilburg-cheer",
    url: "https://invictacheer.nl/trainings/",
  },

  // ---- E.S.T.C. Twist: open training, monthly ----
  // Modelled as events rather than a monthly open_gym doc: weeklySlots() only
  // understands FREQ=WEEKLY, so a monthly recurrence would never render on the
  // club page. Individual dated events show up everywhere.
  {
    id: "estc-twist-2026-09-02-open-training",
    title: "Open cheertraining — E.S.T.C. Twist",
    type: "open_gym" as never,
    start: "2026-09-02T20:00:00+02:00",
    end: "2026-09-02T22:00:00+02:00",
    description:
      "Maandelijkse open cheertraining, elke eerste woensdag van de maand. Open voor niet-leden, maar een geldige sportkaart is verplicht. Trainer: Anne van Staveren.",
    loc: "SSCE Hall 3A, Onze Lieve Vrouwestraat 1, Eindhoven",
    geo: EINDHOVEN,
    club: "e-s-t-c-twist",
    url: "https://estctwist.nl/sports/open-trainings/",
  },
  {
    id: "estc-twist-2026-10-07-open-training",
    title: "Open cheertraining — E.S.T.C. Twist",
    type: "open_gym" as never,
    start: "2026-10-07T20:00:00+02:00",
    end: "2026-10-07T22:00:00+02:00",
    description:
      "Maandelijkse open cheertraining, elke eerste woensdag van de maand. Open voor niet-leden, maar een geldige sportkaart is verplicht. Trainer: Anne van Staveren.",
    loc: "SSCE Hall 3A, Onze Lieve Vrouwestraat 1, Eindhoven",
    geo: EINDHOVEN,
    club: "e-s-t-c-twist",
    url: "https://estctwist.nl/sports/open-trainings/",
  },
  {
    id: "estc-twist-2026-11-04-open-training",
    title: "Open cheertraining — E.S.T.C. Twist",
    type: "open_gym" as never,
    start: "2026-11-04T20:00:00+01:00",
    end: "2026-11-04T22:00:00+01:00",
    description:
      "Maandelijkse open cheertraining, elke eerste woensdag van de maand. Open voor niet-leden, maar een geldige sportkaart is verplicht. Trainer: Anne van Staveren.",
    loc: "SSCE Hall 3A, Onze Lieve Vrouwestraat 1, Eindhoven",
    geo: EINDHOVEN,
    club: "e-s-t-c-twist",
    url: "https://estctwist.nl/sports/open-trainings/",
  },

  // ---- DANSJA: free open lesson weeks (the cheer class is included) ----
  {
    id: "dansja-2026-08-31-open-lesweken",
    title: "Gratis open lesweken — DANSJA",
    type: "open_gym" as never,
    start: "2026-08-31T00:00:00+02:00",
    end: "2026-09-13T23:59:00+02:00",
    allDay: true,
    description:
      "Twee weken gratis meedoen met alle lessen, inclusief de cheerleadingles (dinsdag 15:30–16:30, vanaf 7 jaar). Aanmelden via mijn.dansja.nl/Proefles.",
    loc: "DANSJA, Linnaeusweg 25, 3401 MS IJsselstein",
    geo: IJSSELSTEIN,
    club: "dansja-cheerleading",
    url: "https://www.dansja.nl/open-lesweken-3/",
  },
];

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { Timestamp, FieldValue } = await import("firebase-admin/firestore");
  const tag = APPLY ? "" : "[dry run] ";

  console.log(`${tag}events (${EVENTS.length}):`);
  for (const e of EVENTS) {
    const had = (await adminDb.doc(`events/${e.id}`).get()).exists;
    console.log(
      `  ${e.start.slice(0, 10)}  ${String(e.type).padEnd(11)} ${e.title}${had ? "  [exists]" : ""}`,
    );
    if (!APPLY) continue;
    await adminDb.doc(`events/${e.id}`).set(
      {
        canonicalEventId: e.id,
        clubId: e.club,
        title: e.title,
        description: e.description,
        type: e.type,
        allDay: e.allDay ?? false,
        startsAt: Timestamp.fromDate(new Date(e.start)),
        endsAt: Timestamp.fromDate(new Date(e.end)),
        locationText: e.loc,
        city: e.geo.city,
        region: e.geo.region,
        lat: e.geo.lat,
        lng: e.geo.lng,
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

  // ---- Level UP: fill in the venue and pricing we previously lacked ----
  const lvl = adminDb.doc("events/bcf-level-up-2026-11-07");
  if ((await lvl.get()).exists) {
    console.log(
      `\n${tag}events/bcf-level-up-2026-11-07: adding venue + pricing (was "locatie nog niet bekend")`,
    );
    if (APPLY)
      await lvl.update({
        locationText:
          "KU Leuven Sportcentrum, Tervuursevest 101, Leuven, België",
        city: LEUVEN.city,
        region: LEUVEN.region,
        lat: LEUVEN.lat,
        lng: LEUVEN.lng,
        description:
          "Tweedaags camp van de Belgian Cheerleading Federation, in hetzelfde weekend als de Lowlands Challenger. " +
          "Atleten €60 per dag, of €40 voor het zondagse development track. Coaches en bestuursleden €45 per dag of €80 voor beide dagen; lunch en drinken inbegrepen. " +
          "Inschrijven t/m 14 oktober 2026 via member.belgiancheer.be. Exacte tijden waren bij publicatie nog niet bekend.",
        url: "https://www.belgiancheer.be/en/level",
        ticketUrl: "https://www.belgiancheer.be/en/level",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  // ---- Club record fixes found during the sweep ----
  const inv = adminDb.doc("clubs/invicta-tilburg-cheer");
  if ((await inv.get()).exists) {
    console.log(
      `${tag}clubs/invicta-tilburg-cheer: websiteUrl -> https://invictacheer.nl (we had none)`,
    );
    if (APPLY)
      await inv.update({
        websiteUrl: "https://invictacheer.nl",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }
  const gg = adminDb.doc("clubs/groningen-giants-cheerleaders");
  if ((await gg.get()).exists) {
    console.log(
      `${tag}clubs/groningen-giants-cheerleaders: address -> Laan Corpus Den Hoorn 101, 9728 JR Groningen`,
    );
    if (APPLY)
      await gg.update({
        address: "Laan Corpus Den Hoorn 101, 9728 JR Groningen",
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written.");
}
main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
