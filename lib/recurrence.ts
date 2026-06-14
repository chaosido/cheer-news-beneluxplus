/**
 * Open-gym recurrence expansion.
 *
 * Expands an OpenGymClient's iCal RRULE (or single occurrence via `validFrom`)
 * into concrete dated `OpenGymOccurrence`s within a window.
 *
 * DST CORRECTNESS: `startTime`/`endTime` are LOCAL wall-clock "HH:mm" in the
 * gym's IANA `tz` (Europe/Amsterdam). A 19:00 weekly gym must render at 19:00
 * local on BOTH sides of the March/October DST switch. We therefore compute the
 * UTC instant per-occurrence from the local wall-clock components using the
 * zone (via `fromZonedTime`), NOT a fixed offset.
 */
import { RRule, Weekday } from "rrule";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { dayKey as zonedDayKey } from "@/lib/dateFormat";
import type { OpenGymClient, OpenGymOccurrence } from "@/lib/types";

/** rrule weekday helpers indexed Mon..Sun (ISO-ish) for convenience. */
const RRULE_WEEKDAYS: Weekday[] = [
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
  RRule.SU,
];

/**
 * Build a weekly RRULE string from a weekday.
 *
 * @param weekday   0 = Monday .. 6 = Sunday (ISO ordering).
 * @param opts.count    optional total occurrence count.
 * @param opts.until    optional UNTIL Date (exclusive upper bound per iCal).
 * @param opts.interval optional week interval (default 1).
 */
export function buildWeeklyRRule(
  weekday: number,
  opts: { count?: number; until?: Date; interval?: number } = {}
): string {
  const wd = RRULE_WEEKDAYS[((weekday % 7) + 7) % 7];
  const rule = new RRule({
    freq: RRule.WEEKLY,
    interval: opts.interval ?? 1,
    byweekday: [wd],
    count: opts.count,
    until: opts.until,
  });
  // RRule.toString() emits "RRULE:FREQ=WEEKLY;..." — return just the RRULE line.
  return rule.toString();
}

/** Parse "HH:mm" → {h, m}; tolerant of "H:mm" / "HH:mm:ss". */
function parseHHmm(s: string): { h: number; m: number } {
  const [hh = "0", mm = "0"] = s.split(":");
  const h = Number.parseInt(hh, 10);
  const m = Number.parseInt(mm, 10);
  return {
    h: Number.isFinite(h) ? h : 0,
    m: Number.isFinite(m) ? m : 0,
  };
}

/** YYYY-MM-DD of a Date as seen in the given IANA zone (shared day-key helper). */
function zonedDateKey(d: Date, tz: string): string {
  return zonedDayKey(d, tz);
}

/**
 * Combine a local calendar day + local "HH:mm" wall-clock in `tz` into a real
 * UTC instant, then render it as an ISO-8601 string WITH the zone's offset for
 * that instant (so the offset reflects DST at that moment).
 */
function localWallClockToIso(
  dayKey: string,
  time: { h: number; m: number },
  tz: string
): string {
  const hh = String(time.h).padStart(2, "0");
  const mm = String(time.m).padStart(2, "0");
  // Naive local wall-clock string; fromZonedTime interprets it in `tz`.
  const naive = `${dayKey}T${hh}:${mm}:00`;
  const instant = fromZonedTime(naive, tz);
  // Render in the same zone WITH offset, e.g. 2025-03-28T19:00:00+01:00.
  return formatInTimeZone(instant, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Expand an open gym into concrete occurrences within [rangeStart, rangeEnd].
 *
 * - If `rrule` is set, expand it; otherwise emit a single occurrence on the
 *   `validFrom` day (one-off gym).
 * - `exdates` (ISO dates) remove matching occurrences, compared on the LOCAL
 *   calendar day in `tz`.
 * - Each occurrence's startsAt/endsAt are ISO strings with the correct offset.
 * - endTime <= startTime is treated as crossing midnight (+1 local day).
 */
export function expandOpenGym(
  gym: OpenGymClient,
  rangeStart: Date,
  rangeEnd: Date
): OpenGymOccurrence[] {
  const tz = gym.tz || "Europe/Amsterdam";
  const start = parseHHmm(gym.startTime);
  const end = parseHHmm(gym.endTime);
  const crossesMidnight =
    end.h * 60 + end.m <= start.h * 60 + start.m;

  // Local calendar days on which the gym occurs (as YYYY-MM-DD in tz).
  const dayKeys: string[] = [];

  if (gym.rrule) {
    // RRule produces UTC-clock dates; we only consume their local calendar day.
    // The stored RRULE has no DTSTART, so rrule would default it to "now" and
    // miss windows in the past/future. Anchor DTSTART explicitly: use the
    // gym's validFrom if present, otherwise the start of the query window
    // (minus a buffer week so a recurrence landing exactly on rangeStart is
    // not clipped by rrule's own dtstart >= floor rule).
    const parsed = RRule.parseString(gym.rrule);
    if (!parsed.dtstart) {
      const anchor = gym.validFrom
        ? new Date(gym.validFrom)
        : new Date(rangeStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      // Use a UTC-midnight floating anchor so day-key extraction is stable.
      parsed.dtstart = new Date(
        Date.UTC(
          anchor.getUTCFullYear(),
          anchor.getUTCMonth(),
          anchor.getUTCDate()
        )
      );
    }
    const rule = new RRule(parsed);
    // Pad the query window by a day on each side so a boundary day whose local
    // start instant falls just outside the UTC window is not missed.
    const pad = 24 * 60 * 60 * 1000;
    const between = rule.between(
      new Date(rangeStart.getTime() - pad),
      new Date(rangeEnd.getTime() + pad),
      true
    );
    for (const occ of between) {
      // rrule emits floating times as UTC; format the UTC clock to a day key.
      dayKeys.push(formatInTimeZone(occ, "UTC", "yyyy-MM-dd"));
    }
  } else if (gym.validFrom) {
    dayKeys.push(zonedDateKey(new Date(gym.validFrom), tz));
  }

  // Normalize exdates to local day keys for comparison.
  const exDayKeys = new Set(
    (gym.exdates ?? []).map((iso) => zonedDateKey(new Date(iso), tz))
  );

  const occurrences: OpenGymOccurrence[] = [];
  const seen = new Set<string>();

  for (const dayKey of dayKeys) {
    if (exDayKeys.has(dayKey)) continue;
    if (seen.has(dayKey)) continue;
    seen.add(dayKey);

    const startsAt = localWallClockToIso(dayKey, start, tz);
    const endDayKey = crossesMidnight ? addDays(dayKey, 1) : dayKey;
    const endsAt = localWallClockToIso(endDayKey, end, tz);

    const startInstant = new Date(startsAt);
    // Clip to the requested window using the real instant.
    if (startInstant < rangeStart || startInstant > rangeEnd) continue;

    occurrences.push({
      openGymId: gym.id,
      clubId: gym.clubId,
      startsAt,
      endsAt,
      locationText: gym.locationText,
      lat: gym.lat,
      lng: gym.lng,
      notes: gym.notes,
    });
  }

  occurrences.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return occurrences;
}

/** iCal BYDAY token → {Dutch weekday name, Monday-based index 0..6}. */
const BYDAY_TO_NL: Record<string, { weekday: string; weekdayIndex: number }> = {
  MO: { weekday: "Maandag", weekdayIndex: 0 },
  TU: { weekday: "Dinsdag", weekdayIndex: 1 },
  WE: { weekday: "Woensdag", weekdayIndex: 2 },
  TH: { weekday: "Donderdag", weekdayIndex: 3 },
  FR: { weekday: "Vrijdag", weekdayIndex: 4 },
  SA: { weekday: "Zaterdag", weekdayIndex: 5 },
  SU: { weekday: "Zondag", weekdayIndex: 6 },
};

/** A single weekly recurring slot for display (no concrete date). */
export interface WeeklySlot {
  weekdayIndex: number; // 0 = Monday .. 6 = Sunday
  weekday: string; // Dutch weekday name, e.g. "Maandag"
  startTime: string; // local "HH:mm"
  endTime: string; // local "HH:mm"
}

/**
 * Turn a weekly-recurring open gym/training into display slots — one per BYDAY
 * day — WITHOUT expanding into concrete dated occurrences.
 *
 * Returns [] when the doc has no rrule, a non-weekly rrule, or no BYDAY days.
 * A doc may list multiple BYDAY days (e.g. "FREQ=WEEKLY;BYDAY=MO,WE"); each
 * yields its own slot. Slots are sorted by weekday then start time.
 */
export function weeklySlots(gym: OpenGymClient): WeeklySlot[] {
  if (!gym.rrule) return [];

  let parsed: ReturnType<typeof RRule.parseString>;
  try {
    parsed = RRule.parseString(gym.rrule);
  } catch {
    return [];
  }
  if (parsed.freq !== RRule.WEEKLY) return [];

  // Normalize byweekday into a set of BYDAY tokens (MO..SU).
  const days = Array.isArray(parsed.byweekday)
    ? parsed.byweekday
    : parsed.byweekday != null
      ? [parsed.byweekday]
      : [];

  const slots: WeeklySlot[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    // rrule may give us a Weekday instance, a number (0=Mon), or a string.
    let token: string | undefined;
    if (typeof day === "number") {
      token = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][day];
    } else if (typeof day === "string") {
      token = day.toUpperCase().slice(0, 2);
    } else if (day && typeof day === "object" && "weekday" in day) {
      token = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][
        (day as Weekday).weekday
      ];
    }
    if (!token) continue;
    const nl = BYDAY_TO_NL[token];
    if (!nl || seen.has(token)) continue;
    seen.add(token);
    slots.push({
      weekdayIndex: nl.weekdayIndex,
      weekday: nl.weekday,
      startTime: gym.startTime,
      endTime: gym.endTime,
    });
  }

  slots.sort(
    (a, b) =>
      a.weekdayIndex - b.weekdayIndex ||
      a.startTime.localeCompare(b.startTime),
  );
  return slots;
}

/** Add `n` days to a YYYY-MM-DD key (calendar arithmetic, no tz needed). */
function addDays(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return formatInTimeZone(dt, "UTC", "yyyy-MM-dd");
}
