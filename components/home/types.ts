import type { EventType } from "@/lib/types";

/**
 * A unified calendar/agenda item merged from two server sources:
 *  - published one-off `events`
 *  - expanded open-gym occurrences
 *
 * Both reduce to the same client shape so the Calendar and Filters can treat
 * them uniformly. All instants are ISO-8601 strings (serializable).
 */
export interface CalendarItem {
  /** Stable id, unique across both sources. */
  id: string;
  /** Owning club, if known (open gyms always have one; events may not). */
  clubId: string | null;
  title: string;
  type: EventType;
  /** All-day (date-only) event — renders as a date block, not a timed slot. */
  allDay: boolean;
  startsAt: string;
  endsAt: string | null;
  /** Click target: event url, else the club profile, else null. */
  url: string | null;
  /** Free-text location for the agenda line. */
  locationText: string | null;
  /** City derived from the owning club (used by the city filter). */
  city: string | null;
  /** True for open-gym occurrences (drives the "Alleen open gyms" toggle). */
  isOpenGym: boolean;
}

/** Minimal club shape the map + popups need (subset of ClubClient). */
export interface MapClub {
  id: string;
  name: string;
  slug: string;
  city: string;
  lat: number;
  lng: number;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
}

export interface HomeFilters {
  /** Selected event types; empty set = all types. */
  types: Set<EventType>;
  /** Selected city; null = all cities. */
  city: string | null;
  /** ISO date (yyyy-MM-dd) inclusive lower bound, or null. */
  from: string | null;
  /** ISO date (yyyy-MM-dd) inclusive upper bound, or null. */
  to: string | null;
  /** Only show open-gym occurrences. */
  openGymsOnly: boolean;
}
