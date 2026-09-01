import { describe, it, expect } from "vitest";
import { buildAgenda, type AgendaLabels } from "@/components/home/agenda";
import { nl } from "@/lib/i18n/dictionaries";
import type { CalendarItem } from "@/components/home/types";

/** NL agenda labels, matching the assertions below ("Hele dag", "tot …"). */
const NL_LABELS: AgendaLabels = {
  today: nl.agenda.today,
  tomorrow: nl.agenda.tomorrow,
  allDay: nl.agenda.allDay,
  until: nl.agenda.until,
};

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
    anchor: owner.clubId
      ? { kind: "club", id: owner.clubId }
      : owner.venueId
        ? { kind: "venue", id: owner.venueId }
        : null,
  };
}

const NOW = new Date("2026-06-15T08:00:00+02:00"); // a Monday

describe("buildAgenda venue merging", () => {
  it("condenses club-independent gyms at the same venue on the same day", () => {
    const items = [
      gym("a", "2026-06-15T19:00:00+02:00", { venueId: "v1" }),
      gym("b", "2026-06-15T20:00:00+02:00", { venueId: "v1" }),
    ];
    const groups = buildAgenda(items, NOW, NL_LABELS, "nl");
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].count).toBe(2);
  });

  it("keeps different venues on the same day as separate rows", () => {
    const items = [
      gym("a", "2026-06-15T19:00:00+02:00", { venueId: "v1" }),
      gym("b", "2026-06-15T19:00:00+02:00", { venueId: "v2" }),
    ];
    const groups = buildAgenda(items, NOW, NL_LABELS, "nl");
    expect(groups[0].rows).toHaveLength(2);
  });

  it("does not merge a venue gym with a club gym on the same day", () => {
    const items = [
      gym("a", "2026-06-15T19:00:00+02:00", { clubId: "c1" }),
      gym("b", "2026-06-15T19:00:00+02:00", { venueId: "v1" }),
    ];
    const groups = buildAgenda(items, NOW, NL_LABELS, "nl");
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
    anchor: null,
  };
}

describe("buildAgenda multi-day events", () => {
  it("shows a multi-day event under each day it spans", () => {
    const items = [
      event(
        "skills",
        "2026-08-01T00:00:00+02:00",
        "2026-08-02T23:59:00+02:00",
        true,
      ),
    ];
    const groups = buildAgenda(items, NOW, NL_LABELS, "nl");
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
    const groups = buildAgenda(items, NOW, NL_LABELS, "nl");
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].key).toBe("one");
    expect(groups[0].rows[0].timeLabel).toBe("19:00 – 21:00");
  });

  it("labels timed multi-day spans with start time and 'tot' end time", () => {
    const items = [
      event("camp", "2026-08-01T10:00:00+02:00", "2026-08-02T16:00:00+02:00"),
    ];
    const groups = buildAgenda(items, NOW, NL_LABELS, "nl");
    expect(groups).toHaveLength(2);
    expect(groups[0].rows[0].timeLabel).toBe("10:00");
    expect(groups[1].rows[0].timeLabel).toBe("tot 16:00");
  });
});

describe("buildAgenda: an event already under way", () => {
  /** Build a multi-day all-day event, like DANSJA's two-week open-lesson block. */
  function span(id: string, startsAt: string, endsAt: string): CalendarItem {
    return {
      id,
      clubId: "dansja-cheerleading",
      venueId: null,
      title: "Gratis open lesweken",
      type: "open_gym",
      allDay: true,
      startsAt,
      endsAt,
      url: null,
      locationText: null,
      city: null,
      province: null,
      isOpenGym: false,
      anchor: { kind: "club", id: "dansja-cheerleading" },
    };
  }

  // Runs 31 Aug -> 13 Sep; "now" is the 5th, so five days have already elapsed.
  const RUNNING = span(
    "event:dansja-lesweken",
    "2026-08-31T00:00:00+02:00",
    "2026-09-13T23:59:00+02:00",
  );
  const SEPT_5 = new Date("2026-09-05T12:00:00+02:00");

  it("emits no day group before today", () => {
    const groups = buildAgenda([RUNNING], SEPT_5, NL_LABELS, "nl");
    const past = groups.filter((g) => g.dayKey < "2026-09-05");
    expect(past).toEqual([]);
  });

  it("still shows the event today and on every remaining day", () => {
    const groups = buildAgenda([RUNNING], SEPT_5, NL_LABELS, "nl");
    expect(groups[0].dayKey).toBe("2026-09-05");
    expect(groups.at(-1)!.dayKey).toBe("2026-09-13");
    // 5 Sept through 13 Sept inclusive.
    expect(groups).toHaveLength(9);
  });

  it("labels the first remaining group as today, not as the start date", () => {
    const groups = buildAgenda([RUNNING], SEPT_5, NL_LABELS, "nl");
    expect(groups[0].label).toBe(nl.agenda.today);
  });

  it("leaves a wholly-future span untouched", () => {
    const future = span(
      "event:future",
      "2026-09-26T00:00:00+02:00",
      "2026-09-27T23:59:00+02:00",
    );
    const groups = buildAgenda([future], SEPT_5, NL_LABELS, "nl");
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-09-26", "2026-09-27"]);
  });
});
