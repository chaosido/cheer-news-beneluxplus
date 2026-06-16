/**
 * Admin review endpoint (Node runtime; admin-gated via Firebase ID token).
 *
 * GET  ?list=pending  → { submissions, events } awaiting review.
 * POST { kind, id, action } → approve/reject a submission or a pending event.
 *
 * Auth: the client sends `Authorization: Bearer <firebaseIdToken>`. We verify
 * it with `verifyAdmin`, which also checks the email against ADMIN_EMAILS.
 * Any failure → 401.
 */
import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { bearerToken, verifyAdmin, type AdminUser } from "@/lib/auth";
import {
  COLLECTIONS,
  getPendingEvents,
  getSubmissionsByStatus,
} from "@/lib/queries";
import { slugify } from "@/lib/utils";
import type { SubmissionClient } from "@/lib/types";

export const runtime = "nodejs";

async function requireAdmin(req: Request): Promise<AdminUser | null> {
  return verifyAdmin(bearerToken(req.headers.get("authorization")));
}

/** Audit entries auto-delete one year after they're written (see expireAt). */
const AUDIT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Append an immutable record of a state-changing admin action to `auditLog`.
 * Best-effort: a logging failure must never fail the action itself, so this
 * swallows its own errors. The collection is server-only (Firestore rules deny
 * all client access).
 *
 * `expireAt` is the retention deadline; a Firestore TTL policy configured on
 * the `expireAt` field deletes the doc once that time passes. (TTL must point
 * at a future timestamp — never at `at`, which is already in the past.)
 */
async function writeAuditLog(entry: {
  action: "approve" | "reject";
  kind: "submission" | "event";
  targetId: string;
  reviewer: string;
}): Promise<void> {
  try {
    await adminDb.collection("auditLog").add({
      ...entry,
      at: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + AUDIT_RETENTION_MS),
    });
  } catch (err) {
    console.error("[api/admin/review] audit log write failed:", err);
  }
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Geen toegang" },
      { status: 401 },
    );
  }

  try {
    const [submissions, events] = await Promise.all([
      getSubmissionsByStatus("pending"),
      getPendingEvents(),
    ]);
    return NextResponse.json({ ok: true, submissions, events });
  } catch (err) {
    console.error("[api/admin/review] list failed:", err);
    return NextResponse.json(
      { ok: false, error: "Kon items niet laden." },
      { status: 500 },
    );
  }
}

interface ReviewBody {
  kind?: "submission" | "event";
  id?: string;
  action?: "approve" | "reject" | "decide";
  /** For action:"decide" — the triage bucket. "undecided" clears it. */
  decision?: "agreed" | "disagreed" | "undecided";
  /** For action:"decide" — optional free-text note. */
  note?: string;
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Geen toegang" },
      { status: 401 },
    );
  }

  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ongeldige aanvraag" },
      { status: 400 },
    );
  }

  const { kind, id, action } = body;
  if ((kind !== "submission" && kind !== "event") || !id) {
    return NextResponse.json(
      { ok: false, error: "Ongeldige parameters" },
      { status: 400 },
    );
  }

  // Triage: record a decision + note WITHOUT acting (item stays pending so it
  // remains on the board; the changes are applied later in a batch).
  if (action === "decide") {
    const { decision, note } = body;
    if (
      decision !== "agreed" &&
      decision !== "disagreed" &&
      decision !== "undecided"
    ) {
      return NextResponse.json(
        { ok: false, error: "Ongeldige decision" },
        { status: 400 },
      );
    }
    const collection = kind === "event" ? COLLECTIONS.events : COLLECTIONS.submissions;
    try {
      await adminDb
        .collection(collection)
        .doc(id)
        .update({
          reviewDecision: decision === "undecided" ? null : decision,
          reviewNote: typeof note === "string" ? note.slice(0, 2000) : null,
          reviewDecidedBy: admin.email,
          reviewDecidedAt: FieldValue.serverTimestamp(),
        });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[api/admin/review] decide failed:", err);
      return NextResponse.json({ ok: false, error: "Kon niet opslaan." }, { status: 500 });
    }
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { ok: false, error: "Ongeldige parameters" },
      { status: 400 },
    );
  }

  try {
    if (kind === "event") {
      return await reviewEvent(id, action, admin.email);
    }
    return await reviewSubmission(id, action, admin.email);
  } catch (err) {
    console.error("[api/admin/review] action failed:", err);
    return NextResponse.json(
      { ok: false, error: "Actie mislukt." },
      { status: 500 },
    );
  }
}

/** A pending scraped event: publish it or reject it. */
async function reviewEvent(
  id: string,
  action: "approve" | "reject",
  reviewer: string,
) {
  const ref = adminDb.collection(COLLECTIONS.events).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json(
      { ok: false, error: "Niet gevonden" },
      { status: 404 },
    );
  }
  await ref.update({
    status: action === "approve" ? "published" : "rejected",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAuditLog({ action, kind: "event", targetId: id, reviewer });
  return NextResponse.json({ ok: true });
}

/** A public submission: on approve, publish + best-effort create the entity. */
async function reviewSubmission(
  id: string,
  action: "approve" | "reject",
  reviewer: string,
) {
  const ref = adminDb.collection(COLLECTIONS.submissions).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json(
      { ok: false, error: "Niet gevonden" },
      { status: 404 },
    );
  }

  if (action === "reject") {
    await ref.update({ status: "rejected", reviewedBy: reviewer });
    await writeAuditLog({ action, kind: "submission", targetId: id, reviewer });
    return NextResponse.json({ ok: true });
  }

  // Approve: best-effort create the corresponding entity, then publish.
  const data = snap.data() as Omit<SubmissionClient, "id" | "createdAt">;
  const createdEntityId = await createEntityFromSubmission(
    data.kind,
    (data.payload ?? {}) as Record<string, unknown>,
  );

  await ref.update({
    status: "published",
    reviewedBy: reviewer,
    createdEntityId: createdEntityId ?? null,
  });
  await writeAuditLog({ action, kind: "submission", targetId: id, reviewer });
  return NextResponse.json({ ok: true, createdEntityId });
}

/**
 * Create a domain entity from an approved submission payload.
 *
 * Implemented for `club` (creates a minimal active club doc). `event`, `gym`,
 * and `correction` are intentionally NOT auto-created yet: events/gyms need
 * timezone-aware start/end + dedup-key computation (see lib/dedup.ts) and a
 * resolved clubId, and corrections are informational. For those we publish the
 * submission only and leave entity creation to a maintainer.
 *
 * Returns the new entity id, or null if no entity was created.
 */
async function createEntityFromSubmission(
  kind: SubmissionClient["kind"],
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (kind === "club") {
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) return null;
    const city = typeof payload.city === "string" ? payload.city.trim() : "";
    const str = (k: string) =>
      typeof payload[k] === "string" && (payload[k] as string).trim()
        ? (payload[k] as string).trim()
        : null;

    const ref = await adminDb.collection(COLLECTIONS.clubs).add({
      name,
      slug: slugify(name),
      websiteUrl: str("website"),
      city,
      address: null,
      country: "NL",
      region: null,
      lat: null,
      lng: null,
      instagramUrl: str("instagram"),
      tiktokUrl: str("tiktok"),
      facebookUrl: str("facebook"),
      logoUrl: null,
      blurb: str("blurb"),
      foundedYear: null,
      primaryChannel: str("website") ? "website" : "none",
      clubType: "club",
      status: "active",
      locked: false,
      // teamsSummary is intentionally NOT stored: it is derived at read time
      // from the `teams` subcollection (the single source of truth). See
      // lib/queries.ts#teamsToSummary.
      lastVerifiedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  // TODO(events/gyms/coach): not auto-created. Submissions are free-text; a
  // maintainer turns them into structured docs at review time (visiting coaches
  // via `npm run seed:visiting-coaches`). For now the submission is published
  // without a linked entity.
  return null;
}
