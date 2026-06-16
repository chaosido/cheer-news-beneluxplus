import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "@/proxy";

/**
 * Regression guard for the security proxy (proxy.ts). The CSP is fragile by
 * nature — a dependency bump or a well-meaning "harden the headers" edit can
 * silently break the map, Turnstile, or Google login in production with zero
 * other signal. These tests pin down the properties that must hold so CI fails
 * loudly instead.
 */

function req(path = "/"): NextRequest {
  return new NextRequest(`https://example.com${path}`);
}

function cspOf(res: { headers: Headers }, enforce = false): string {
  const name = enforce
    ? "content-security-policy"
    : "content-security-policy-report-only";
  return res.headers.get(name) ?? "";
}

function nonceOf(csp: string): string | null {
  return csp.match(/'nonce-([A-Za-z0-9+/_-]+={0,2})'/)?.[1] ?? null;
}

const ORIGINAL = process.env.CSP_MODE;
beforeEach(() => {
  delete process.env.CSP_MODE;
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CSP_MODE;
  else process.env.CSP_MODE = ORIGINAL;
});

describe("proxy CSP", () => {
  it("defaults to report-only and never enforces unexpectedly", () => {
    const res = proxy(req("/"));
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("content-security-policy-report-only")).toBeTruthy();
  });

  it("emits a per-request nonce that differs across requests", () => {
    const a = nonceOf(cspOf(proxy(req("/"))));
    const b = nonceOf(cspOf(proxy(req("/"))));
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b); // must be per-request, not a module-load constant
  });

  it("enforce mode sets the enforcing header (not report-only)", () => {
    process.env.CSP_MODE = "enforce";
    const res = proxy(req("/"));
    expect(res.headers.get("content-security-policy")).toBeTruthy();
    expect(res.headers.get("content-security-policy-report-only")).toBeNull();
  });

  it("off mode sets no CSP header at all", () => {
    process.env.CSP_MODE = "off";
    const res = proxy(req("/"));
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("content-security-policy-report-only")).toBeNull();
  });

  it("allows the sources this stack actually needs", () => {
    const csp = cspOf(proxy(req("/")));
    // Map (Leaflet) + home page use inline styles — must stay allowed.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    // Turnstile script + iframe.
    expect(csp).toContain("https://challenges.cloudflare.com");
    // OSM map tiles.
    expect(csp).toContain("https://*.tile.openstreetmap.org");
    // Firebase auth.
    expect(csp).toContain("https://*.firebaseapp.com");
    // Clickjacking + base/ form hardening.
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("does NOT use strict-dynamic (it would disable the Turnstile host allowlist)", () => {
    const csp = cspOf(proxy(req("/")));
    expect(csp).not.toContain("strict-dynamic");
  });

  it("points violation reports at the report sink", () => {
    const res = proxy(req("/"));
    expect(res.headers.get("reporting-endpoints")).toContain("/api/csp-report");
    expect(cspOf(proxy(req("/")))).toContain("report-to csp-endpoint");
  });
});

describe("proxy hardening invariants", () => {
  it("never sets a same-origin COOP (would break signInWithPopup)", () => {
    for (const mode of ["report-only", "enforce", "off"]) {
      process.env.CSP_MODE = mode;
      const res = proxy(req("/submit"));
      expect(res.headers.get("cross-origin-opener-policy")).not.toBe(
        "same-origin",
      );
    }
  });

  it("marks authenticated API responses no-store", () => {
    expect(proxy(req("/api/admin/review")).headers.get("cache-control")).toBe(
      "no-store",
    );
    expect(proxy(req("/api/submit")).headers.get("cache-control")).toBe(
      "no-store",
    );
  });

  it("does not force no-store on public pages", () => {
    expect(proxy(req("/")).headers.get("cache-control")).toBeNull();
  });
});

describe("proxy matcher", () => {
  it("skips Next internals and static assets", () => {
    const m = config.matcher[0];
    expect(m).toContain("_next/static");
    expect(m).toContain("_next/image");
    expect(m).toContain(".well-known");
  });
});
