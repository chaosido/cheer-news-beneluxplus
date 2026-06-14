import { describe, it, expect } from "vitest";
import { validateExtractedEvent } from "@/lib/validate";
import type { ExtractedEvent } from "@/lib/types";

const SOURCE = "https://www.myclub.nl/events";

function baseRaw(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  // A valid-ish event roughly one month out (relative to test run time).
  const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    title: "Spring Showcase",
    type: "showcase",
    clubSlug: null,
    start,
    end: null,
    allDay: false,
    recurrence: null,
    location: { name: "Sporthal", address: "Main St 1", lat: null, lng: null },
    description: "A fun event.",
    url: "https://www.myclub.nl/events/spring",
    ticketUrl: null,
    sourceUrl: SOURCE,
    extractionMethod: "json-ld",
    confidence: 0.9,
    ...overrides,
  };
}

describe("validateExtractedEvent", () => {
  it("accepts a well-formed event", () => {
    const res = validateExtractedEvent(baseRaw(), SOURCE);
    expect(res.ok).toBe(true);
  });

  it("rejects out-of-window dates (too far in the past)", () => {
    const res = validateExtractedEvent(
      baseRaw({ start: "2000-01-01T10:00:00+01:00" }),
      SOURCE,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.join(" ")).toMatch(/start/);
    }
  });

  it("rejects out-of-window dates (too far in the future)", () => {
    const res = validateExtractedEvent(
      baseRaw({ start: "2099-01-01T10:00:00+01:00" }),
      SOURCE,
    );
    expect(res.ok).toBe(false);
  });

  it("strips off-domain URLs to null but keeps allowlisted ticketing URLs", () => {
    const res = validateExtractedEvent(
      baseRaw({
        url: "https://evil.example.com/phish",
        ticketUrl: "https://www.eventbrite.nl/e/12345",
      }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.url).toBeNull(); // off-domain dropped
      expect(res.value.ticketUrl).toContain("eventbrite.nl"); // allowlisted kept
    }
  });

  it("keeps same-registrable-domain URLs (across subdomains)", () => {
    const res = validateExtractedEvent(
      baseRaw({ url: "https://tickets.myclub.nl/buy" }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.url).toContain("myclub.nl");
  });

  it("clamps confidence into 0..1", () => {
    const hi = validateExtractedEvent(baseRaw({ confidence: 5 }), SOURCE);
    const lo = validateExtractedEvent(baseRaw({ confidence: -3 }), SOURCE);
    expect(hi.ok && hi.value.confidence).toBe(1);
    expect(lo.ok && lo.value.confidence).toBe(0);
  });

  it("strips HTML from text fields and enforces length caps", () => {
    const longDesc = "x".repeat(6000);
    const res = validateExtractedEvent(
      baseRaw({
        title: "<b>Hack</b> <script>alert(1)</script>Showcase",
        description: `<p>${longDesc}</p>`,
      }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe("Hack Showcase");
      expect(res.value.title).not.toContain("<");
      expect(res.value.description).not.toContain("<");
      expect(res.value.description!.length).toBeLessThanOrEqual(5000);
    }
  });

  it("never trusts extractor-provided coordinates (always null)", () => {
    const res = validateExtractedEvent(
      baseRaw({
        location: { name: "X", address: null, lat: 52.1, lng: 4.3 },
      }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.location.lat).toBeNull();
      expect(res.value.location.lng).toBeNull();
    }
  });

  it("rejects shape-invalid input", () => {
    const res = validateExtractedEvent({ nope: true }, SOURCE);
    expect(res.ok).toBe(false);
  });

  it("drops end-before-start silently, still ok:true with end:null", () => {
    const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const endBeforeStart = new Date(start.getTime() - 60 * 60 * 1000); // 1h earlier
    const res = validateExtractedEvent(
      baseRaw({
        start: start.toISOString(),
        end: endBeforeStart.toISOString(),
      }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.end).toBeNull();
  });

  it("drops an out-of-window end but keeps the event (end:null)", () => {
    const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const res = validateExtractedEvent(
      baseRaw({
        start: start.toISOString(),
        end: "2099-01-01T10:00:00+01:00", // far future, dropped
      }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.end).toBeNull();
  });

  it("accepts an all-day event with a date-only start", () => {
    // Use a date well inside the now-1y..now+2y window regardless of run time.
    const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const endDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const res = validateExtractedEvent(
      baseRaw({ start: startDate, end: endDate, allDay: true }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.allDay).toBe(true);
      expect(res.value.start).toBe(startDate);
      expect(res.value.end).toBe(endDate);
    }
  });

  it("accepts a multi-day event with end several days after start", () => {
    const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
    const res = validateExtractedEvent(
      baseRaw({ start: start.toISOString(), end: end.toISOString() }),
      SOURCE,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.end).toBe(end.toISOString());
  });
});
