/**
 * Front page — map + calendar split-view (Server Component).
 *
 * Fetches clubs, published one-off events, and published open gyms, expands the
 * open gyms into concrete occurrences over a ~90-day window, and merges events +
 * occurrences into a single `CalendarItem[]`. Everything serializable is handed
 * to the `HomeView` client component which owns interaction state.
 *
 * Firestore may be empty or unreachable in dev; all reads are wrapped so the
 * page renders an intentional empty state instead of crashing.
 */
import {
  getClubs,
  getPublishedEvents,
  getPublishedOpenGyms,
  getPublishedVisitingCoaches,
} from "@/lib/queries";
import { expandOpenGym, weeklySlots } from "@/lib/recurrence";
import { getDictionary } from "@/lib/i18n/server";
import type { ClubClient } from "@/lib/types";
import { HomeView } from "@/components/HomeView";
import type {
  CalendarItem,
  MapClub,
  MapVenue,
  MapEvent,
  MapCoach,
} from "@/components/home/types";

// Read at request time; the dashboard is data-driven, not statically cacheable.
export const dynamic = "force-dynamic";

/** Window for open-gym expansion: now → +90 days. */
const HORIZON_DAYS = 90;

function clubProfileUrl(slug: string): string {
  return `/clubs/${slug}`;
}

export default async function Home() {
  const t = await getDictionary();
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  let clubs: ClubClient[] = [];
  let items: CalendarItem[] = [];
  let venues: MapVenue[] = [];
  let mapEvents: MapEvent[] = [];
  let mapCoaches: MapCoach[] = [];

  try {
    const [clubList, events, gyms, coaches] = await Promise.all([
      getClubs(),
      getPublishedEvents({ from: now }),
      getPublishedOpenGyms(),
      getPublishedVisitingCoaches(),
    ]);
    clubs = clubList;

    const clubsById = new Map(clubList.map((c) => [c.id, c]));

    // One-off events → CalendarItem.
    const eventItems: CalendarItem[] = events.map((e) => {
      const club = e.clubId ? clubsById.get(e.clubId) : undefined;
      return {
        id: `event:${e.id}`,
        clubId: e.clubId,
        venueId: null,
        title: e.title,
        type: e.type,
        allDay: e.allDay ?? false,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        url: e.url ?? (club ? clubProfileUrl(club.slug) : null),
        locationText: e.locationText ?? club?.city ?? e.city ?? null,
        city: club?.city ?? e.city ?? null,
        province: club?.region ?? e.region ?? null,
        isOpenGym: false,
      };
    });

    // Located events → hover-reveal map pins. The map shows NO persistent event
    // pins (they cluttered the map — e.g. a club's off-site showcase sitting as
    // its own diamond). Instead, every located event is a *candidate* pin keyed
    // by the same `event:{id}` id as its CalendarItem; the pin only appears when
    // its agenda row is hovered (see HomeView `hoveredItemId` → Map
    // `activeEventId`). Club-hosted and independent events alike are included so
    // hovering any event row reveals where it actually is.
    mapEvents = events
      .filter(
        (e): e is typeof e & { lat: number; lng: number } =>
          e.lat != null && e.lng != null,
      )
      .map((e) => {
        const club = e.clubId ? clubsById.get(e.clubId) : undefined;
        return {
          id: `event:${e.id}`,
          title: e.title,
          type: e.type,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          allDay: e.allDay ?? false,
          locationText: e.locationText ?? club?.city ?? e.city ?? null,
          region: club?.region ?? e.region ?? null,
          url: e.url ?? (club ? clubProfileUrl(club.slug) : null),
          lat: e.lat,
          lng: e.lng,
        };
      });

    // Open gyms → expanded occurrences → CalendarItem. The open_gyms collection
    // also holds team trainings (sessionType === "training"); those belong only
    // on club pages, never on the public agenda, so filter them out here.
    //
    // An open gym is either club-owned (clubId set → derive venue from the club)
    // or venue-hosted (clubId null → self-describing venueName/city/region).
    const publicGyms = gyms.filter((gym) => gym.sessionType !== "training");

    const gymItems: CalendarItem[] = publicGyms.flatMap((gym) => {
      const club = gym.clubId ? clubsById.get(gym.clubId) : undefined;
      const venueName = club?.name ?? gym.venueName ?? null;
      const occurrences = expandOpenGym(gym, now, horizon);
      return occurrences.map((occ, i) => ({
        id: `gym:${gym.id}:${i}`,
        clubId: gym.clubId,
        // Must match the MapVenue id below (`venue:${vid}`) so clicking this row
        // can find and reveal the venue's pin — same prefix on both sides.
        venueId: gym.clubId ? null : `venue:${gym.venueId ?? gym.id}`,
        title: venueName
          ? `Open gym · ${venueName}`
          : t.eventType.open_gym,
        type: "open_gym" as const,
        allDay: false,
        startsAt: occ.startsAt,
        endsAt: occ.endsAt,
        url: club ? clubProfileUrl(club.slug) : (gym.websiteUrl ?? null),
        locationText: occ.locationText ?? club?.city ?? gym.city ?? null,
        city: club?.city ?? gym.city ?? null,
        province: club?.region ?? gym.region ?? null,
        isOpenGym: true,
      }));
    });

    // Club-independent gyms with coordinates → grouped into venue map pins. One
    // venue may have several weekly docs (Mon + Thu); group them by venueId so
    // the hall is a single pin listing every slot.
    const venuesById = new Map<string, MapVenue>();
    for (const gym of publicGyms) {
      if (gym.clubId) continue; // club gyms already render as club pins
      if (gym.lat == null || gym.lng == null) continue;
      const vid = gym.venueId ?? gym.id;
      let venue = venuesById.get(vid);
      if (!venue) {
        venue = {
          id: `venue:${vid}`,
          name: gym.venueName ?? t.eventType.open_gym,
          city: gym.city ?? "",
          region: gym.region ?? null,
          address: gym.address ?? null,
          websiteUrl: gym.websiteUrl ?? null,
          lat: gym.lat,
          lng: gym.lng,
          sessions: [],
        };
        venuesById.set(vid, venue);
      }
      for (const slot of weeklySlots(gym)) {
        venue.sessions.push({
          weekdayIndex: slot.weekdayIndex,
          weekday: slot.weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }
    venues = [...venuesById.values()].map((v) => ({
      ...v,
      sessions: v.sessions.sort(
        (a, b) =>
          a.weekdayIndex - b.weekdayIndex ||
          a.startTime.localeCompare(b.startTime),
      ),
    }));

    // Visiting coaches with coordinates → map pins. Coaches without coords still
    // show on /coaches; they just get no pin.
    mapCoaches = coaches
      .filter(
        (c): c is typeof c & { lat: number; lng: number } =>
          c.lat != null && c.lng != null,
      )
      .map((c) => ({
        id: `coach:${c.id}`,
        name: c.name,
        role: c.role,
        city: c.city,
        region: c.region,
        lat: c.lat,
        lng: c.lng,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        instagramUrl: c.instagramUrl,
        tiktokUrl: c.tiktokUrl,
        facebookUrl: c.facebookUrl,
        websiteUrl: c.websiteUrl,
        contactEmail: c.contactEmail,
        phone: c.phone,
      }));

    items = [...eventItems, ...gymItems].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
  } catch (err) {
    // Missing credentials / empty Firestore in dev — degrade to empty state.
    console.error("[home] data load failed, rendering empty state:", err);
    clubs = [];
    items = [];
    venues = [];
    mapEvents = [];
    mapCoaches = [];
  }

  // Clubs with a usable location become map pins.
  const mapClubs: MapClub[] = clubs
    .filter(
      (c): c is ClubClient & { lat: number; lng: number } =>
        c.lat != null && c.lng != null,
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      region: c.region,
      lat: c.lat,
      lng: c.lng,
      websiteUrl: c.websiteUrl,
      instagramUrl: c.instagramUrl,
      facebookUrl: c.facebookUrl,
      tiktokUrl: c.tiktokUrl,
      csnMember: c.csnMember ?? false,
    }));

  return (
    <HomeView
      clubs={mapClubs}
      venues={venues}
      events={mapEvents}
      coaches={mapCoaches}
      items={items}
    />
  );
}
