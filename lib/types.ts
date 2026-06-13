/**
 * Shared domain types for Cheer News BeneluxPlus.
 *
 * Two layers:
 *  - Firestore document shapes use Firestore `Timestamp` for instants.
 *  - Client/SSR-serialized shapes use ISO-8601 strings (Timestamps are not
 *    serializable across the server→client boundary). Query helpers in
 *    `lib/queries.ts` convert documents to the `*Client` shapes.
 *
 * Field naming is camelCase throughout the codebase.
 */

// ---- Enums / unions ----

export type ClubType = "club" | "student" | "school" | "select_team";
export type PrimaryChannel = "website" | "facebook" | "instagram" | "none";
export type Level = "1" | "2" | "3" | "4" | "5" | "6" | "elite" | "prep" | "recreational";
export type Division = "all_girl" | "coed" | "all_boy";
export type AgeGroup = "mini" | "youth" | "junior" | "senior" | "open";
export type EventType =
  | "competition"
  | "open_gym"
  | "clinic"
  | "tryout"
  | "showcase"
  | "training"
  | "other";
export type PublishStatus = "published" | "pending" | "rejected";
export type Origin = "scrape" | "submission";
export type SourceTier = "federation" | "structured" | "club";
export type SourceType = "events" | "gyms" | "general" | "federation";
export type FetchStrategy = "http" | "playwright";
export type ExtractionMethod = "json-ld" | "llm";
export type SubmissionKind = "event" | "gym" | "club" | "correction";

/** Current extraction prompt/schema version. Bump to force re-extraction past the diff gate. */
export const EXTRACTOR_VERSION = 1;

// ---- Geo ----

export interface GeoPoint {
  lat: number | null;
  lng: number | null;
}

// ---- Teams ----

export interface Team {
  id: string;
  name: string;
  level: Level;
  division: Division;
  ageGroup: AgeGroup;
  notes?: string;
  status: "active" | "inactive";
}

/** Compact team descriptor denormalized onto the club doc for fast guide rendering. */
export interface TeamSummary {
  level: Level;
  division: Division;
  ageGroup: AgeGroup;
}

/** A coach/trainer at a club. */
export interface Coach {
  name: string;
  role: string | null; // e.g. "Head Coach", "Tumbling Coach"
}

// ---- Clubs ----

export interface ClubBase {
  name: string;
  slug: string;
  websiteUrl: string | null;
  city: string;
  address: string | null;
  country: string; // ISO-3166-1 alpha-2, e.g. "NL"
  region: string | null;
  lat: number | null;
  lng: number | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  logoUrl: string | null;
  blurb: string | null;
  foundedYear: number | null;
  primaryChannel: PrimaryChannel;
  clubType: ClubType;
  status: "active" | "inactive";
  locked: boolean;
  teamsSummary: TeamSummary[];
  // Richer profile fields (populated by the deep-research pass; optional so
  // existing docs without them stay valid — consumers default to [] / null).
  coaches?: Coach[];
  contactEmail?: string | null;
  trainingLocation?: string | null; // venue name/address where the club trains
  achievements?: string[]; // notable results, e.g. "NK 2024 — 1st place Senior Coed"
  youtubeUrl?: string | null;
  email?: string | null;
}

export interface ClubClient extends ClubBase {
  id: string;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

// ---- Events ----

/** Per-source provenance + miss tracking embedded on an event. */
export interface EventSourceRef {
  sourceId: string;
  sourceUrl: string;
  lastSeenAt: string;
  consecutiveMisses: number;
}

export interface EventBase {
  canonicalEventId: string;
  clubId: string | null;
  title: string;
  description: string | null;
  type: EventType;
  allDay: boolean;
  locationText: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  ticketUrl: string | null;
  origin: Origin;
  confidence: number;
  extractorVersion: number;
  status: PublishStatus;
  locked: boolean;
}

export interface EventClient extends EventBase {
  id: string;
  startsAt: string; // ISO-8601 with offset
  endsAt: string | null;
  sources: EventSourceRef[];
  updatedAt: string;
}

// ---- Open gyms (recurring) ----

/** A recurring session is either a team training or a public open gym. */
export type SessionType = "training" | "open_gym";

export interface OpenGymBase {
  clubId: string;
  dedupKey: string;
  // Distinguishes a team's training slot from a public open-gym/drop-in.
  // Optional for back-compat; defaults treated as "open_gym".
  sessionType?: SessionType;
  teamLabel?: string | null; // which team trains in this slot (for trainings)
  rrule: string | null; // iCal RRULE; null => one-off using validFrom
  exdates: string[]; // ISO dates excluded from the recurrence
  startTime: string; // local "HH:mm"
  endTime: string; // local "HH:mm"
  tz: string; // IANA, e.g. "Europe/Amsterdam"
  locationText: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  origin: Origin;
  confidence: number;
  extractorVersion: number;
  status: PublishStatus;
  locked: boolean;
}

export interface OpenGymClient extends OpenGymBase {
  id: string;
  validFrom: string | null;
  validUntil: string | null;
  updatedAt: string;
}

/** A concrete dated occurrence of an open gym, expanded from its RRULE for display. */
export interface OpenGymOccurrence {
  openGymId: string;
  clubId: string;
  startsAt: string; // ISO with offset
  endsAt: string; // ISO with offset
  locationText: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

// ---- Sources ----

export interface SourceClient {
  id: string;
  clubId: string | null; // null for federation-level sources
  url: string;
  type: SourceType;
  sourceTier: SourceTier;
  fetchStrategy: FetchStrategy;
  hashSelector: string | null;
  contentHash: string | null;
  lastFetchedAt: string | null;
  lastStatus: string | null;
  consecutiveMisses: number;
}

// ---- Submissions ----

export interface SubmissionClient {
  id: string;
  kind: SubmissionKind;
  payload: Record<string, unknown>;
  status: PublishStatus;
  createdEntityId: string | null;
  reviewedBy: string | null;
  ipHash: string | null;
  createdAt: string;
}

// ---- Extraction contract (emitted by JSON-LD/Gemini extractor, see lib/extract.ts) ----

/**
 * The shape the extractor emits and `lib/validate.ts` checks. Modeled on
 * schema.org/Event. INVARIANTS: `start`/`end` always carry a UTC offset;
 * the extractor never sets `location.lat/lng` (the geocoder fills them);
 * the extractor never computes a dedup key (server-side `dedup.ts` does).
 */
export interface ExtractedEvent {
  title: string;
  type: EventType;
  clubSlug: string | null;
  start: string; // ISO-8601 with offset
  end: string | null;
  allDay: boolean;
  recurrence: string | null; // iCal RRULE or null
  location: {
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  };
  description: string | null;
  url: string | null;
  ticketUrl: string | null;
  sourceUrl: string;
  extractionMethod: ExtractionMethod;
  confidence: number; // 0..1
}
