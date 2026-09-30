/**
 * Which pin a happening points at, and how the agenda reacts.
 *
 * These import the real implementation. The previous version of this file
 * re-implemented the predicate inside the test and asserted the copy, so it
 * could not fail when the shipped rule changed.
 */
import { describe, it, expect } from "vitest";
import {
  anchorForEvent,
  anchorForGym,
  metersBetween,
  SAME_SPOT_METERS,
} from "@/lib/anchors";
import { sameAnchor } from "@/components/home/types";

const DANSJA_CLUB = { lat: 52.0167738, lng: 5.0550503 };

describe("anchorForEvent", () => {
  it("points an event at its club when it is held there", () => {
    expect(
      anchorForEvent(
        { id: "x", clubId: "dansja-cheerleading", ...DANSJA_CLUB },
        DANSJA_CLUB,
      ),
    ).toEqual({ kind: "club", id: "dansja-cheerleading" });
  });

  it("gives a club event held elsewhere its own pin", () => {
    // Hikari (Rotterdam) competing in Den Bosch.
    expect(
      anchorForEvent(
        { id: "nk", clubId: "hikari-cheerleading", lat: 51.7269, lng: 5.3417 },
        { lat: 51.8991591, lng: 4.516658 },
      ),
    ).toEqual({ kind: "event", id: "event:nk" });
  });

  it("gives a club-less event its own pin", () => {
    expect(
      anchorForEvent(
        { id: "nca", clubId: null, lat: 51.3388, lng: 6.5853 },
        undefined,
      ),
    ).toEqual({ kind: "event", id: "event:nca" });
  });

  it("falls back to the club when the event has no coordinates", () => {
    expect(
      anchorForEvent(
        { id: "y", clubId: "hikari-cheerleading", lat: null, lng: null },
        { lat: 51.8991591, lng: 4.516658 },
      ),
    ).toEqual({ kind: "club", id: "hikari-cheerleading" });
  });

  it("returns no anchor when there is nothing to point at", () => {
    expect(
      anchorForEvent(
        { id: "z", clubId: null, lat: null, lng: null },
        undefined,
      ),
    ).toBeNull();
  });

  it("does not treat a city centroid as the club's address", () => {
    // The IJsselstein centroid is ~1 km from DANSJA's own address — far enough
    // that the threshold must NOT swallow it, which is why the fix is to give
    // such events the club's coordinates rather than to widen the threshold.
    const centroid = { lat: 52.0206, lng: 5.0417 };
    expect(
      metersBetween(
        centroid.lat,
        centroid.lng,
        DANSJA_CLUB.lat,
        DANSJA_CLUB.lng,
      ),
    ).toBeGreaterThan(SAME_SPOT_METERS);
  });
});

describe("anchorForGym", () => {
  it("points a club gym at its club — identical to a club event", () => {
    const gym = anchorForGym({
      clubId: "ravens-cheerleading-utrecht",
      venueAnchorId: "venue:x",
      lat: 52.08,
      lng: 5.12,
    });
    const event = anchorForEvent(
      { id: "e", clubId: "ravens-cheerleading-utrecht", lat: 52.08, lng: 5.12 },
      { lat: 52.08, lng: 5.12 },
    );
    expect(gym).toEqual({ kind: "club", id: "ravens-cheerleading-utrecht" });
    // The symmetry the whole change exists for.
    expect(sameAnchor(gym, event)).toBe(true);
  });

  it("points a venue gym at its venue", () => {
    expect(
      anchorForGym({
        clubId: null,
        venueAnchorId: "venue:turnz-ookmeer-amsterdam",
        lat: 52.37,
        lng: 4.79,
      }),
    ).toEqual({ kind: "venue", id: "venue:turnz-ookmeer-amsterdam" });
  });

  it("gives no anchor to a venue gym with no coordinates", () => {
    // Such a row must stay non-interactive: clicking it used to set a venue
    // focus that matched no pin, dimming the whole agenda with nothing shown.
    expect(
      anchorForGym({
        clubId: null,
        venueAnchorId: "venue:x",
        lat: null,
        lng: null,
      }),
    ).toBeNull();
  });
});

describe("sameAnchor", () => {
  it("matches only on both kind and id", () => {
    expect(
      sameAnchor({ kind: "club", id: "a" }, { kind: "club", id: "a" }),
    ).toBe(true);
    expect(
      sameAnchor({ kind: "club", id: "a" }, { kind: "venue", id: "a" }),
    ).toBe(false);
    expect(
      sameAnchor({ kind: "club", id: "a" }, { kind: "club", id: "b" }),
    ).toBe(false);
  });

  it("treats absent anchors as never matching, so they never focus a row", () => {
    expect(sameAnchor(null, null)).toBe(false);
    expect(sameAnchor(null, { kind: "club", id: "a" })).toBe(false);
  });
});
