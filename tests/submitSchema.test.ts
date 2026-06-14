import { describe, it, expect } from "vitest";
import { submissionInputSchema } from "@/lib/submitSchema";

/**
 * The submission schema is the ONLY input-validation layer for the public
 * POST /api/submit endpoint. These tests pin down its real behavior — including
 * the edge cases of the `optionalUrl`, `contactEmail` and `date` field — so a
 * silent drift can't sneak garbage into Firestore.
 *
 * Pure Zod, no mocking, no server-only imports.
 */

describe("submissionInputSchema", () => {
  // ---- happy-path parse of all four kinds ----

  it("parses a valid event payload", () => {
    const res = submissionInputSchema.safeParse({
      kind: "event",
      title: "Spring Showcase",
      type: "showcase",
      date: "2026-11-01",
      time: "14:30",
      location: "Sporthal",
      clubName: "My Club",
      url: "https://www.myclub.nl/event",
      description: "A fun event.",
      contactEmail: "info@myclub.nl",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data.kind === "event") {
      expect(res.data.title).toBe("Spring Showcase");
      expect(res.data.type).toBe("showcase");
      expect(res.data.time).toBe("14:30");
    }
  });

  it("parses a valid gym payload", () => {
    const res = submissionInputSchema.safeParse({
      kind: "gym",
      clubName: "My Club",
      schedule: "Vrijdag 19:00-21:00",
    });
    expect(res.success).toBe(true);
  });

  it("parses a valid club payload", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      name: "My Club",
      city: "Amsterdam",
      website: "https://www.myclub.nl",
    });
    expect(res.success).toBe(true);
  });

  it("parses a valid correction payload", () => {
    const res = submissionInputSchema.safeParse({
      kind: "correction",
      description: "The address for this club is wrong.",
    });
    expect(res.success).toBe(true);
  });

  // ---- missing required fields per kind ----

  it("rejects an event missing its title", () => {
    const res = submissionInputSchema.safeParse({
      kind: "event",
      type: "showcase",
      date: "2026-11-01",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a gym missing its schedule", () => {
    const res = submissionInputSchema.safeParse({
      kind: "gym",
      clubName: "My Club",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a club missing its city", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      name: "My Club",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a correction whose description is too short (<5 chars)", () => {
    const res = submissionInputSchema.safeParse({
      kind: "correction",
      description: "no",
    });
    expect(res.success).toBe(false);
  });

  // ---- discriminated union: unknown kind ----

  it("rejects an unknown kind", () => {
    const res = submissionInputSchema.safeParse({
      kind: "banana",
      title: "x",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an event with an out-of-enum type", () => {
    const res = submissionInputSchema.safeParse({
      kind: "event",
      title: "X",
      type: "party",
      date: "2026-11-01",
    });
    expect(res.success).toBe(false);
  });

  // ---- optionalUrl edge cases ----

  it("treats an empty-string url as undefined (optional)", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      name: "My Club",
      city: "Amsterdam",
      website: "",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data.kind === "club") {
      expect(res.data.website).toBeUndefined();
    }
  });

  it("keeps a valid https url", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      name: "My Club",
      city: "Amsterdam",
      website: "https://www.myclub.nl",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data.kind === "club") {
      expect(res.data.website).toBe("https://www.myclub.nl");
    }
  });

  it("rejects a non-URL string for an optional url field", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      name: "My Club",
      city: "Amsterdam",
      website: "not a url at all",
    });
    expect(res.success).toBe(false);
  });

  it("documents that Zod's url() accepts a TLD-less host like 'http://foo'", () => {
    // Pin current behavior: the schema does NOT require a dotted TLD. If this
    // ever changes (e.g. stricter URL validation) the assertion will flip and
    // force a deliberate review.
    const res = submissionInputSchema.safeParse({
      kind: "club",
      name: "My Club",
      city: "Amsterdam",
      website: "http://foo",
    });
    expect(res.success).toBe(true);
  });

  // ---- date regex edge cases ----

  it("accepts a syntactically valid YYYY-MM-DD date", () => {
    const res = submissionInputSchema.safeParse({
      kind: "event",
      title: "X",
      type: "other",
      date: "2026-06-15",
    });
    expect(res.success).toBe(true);
  });

  it("documents that the date regex passes calendar-invalid dates like 2025-99-99", () => {
    // The regex only checks the SHAPE \d{4}-\d{2}-\d{2}; it does not validate
    // that month/day are in range. This is intentionally pinned so a regression
    // (or a fix that adds real date parsing) is a conscious change.
    const res = submissionInputSchema.safeParse({
      kind: "event",
      title: "X",
      type: "other",
      date: "2025-99-99",
    });
    expect(res.success).toBe(true);
  });

  it("rejects a date in the wrong shape", () => {
    const res = submissionInputSchema.safeParse({
      kind: "event",
      title: "X",
      type: "other",
      date: "15-06-2026",
    });
    expect(res.success).toBe(false);
  });

  // ---- contactEmail edge cases ----

  it("strips an empty contactEmail to undefined", () => {
    const res = submissionInputSchema.safeParse({
      kind: "gym",
      clubName: "My Club",
      schedule: "Vrijdag 19:00",
      contactEmail: "",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data.kind === "gym") {
      expect(res.data.contactEmail).toBeUndefined();
    }
  });

  it("rejects a non-empty malformed contactEmail (does NOT silently strip it)", () => {
    const res = submissionInputSchema.safeParse({
      kind: "gym",
      clubName: "My Club",
      schedule: "Vrijdag 19:00",
      contactEmail: "definitely-not-an-email",
    });
    expect(res.success).toBe(false);
  });

  // ---- correction message length cap ----

  it("accepts a correction description at the 4000-char cap", () => {
    const res = submissionInputSchema.safeParse({
      kind: "correction",
      description: "x".repeat(4000),
    });
    expect(res.success).toBe(true);
  });

  it("rejects a correction description over the 4000-char cap", () => {
    const res = submissionInputSchema.safeParse({
      kind: "correction",
      description: "x".repeat(4001),
    });
    expect(res.success).toBe(false);
  });
});
