/**
 * URL protocol allowlist: returns the trimmed/normalized URL only when it's safe
 * to use in an `href`/`src`, else null. Guards against `javascript:`, `data:`,
 * `file:` and other dangerous schemes ending up in attributes (XSS, Referer
 * leakage) or being fetched by the pipeline (SSRF).
 *
 * Accepts two safe shapes:
 *   1. Same-origin ROOT-RELATIVE paths ("/logos/foo.jpg") — our self-hosted
 *      assets. A single leading slash can't leave the origin; "//host" (protocol
 *      -relative, which CAN leave the origin) is rejected.
 *   2. Absolute http(s) URLs.
 */
export function safeUrl(v: string | null | undefined): string | null {
  if (!v || !v.trim()) return null;
  const t = v.trim();
  // Same-origin absolute path (but not a protocol-relative "//evil.com" URL).
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
