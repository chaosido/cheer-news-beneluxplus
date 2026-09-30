/**
 * Deciding which map pin a happening points at.
 *
 * Lives in lib/ rather than inside app/page.tsx so it can be tested directly —
 * the previous version of this rule was only ever asserted against a copy of
 * itself pasted into the test file, which could not fail when the real code
 * changed.
 *
 * See components/home/types.ts for what an Anchor is and the rule it encodes.
 */
import type { Anchor } from "@/components/home/types";

/**
 * How far apart two coordinates may be and still count as the same spot.
 *
 * Only absorbs rounding and geocoder jitter, NOT "same city": a city centroid
 * can sit kilometres from an address inside it (Utrecht's centroid is ~6 km from
 * one of its own clubs), while two genuinely different halls in one town can be
 * ~2 km apart. No threshold separates those, so this one does not try — it is
 * deliberately tight, and anything beyond it is treated as a different place.
 */
export const SAME_SPOT_METERS = 150;

/** Great-circle distance in metres. */
export function metersBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Which pin an event points at.
 *
 * Held at its club, or carrying no coordinates of its own → the club's pin, so
 * it behaves exactly like an open gym at that club. Held anywhere else → its own
 * pin, which is the case the reveal mechanism exists for: a club's off-site
 * showcase belongs where it happens, not at home. No club and no coordinates →
 * nothing to point at, and the row is not interactive.
 */
export function anchorForEvent(
  e: {
    id: string;
    clubId: string | null;
    lat: number | null;
    lng: number | null;
  },
  club: { lat: number | null; lng: number | null } | undefined,
): Anchor | null {
  if (e.clubId) {
    const atClub =
      e.lat == null ||
      e.lng == null ||
      club?.lat == null ||
      club?.lng == null ||
      metersBetween(e.lat, e.lng, club.lat, club.lng) <= SAME_SPOT_METERS;
    if (atClub) return { kind: "club", id: e.clubId };
  }
  if (e.lat == null || e.lng == null) return null;
  return { kind: "event", id: `event:${e.id}` };
}

/** Which pin an open-gym occurrence points at. */
export function anchorForGym(gym: {
  clubId: string | null;
  venueAnchorId: string;
  lat: number | null;
  lng: number | null;
}): Anchor | null {
  if (gym.clubId) return { kind: "club", id: gym.clubId };
  if (gym.lat == null || gym.lng == null) return null;
  return { kind: "venue", id: gym.venueAnchorId };
}
