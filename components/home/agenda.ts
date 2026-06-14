/**
 * Pure helpers for the agenda list (no React, easy to reason about/test).
 *
 * The agenda renders a flat, date-grouped list instead of a month grid. These
 * helpers turn the flat `CalendarItem[]` into grouped, condensed rows and format
 * the date/time strings shown per row — all Dutch, all Amsterdam-day based.
 */
import { formatInTimeZone } from "date-fns-tz";
import { nl } from "date-fns/locale";
import { TZ, dayKey } from "@/lib/dateFormat";
import type { CalendarItem } from "@/components/home/types";

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
  return formatInTimeZone(new Date(iso), TZ, "HH:mm", { locale: nl });
}

/** "16 jun" — day + short month (used for multi-day ranges). */
function dayMonthFmt(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "d MMM", { locale: nl });
}

/** "ma 16 jun" — short weekday + day + month. */
function headerFmt(dKey: string): string {
  // dKey is a yyyy-MM-dd Amsterdam day; anchor to noon UTC so the calendar day
  // is unambiguous regardless of the Amsterdam offset.
  return formatInTimeZone(`${dKey}T12:00:00Z`, TZ, "eee d MMM", { locale: nl });
}

/** Header label for a day key relative to `today` (also a yyyy-MM-dd key). */
export function headerLabel(dKey: string, todayKey: string): string {
  if (dKey === todayKey) return "Vandaag";
  // Tomorrow.
  const tomorrow = new Date(`${todayKey}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (dKey === dayKey(tomorrow)) return "Morgen";
  return headerFmt(dKey);
}

/**
 * Format the time/duration cell for an item.
 *  - all-day, single day            → "Hele dag"
 *  - all-day, multi-day             → "16 jun – 17 jun"
 *  - timed, no end (or same-day end)→ "19:30"
 *  - timed with end on same day     → "19:30 – 21:00"
 *  - timed spanning days            → "16 jun 19:30 – 17 jun 02:00"
 */
export function timeLabel(item: CalendarItem): string {
  const startDay = dayKey(item.startsAt);
  const endDay = item.endsAt ? dayKey(item.endsAt) : startDay;

  if (item.allDay) {
    if (item.endsAt && endDay > startDay) {
      return `${dayMonthFmt(item.startsAt)} – ${dayMonthFmt(item.endsAt)}`;
    }
    return "Hele dag";
  }

  const startTime = timeFmt(item.startsAt);
  if (!item.endsAt) return startTime;

  if (endDay > startDay) {
    // Spans midnight / multiple days — qualify both ends with their date.
    return `${dayMonthFmt(item.startsAt)} ${startTime} – ${dayMonthFmt(
      item.endsAt,
    )} ${timeFmt(item.endsAt)}`;
  }
  return `${startTime} – ${timeFmt(item.endsAt)}`;
}

/**
 * Build date-grouped, condensed agenda rows from a flat (already filtered)
 * item list.
 *
 * Condensing: open-gym occurrences for the SAME club on the SAME day are merged
 * into one row (events are sparse; open gyms dominate, so this keeps one-off
 * events from being drowned out). One-off events are never merged. The merged
 * row keeps the earliest start and shows a count so detail isn't lost.
 *
 * Items are assumed sorted by `startsAt` ascending (page.tsx sorts them); we
 * sort defensively anyway so the component never depends on caller order.
 */
export function buildAgenda(items: CalendarItem[], now: Date): AgendaGroup[] {
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const todayKey = dayKey(now);

  const groups = new Map<string, AgendaGroup>();
  // Merge bucket for open gyms: `${dayKey}|${clubId}` → AgendaRow already pushed.
  const gymMerge = new Map<string, AgendaRow>();

  for (const item of sorted) {
    const dKey = dayKey(item.startsAt);
    let group = groups.get(dKey);
    if (!group) {
      group = { dayKey: dKey, label: headerLabel(dKey, todayKey), rows: [] };
      groups.set(dKey, group);
    }

    if (item.isOpenGym && item.clubId) {
      const mergeKey = `${dKey}|${item.clubId}`;
      const existing = gymMerge.get(mergeKey);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const row: AgendaRow = {
        key: item.id,
        item,
        count: 1,
        timeLabel: timeLabel(item),
      };
      gymMerge.set(mergeKey, row);
      group.rows.push(row);
      continue;
    }

    group.rows.push({
      key: item.id,
      item,
      count: 1,
      timeLabel: timeLabel(item),
    });
  }

  return [...groups.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}
