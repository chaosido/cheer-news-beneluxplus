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
import { getClubs, getPublishedEvents, getPublishedOpenGyms } from "@/lib/queries";
import { expandOpenGym } from "@/lib/recurrence";
import { EVENT_TYPE_LABEL } from "@/lib/eventColors";
import type { ClubClient } from "@/lib/types";
import { HomeView } from "@/components/HomeView";
import type { CalendarItem, MapClub } from "@/components/home/types";

// Read at request time; the dashboard is data-driven, not statically cacheable.
export const dynamic = "force-dynamic";

/** Window for open-gym expansion: now → +90 days. */
const HORIZON_DAYS = 90;

function clubProfileUrl(slug: string): string {
  return `/clubs/${slug}`;
}

export default async function Home() {
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  let clubs: ClubClient[] = [];
  let items: CalendarItem[] = [];

  try {
    const [clubList, events, gyms] = await Promise.all([
      getClubs(),
      getPublishedEvents({ from: now }),
      getPublishedOpenGyms(),
    ]);
    clubs = clubList;

    const clubsById = new Map(clubList.map((c) => [c.id, c]));

    // One-off events → CalendarItem.
    const eventItems: CalendarItem[] = events.map((e) => {
      const club = e.clubId ? clubsById.get(e.clubId) : undefined;
      return {
        id: `event:${e.id}`,
        clubId: e.clubId,
        title: e.title,
        type: e.type,
        allDay: e.allDay ?? false,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        url: e.url ?? (club ? clubProfileUrl(club.slug) : null),
        locationText: e.locationText ?? club?.city ?? null,
        city: club?.city ?? null,
        isOpenGym: false,
      };
    });

    // Open gyms → expanded occurrences → CalendarItem.
    const gymItems: CalendarItem[] = gyms.flatMap((gym) => {
      const club = clubsById.get(gym.clubId);
      const occurrences = expandOpenGym(gym, now, horizon);
      return occurrences.map((occ, i) => ({
        id: `gym:${gym.id}:${i}`,
        clubId: gym.clubId,
        title: club ? `Open gym · ${club.name}` : EVENT_TYPE_LABEL.open_gym,
        type: "open_gym" as const,
        allDay: false,
        startsAt: occ.startsAt,
        endsAt: occ.endsAt,
        url: club ? clubProfileUrl(club.slug) : null,
        locationText: occ.locationText ?? club?.city ?? null,
        city: club?.city ?? null,
        isOpenGym: true,
      }));
    });

    items = [...eventItems, ...gymItems].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
  } catch (err) {
    // Missing credentials / empty Firestore in dev — degrade to empty state.
    console.error("[home] data load failed, rendering empty state:", err);
    clubs = [];
    items = [];
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
      lat: c.lat,
      lng: c.lng,
      websiteUrl: c.websiteUrl,
      instagramUrl: c.instagramUrl,
      facebookUrl: c.facebookUrl,
      tiktokUrl: c.tiktokUrl,
    }));

  return <HomeView clubs={mapClubs} items={items} />;
}
