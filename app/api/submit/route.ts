/**
 * Public submission endpoint (Node runtime — uses firebase-admin + node:crypto).
 *
 * Flow:
 *   1. Parse JSON body.
 *   2. Honeypot: if the hidden `website_url2` field is filled, treat as a bot —
 *      return a fake success (200 {ok:true}) without writing anything.
 *   3. Turnstile: if TURNSTILE_SECRET_KEY is set, verify the token with
 *      Cloudflare siteverify; if unset (dev), skip verification entirely.
 *   4. Validate the payload with `submissionInputSchema` (zod).
 *   5. Per-UID rate limit (in-memory; resets per server instance — fine for MVP).
 *   6. Compute a SALTED sha256 ipHash (never store the raw IP).
 *   7. Write to `submissions` with status:'pending' and a server timestamp.
 */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { COLLECTIONS } from "@/lib/queries";
import { submissionInputSchema } from "@/lib/submitSchema";
import { bearerToken, verifyUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Honeypot field name — must match the hidden input in SubmitForm. */
const HONEYPOT_FIELD = "website_url2";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// ---- In-memory rate limiter (per instance; resets on cold start / redeploy) ----
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

/** Best-effort client IP from proxy headers (App Hosting / Vercel / generic). */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Resolve the IP hashing salt. No hardcoded fallback: a committed default salt
 * is publicly known and makes the stored hashes trivially reversible (the
 * reachable NL/Benelux IPv4 space is small enough to precompute). In production
 * we fail loudly if it is unset; in dev/test we allow a clearly-marked,
 * non-secret placeholder so the form still works locally.
 */
function ipHashSalt(): string {
  const salt = process.env.IP_HASH_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("IP_HASH_SALT must be set in production");
  }
  return "dev-only-insecure-salt";
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}:${ipHashSalt()}`).digest("hex");
}

async function verifyTurnstile(
  token: string | undefined,
  ip: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Not configured (dev) → skip verification.
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (ip && ip !== "unknown") form.set("remoteip", ip);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ongeldige aanvraag" },
      { status: 400 },
    );
  }

  // 2. Honeypot — pretend success so bots don't learn they were caught.
  if (
    typeof body[HONEYPOT_FIELD] === "string" &&
    body[HONEYPOT_FIELD].trim() !== ""
  ) {
    return NextResponse.json({ ok: true });
  }

  // 2b. Require a valid Firebase login (any Google account). This is the new
  //     anti-spam / accountability gate; Turnstile below is now redundant but
  //     left in place. The allowlist is NOT checked here — anyone signed in may
  //     submit; maintainers review before anything is published.
  const user = await verifyUser(bearerToken(req.headers.get("authorization")));
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Log in om een evenement te melden." },
      { status: 401 },
    );
  }

  const ip = clientIp(req);

  // 5. Rate limit (before doing expensive work / writes). Key on the verified
  //     Firebase UID, not the client IP: x-forwarded-for is client-controlled
  //     and trivially spoofed per-request, so an IP key offers no real limit.
  if (rateLimited(user.uid)) {
    return NextResponse.json(
      { ok: false, error: "Te veel inzendingen. Probeer het later opnieuw." },
      { status: 429 },
    );
  }

  // 3. Turnstile (skipped when secret is unset).
  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken : undefined;
  const human = await verifyTurnstile(turnstileToken, ip);
  if (!human) {
    return NextResponse.json(
      {
        ok: false,
        error: "Verificatie mislukt. Vernieuw de pagina en probeer opnieuw.",
      },
      { status: 400 },
    );
  }

  // 4. Validate payload.
  const parsed = submissionInputSchema.safeParse(body.payload ?? body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, error: "Controleer de ingevulde velden.", fieldErrors },
      { status: 422 },
    );
  }

  const { kind, ...payload } = parsed.data;

  // 7. Persist as a pending submission.
  //
  // Maintainers are NOT emailed here. Instead `digestNotifiedAt: null` marks
  // this row as "not yet reported"; a once-daily evening job
  // (scripts/notify-digest.ts) collects all un-notified rows into ONE digest
  // email and stamps them, so a busy day is one mail, not one-per-submission.
  try {
    const ref = await adminDb.collection(COLLECTIONS.submissions).add({
      kind,
      payload,
      status: "pending",
      createdEntityId: null,
      reviewedBy: null,
      ipHash: hashIp(ip),
      submittedByEmail: user.email,
      submittedByUid: user.uid,
      digestNotifiedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error("[api/submit] write failed:", err);
    return NextResponse.json(
      { ok: false, error: "Er ging iets mis. Probeer het later opnieuw." },
      { status: 500 },
    );
  }
}
