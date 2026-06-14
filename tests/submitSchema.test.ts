import { describe, it, expect } from "vitest";
import { submissionInputSchema, SUBMISSION_KINDS } from "@/lib/submitSchema";

/**
 * The submission schema is the ONLY input-validation layer for the public
 * POST /api/submit endpoint. The form is now OPEN FORMAT: one `kind` tag, one
 * required free-text `message`, plus optional `url` and `contactEmail`. These
 * tests pin down its real behavior — including the `optionalUrl` / `contactEmail`
 * edge cases — so a silent drift can't sneak garbage into Firestore.
 *
 * Pure Zod, no mocking, no server-only imports.
 */

describe("submissionInputSchema (open format)", () => {
  // ---- happy path: every kind accepts the same open shape ----

  it.each(SUBMISSION_KINDS)("parses a valid %s submission", (kind) => {
    const res = submissionInputSchema.safeParse({
      kind,
      message: "Er ontbreekt een club in Amsterdam, zie de link.",
      url: "https://www.myclub.nl",
      contactEmail: "info@myclub.nl",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.kind).toBe(kind);
      expect(res.data.message).toContain("Amsterdam");
    }
  });

  it("parses a minimal submission (only kind + message)", () => {
    const res = submissionInputSchema.safeParse({
      kind: "feedback",
      message: "De kaart laadt traag op mobiel.",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.url).toBeUndefined();
      expect(res.data.contactEmail).toBeUndefined();
    }
  });

  // ---- required message ----

  it("rejects a submission with no message", () => {
    const res = submissionInputSchema.safeParse({ kind: "event" });
    expect(res.success).toBe(false);
  });

  it("rejects a message that is too short (<5 chars)", () => {
    const res = submissionInputSchema.safeParse({
      kind: "event",
      message: "no",
    });
    expect(res.success).toBe(false);
  });

  it("trims the message before length checks", () => {
    const res = submissionInputSchema.safeParse({
      kind: "event",
      message: "   hi   ", // only 2 non-space chars
    });
    expect(res.success).toBe(false);
  });

  it("accepts a message at the 8000-char cap", () => {
    const res = submissionInputSchema.safeParse({
      kind: "feedback",
      message: "x".repeat(8000),
    });
    expect(res.success).toBe(true);
  });

  it("rejects a message over the 8000-char cap", () => {
    const res = submissionInputSchema.safeParse({
      kind: "feedback",
      message: "x".repeat(8001),
    });
    expect(res.success).toBe(false);
  });

  // ---- kind enum ----

  it("rejects an unknown kind", () => {
    const res = submissionInputSchema.safeParse({
      kind: "banana",
      message: "anything goes here",
    });
    expect(res.success).toBe(false);
  });

  it("accepts the new 'feedback' kind", () => {
    const res = submissionInputSchema.safeParse({
      kind: "feedback",
      message: "Top site, ga zo door!",
    });
    expect(res.success).toBe(true);
  });

  // ---- optionalUrl edge cases ----

  it("treats an empty-string url as undefined (optional)", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      message: "Nieuwe club in Utrecht.",
      url: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.url).toBeUndefined();
  });

  it("keeps a valid https url", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      message: "Nieuwe club in Utrecht.",
      url: "https://www.myclub.nl",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.url).toBe("https://www.myclub.nl");
  });

  it("rejects a non-URL string for the url field", () => {
    const res = submissionInputSchema.safeParse({
      kind: "club",
      message: "Nieuwe club in Utrecht.",
      url: "not a url at all",
    });
    expect(res.success).toBe(false);
  });

  it("documents that Zod's url() accepts a TLD-less host like 'http://foo'", () => {
    // Pin current behavior: the schema does NOT require a dotted TLD. If this
    // ever changes (e.g. stricter URL validation) the assertion will flip and
    // force a deliberate review.
    const res = submissionInputSchema.safeParse({
      kind: "club",
      message: "Nieuwe club in Utrecht.",
      url: "http://foo",
    });
    expect(res.success).toBe(true);
  });

  // ---- contactEmail edge cases ----

  it("strips an empty contactEmail to undefined", () => {
    const res = submissionInputSchema.safeParse({
      kind: "gym",
      message: "Open gym op vrijdag bij My Club.",
      contactEmail: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.contactEmail).toBeUndefined();
  });

  it("rejects a non-empty malformed contactEmail (does NOT silently strip it)", () => {
    const res = submissionInputSchema.safeParse({
      kind: "gym",
      message: "Open gym op vrijdag bij My Club.",
      contactEmail: "definitely-not-an-email",
    });
    expect(res.success).toBe(false);
  });
});
