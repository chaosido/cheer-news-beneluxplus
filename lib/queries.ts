/**
 * Server-side data access (SERVER ONLY). All Firestore reads for the app live
 * here so pages/components share one typed contract. Converts Firestore
 * Timestamps to ISO strings so results are safe to pass to Client Components.
 */
import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import type {
  Coach,
  ClubClient,
  EventClient,
  OpenGymClient,
  SubmissionClient,
  Team,
  TeamSummary,
  VisitingCoachClient,
} from "@/lib/types";

export const COLLECTIONS = {
  clubs: "clubs",
  teams: "teams", // subcollection of clubs/{id}/teams
  sources: "sources",
  events: "events",
  openGyms: "open_gyms",
  submissions: "submissions",
  visitingCoaches: "visiting_coaches",
} as const;

/**
 * Recursively convert Firestore Timestamps to ISO strings; pass other values
 * through. The input shape is unknown (Firestore `DocumentData`) and the output
 * is a structurally transformed copy, so this is honestly typed `unknown` ->
 * `unknown`. The single unsound cast lives at the `docToClient` boundary.
 */
function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((v) => serialize(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

/**
 * Map a Firestore document to its client type. NOTE: this is an unchecked cast
 * — Firestore `.data()` is `DocumentData` with no compile-time guarantee that a
 * stored document matches `T` (e.g. a club written before a field existed). The
 * unsoundness is intentional and local to this one site; callers that index
 * fields unconditionally must defend against missing values at runtime.
 */
function docToClient<T>(doc: FirebaseFirestore.QueryDocumentSnapshot): T {
  return {
    id: doc.id,
    ...(serialize(doc.data()) as Record<string, unknown>),
  } as T;
}

// ---- Clubs ----

/**
 * Derive a club's denormalized team summary from its full team docs.
 *
 * SINGLE SOURCE OF TRUTH: the `teams` subcollection is authoritative. The
 * `teamsSummary` array (consumed by ClubCard badges + ClubGrid filters) is NOT
 * stored — it is computed here at read time so it can never drift from the
 * subcollection. Only active teams contribute, matching the detail page.
 */
export function teamsToSummary(teams: Team[]): TeamSummary[] {
  return teams
    .filter((t) => t.status === "active")
    .map((t) => ({
      // Defaults guard legacy docs written before these fields existed
      // (docToClient does no runtime check — see its note).
      discipline: t.discipline ?? "cheer",
      level: t.level ?? null,
      danceStyle: t.danceStyle ?? null,
      tier: t.tier ?? "competition",
      division: t.division,
      ageGroup: t.ageGroup,
    }));
}

/**
 * Whether a club has at least one ICU-certified coach.
 *
 * DERIVED, never stored — computed at read time from the club's `coaches`
 * array so it can't drift. Backs the federation's "each club needs ≥1 ICU
 * coach" rule (data-readiness for next season; surfaced, not enforced).
 */
export function clubHasIcuCoach(coaches: Coach[] | undefined): boolean {
  return (coaches ?? []).some((c) => c.icuCertified === true);
}

export async function getClubs(): Promise<ClubClient[]> {
  // One read for the clubs, one `collectionGroup` read for ALL teams across all
  // clubs (cheaper than N per-club reads at this scale). Group teams by their
  // parent club id, then derive each club's teamsSummary — never trusting any
  // stored copy, so the subcollection stays the single source of truth.
  const [snap, teamsSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.clubs).where("status", "==", "active").get(),
    adminDb.collectionGroup(COLLECTIONS.teams).get(),
  ]);

  const teamsByClub = new Map<string, Team[]>();
  for (const d of teamsSnap.docs) {
    const clubId = d.ref.parent.parent?.id;
    if (!clubId) continue;
    const list = teamsByClub.get(clubId) ?? [];
    list.push(docToClient<Team>(d));
    teamsByClub.set(clubId, list);
  }

  return (
    snap.docs
      .map((d) => {
        const club = docToClient<ClubClient>(d);
        club.teamsSummary = teamsToSummary(teamsByClub.get(d.id) ?? []);
        return club;
      })
      // `name` is required by the type but `docToClient` does no runtime check;
      // guard with `?? ""` so a malformed legacy doc can't throw here.
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "nl"))
  );
}

export async function getClubBySlug(slug: string): Promise<ClubClient | null> {
  const snap = await adminDb
    .collection(COLLECTIONS.clubs)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const club = docToClient<ClubClient>(snap.docs[0]);
  // Derive teamsSummary from the subcollection (single source of truth) rather
  // than the stored copy on the doc.
  club.teamsSummary = teamsToSummary(await getClubTeams(club.id));
  return club;
}

/** Full team list from the club's `teams` subcollection. */
export async function getClubTeams(clubId: string): Promise<Team[]> {
  const snap = await adminDb
    .collection(COLLECTIONS.clubs)
    .doc(clubId)
    .collection(COLLECTIONS.teams)
    .get();
  return snap.docs.map((d) => docToClient<Team>(d));
}

// ---- Events ----

/** Published events from now (or `from`) forward, ordered by start. */
export async function getPublishedEvents(opts?: {
  clubId?: string;
  from?: Date;
  limit?: number;
}): Promise<EventClient[]> {
  const from = opts?.from ?? new Date();
  let q: FirebaseFirestore.Query = adminDb
    .collection(COLLECTIONS.events)
    .where("status", "==", "published")
    .where("startsAt", ">=", Timestamp.fromDate(from));
  if (opts?.clubId) q = q.where("clubId", "==", opts.clubId);
  q = q.orderBy("startsAt", "asc");
  if (opts?.limit) q = q.limit(opts.limit);
  const snap = await q.get();
  return snap.docs.map((d) => docToClient<EventClient>(d));
}

// ---- Open gyms ----

export async function getPublishedOpenGyms(opts?: {
  clubId?: string;
}): Promise<OpenGymClient[]> {
  let q: FirebaseFirestore.Query = adminDb
    .collection(COLLECTIONS.openGyms)
    .where("status", "==", "published");
  if (opts?.clubId) q = q.where("clubId", "==", opts.clubId);
  const snap = await q.get();
  return snap.docs.map((d) => docToClient<OpenGymClient>(d));
}

// ---- Visiting coaches ----

/**
 * Published visiting coaches whose stay hasn't ended yet (current + upcoming).
 * The expiry filter runs in memory — the set is tiny, so this avoids a composite
 * index. Sorted by arrival (`startsAt`) ascending.
 */
export async function getPublishedVisitingCoaches(): Promise<
  VisitingCoachClient[]
> {
  const snap = await adminDb
    .collection(COLLECTIONS.visitingCoaches)
    .where("status", "==", "published")
    .get();
  // Keep a coach until the end of their departure day (or forever if open-ended).
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  const cutoffIso = cutoff.toISOString();
  return snap.docs
    .map((d) => docToClient<VisitingCoachClient>(d))
    .filter((c) => c.endsAt == null || c.endsAt >= cutoffIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// ---- Submissions (admin) ----

export async function getSubmissionsByStatus(
  status: "pending" | "published" | "rejected",
): Promise<SubmissionClient[]> {
  const snap = await adminDb
    .collection(COLLECTIONS.submissions)
    .where("status", "==", status)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => docToClient<SubmissionClient>(d));
}

/** Low-confidence / pending scraped events awaiting review. */
export async function getPendingEvents(): Promise<EventClient[]> {
  // Single-field query (no composite index needed); sort in memory since the
  // pending set is small.
  const snap = await adminDb
    .collection(COLLECTIONS.events)
    .where("status", "==", "pending")
    .get();
  return snap.docs
    .map((d) => docToClient<EventClient>(d))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}
