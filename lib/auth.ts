/**
 * Admin auth helpers (SERVER ONLY).
 *
 * /admin is gated by Firebase Auth on the client; the server verifies the
 * Firebase ID token and checks the email against ADMIN_EMAILS. The client
 * sends its ID token in the `Authorization: Bearer <token>` header.
 */
import "server-only";
import { adminAuth } from "@/lib/firebaseAdmin";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export interface AdminUser {
  uid: string;
  email: string;
}

/**
 * Verify a Firebase ID token and confirm the user is an allowlisted admin.
 * Returns the user on success, or null on any failure (invalid token, not allowlisted).
 */
export async function verifyAdmin(idToken: string | undefined): Promise<AdminUser | null> {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!isAdminEmail(decoded.email)) return null;
    return { uid: decoded.uid, email: decoded.email! };
  } catch {
    return null;
  }
}

/**
 * Verify a Firebase ID token WITHOUT requiring the admin allowlist.
 *
 * Used to gate public submissions: any signed-in Google account is acceptable
 * (this is accountability / anti-spam, not authorization). Returns the user on
 * success, or null on any failure (missing/invalid token).
 */
export async function verifyUser(
  idToken: string | undefined,
): Promise<{ uid: string; email: string | null } | null> {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    // Defense-in-depth: reject tokens whose email the provider did not confirm.
    // The form only exposes Google OAuth today (always email_verified:true), but
    // this keeps the gate robust if other sign-in methods are enabled later.
    if (!decoded.email_verified) return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

/** Extract a bearer token from an Authorization header value. */
export function bearerToken(authHeader: string | null | undefined): string | undefined {
  if (!authHeader) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  return m?.[1];
}
