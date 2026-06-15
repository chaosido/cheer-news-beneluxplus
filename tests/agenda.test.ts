import { describe, it, expect } from "vitest";
import { buildAgenda } from "@/components/home/agenda";
import type { CalendarItem } from "@/components/home/types";

/** Build a minimal open-gym CalendarItem for a given day + owner. */
function gym(
  id: string,
  startsAt: string,
  owner: { clubId?: string | null; venueId?: string | null },
): CalendarItem {
  return {
    id,
    clubId: owner.clubId ?? null,
    venueId: owner.venueId ?? null,
    title: "Open gym",
    type: "open_gym",
    allDay: false,
    startsAt,
    endsAt: null,
    url: null,
    locationText: null,
    city: null,
    province: null,
    isOpenGym: true,
  };
}

const NOW = new Date("2026-06-15T08:00:00+02:00"); // a Monday

describe("buildAgenda venue merging", () => {
  it("condenses club-independent gyms at the same venue on the same day", () => {
    const items = [
      gym("a", "2026-06-15T19:00:00+02:00", { venueId: "v1" }),
      gym("b", "2026-06-15T20:00:00+02:00", { venueId: "v1" }),
    ];
    const groups = buildAgenda(items, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].count).toBe(2);
  });

  it("keeps different venues on the same day as separate rows", () => {
    const items = [
      gym("a", "2026-06-15T19:00:00+02:00", { venueId: "v1" }),
      gym("b", "2026-06-15T19:00:00+02:00", { venueId: "v2" }),
    ];
    const groups = buildAgenda(items, NOW);
    expect(groups[0].rows).toHaveLength(2);
  });

  it("does not merge a venue gym with a club gym on the same day", () => {
    const items = [
      gym("a", "2026-06-15T19:00:00+02:00", { clubId: "c1" }),
      gym("b", "2026-06-15T19:00:00+02:00", { venueId: "v1" }),
    ];
    const groups = buildAgenda(items, NOW);
    expect(groups[0].rows).toHaveLength(2);
  });
});

/** Build a one-off (non-open-gym) event CalendarItem. */
function event(
  id: string,
  startsAt: string,
  endsAt: string | null,
  allDay = false,
): CalendarItem {
  return {
    id,
    clubId: null,
    venueId: null,
    title: "Skills Days",
    type: "other",
    allDay,
    startsAt,
    endsAt,
    url: null,
    locationText: null,
    city: null,
    province: null,
    isOpenGym: false,
  };
}

describe("buildAgenda multi-day events", () => {
  it("shows a multi-day event under each day it spans", () => {
    const items = [
      event("skills", "2026-08-01T00:00:00+02:00", "2026-08-02T23:59:00+02:00", true),
    ];
    const groups = buildAgenda(items, NOW);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-08-01", "2026-08-02"]);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[1].rows).toHaveLength(1);
    // Same underlying item, distinct per-day row keys.
    expect(groups[0].rows[0].item.id).toBe("skills");
    expect(groups[1].rows[0].item.id).toBe("skills");
    expect(groups[0].rows[0].key).not.toBe(groups[1].rows[0].key);
    expect(groups[0].rows[0].timeLabel).toBe("Hele dag");
  });

  it("leaves a single-day event as one row with the plain id key", () => {
    const items = [
      event("one", "2026-08-01T19:00:00+02:00", "2026-08-01T21:00:00+02:00"),
    ];
    const groups = buildAgenda(items, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].key).toBe("one");
    expect(groups[0].rows[0].timeLabel).toBe("19:00 – 21:00");
  });

  it("labels timed multi-day spans with start time and 'tot' end time", () => {
    const items = [
      event("camp", "2026-08-01T10:00:00+02:00", "2026-08-02T16:00:00+02:00"),
    ];
    const groups = buildAgenda(items, NOW);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows[0].timeLabel).toBe("10:00");
    expect(groups[1].rows[0].timeLabel).toBe("tot 16:00");
  });
});
