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
  /** Owning club, if known (events and venue open gyms may have none). */
  clubId: string | null;
  /** Owning venue, for club-independent open gyms (else null). */
  venueId: string | null;
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
  /** City derived from the owning club (used for the agenda line). */
  city: string | null;
  /** Province derived from the owning club (used by the province filter). */
  province: string | null;
  /** True for open-gym occurrences (drives the "Alleen open gyms" toggle). */
  isOpenGym: boolean;
}

/** One weekly open-gym slot shown in a venue's map popup. */
export interface VenueSlot {
  /** 0 = Monday .. 6 = Sunday (for sorting). */
  weekdayIndex: number;
  /** Dutch weekday name, e.g. "Maandag". */
  weekday: string;
  /** Local "HH:mm". */
  startTime: string;
  endTime: string;
}

/**
 * A club-independent open-gym venue (turn hall) rendered as its own map pin.
 * One venue groups all of its weekly slots (`sessions`), so a hall open on
 * Monday and Thursday is a single pin listing both.
 */
export interface MapVenue {
  id: string;
  name: string;
  city: string;
  region: string | null;
  address: string | null;
  websiteUrl: string | null;
  lat: number;
  lng: number;
  sessions: VenueSlot[];
}

/**
 * A located event rendered as its own map pin (colored by event type). Its `id`
 * matches the corresponding `CalendarItem.id` (`event:{id}`) so HomeView can
 * show/hide pins in lock-step with the filtered agenda.
 */
export interface MapEvent {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  locationText: string | null;
  region: string | null;
  url: string | null;
  lat: number;
  lng: number;
}

/**
 * A visiting (touring) coach rendered as its own map pin. Self-contained popup
 * with their stay dates and contact handles; not part of the agenda.
 */
export interface MapCoach {
  id: string;
  name: string;
  role: string | null;
  city: string;
  region: string | null;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  phone: string | null;
}

/** Minimal club shape the map + popups need (subset of ClubClient). */
export interface MapClub {
  id: string;
  name: string;
  slug: string;
  city: string;
  region: string | null;
  lat: number;
  lng: number;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  /** True if the club is a Cheersport Nederland (CSN) member. */
  csnMember: boolean;
}

export interface HomeFilters {
  /** Selected event types; empty set = all types. */
  types: Set<EventType>;
  /** Selected province; null = all provinces. */
  province: string | null;
  /** ISO date (yyyy-MM-dd) inclusive lower bound, or null. */
  from: string | null;
  /** ISO date (yyyy-MM-dd) inclusive upper bound, or null. */
  to: string | null;
  /**
   * CSN-member base view (default `true`): show only CSN-member clubs and their
   * events. Open gyms / turn-hall venues are unaffected. Set `false` to show all.
   */
  membersOnly: boolean;
}
