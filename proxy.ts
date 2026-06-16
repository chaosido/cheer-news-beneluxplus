/**
 * Edge proxy (Next 16's renamed `middleware`). Runs on every matched request.
 *
 * Responsibilities:
 *   1. Content-Security-Policy with a fresh per-request nonce. Next reads the
 *      nonce from the CSP request header we set here and stamps it onto its own
 *      inline hydration scripts, so they survive the policy.
 *   2. `Cache-Control: no-store` on authenticated API responses so an admin's
 *      JSON can never be cached by a CDN/browser and served to someone else.
 *
 * The CSP is gated by the CSP_MODE env var so it can be flipped or disabled
 * without a code change (App Hosting has no runtime header toggle):
 *   - "enforce"      → Content-Security-Policy (blocks violations)
 *   - "report-only"  → Content-Security-Policy-Report-Only (logs, blocks nothing)
 *   - "off"          → no CSP header at all
 *   - unset          → defaults to "report-only" (safe: never breaks a page)
 *
 * NOTE (do not "harden" away): we intentionally do NOT set
 * Cross-Origin-Opener-Policy: same-origin — it severs window.opener and breaks
 * Firebase signInWithPopup (the only login path). See SECURITY.md.
 */
import { NextResponse, type NextRequest } from "next/server";

type CspMode = "enforce" | "report-only" | "off";

function cspMode(): CspMode {
  const m = (process.env.CSP_MODE ?? "report-only").toLowerCase();
  if (m === "enforce" || m === "off") return m;
  return "report-only";
}

/** 16 random bytes, base64 — a valid CSP nonce, unguessable per request. */
function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Build the CSP for this stack. Host lists are derived from what the app
 * actually loads (verified against source); see SECURITY.md before narrowing.
 *
 * Deliberate choices:
 *   - NO 'strict-dynamic': it would disable the explicit script host allowlist
 *     (Turnstile) that we rely on. Our only script origins are 'self' (Next
 *     chunks), the per-request nonce (Next inline scripts), and Cloudflare
 *     Turnstile — all trusted, none JSONP-capable.
 *   - style-src 'unsafe-inline' is REQUIRED: Leaflet sets inline style="" and
 *     two components render inline <style> elements (Map.tsx, HomeView.tsx).
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://storage.googleapis.com https://firebasestorage.googleapis.com`,
    `font-src 'self'`,
    `connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`,
    `frame-src https://challenges.cloudflare.com https://*.firebaseapp.com https://accounts.google.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
    `report-to csp-endpoint`,
  ];
  return directives.join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const mode = cspMode();
  const isDev = process.env.NODE_ENV === "development";

  // Forward a (possibly CSP-augmented) set of request headers to the app.
  const requestHeaders = new Headers(request.headers);

  let csp: string | null = null;
  let nonce: string | null = null;
  if (mode !== "off") {
    nonce = makeNonce();
    csp = buildCsp(nonce, isDev);
    // Next extracts the nonce from EITHER the CSP or the CSP-Report-Only
    // request header, so report-only still stamps scripts correctly.
    const requestHeaderName =
      mode === "enforce"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only";
    requestHeaders.set(requestHeaderName, csp);
    requestHeaders.set("x-nonce", nonce);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (csp) {
    const responseHeaderName =
      mode === "enforce"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only";
    response.headers.set(responseHeaderName, csp);
    // Where the browser sends violation reports (see app/api/csp-report).
    response.headers.set(
      "Reporting-Endpoints",
      `csp-endpoint="/api/csp-report"`,
    );
  }

  // Authenticated JSON must never be cached and re-served to another user.
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/admin") || path.startsWith("/api/submit")) {
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static files. Pages are
  // included on purpose: a per-request nonce makes them dynamic, which is the
  // accepted trade-off for a strong CSP on a low-traffic site.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.well-known).*)",
  ],
};
