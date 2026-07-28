/**
 * Shared date/time formatting — the single source of truth.
 *
 * Everything is rendered in Europe/Amsterdam wall-clock via date-fns-tz, so the
 * home agenda, club pages and recurrence logic all agree on what "a day" is.
 * The DATE words (weekday/month names) follow the active UI locale: NL by
 * default, EN when the visitor switches. Times are 24-hour in both.
 */
import { formatInTimeZone } from "date-fns-tz";
import { nl, enGB, type Locale as DateFnsLocale } from "date-fns/locale";
import type { Locale } from "@/lib/i18n/config";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

export const TZ = "Europe/Amsterdam";

/** Map a UI locale to its date-fns locale (EN uses en-GB: "16 Jun", 24h). */
export function dateFnsLocale(locale: Locale): DateFnsLocale {
  return locale === "en" ? enGB : nl;
}

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

/** "ma 13 jun 2026" / "Mon 13 Jun 2026" — short date in Amsterdam time. */
export function formatDate(
  iso: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatInTimeZone(new Date(iso), TZ, "eee d MMM yyyy", {
    locale: dateFnsLocale(locale),
  });
}

/** "19:00" — NL wall-clock time in Amsterdam (24-hour, locale-independent). */
export function formatTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "HH:mm");
}

/** "ma 13 jun 2026 · 19:00–21:00" / "Mon 13 Jun 2026 · 19:00–21:00". */
export function formatDateTimeRange(
  startIso: string,
  endIso: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const date = formatDate(startIso, locale);
  const start = formatTime(startIso);
  if (!endIso) return `${date} · ${start}`;
  return `${date} · ${start}–${formatTime(endIso)}`;
}
