import type { EventType } from "@/lib/types";

/**
 * What a map pin represents, and therefore what an agenda row points at.
 *
 * THE RULE THE MAP OBEYS: a pin is a PLACE; an agenda row is a DATED HAPPENING.
 * A happening does not get a pin of its own — it points at the pin of the place
 * hosting it, and only conjures one when no such place exists.
 *
 *  - `club`  — hosted at a club that already has a persistent pin.
 *  - `venue` — hosted at a club-independent open-gym venue (also persistent).
 *  - `event` — happening somewhere with no pin of its own; the map materialises
 *              one on hover/selection and drops it again afterwards.
 *
 * A row with no anchor (`null`) is not locatable at all: it still appears in the
 * agenda, but it cannot be hovered onto the map or clicked to zoom.
 *
 * Anchors are computed ONCE on the server (app/page.tsx) so the map and the
 * agenda cannot disagree about what a row points at.
 */
export type AnchorKind = "club" | "venue" | "event";

export interface Anchor {
  kind: AnchorKind;
  /** Entity id within its kind — a club id, a `venue:` id, or an `event:` id. */
  id: string;
}

/** True when two anchors denote the same pin. Either side may be absent. */
export function sameAnchor(a: Anchor | null, b: Anchor | null): boolean {
  return a != null && b != null && a.kind === b.kind && a.id === b.id;
}

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
  /**
   * The pin this row points at, or null when it has no location at all.
   * Replaces the old habit of inferring it from `clubId`/`venueId` at each call
   * site, which let the map and the agenda reach different conclusions.
   */
  anchor: Anchor | null;
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
 * An event with no hosting place of its own, rendered as a map pin coloured by
 * event type. Present only for events whose `CalendarItem.anchor` is
 * `{ kind: "event" }`; its `id` equals that anchor's id. The pin is NOT
 * persistent — the map materialises it while its row is hovered or selected.
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
 * A visiting (touring) coach rendered as a PERSISTENT map pin, with a
 * self-contained popup carrying their stay dates and contact handles.
 *
 * Coaches have no agenda rows — they are a presence over a date range, not a
 * dated happening — so they cannot be anchors. They were briefly given the
 * reveal-by-hover treatment used for events, which made them permanently
 * invisible: no agenda row could ever carry their id to reveal them.
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
