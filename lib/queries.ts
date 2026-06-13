/**
 * Server-side data access (SERVER ONLY). All Firestore reads for the app live
 * here so pages/components share one typed contract. Converts Firestore
 * Timestamps to ISO strings so results are safe to pass to Client Components.
 */
import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import type {
  ClubClient,
  EventClient,
  OpenGymClient,
  SubmissionClient,
  Team,
} from "@/lib/types";

export const COLLECTIONS = {
  clubs: "clubs",
  teams: "teams", // subcollection of clubs/{id}/teams
  sources: "sources",
  events: "events",
  openGyms: "open_gyms",
  submissions: "submissions",
} as const;

/** Recursively convert Firestore Timestamps to ISO strings; pass other values through. */
function serialize<T>(value: unknown): T {
  if (value instanceof Timestamp) return value.toDate().toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out as T;
  }
  return value as T;
}

function docToClient<T>(doc: FirebaseFirestore.QueryDocumentSnapshot): T {
  return { id: doc.id, ...serialize<Record<string, unknown>>(doc.data()) } as T;
}

// ---- Clubs ----

export async function getClubs(): Promise<ClubClient[]> {
  const snap = await adminDb
    .collection(COLLECTIONS.clubs)
    .where("status", "==", "active")
    .get();
  return snap.docs
    .map((d) => docToClient<ClubClient>(d))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}

export async function getClubBySlug(slug: string): Promise<ClubClient | null> {
  const snap = await adminDb
    .collection(COLLECTIONS.clubs)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return docToClient<ClubClient>(snap.docs[0]);
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
