/**
 * Pure helpers for the agenda list (no React, easy to reason about/test).
 *
 * The agenda renders a flat, date-grouped list instead of a month grid. These
 * helpers turn the flat `CalendarItem[]` into grouped, condensed rows and format
 * the date/time strings shown per row — all Dutch, all Amsterdam-day based.
 */
import { formatInTimeZone } from "date-fns-tz";
import { TZ, dateFnsLocale, dayKey } from "@/lib/dateFormat";
import type { Locale } from "@/lib/i18n/config";
import type { CalendarItem } from "@/components/home/types";

/**
 * The agenda label strings this module needs, supplied by the caller from the
 * active dictionary (`t.agenda`). Keeps these pure helpers free of any i18n
 * import while still rendering in the chosen language.
 */
export interface AgendaLabels {
  today: string;
  tomorrow: string;
  allDay: string;
  until: string;
}

/** A single agenda row. May represent one item or several condensed occurrences. */
export interface AgendaRow {
  /** Row key (stable per render). */
  key: string;
  /** Representative item (first occurrence) — drives title/type/club/url. */
  item: CalendarItem;
  /** Number of occurrences condensed into this row (1 = a normal single row). */
  count: number;
  /** Pre-formatted time/duration string (e.g. "19:30", "19:30 – 21:00", "Hele dag"). */
  timeLabel: string;
}

/** A date section: a header label plus its rows. */
export interface AgendaGroup {
  /** yyyy-MM-dd day key (sort/identity). */
  dayKey: string;
  /** Header label, e.g. "Vandaag", "Morgen", "ma 16 jun". */
  label: string;
  rows: AgendaRow[];
}

/** "19:30" — Amsterdam wall-clock time. */
function timeFmt(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "HH:mm");
}

/** "16 jun" / "16 Jun" — day + short month (used for multi-day ranges). */
function dayMonthFmt(iso: string, locale: Locale): string {
  return formatInTimeZone(new Date(iso), TZ, "d MMM", {
    locale: dateFnsLocale(locale),
  });
}

/** "ma 16 jun" / "Mon 16 Jun" — short weekday + day + month. */
function headerFmt(dKey: string, locale: Locale): string {
  // dKey is a yyyy-MM-dd Amsterdam day; anchor to noon UTC so the calendar day
  // is unambiguous regardless of the Amsterdam offset.
  return formatInTimeZone(`${dKey}T12:00:00Z`, TZ, "eee d MMM", {
    locale: dateFnsLocale(locale),
  });
}

/** Header label for a day key relative to `today` (also a yyyy-MM-dd key). */
export function headerLabel(
  dKey: string,
  todayKey: string,
  labels: AgendaLabels,
  locale: Locale,
): string {
  if (dKey === todayKey) return labels.today;
  // Tomorrow.
  const tomorrow = new Date(`${todayKey}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (dKey === dayKey(tomorrow)) return labels.tomorrow;
  return headerFmt(dKey, locale);
}

/**
 * Format the time/duration cell for an item.
 *  - all-day, single day            → "Hele dag"
 *  - all-day, multi-day             → "16 jun – 17 jun"
 *  - timed, no end (or same-day end)→ "19:30"
 *  - timed with end on same day     → "19:30 – 21:00"
 *  - timed spanning days            → "16 jun 19:30 – 17 jun 02:00"
 */
export function timeLabel(
  item: CalendarItem,
  labels: AgendaLabels,
  locale: Locale,
): string {
  const startDay = dayKey(item.startsAt);
  const endDay = item.endsAt ? dayKey(item.endsAt) : startDay;

  if (item.allDay) {
    if (item.endsAt && endDay > startDay) {
      return `${dayMonthFmt(item.startsAt, locale)} – ${dayMonthFmt(item.endsAt, locale)}`;
    }
    return labels.allDay;
  }

  const startTime = timeFmt(item.startsAt);
  if (!item.endsAt) return startTime;

  if (endDay > startDay) {
    // Spans midnight / multiple days — qualify both ends with their date.
    return `${dayMonthFmt(item.startsAt, locale)} ${startTime} – ${dayMonthFmt(
      item.endsAt,
      locale,
    )} ${timeFmt(item.endsAt)}`;
  }
  return `${startTime} – ${timeFmt(item.endsAt)}`;
}

/** Max days a single event may be exploded across (guards bad data). */
const MAX_SPAN_DAYS = 31;

/**
 * The yyyy-MM-dd day keys an item spans, inclusive. A single-day item returns
 * one key; a multi-day event returns one per calendar day from start to end so
 * it can appear under each day's header. Anchored at noon UTC so the calendar
 * day is unambiguous regardless of the Amsterdam offset.
 */
function spannedDayKeys(item: CalendarItem): string[] {
  const startKey = dayKey(item.startsAt);
  const endKey = item.endsAt ? dayKey(item.endsAt) : startKey;
  if (endKey <= startKey) return [startKey];
  const keys: string[] = [];
  const cursor = new Date(`${startKey}T12:00:00Z`);
  for (let i = 0; i < MAX_SPAN_DAYS; i++) {
    const key = cursor.toISOString().slice(0, 10);
    keys.push(key);
    if (key >= endKey) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/**
 * Per-day time cell for one day of a multi-day event: the start time on the
 * first day, "tot HH:mm" on the last, and "Hele dag" for full days in between
 * (or any all-day event).
 */
function timeLabelForDay(
  item: CalendarItem,
  dKey: string,
  span: string[],
  labels: AgendaLabels,
): string {
  if (item.allDay) return labels.allDay;
  if (dKey === span[0]) return timeFmt(item.startsAt);
  if (dKey === span[span.length - 1] && item.endsAt) {
    return `${labels.until} ${timeFmt(item.endsAt)}`;
  }
  return labels.allDay;
}

/**
 * Build date-grouped, condensed agenda rows from a flat (already filtered)
 * item list.
 *
 * Condensing: open-gym occurrences for the SAME club (or, for club-independent
 * gyms, the SAME venue) on the SAME day are merged into one row (events are
 * sparse; open gyms dominate, so this keeps one-off events from being drowned
 * out). One-off events are never merged. The merged row keeps the earliest
 * start and shows a count so detail isn't lost.
 *
 * Items are assumed sorted by `startsAt` ascending (page.tsx sorts them); we
 * sort defensively anyway so the component never depends on caller order.
 */
export function buildAgenda(
  items: CalendarItem[],
  now: Date,
  labels: AgendaLabels,
  locale: Locale,
): AgendaGroup[] {
  const sorted = [...items].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
  const todayKey = dayKey(now);

  const groups = new Map<string, AgendaGroup>();
  // Merge bucket for open gyms: `${dayKey}|${clubId|venueId}` → AgendaRow pushed.
  const gymMerge = new Map<string, AgendaRow>();

  const groupFor = (dKey: string): AgendaGroup => {
    let group = groups.get(dKey);
    if (!group) {
      group = {
        dayKey: dKey,
        label: headerLabel(dKey, todayKey, labels, locale),
        rows: [],
      };
      groups.set(dKey, group);
    }
    return group;
  };

  for (const item of sorted) {
    const startDayKey = dayKey(item.startsAt);

    // Condense open gyms by club (or by venue for club-independent gyms). Open
    // gyms are single-day occurrences, so they live only on their start day.
    const locator = item.clubId ?? item.venueId;
    if (item.isOpenGym && locator) {
      const mergeKey = `${startDayKey}|${locator}`;
      const existing = gymMerge.get(mergeKey);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const row: AgendaRow = {
        key: item.id,
        item,
        count: 1,
        timeLabel: timeLabel(item, labels, locale),
      };
      gymMerge.set(mergeKey, row);
      groupFor(startDayKey).rows.push(row);
      continue;
    }

    // Events appear under every day they span, so a multi-day event (e.g. a
    // two-day "Skills Days") shows under each day's header rather than as a
    // single range row on day one.
    //
    // Days already past are skipped. An event stays in the dataset while it is
    // still running (see getPublishedEvents), so a two-week block that began
    // last Monday would otherwise emit headers for every elapsed day and sort
    // them ABOVE "Vandaag". The span keeps its shape for the time labels — only
    // the group emission is bounded.
    const span = spannedDayKeys(item);
    for (const dKey of span) {
      if (dKey < todayKey) continue;
      groupFor(dKey).rows.push({
        key: span.length > 1 ? `${item.id}:${dKey}` : item.id,
        item,
        count: 1,
        timeLabel:
          span.length > 1
            ? timeLabelForDay(item, dKey, span, labels)
            : timeLabel(item, labels, locale),
      });
    }
  }

  return [...groups.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}
