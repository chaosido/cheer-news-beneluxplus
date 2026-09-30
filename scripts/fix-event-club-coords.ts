/**
 * Align club-hosted events with their club's coordinates.
 *
 * An event held at its club should point at the club's pin (see lib/anchors.ts).
 * That decision is made by comparing coordinates, so an event carrying a CITY
 * CENTROID instead of the club's address reads as "somewhere else in town" and
 * earns a stray pin — which is exactly the DANSJA "open lesweken" pin that
 * surfaced beneath the cluster marker.
 *
 * Widening the distance threshold cannot fix this: a centroid can sit ~6 km from
 * a club in the same city, while two genuinely different halls are often ~2 km
 * apart. So the imprecise data is corrected instead, which is where the problem
 * actually is.
 *
 * ONLY touches events whose locationText names the club's own venue, so a
 * genuine off-site event is never dragged back to the club.
 *
 *   npx tsx --env-file=.env.local scripts/fix-event-club-coords.ts [--apply]
 */
import { spawnSync } from "node:child_process";

const C = "--conditions=react-server";
if (!process.execArgv.includes(C)) {
  process.exit(
    spawnSync(
      process.argv[0],
      [...process.execArgv, C, ...process.argv.slice(1)],
      {
        stdio: "inherit",
      },
    ).status ?? 1,
  );
}

const APPLY = process.argv.includes("--apply");
const SAME_SPOT_METERS = 150;

function meters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const [events, clubs] = await Promise.all([
    adminDb.collection("events").get(),
    adminDb.collection("clubs").get(),
  ]);
  const byId = new Map(clubs.docs.map((d) => [d.id, d.data()]));
  const now = new Date();

  console.log(
    `${APPLY ? "" : "[dry run] "}club-hosted future events whose coords differ from their club:\n`,
  );
  let realigned = 0;
  let left = 0;
  for (const d of events.docs) {
    const e = d.data();
    if (!e.clubId || e.lat == null || e.lng == null) continue;
    // Finished events are left alone — nothing renders them. Judged on the END,
    // not the start: an event that began days ago may still be running, and it
    // is precisely those long multi-day blocks whose stray pin is most visible.
    const ends = e.endsAt?.toDate?.() ?? e.startsAt?.toDate?.() ?? new Date(0);
    if (ends < now) continue;
    const c = byId.get(e.clubId);
    if (!c || c.lat == null || c.lng == null) continue;
    const dist = meters(e.lat, e.lng, c.lat, c.lng);
    if (dist <= SAME_SPOT_METERS) continue;

    // Does the event claim to be at the club's own venue?
    //
    // Compared on POSTCODE, not on the first comma-segment: that segment is
    // often a venue name rather than a street ("Dansschool DANSJA, Linnaeusweg
    // 25, …" vs the event's "DANSJA, Linnaeusweg 25, …"), so name-matching
    // missed a genuine same-address pair. A Dutch postcode identifies a specific
    // building, which is exactly the question being asked. Falls back to
    // street+number when no postcode is present on both sides.
    const POSTCODE = /\b(\d{4})\s?([a-z]{2})\b/;
    const STREET_NR =
      /\b([a-z]+(?:straat|weg|laan|plein|kade|dijk|pad|singel))\s+(\d+)/;
    const venue = String(c.trainingLocation ?? c.address ?? "").toLowerCase();
    const loc = String(e.locationText ?? "").toLowerCase();

    const clubPc = venue.match(POSTCODE);
    const evPc = loc.match(POSTCODE);
    const clubSt = venue.match(STREET_NR);
    const evSt = loc.match(STREET_NR);

    const atClubVenue = Boolean(
      (clubPc && evPc && clubPc[1] === evPc[1] && clubPc[2] === evPc[2]) ||
      (clubSt && evSt && clubSt[1] === evSt[1] && clubSt[2] === evSt[2]),
    );

    console.log(`  ${d.id}`);
    console.log(`     ${Math.round(dist)}m from ${c.name}`);
    console.log(`     event loc: "${e.locationText}"`);
    console.log(`     club  loc: "${c.trainingLocation ?? c.address}"`);
    console.log(
      `     -> ${atClubVenue ? "SAME VENUE: adopt the club's coords" : "different venue: LEAVE IT (keeps its own pin)"}`,
    );
    if (!atClubVenue) {
      left++;
      continue;
    }
    realigned++;
    if (!APPLY) continue;
    await d.ref.update({
      lat: c.lat,
      lng: c.lng,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  console.log(
    APPLY
      ? `\nDone. ${realigned} realigned, ${left} left as genuinely off-site.`
      : `\nDRY RUN — nothing written. ${realigned} would be realigned, ${left} left alone.`,
  );
}

main().catch((err) => {
  console.error("Failed to align event coords:", String(err).slice(0, 300));
  process.exit(1);
});
