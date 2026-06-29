import type { EventType } from "@/lib/types";

/** CSS color (matches --type-* tokens in globals.css) per event type. */
export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  competition: "#ec1e24",
  open_gym: "#15803d",
  workshop: "#f37421",
  tryout: "#7c3aed",
  showcase: "#0891b2",
  other: "#64748b",
};

/**
 * Dutch label per event type, for NON-UI / maintainer-facing contexts only
 * (e.g. server-side title fallbacks, notification emails). The user-facing UI
 * uses the locale dictionaries (`t.eventType`) instead, so it follows NL/EN.
 */
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  competition: "Wedstrijd",
  open_gym: "Open gym",
  workshop: "Workshop",
  tryout: "Tryout",
  showcase: "Showcase",
  other: "Overig",
};
