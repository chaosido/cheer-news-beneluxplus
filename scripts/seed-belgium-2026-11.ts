/**
 * Belgium launch — seeds the full Belgian cheerleading scene (2026-11-16 intake).
 *
 * SOURCE: scripts/data/belgium-2026-11.json, curated from the BCF club registry
 * (belgiancheer.be/clubs), every club's own website, an Instagram pass in the
 * maintainer's browser, and ICU/BCC/ASEUS results. Research provenance (per-claim
 * URLs + quotes) lives in tmp/sweep/belgium/ on the intake branch and in the
 * review artifact. 34 clubs (all current BCF members → bcfMember: true), the 18
 * team docs whose division/ageGroup/tier are fully sourced (everything else
 * stays a training-slot teamLabel), 109 weekly training slots, one venue-hosted
 * open gym (KU Leuven Sportcampus Arenberg) and 4 upcoming BCF-agenda events.
 *
 * DELIBERATE:
 *  - Clubs without a published street address get their pin from a venue-name
 *    or city-centroid geocode and carry "(exacte locatie niet bevestigd)" in
 *    their slots' locationText, same as the hicheer precedent.
 *  - University teams use ageGroup "open" (NL convention: UCA/UM/USC).
 *  - Danshuis's pom teams are all_girl from roster photo evidence (division is
 *    not published anywhere; see the team notes).
 *  - KSVT Lembeek (no cheer), KU Leuven Cheerteam (unverifiable), Ultimate
 *    Cheer All-Stars + Brussels Tigers squad (defunct) are NOT seeded;
 *    Athanor Brussels Cheer is covered by its rebrand ABC Hive.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/seed-belgium-2026-11.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/seed-belgium-2026-11.ts --apply   # write
 *
 * Geocoding uses Nominatim (1.1s/request) with a cache at
 * tmp/sweep/belgium/geocache.json so re-runs and the apply reuse the dry run's
 * results. NOT idempotent-safe to run twice with --apply only in the sense that
 * it re-merges the same ids (safe), but take a snapshot first regardless.
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

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const DATA_PATH = "scripts/data/belgium-2026-11.json";
const CACHE_PATH = "tmp/sweep/belgium/geocache.json";

// ---- shapes of the data file ------------------------------------------------
interface SeedClub {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  city: string;
  address: string | null;
  country: string;
  region: string;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  blurb: string;
  foundedYear: number | null;
  primaryChannel: string;
  clubType: string;
  csnMember: boolean;
  bcfMember: boolean;
  contactEmail: string | null;
  trainingLocation: string | null;
  geoQuery: string;
  geoProvisional: boolean;
}
interface SeedTeam {
  clubId: string;
  id: string;
  name: string;
  discipline: string;
  level: string | null;
  danceStyle?: string | null;
  tier: string;
  division: string;
  ageGroup: string;
  notes: string;
  status: string;
}
interface SeedSession {
  id: string;
  clubId: string;
  teamLabel: string | null;
  byday: string;
  startTime: string;
  endTime: string;
  locationText: string;
  notes: string | null;
  source: string;
}
interface SeedData {
  clubs: SeedClub[];
  teams: SeedTeam[];
  sessions: SeedSession[];
  openGyms: Record<string, unknown>[];
  events: Record<string, unknown>[];
}

// ---- validation (mirrors apply-sweep's rules) -------------------------------
const CLUB_TYPES = new Set(["club", "student", "school", "select_team"]);
const CHANNELS = new Set(["website", "facebook", "instagram", "none"]);
const DISCIPLINES = new Set(["cheer", "performance_cheer"]);
const LEVELS = new Set(["1", "2", "3", "4", "5", "6", "7"]);
const TIERS = new Set(["competition", "prep", "recreational"]);
const DIVISIONS = new Set(["all_girl", "coed", "all_boy"]);
const AGES = new Set(["mini", "peewee", "youth", "junior", "senior", "open"]);
const DAYS = new Set(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(d: SeedData): string[] {
  const errs: string[] = [];
  const clubIds = new Set(d.clubs.map((c) => c.id));
  for (const c of d.clubs) {
    if (!c.name || !c.slug || !c.city || !c.blurb)
      errs.push(`${c.id}: missing required club field`);
    if (c.country !== "BE") errs.push(`${c.id}: country must be BE`);
    if (!c.region) errs.push(`${c.id}: missing region`);
    if (!CLUB_TYPES.has(c.clubType))
      errs.push(`${c.id}: bad clubType ${c.clubType}`);
    if (!CHANNELS.has(c.primaryChannel))
      errs.push(`${c.id}: bad primaryChannel`);
    if (c.csnMember && c.bcfMember)
      errs.push(`${c.id}: csnMember and bcfMember are mutually exclusive`);
  }
  for (const t of d.teams) {
    if (!clubIds.has(t.clubId)) errs.push(`team ${t.id}: unknown clubId`);
    if (!DISCIPLINES.has(t.discipline))
      errs.push(`team ${t.id}: bad discipline`);
    if (t.level != null && !LEVELS.has(t.level))
      errs.push(`team ${t.id}: bad level`);
    if (t.discipline === "performance_cheer" && t.level != null)
      errs.push(`team ${t.id}: pom team must have level null`);
    if (!TIERS.has(t.tier)) errs.push(`team ${t.id}: bad tier`);
    if (!DIVISIONS.has(t.division)) errs.push(`team ${t.id}: bad division`);
    if (!AGES.has(t.ageGroup)) errs.push(`team ${t.id}: bad ageGroup`);
    if (!t.notes?.includes("Bron:"))
      errs.push(`team ${t.id}: missing provenance note`);
  }
  const seen = new Set<string>();
  for (const s of d.sessions) {
    if (!clubIds.has(s.clubId)) errs.push(`session ${s.id}: unknown clubId`);
    if (!DAYS.has(s.byday)) errs.push(`session ${s.id}: bad byday ${s.byday}`);
    if (!HHMM.test(s.startTime) || !HHMM.test(s.endTime))
      errs.push(`session ${s.id}: bad time`);
    if (s.startTime >= s.endTime) errs.push(`session ${s.id}: start >= end`);
    const key = `${s.clubId}|${s.byday}|${s.startTime}|${s.teamLabel}`;
    if (seen.has(key)) errs.push(`session ${s.id}: duplicate slot ${key}`);
    seen.add(key);
  }
  return errs;
}

// ---- geocoding --------------------------------------------------------------
type Geo = { lat: number; lng: number } | null;
function loadCache(): Record<string, Geo> {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}
async function geocode(
  query: string,
  cache: Record<string, Geo>,
): Promise<Geo> {
  if (query in cache) return cache[query];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "cheer-overview-seed/1.0 (open data seeding script)",
    },
  });
  const rows = (await res.json()) as { lat: string; lon: string }[];
  const hit = rows[0]
    ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) }
    : null;
  cache[query] = hit;
  mkdirSync("tmp/sweep/belgium", { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));
  await new Promise((r) => setTimeout(r, 1100));
  return hit;
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as SeedData;
  const errs = validate(data);
  if (errs.length) {
    console.error(`REFUSED — ${errs.length} validation error(s):`);
    for (const e of errs) console.error("  - " + e);
    process.exit(1);
  }
  console.log(
    `${APPLY ? "" : "[dry run] "}${data.clubs.length} clubs, ${data.teams.length} teams, ` +
      `${data.sessions.length} training slots, ${data.openGyms.length} open gym, ${data.events.length} events`,
  );

  // Geocode everything first (also in dry run, so the apply uses reviewed coords).
  const cache = loadCache();
  const coords = new Map<string, Geo>();
  for (const c of data.clubs) {
    let g = await geocode(c.geoQuery, cache);
    if (!g && c.geoQuery !== `${c.city}, Belgium`) {
      console.warn(
        `  geocode MISS "${c.geoQuery}" → falling back to city centroid`,
      );
      g = await geocode(`${c.city}, Belgium`, cache);
    }
    if (!g) console.warn(`  geocode MISS for ${c.id} — pin will be null`);
    coords.set(c.id, g);
    console.log(
      `  ${c.id.padEnd(36)} ${c.city.padEnd(22)} ${g ? `${g.lat.toFixed(4)},${g.lng.toFixed(4)}` : "NO PIN"}` +
        `${c.geoProvisional ? " (centroid/venue-name)" : ""}`,
    );
  }
  for (const og of data.openGyms) {
    coords.set(og.id as string, await geocode(og.geoQuery as string, cache));
  }

  console.log("\nTeams:");
  for (const t of data.teams)
    console.log(
      `  ${t.clubId.padEnd(36)} ${t.name.padEnd(28)} ${t.discipline} L${t.level ?? "-"} ${t.division} ${t.ageGroup} ${t.tier}`,
    );
  console.log(`\nSlots per club:`);
  const perClub = new Map<string, number>();
  for (const s of data.sessions)
    perClub.set(s.clubId, (perClub.get(s.clubId) ?? 0) + 1);
  for (const [k, v] of [...perClub].sort())
    console.log(`  ${k.padEnd(36)} ${v}`);

  if (!APPLY) {
    console.log(
      "\nDRY RUN — nothing written. Re-run with --apply after approval.",
    );
    return;
  }

  const { adminDb } = await import("../lib/firebaseAdmin");
  const { Timestamp, FieldValue } = await import("firebase-admin/firestore");
  const verified = Timestamp.fromDate(new Date("2026-11-16T12:00:00+01:00"));

  for (const c of data.clubs) {
    const g = coords.get(c.id) ?? null;
    await adminDb.doc(`clubs/${c.id}`).set(
      {
        name: c.name,
        slug: c.slug,
        websiteUrl: c.websiteUrl,
        city: c.city,
        address: c.address,
        country: "BE",
        region: c.region,
        lat: g?.lat ?? null,
        lng: g?.lng ?? null,
        instagramUrl: c.instagramUrl,
        tiktokUrl: c.tiktokUrl,
        facebookUrl: c.facebookUrl,
        youtubeUrl: null,
        logoUrl: null,
        blurb: c.blurb,
        foundedYear: c.foundedYear,
        primaryChannel: c.primaryChannel,
        clubType: c.clubType,
        status: "active",
        locked: true,
        csnMember: false,
        bcfMember: true,
        contactEmail: c.contactEmail,
        email: c.contactEmail,
        trainingLocation: c.trainingLocation,
        coaches: [],
        achievements: [],
        lastVerifiedAt: verified,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`wrote clubs/${c.id}`);
  }

  for (const t of data.teams) {
    await adminDb.doc(`clubs/${t.clubId}/teams/${t.id}`).set(
      {
        name: t.name,
        discipline: t.discipline,
        level: t.level,
        danceStyle: t.danceStyle ?? null,
        tier: t.tier,
        division: t.division,
        ageGroup: t.ageGroup,
        notes: t.notes,
        status: "active",
      },
      { merge: true },
    );
  }
  console.log(`wrote ${data.teams.length} team docs`);

  for (const s of data.sessions) {
    const g = coords.get(s.clubId) ?? null;
    await adminDb.doc(`open_gyms/${s.id}`).set(
      {
        clubId: s.clubId,
        dedupKey: s.id,
        sessionType: "training",
        teamLabel: s.teamLabel,
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${s.byday}`,
        exdates: [],
        startTime: s.startTime,
        endTime: s.endTime,
        tz: "Europe/Brussels",
        locationText: s.locationText,
        lat: g?.lat ?? null,
        lng: g?.lng ?? null,
        notes: s.notes,
        origin: "scrape",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        locked: true,
        validFrom: null,
        validUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  console.log(`wrote ${data.sessions.length} training slots`);

  for (const og of data.openGyms) {
    const g = coords.get(og.id as string) ?? null;
    await adminDb.doc(`open_gyms/${og.id}`).set(
      {
        clubId: null,
        dedupKey: og.id,
        sessionType: "open_gym",
        venueId: og.venueId,
        venueName: og.venueName,
        city: og.city,
        region: og.region,
        address: og.address,
        websiteUrl: og.websiteUrl,
        teamLabel: null,
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${og.byday}`,
        exdates: [],
        startTime: og.startTime,
        endTime: og.endTime,
        tz: "Europe/Brussels",
        locationText: `${og.venueName}`,
        lat: g?.lat ?? null,
        lng: g?.lng ?? null,
        notes: og.notes,
        price: og.price ?? null,
        priceNote: og.priceNote ?? null,
        origin: "scrape",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        locked: true,
        validFrom: Timestamp.fromDate(
          new Date(`${og.validFrom}T00:00:00+01:00`),
        ),
        validUntil: Timestamp.fromDate(
          new Date(`${og.validUntil}T23:59:00+01:00`),
        ),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`wrote open_gyms/${og.id}`);
  }

  for (const e of data.events) {
    const start = e.start as string;
    const end = (e.end as string) ?? start;
    await adminDb.doc(`events/${e.id}`).set(
      {
        canonicalEventId: e.id,
        clubId: null,
        title: e.title,
        description: e.description,
        type: e.type,
        allDay: true,
        startsAt: Timestamp.fromDate(new Date(`${start}T00:00:00+01:00`)),
        endsAt: Timestamp.fromDate(new Date(`${end}T23:59:00+01:00`)),
        locationText: e.locationText,
        city: e.city ?? null,
        region: e.region ?? null,
        lat: null,
        lng: null,
        url: e.url,
        ticketUrl: null,
        origin: "scrape",
        confidence: 1,
        extractorVersion: 1,
        status: "published",
        locked: true,
        sources: [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`wrote events/${e.id}`);
  }

  // Shape matches ChangelogEntryClient from PR #129 (/updates page).
  await adminDb.doc("changelog/2026-11-16-belgie-op-de-kaart").set(
    {
      date: verified,
      title: "België staat op de kaart",
      items: [
        "34 Belgische clubs toegevoegd — alle huidige BCF-leden, van Antwerpen tot Cerfontaine, inclusief de universiteitsteams.",
        "18 teams en 109 wekelijkse trainingen, rechtstreeks uit clubwebsites, Instagram en federatie-uitslagen.",
        "De open cheer-sessie van KU Leuven Sport (donderdagavond, Sportcampus Arenberg) staat als open gym op de kaart.",
        "De BCF-kalender is toegevoegd, met onder meer het BK 2027 op 22–23 mei in Leuven.",
        "Clubs tonen nu ook een BCF-lidbadge en de kaart opent op de hele Benelux.",
      ],
      kind: "data",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log("wrote changelog entry\nDone.");
}

main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
