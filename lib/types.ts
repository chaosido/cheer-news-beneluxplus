/**
 * Shared domain types for Cheer News.
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

/**
 * Team classification has two independent axes, kept in separate fields:
 *
 *  - `Discipline` — WHAT kind of sport. `cheer` (stunts/tumbling, scored on a
 *    numeric skill ladder) vs `performance_cheer` (pom/dance, scored by style,
 *    with NO numeric level).
 *  - `CheerLevel` — HOW HARD the cheer is. The numeric L-code ladder. We store
 *    the number (canonical, sortable) and render the ICU word-name as a label
 *    (3 = Median, 4 = Advanced, 5 = Elite, 6/7 = Premier — see lib/i18n). The
 *    Dutch federation (CSN) runs the NK on the ICU/ECU rulebook, so the L-code
 *    is the authoritative spine here. `null` for performance-cheer teams.
 *  - `Tier` — HOW COMPETITIVE (orthogonal to level). `prep`/`recreational` used
 *    to live in the level enum but were never skill levels.
 */
export type Discipline = "cheer" | "performance_cheer";
export type CheerLevel = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type DanceStyle =
  | "pom"
  | "hip_hop"
  | "jazz"
  | "kick"
  | "pom_doubles"
  | "hip_hop_doubles";
export type Tier = "competition" | "prep" | "recreational";
export type Division = "all_girl" | "coed" | "all_boy";
export type AgeGroup = "mini" | "youth" | "junior" | "senior" | "open";
// One-off dated happenings. Note: recurring *team training* is a separate
// concept living in the `open_gyms` collection as SessionType.training — an
// organised one-off session is a workshop, so there is no event "training" type.
export type EventType =
  | "competition"
  | "open_gym"
  | "workshop"
  | "tryout"
  | "showcase"
  | "other";
export type PublishStatus = "published" | "pending" | "rejected";
export type Origin = "scrape" | "submission";
export type SourceTier = "federation" | "structured" | "club";
export type SourceType = "events" | "gyms" | "general" | "federation";
export type FetchStrategy = "http" | "playwright";
export type ExtractionMethod = "json-ld" | "llm";
export type SubmissionKind =
  | "event"
  | "gym"
  | "club"
  | "coach"
  | "correction"
  | "feedback";

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
  discipline: Discipline;
  /** Numeric L-code; `null` for performance-cheer teams (style describes them). */
  level: CheerLevel | null;
  /** Set only when `discipline === "performance_cheer"`. */
  danceStyle?: DanceStyle | null;
  tier: Tier;
  division: Division;
  ageGroup: AgeGroup;
  notes?: string;
  status: "active" | "inactive";
}

/** Compact team descriptor denormalized onto the club doc for fast guide rendering. */
export interface TeamSummary {
  discipline: Discipline;
  level: CheerLevel | null;
  danceStyle?: DanceStyle | null;
  tier: Tier;
  division: Division;
  ageGroup: AgeGroup;
}

/** A coach/trainer at a club. */
export interface Coach {
  name: string;
  role: string | null; // e.g. "Head Coach", "Tumbling Coach"
  // ICU coach certification (data-readiness for the "≥1 ICU coach per club"
  // rule that starts next season — tracked, not yet enforced). All optional so
  // existing club docs stay valid; absent = not certified / unknown.
  icuCertified?: boolean;
  icuLevel?: string | null; // ICU coach credential level, free text (e.g. "Level 2")
  icuExpiresAt?: string | null; // ISO date the cert lapses — kept for future enforcement
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
  // Federation membership. True if the club is a Cheersport Nederland (CSN)
  // member; optional so legacy docs stay valid — consumers default to false.
  csnMember?: boolean;
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
  // DERIVED, never stored: computed at read time from the club's `teams`
  // subcollection (the single source of truth) by lib/queries.ts#teamsToSummary.
  // Lives on the client/read shape only, so it cannot drift from the source.
  teamsSummary: TeamSummary[];
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
  // Self-describing location for club-independent events (e.g. a one-off park
  // session). Optional so existing club-owned events stay valid; when clubId is
  // null these feed the province filter + agenda line in place of the club.
  city?: string | null;
  region?: string | null; // province, mirrors ClubBase.region
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
  /** Triage bucket (null = undecided) + free-text note, set in /admin. */
  reviewDecision?: ReviewDecision | null;
  reviewNote?: string | null;
}

// ---- Open gyms (recurring) ----

/** A recurring session is either a team training or a public open gym. */
export type SessionType = "training" | "open_gym";

export interface OpenGymBase {
  // Owning club, or `null` for a venue-hosted open gym with no parent club
  // (e.g. a turn hall's public drop-in). When null, the venue fields below
  // self-describe the location instead of deriving it from a club.
  clubId: string | null;
  dedupKey: string;
  // Self-describing venue, used when `clubId` is null. A stable `venueId`
  // groups the several weekly docs of one hall (e.g. Mon + Thu) into a single
  // map pin. All optional so existing club-owned docs stay valid.
  venueId?: string | null;
  venueName?: string | null;
  city?: string | null;
  region?: string | null; // province, mirrors ClubBase.region
  address?: string | null;
  websiteUrl?: string | null;
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
  // Drop-in pricing for public open gyms. Only meaningful when
  // `sessionType === "open_gym"` (team trainings never show a price).
  // Optional + nullable so existing docs stay valid; absent/null = unknown.
  price?: number | null; // EUROS as a decimal, e.g. 7.5 => €7,50; 0 = free
  priceNote?: string | null; // free text, e.g. "gratis voor leden / €7,50 drop-in"
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
  clubId: string | null;
  startsAt: string; // ISO with offset
  endsAt: string; // ISO with offset
  locationText: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

// ---- Visiting coaches ----

/**
 * A guest/touring coach temporarily in the country at one city for a date range,
 * who signed themselves up so people can reach out. Not tied to a club; rendered
 * as its own map pin and on the /coaches page (never in the agenda). Like the
 * event types, the instant fields (`startsAt`/`endsAt`) live on the Client layer
 * as ISO strings; the Firestore doc stores Timestamps.
 */
export interface VisitingCoachBase {
  name: string;
  role: string | null; // free text, e.g. "Tumbling specialist"
  bio: string | null;
  city: string;
  region: string | null; // province, mirrors ClubBase.region
  lat: number | null;
  lng: number | null;
  // Contact — at least one is required at submit time; all nullable on the doc.
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  phone: string | null; // WhatsApp / phone, free text
  origin: Origin;
  status: PublishStatus;
  locked: boolean;
}

export interface VisitingCoachClient extends VisitingCoachBase {
  id: string;
  startsAt: string; // ISO — arrival day
  endsAt: string | null; // ISO — departure day, or null if open-ended
  updatedAt: string;
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

/**
 * Triage decision a maintainer records on a queue item. `null`/absent means
 * "undecided". The decision is recorded WITHOUT acting on the item — the
 * maintainer clicks through everything, then the changes are applied in a batch.
 */
export type ReviewDecision = "agreed" | "disagreed";

export interface SubmissionClient {
  id: string;
  kind: SubmissionKind;
  payload: Record<string, unknown>;
  status: PublishStatus;
  createdEntityId: string | null;
  reviewedBy: string | null;
  ipHash: string | null;
  createdAt: string;
  /** Triage bucket (null = undecided) + free-text note, set in /admin. */
  reviewDecision?: ReviewDecision | null;
  reviewNote?: string | null;
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
