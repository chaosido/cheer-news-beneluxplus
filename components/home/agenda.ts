/**
 * Pure helpers for the agenda list (no React, easy to reason about/test).
 *
 * The agenda renders a flat, date-grouped list instead of a month grid. These
 * helpers turn the flat `CalendarItem[]` into grouped, condensed rows and format
 * the date/time strings shown per row — all Dutch, all local-day based.
 */
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

const TZ = "Europe/Amsterdam";

/** yyyy-MM-dd key formatter, fixed to Amsterdam time (en-CA yields ISO order). */
const DAYKEY_FMT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "numeric",
  timeZone: TZ,
});

/** ISO instant → yyyy-MM-dd of the Amsterdam calendar day it falls on. */
export function dayKey(iso: string): string {
  return DAYKEY_FMT.format(new Date(iso));
}

const TIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});

/** Short weekday + day + month, e.g. "ma 16 jun". */
const HEADER_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TZ,
});

/** Day + month, e.g. "16 jun" (used for multi-day ranges). */
const DAYMONTH_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  timeZone: TZ,
});

function stripDot(s: string): string {
  // nl-NL short weekday/month can include a trailing period ("ma.", "jun.").
  return s.replace(/\.(?=\s|$)/g, "");
}

/** Header label for a day key relative to `today` (also a yyyy-MM-dd key). */
export function headerLabel(dKey: string, todayKey: string): string {
  if (dKey === todayKey) return "Vandaag";
  // Tomorrow. Anchor the keys at UTC noon so neither the +1 day arithmetic nor
  // the Amsterdam reformat below can cross a calendar-day boundary regardless of
  // the runtime's own timezone.
  const today = new Date(`${todayKey}T12:00:00Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (dKey === dayKey(tomorrow.toISOString())) return "Morgen";
  const d = new Date(`${dKey}T12:00:00Z`);
  return stripDot(HEADER_FMT.format(d));
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
  const start = new Date(item.startsAt);
  const startDay = dayKey(item.startsAt);
  const endDay = item.endsAt ? dayKey(item.endsAt) : startDay;

  if (item.allDay) {
    if (item.endsAt && endDay > startDay) {
      return `${stripDot(DAYMONTH_FMT.format(start))} – ${stripDot(
        DAYMONTH_FMT.format(new Date(item.endsAt)),
      )}`;
    }
    return "Hele dag";
  }

  const startTime = TIME_FMT.format(start);
  if (!item.endsAt) return startTime;

  const end = new Date(item.endsAt);
  if (endDay > startDay) {
    // Spans midnight / multiple days — qualify both ends with their date.
    return `${stripDot(DAYMONTH_FMT.format(start))} ${startTime} – ${stripDot(
      DAYMONTH_FMT.format(end),
    )} ${TIME_FMT.format(end)}`;
  }
  return `${startTime} – ${TIME_FMT.format(end)}`;
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
  const todayKey = dayKey(now.toISOString());

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
