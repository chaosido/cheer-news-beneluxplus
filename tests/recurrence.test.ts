import { describe, it, expect } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { expandOpenGym, buildWeeklyRRule, weeklySlots } from "@/lib/recurrence";
import type { OpenGymClient } from "@/lib/types";

const TZ = "Europe/Amsterdam";

function makeGym(overrides: Partial<OpenGymClient> = {}): OpenGymClient {
  return {
    id: "gym1",
    clubId: "club1",
    dedupKey: "k",
    rrule: "RRULE:FREQ=WEEKLY;BYDAY=FR",
    exdates: [],
    startTime: "19:00",
    endTime: "21:00",
    tz: TZ,
    locationText: "Sporthal",
    lat: null,
    lng: null,
    notes: null,
    origin: "scrape",
    confidence: 0.9,
    extractorVersion: 1,
    status: "published",
    locked: false,
    validFrom: null,
    validUntil: null,
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("expandOpenGym", () => {
  it("renders a 19:00 local weekly gym at 19:00 local on BOTH sides of the late-March DST switch", () => {
    // NL DST 2025: clocks jump forward on Sun 30 March 2025.
    // Window covers Fridays 28 Mar (CET, +01:00) and 4 Apr (CEST, +02:00).
    const gym = makeGym();
    const start = new Date("2025-03-21T00:00:00Z");
    const end = new Date("2025-04-11T00:00:00Z");

    const occ = expandOpenGym(gym, start, end);
    const fridays = occ.map((o) =>
      formatInTimeZone(new Date(o.startsAt), TZ, "yyyy-MM-dd HH:mm"),
    );

    expect(fridays).toContain("2025-03-28 19:00"); // before DST (CET)
    expect(fridays).toContain("2025-04-04 19:00"); // after DST (CEST)

    // Verify the actual offsets differ across the boundary.
    const before = occ.find((o) => o.startsAt.startsWith("2025-03-28"))!;
    const after = occ.find((o) => o.startsAt.startsWith("2025-04-04"))!;
    expect(before.startsAt).toBe("2025-03-28T19:00:00+01:00");
    expect(after.startsAt).toBe("2025-04-04T19:00:00+02:00");

    // End times also respect local wall-clock.
    expect(before.endsAt).toBe("2025-03-28T21:00:00+01:00");
    expect(after.endsAt).toBe("2025-04-04T21:00:00+02:00");
  });

  it("removes an occurrence covered by an EXDATE", () => {
    const gym = makeGym({ exdates: ["2025-04-04T00:00:00+02:00"] });
    const start = new Date("2025-03-21T00:00:00Z");
    const end = new Date("2025-04-11T00:00:00Z");

    const occ = expandOpenGym(gym, start, end);
    const days = occ.map((o) => o.startsAt.slice(0, 10));

    expect(days).toContain("2025-03-28");
    expect(days).not.toContain("2025-04-04"); // excluded
  });

  it("honors validUntil: no occurrences past the end date", () => {
    // Weekly Friday gym ending 2025-04-04. The window extends to 2025-04-25,
    // but occurrences on/after 2025-04-11 must be suppressed.
    const gym = makeGym({ validUntil: "2025-04-04T23:59:59+02:00" });
    const start = new Date("2025-03-21T00:00:00Z");
    const end = new Date("2025-04-25T00:00:00Z");

    const occ = expandOpenGym(gym, start, end);
    const days = occ.map((o) => o.startsAt.slice(0, 10));

    expect(days).toContain("2025-03-28");
    expect(days).toContain("2025-04-04");
    expect(days).not.toContain("2025-04-11"); // past validUntil
    expect(days).not.toContain("2025-04-18");
  });

  it("midnight-crossing gym: endsAt falls on the next calendar day", () => {
    // 23:00–01:00 weekly Wednesday. endsAt should land on the Thursday.
    const gym = makeGym({
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE",
      startTime: "23:00",
      endTime: "01:00",
    });
    const start = new Date("2025-06-01T00:00:00Z");
    const end = new Date("2025-06-15T00:00:00Z");

    const occ = expandOpenGym(gym, start, end);
    const wed = occ.find((o) => o.startsAt.startsWith("2025-06-04"))!;
    expect(wed).toBeDefined();
    expect(wed.startsAt).toBe("2025-06-04T23:00:00+02:00"); // Wednesday
    expect(wed.endsAt).toBe("2025-06-05T01:00:00+02:00"); // Thursday
  });

  it("zero-duration gym (equal start/end times) stays on the same day", () => {
    const gym = makeGym({
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE",
      startTime: "09:00",
      endTime: "09:00",
    });
    const start = new Date("2025-06-01T00:00:00Z");
    const end = new Date("2025-06-15T00:00:00Z");

    const occ = expandOpenGym(gym, start, end);
    const wed = occ.find((o) => o.startsAt.startsWith("2025-06-04"))!;
    expect(wed).toBeDefined();
    expect(wed.startsAt).toBe("2025-06-04T09:00:00+02:00");
    expect(wed.endsAt).toBe("2025-06-04T09:00:00+02:00"); // same day, not +1
  });

  it("renders a 19:00 gym correctly through the October DST fall-back", () => {
    // NL DST 2025: clocks go back on Sun 26 Oct 2025.
    // Fri 24 Oct is CEST (+02:00); Fri 31 Oct is CET (+01:00).
    const gym = makeGym();
    const start = new Date("2025-10-20T00:00:00Z");
    const end = new Date("2025-11-05T00:00:00Z");

    const occ = expandOpenGym(gym, start, end);
    const before = occ.find((o) => o.startsAt.startsWith("2025-10-24"))!;
    const after = occ.find((o) => o.startsAt.startsWith("2025-10-31"))!;
    expect(before.startsAt).toBe("2025-10-24T19:00:00+02:00"); // CEST
    expect(after.startsAt).toBe("2025-10-31T19:00:00+01:00"); // CET
  });

  it("bi-weekly rrule skips alternate weeks", () => {
    const gym = makeGym({
      rrule: "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR",
      validFrom: "2025-06-06T00:00:00+02:00",
    });
    const start = new Date("2025-06-01T00:00:00Z");
    const end = new Date("2025-07-05T00:00:00Z");

    const occ = expandOpenGym(gym, start, end);
    const days = occ.map((o) => o.startsAt.slice(0, 10));

    // Anchored on Fri 6 Jun: 6 Jun, 20 Jun, 4 Jul; 13 Jun and 27 Jun skipped.
    expect(days).toContain("2025-06-06");
    expect(days).toContain("2025-06-20");
    expect(days).toContain("2025-07-04");
    expect(days).not.toContain("2025-06-13");
    expect(days).not.toContain("2025-06-27");
  });

  it("emits a single occurrence for a one-off gym (no rrule, uses validFrom)", () => {
    const gym = makeGym({
      rrule: null,
      validFrom: "2025-06-13T00:00:00+02:00",
    });
    const occ = expandOpenGym(
      gym,
      new Date("2025-06-01T00:00:00Z"),
      new Date("2025-06-30T00:00:00Z"),
    );
    expect(occ).toHaveLength(1);
    expect(occ[0].startsAt).toBe("2025-06-13T19:00:00+02:00");
  });
});

describe("weeklySlots", () => {
  it("emits one slot per BYDAY day, sorted by weekday, with Dutch weekday names", () => {
    const gym = makeGym({
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE,MO",
      startTime: "17:30",
      endTime: "19:30",
    });
    const slots = weeklySlots(gym);
    expect(slots).toEqual([
      {
        weekdayIndex: 0,
        weekday: "Maandag",
        startTime: "17:30",
        endTime: "19:30",
      },
      {
        weekdayIndex: 2,
        weekday: "Woensdag",
        startTime: "17:30",
        endTime: "19:30",
      },
    ]);
  });

  it("maps each BYDAY token to its Dutch weekday name", () => {
    const cases: Array<[string, string]> = [
      ["MO", "Maandag"],
      ["TU", "Dinsdag"],
      ["WE", "Woensdag"],
      ["TH", "Donderdag"],
      ["FR", "Vrijdag"],
      ["SA", "Zaterdag"],
      ["SU", "Zondag"],
    ];
    for (const [token, name] of cases) {
      const slots = weeklySlots(
        makeGym({ rrule: `RRULE:FREQ=WEEKLY;BYDAY=${token}` }),
      );
      expect(slots).toHaveLength(1);
      expect(slots[0].weekday).toBe(name);
    }
  });

  it("returns [] for a null rrule", () => {
    expect(weeklySlots(makeGym({ rrule: null }))).toEqual([]);
  });

  it("returns [] for a non-weekly rrule", () => {
    expect(
      weeklySlots(makeGym({ rrule: "RRULE:FREQ=MONTHLY;BYDAY=MO" })),
    ).toEqual([]);
  });
});

describe("buildWeeklyRRule", () => {
  it("builds a weekly RRULE for the given weekday (0=Mon)", () => {
    const rule = buildWeeklyRRule(4); // Friday
    expect(rule).toContain("FREQ=WEEKLY");
    expect(rule).toContain("FR");
  });
});
