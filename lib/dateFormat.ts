/**
 * Shared NL date/time formatting — the single source of truth.
 *
 * Everything is rendered in Europe/Amsterdam wall-clock via date-fns-tz +
 * date-fns `nl` locale, so the home agenda, club pages and recurrence logic all
 * agree on what "a day" is and how dates read.
 */
import { formatInTimeZone } from "date-fns-tz";
import { nl } from "date-fns/locale";

export const TZ = "Europe/Amsterdam";

/**
 * ISO instant (or Date) → yyyy-MM-dd as seen in `tz` (default Amsterdam).
 *
 * tz-explicit so date-range filtering and agenda grouping never disagree about
 * the calendar day near midnight.
 */
export function dayKey(value: string | Date, tz: string = TZ): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

/** "ma 13 jun 2026" — short NL date in Amsterdam time. */
export function formatNlDate(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "eee d MMM yyyy", { locale: nl });
}

/** "19:00" — NL wall-clock time in Amsterdam. */
export function formatNlTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "HH:mm", { locale: nl });
}

/** "ma 13 jun 2026 · 19:00–21:00" (end optional). */
export function formatNlDateTimeRange(
  startIso: string,
  endIso: string | null,
): string {
  const date = formatNlDate(startIso);
  const start = formatNlTime(startIso);
  if (!endIso) return `${date} · ${start}`;
  return `${date} · ${start}–${formatNlTime(endIso)}`;
}
