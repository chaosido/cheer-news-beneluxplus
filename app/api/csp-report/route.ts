/**
 * CSP violation report sink.
 *
 * The browser POSTs here (unauthenticated, by design) when a Content-Security
 * -Policy directive is violated — see the `report-to`/`Reporting-Endpoints`
 * wiring in proxy.ts. During the report-only rollout this is how we discover
 * what a future enforcing policy would block, from real sessions rather than
 * just the developer's own browser console.
 *
 * It only logs (to the server console, where App Hosting collects it) and
 * always returns 204. It never reads the database and never trusts the body
 * beyond logging it, so it is not a meaningful attack surface; we cap the log
 * size to avoid abuse.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_LOG_CHARS = 4000;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const raw = await req.text();
    if (raw) {
      console.warn(
        "[csp-report]",
        raw.length > MAX_LOG_CHARS ? `${raw.slice(0, MAX_LOG_CHARS)}…` : raw,
      );
    }
  } catch {
    // Ignore malformed/oversized bodies — reporting must never error loudly.
  }
  // 204: accepted, nothing to return.
  return new NextResponse(null, { status: 204 });
}
