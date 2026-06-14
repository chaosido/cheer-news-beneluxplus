import { describe, it, expect } from "vitest";
import {
  dedupeEvents,
  isSameEvent,
  titleSimilarity,
} from "@/lib/dedup";
import type { ExtractedEvent } from "@/lib/types";

function ev(overrides: Partial<ExtractedEvent>): ExtractedEvent {
  return {
    title: "Event",
    type: "competition",
    clubSlug: null,
    start: "2025-05-10T10:00:00+02:00",
    end: null,
    allDay: false,
    recurrence: null,
    location: { name: "Topsporthal Almere", address: null, lat: null, lng: null },
    description: null,
    url: null,
    ticketUrl: null,
    sourceUrl: "https://example.org",
    extractionMethod: "json-ld",
    confidence: 0.9,
    ...overrides,
  };
}

describe("titleSimilarity", () => {
  it("is high for token-overlapping titles", () => {
    expect(
      titleSimilarity(
        "Dutch Open Cheerleading Championship 2025",
        "Dutch Open Championship 2025"
      )
    ).toBeGreaterThanOrEqual(0.6);
  });
  it("is low for unrelated titles", () => {
    expect(titleSimilarity("Open Gym Friday", "National Tryouts")).toBeLessThan(
      0.6
    );
  });
});

describe("isSameEvent", () => {
  it("matches same day + same venue + similar title", () => {
    const a = ev({ title: "Dutch Open Championship 2025" });
    const b = ev({
      title: "Dutch Open Cheer Championship 2025",
      sourceUrl: "https://federation.nl",
    });
    expect(isSameEvent(a, b)).toBe(true);
  });

  it("does not match different days", () => {
    const a = ev({ start: "2025-05-10T10:00:00+02:00" });
    const b = ev({ start: "2025-05-11T10:00:00+02:00" });
    expect(isSameEvent(a, b)).toBe(false);
  });

  it("matches via geo proximity within 500m", () => {
    const a = ev({
      title: "Spring Cup 2025",
      location: { name: "Hall A", address: null, lat: 52.3702, lng: 4.8952 },
    });
    const b = ev({
      title: "Spring Cup 2025",
      location: { name: "Hall B", address: null, lat: 52.3705, lng: 4.8955 },
    });
    expect(isSameEvent(a, b)).toBe(true);
  });

  it("matches two locationless events with a strong title match", () => {
    const noLoc = { name: null, address: null, lat: null, lng: null };
    const a = ev({
      title: "Dutch Open Cheer Championship 2025",
      location: noLoc,
    });
    const b = ev({
      title: "Dutch Open Cheer Championship 2025",
      location: noLoc,
      sourceUrl: "https://federation.nl",
    });
    expect(isSameEvent(a, b)).toBe(true);
  });

  it("does NOT match locationless events whose titles only weakly overlap", () => {
    const noLoc = { name: null, address: null, lat: null, lng: null };
    // Dice ~0.67 here: enough for the located path (>= 0.6), but below the
    // stricter 0.75 threshold applied when both events lack any location.
    const a = ev({ title: "Spring Regional Cheer Cup 2025", location: noLoc });
    const b = ev({ title: "Spring Open Cup 2025", location: noLoc });
    expect(titleSimilarity(a.title, b.title)).toBeGreaterThanOrEqual(0.6);
    expect(titleSimilarity(a.title, b.title)).toBeLessThan(0.75);
    expect(isSameEvent(a, b)).toBe(false);
  });
});

describe("dedupeEvents", () => {
  it("clusters two near-duplicates (fed + club) into one canonicalEventId", () => {
    const fed = ev({
      title: "Dutch Open Championship 2025",
      sourceUrl: "https://federation.nl/calendar",
      confidence: 0.95,
    });
    const club = ev({
      title: "Dutch Open Cheer Championship 2025",
      sourceUrl: "https://myclub.nl/events",
      confidence: 0.65,
    });

    const clusters = dedupeEvents([fed, club]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
    expect(clusters[0].canonicalEventId).toMatch(/^[0-9a-f]{24}$/);
  });

  it("keeps genuinely different events separate", () => {
    const comp = ev({
      title: "Dutch Open Championship 2025",
      location: { name: "Topsporthal Almere", address: null, lat: null, lng: null },
    });
    const gym = ev({
      title: "Open Gym Friday",
      type: "open_gym",
      start: "2025-08-22T19:00:00+02:00",
      location: { name: "Club Den Haag", address: null, lat: null, lng: null },
    });

    const clusters = dedupeEvents([comp, gym]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].canonicalEventId).not.toBe(
      clusters[1].canonicalEventId
    );
  });

  it("assigns a stable canonicalEventId regardless of input order", () => {
    const a = ev({ title: "Dutch Open Championship 2025", confidence: 0.95 });
    const b = ev({
      title: "Dutch Open Cheer Championship 2025",
      confidence: 0.6,
    });
    const id1 = dedupeEvents([a, b])[0].canonicalEventId;
    const id2 = dedupeEvents([b, a])[0].canonicalEventId;
    expect(id1).toBe(id2);
  });

  it("keeps the canonicalEventId stable across runs when the representative changes", () => {
    // Run 1: club page wins (higher confidence), shorter title.
    const run1 = dedupeEvents([
      ev({
        title: "Dutch Open Championship 2025",
        location: { name: "Topsporthal Almere", address: null, lat: null, lng: null },
        confidence: 0.9,
      }),
    ])[0].canonicalEventId;

    // Run 2: same real-world event, but the page now exposes a longer,
    // differently-cased title with a subtitle and a different confidence —
    // which previously flipped the representative and the hash basis.
    const run2 = dedupeEvents([
      ev({
        title: "DUTCH open Championship 2025 — Senior Coed",
        location: { name: "Topsporthal Almere", address: null, lat: null, lng: null },
        confidence: 0.7,
      }),
      ev({
        title: "Dutch Open Championship 2025",
        location: { name: "Topsporthal Almere", address: null, lat: null, lng: null },
        confidence: 0.95,
      }),
    ])[0].canonicalEventId;

    expect(run2).toBe(run1);
  });

  it("merges a federation + club listing that both omit a venue", () => {
    const noLoc = { name: null, address: null, lat: null, lng: null };
    const fed = ev({
      title: "Dutch Open Cheer Championship 2025",
      location: noLoc,
      sourceUrl: "https://federation.nl/calendar",
      confidence: 0.95,
    });
    const club = ev({
      title: "Dutch Open Cheer Championship 2025",
      location: noLoc,
      sourceUrl: "https://myclub.nl/events",
      confidence: 0.6,
    });
    const clusters = dedupeEvents([fed, club]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
  });
});
