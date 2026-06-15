import type { EventType } from "@/lib/types";

/** CSS color (matches --type-* tokens in globals.css) per event type. */
export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  competition: "#ff2d6b",
  open_gym: "#0e7c7b",
  clinic: "#e8920c",
  tryout: "#7c3aed",
  showcase: "#2563eb",
  training: "#6b6973",
  other: "#6b6973",
};

/**
 * Dutch label per event type, for NON-UI / maintainer-facing contexts only
 * (e.g. server-side title fallbacks, notification emails). The user-facing UI
 * uses the locale dictionaries (`t.eventType`) instead, so it follows NL/EN.
 */
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  competition: "Wedstrijd",
  open_gym: "Open gym",
  clinic: "Workshop",
  tryout: "Tryout",
  showcase: "Showcase",
  training: "Training",
  other: "Overig",
};
