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
