/**
 * Which agenda rows get their own candidate map pin.
 *
 * The rule: an item belonging to a club shares that club's persistent pin and
 * gets no pin of its own; only club-less items (federation events, venue-hosted
 * open gyms, visiting coaches) get one.
 *
 * Before this, an EVENT at a club got a candidate pin while an OPEN GYM at the
 * same address got none — so the two behaved differently, and zoomed out the
 * event's pin surfaced beneath the cluster marker instead of beside it.
 */
import { describe, it, expect } from "vitest";

/** Mirrors the mapEvents filter in app/page.tsx. */
const getsCandidatePin = (e: { clubId: string | null }) => e.clubId == null;

/**
 * Mirrors the hover branch in components/Calendar.tsx: a venue row drives the
 * venue channel, a club-less located row drives the item channel, a club row
 * drives neither.
 */
function hoverChannel(item: { clubId: string | null; venueId: string | null }) {
  if (item.venueId) return "venue";
  if (!item.clubId) return "item";
  return "club-only";
}

describe("candidate map pins", () => {
  it("gives no pin to a club-hosted event (DANSJA open lesweken)", () => {
    expect(getsCandidatePin({ clubId: "dansja-cheerleading" })).toBe(false);
  });

  it("gives a pin to a federation event with no club (NCA camp)", () => {
    expect(getsCandidatePin({ clubId: null })).toBe(true);
  });
});

describe("hover channel per row type", () => {
  it("treats a club event and a club open gym identically", () => {
    const clubEvent = { clubId: "dansja-cheerleading", venueId: null };
    const clubGym = { clubId: "ravens-cheerleading-utrecht", venueId: null };
    expect(hoverChannel(clubEvent)).toBe("club-only");
    expect(hoverChannel(clubGym)).toBe(hoverChannel(clubEvent));
  });

  it("routes a venue-hosted open gym down the venue channel", () => {
    expect(
      hoverChannel({ clubId: null, venueId: "venue:turnz-ookmeer-amsterdam" }),
    ).toBe("venue");
  });

  it("routes a club-less event down the item channel", () => {
    expect(hoverChannel({ clubId: null, venueId: null })).toBe("item");
  });
});
