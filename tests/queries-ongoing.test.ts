/**
 * The ongoing-event filter in getPublishedEvents.
 *
 * A multi-day event must stay visible for its whole run, not vanish the moment
 * it starts. The rule under test: keep an event while `endsAt` (or `startsAt`
 * when there is no end) is still in the future.
 */
import { describe, it, expect } from "vitest";

/** Mirrors the predicate in lib/queries.ts#getPublishedEvents. */
function stillRunning(
  e: { startsAt: string; endsAt: string | null },
  now: Date,
): boolean {
  return new Date(e.endsAt ?? e.startsAt) >= now;
}

const NOW = new Date("2026-08-31T12:00:00+02:00");

describe("ongoing event filter", () => {
  it("keeps a multi-day event that has already started", () => {
    // DANSJA open lesweken: began 31 Aug, runs to 13 Sep.
    expect(
      stillRunning(
        {
          startsAt: "2026-08-31T00:00:00+02:00",
          endsAt: "2026-09-13T23:59:00+02:00",
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("keeps a two-day camp on its second day", () => {
    const secondDay = new Date("2026-09-27T09:00:00+02:00");
    expect(
      stillRunning(
        {
          startsAt: "2026-09-26T00:00:00+02:00",
          endsAt: "2026-09-27T23:59:00+02:00",
        },
        secondDay,
      ),
    ).toBe(true);
  });

  it("drops an event that has finished", () => {
    expect(
      stillRunning(
        {
          startsAt: "2026-08-29T10:00:00+02:00",
          endsAt: "2026-08-29T11:00:00+02:00",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("keeps a future event", () => {
    expect(
      stillRunning(
        {
          startsAt: "2026-09-05T12:00:00+02:00",
          endsAt: "2026-09-05T15:00:00+02:00",
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("falls back to startsAt when endsAt is null", () => {
    expect(
      stillRunning(
        { startsAt: "2026-09-05T12:00:00+02:00", endsAt: null },
        NOW,
      ),
    ).toBe(true);
    expect(
      stillRunning(
        { startsAt: "2026-08-01T12:00:00+02:00", endsAt: null },
        NOW,
      ),
    ).toBe(false);
  });
});
