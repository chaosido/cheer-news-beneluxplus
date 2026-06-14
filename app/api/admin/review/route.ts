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
import { FieldValue } from "firebase-admin/firestore";
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
  action?: "approve" | "reject";
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
  if (
    (kind !== "submission" && kind !== "event") ||
    !id ||
    (action !== "approve" && action !== "reject")
  ) {
    return NextResponse.json(
      { ok: false, error: "Ongeldige parameters" },
      { status: 400 },
    );
  }

  try {
    if (kind === "event") {
      return await reviewEvent(id, action);
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
async function reviewEvent(id: string, action: "approve" | "reject") {
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
      teamsSummary: [],
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
