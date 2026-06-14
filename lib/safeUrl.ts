/**
 * URL protocol allowlist: returns the trimmed/normalized URL only when it parses
 * and uses an http(s) scheme, else null. Guards against `javascript:`, `data:`,
 * `file:` and other dangerous schemes ending up in `href`/`src` attributes (XSS,
 * Referer leakage) or being fetched by the pipeline (SSRF).
 */
export function safeUrl(v: string | null | undefined): string | null {
  if (!v || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
