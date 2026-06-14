/**
 * Apply the one-time web-verified enrichment pass to Firestore.
 *
 * Reads data/clubs.enriched.json (output of the verify-enrich-clubs workflow):
 *   - verified=false  -> prune the club (+ its teams/sources/events)
 *   - verified=true   -> publish enriched profile (blurb, logo, coords, socials,
 *                        teams), publish recurring open gyms, queue one-off
 *                        events as `pending` for /admin review.
 *
 * Idempotent: deterministic doc ids; re-running overwrites. Run with:
 *   npx tsx --env-file=.env.local scripts/enrich.ts
 * See scripts/seed.ts for the `server-only` re-exec rationale.
 */
import { spawnSync } from "node:child_process";
const RS = "--conditions=react-server";
if (!process.execArgv.includes(RS)) {
  const r = spawnSync(process.argv[0], [...process.execArgv, RS, ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "../lib/utils";
import { safeUrl } from "../lib/safeUrl";
import { EXTRACTOR_VERSION, type EventType, type Level, type Division, type AgeGroup } from "../lib/types";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(here, "../data/clubs.enriched.json"), "utf8")) as EnrichedClub[];

interface EnrichedClub {
  name: string; city: string; verified: boolean; verifyConfidence: number; verifyNote: string;
  websiteUrl?: string; instagramUrl?: string; facebookUrl?: string; tiktokUrl?: string; logoUrl?: string;
  blurb?: string; foundedYear?: string; lat?: number; lng?: number;
  teams?: { level: string; division: string; ageGroup: string }[];
  events?: { title: string; type: string; start: string; end?: string; locationText?: string; url?: string; description?: string }[];
  openGyms?: { weekday: string; startTime: string; endTime: string; notes?: string }[];
}

const BYDAY: Record<string, string> = {
  monday: "MO", tuesday: "TU", wednesday: "WE", thursday: "TH", friday: "FR", saturday: "SA", sunday: "SU",
};
const EVENT_TYPES = new Set<EventType>(["competition", "open_gym", "clinic", "tryout", "showcase", "training", "other"]);
const LEVELS = new Set(["1", "2", "3", "4", "5", "6", "elite", "prep", "recreational"]);
const DIVISIONS = new Set(["all_girl", "coed", "all_boy"]);
const AGES = new Set(["mini", "youth", "junior", "senior", "open"]);

const nz = (s?: string) => (s && s.trim() ? s.trim() : null);

const TZ = "Europe/Amsterdam";
/** An enriched event is all-day when it has no end and starts at local midnight. */
async function isAllDay(start: Date, hasEnd: boolean): Promise<boolean> {
  if (hasEnd) return false;
  const { formatInTimeZone } = await import("date-fns-tz");
  return formatInTimeZone(start, TZ, "HH:mm") === "00:00";
}

async function main() {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { FieldValue, Timestamp } = await import("firebase-admin/firestore");

  let pruned = 0, updated = 0, teamsW = 0, gymsW = 0, eventsW = 0;

  for (const c of data) {
    const slug = slugify(c.name);
    const clubRef = adminDb.collection("clubs").doc(slug);

    if (!c.verified) {
      // Prune the fake/non-club: club doc, its teams subcollection, its sources, its events.
      const teams = await clubRef.collection("teams").get();
      await Promise.all(teams.docs.map((d) => d.ref.delete()));
      const srcs = await adminDb.collection("sources").where("club_id", "==", slug).get();
      await Promise.all(srcs.docs.map((d) => d.ref.delete()));
      const evs = await adminDb.collection("events").where("clubId", "==", slug).get();
      await Promise.all(evs.docs.map((d) => d.ref.delete()));
      await clubRef.delete();
      pruned++;
      console.log(`[prune] ${c.name} — ${c.verifyNote.slice(0, 80)}`);
      continue;
    }

    // Normalize teams.
    const teams = (c.teams ?? []).filter(
      (t) => LEVELS.has(t.level) && DIVISIONS.has(t.division) && AGES.has(t.ageGroup),
    );
    const teamsSummary = teams.map((t) => ({ level: t.level as Level, division: t.division as Division, ageGroup: t.ageGroup as AgeGroup }));

    // Update club profile (merge; never clobber locked docs).
    const existing = await clubRef.get();
    if (existing.exists && existing.data()?.locked === true) {
      console.log(`[skip-locked] ${c.name}`);
    } else {
      const founded = c.foundedYear && /^\d{4}$/.test(c.foundedYear) ? Number(c.foundedYear) : null;
      await clubRef.set(
        {
          name: c.name,
          slug,
          city: c.city,
          country: "NL",
          status: "active",
          locked: false,
          blurb: nz(c.blurb),
          logoUrl: safeUrl(c.logoUrl),
          foundedYear: founded,
          lat: typeof c.lat === "number" ? c.lat : null,
          lng: typeof c.lng === "number" ? c.lng : null,
          websiteUrl: safeUrl(c.websiteUrl),
          instagramUrl: safeUrl(c.instagramUrl),
          facebookUrl: safeUrl(c.facebookUrl),
          tiktokUrl: safeUrl(c.tiktokUrl),
          teamsSummary,
          lastVerifiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      updated++;
    }

    // Teams subcollection (rewrite).
    const old = await clubRef.collection("teams").get();
    await Promise.all(old.docs.map((d) => d.ref.delete()));
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      await clubRef.collection("teams").doc(`${t.level}-${t.division}-${t.ageGroup}-${i}`).set({
        name: `${t.division} ${t.ageGroup} L${t.level}`,
        level: t.level, division: t.division, ageGroup: t.ageGroup, status: "active",
      });
      teamsW++;
    }

    // Open gyms -> published recurring docs.
    const gyms = c.openGyms ?? [];
    for (let i = 0; i < gyms.length; i++) {
      const g = gyms[i];
      const day = BYDAY[g.weekday?.toLowerCase()];
      if (!day || !/^\d{1,2}:\d{2}$/.test(g.startTime) || !/^\d{1,2}:\d{2}$/.test(g.endTime)) continue;
      await adminDb.collection("open_gyms").doc(`${slug}-og-${i}`).set({
        clubId: slug,
        dedupKey: `${slug}-${day}-${g.startTime}`,
        rrule: `FREQ=WEEKLY;BYDAY=${day}`,
        exdates: [],
        startTime: g.startTime, endTime: g.endTime, tz: "Europe/Amsterdam",
        validFrom: null, validUntil: null,
        locationText: nz(g.notes), lat: typeof c.lat === "number" ? c.lat : null, lng: typeof c.lng === "number" ? c.lng : null,
        notes: nz(g.notes), origin: "scrape", confidence: 0.9, extractorVersion: EXTRACTOR_VERSION,
        status: "published", locked: false, updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      gymsW++;
    }

    // One-off events -> pending (review queue).
    const events = c.events ?? [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const start = new Date(e.start);
      if (isNaN(start.getTime())) continue;
      const type = (EVENT_TYPES.has(e.type as EventType) ? e.type : "other") as EventType;
      const id = `${slug}-ev-${i}`;
      const hasEnd = Boolean(e.end && !isNaN(new Date(e.end).getTime()));
      await adminDb.collection("events").doc(id).set({
        canonicalEventId: id, clubId: slug, title: e.title, description: nz(e.description), type,
        allDay: await isAllDay(start, hasEnd),
        startsAt: Timestamp.fromDate(start),
        endsAt: e.end && !isNaN(new Date(e.end).getTime()) ? Timestamp.fromDate(new Date(e.end)) : null,
        locationText: nz(e.locationText), lat: typeof c.lat === "number" ? c.lat : null, lng: typeof c.lng === "number" ? c.lng : null,
        url: safeUrl(e.url), ticketUrl: null, origin: "scrape", confidence: 0.8, extractorVersion: EXTRACTOR_VERSION,
        status: "pending", locked: false, sources: [], updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      eventsW++;
    }
  }

  console.log(`\n[enrich] done: pruned=${pruned} clubsUpdated=${updated} teams=${teamsW} openGyms=${gymsW} pendingEvents=${eventsW}`);
}

main().catch((e) => { console.error("[enrich] fatal:", e); process.exit(1); });
