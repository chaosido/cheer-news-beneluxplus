"use client";

/**
 * Calendar / agenda (Client Component) built on FullCalendar.
 *
 * - Desktop renders `dayGridMonth`; mobile renders `listMonth` (set via the
 *   `view` prop from HomeView, which knows the breakpoint).
 * - Each `CalendarItem` becomes a FullCalendar event colored by
 *   EVENT_TYPE_COLOR. Open-gym occurrences and one-off events share the model.
 * - Click → open the item's url (event page) or navigate to the club profile.
 *
 * Hover/select sync: every event carries its `clubId` in extendedProps. When a
 * club is focused elsewhere (map pin), events of other clubs dim and the
 * focused club's events get an accent ring. Hovering an event reports its club
 * back up via `onHover` so the map can highlight the matching pin.
 */
import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/eventColors";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/components/home/types";

interface CalendarProps {
  items: CalendarItem[];
  view: "dayGridMonth" | "listMonth";
  hoveredClubId: string | null;
  selectedClubId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

/**
 * Compute the FullCalendar `end` for a CalendarItem.
 *
 * - Timed events: pass `endsAt` through as-is (literal end instant).
 * - All-day events with an `endsAt` on a LATER date: FullCalendar uses `end`
 *   exclusively for all-day events, so we pass the day AFTER the last day
 *   (last day + 1) so the block spans inclusively across all its days.
 * - All-day events with no `endsAt` (or same-day end): omit `end` → a single
 *   all-day block on the start date.
 */
function allDayEnd(item: CalendarItem): string | undefined {
  if (!item.allDay) return item.endsAt ?? undefined;
  if (!item.endsAt) return undefined;
  const startDay = item.startsAt.slice(0, 10);
  const endDay = item.endsAt.slice(0, 10);
  if (endDay <= startDay) return undefined; // single all-day block
  // Exclusive end = last day + 1.
  const next = new Date(`${endDay}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function Calendar({
  items,
  view,
  hoveredClubId,
  selectedClubId,
  onHover,
  onSelect,
}: CalendarProps) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const events = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.title,
        start: item.startsAt,
        // FullCalendar treats `end` as EXCLUSIVE for all-day events. For a
        // multi-day all-day event we must therefore pass the day AFTER the last
        // day so it spans correctly; for timed events `end` is the literal
        // instant. All-day events with no end get no `end` (single-day block).
        end: allDayEnd(item),
        allDay: item.allDay,
        backgroundColor: EVENT_TYPE_COLOR[item.type],
        borderColor: EVENT_TYPE_COLOR[item.type],
        textColor: "#ffffff",
        extendedProps: {
          clubId: item.clubId,
          url: item.url,
          type: item.type,
          locationText: item.locationText,
          isOpenGym: item.isOpenGym,
        },
      })),
    [items],
  );

  const focusId = selectedClubId ?? hoveredClubId;

  function handleClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    const clubId = arg.event.extendedProps.clubId as string | null;
    const url = arg.event.extendedProps.url as string | null;
    if (clubId) onSelect(clubId);
    if (url) {
      if (url.startsWith("/")) router.push(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  // Per-event styling driven by the focused club.
  function eventClassNames(arg: { event: { extendedProps: Record<string, unknown> } }) {
    if (!focusId) return [];
    const clubId = arg.event.extendedProps.clubId as string | null;
    return clubId === focusId ? ["cheer-event-focus"] : ["cheer-event-dim"];
  }

  function renderEventContent(arg: EventContentArg) {
    const type = arg.event.extendedProps.type as keyof typeof EVENT_TYPE_LABEL;
    const location = arg.event.extendedProps.locationText as string | null;
    const isList = arg.view.type.startsWith("list");
    if (isList) {
      return (
        <div className="flex flex-col">
          <span className="font-medium">{arg.event.title}</span>
          <span className="text-xs opacity-70">
            {EVENT_TYPE_LABEL[type]}
            {location ? ` · ${location}` : ""}
          </span>
        </div>
      );
    }
    return (
      <div className="truncate px-1 text-xs font-medium" title={arg.event.title}>
        {arg.timeText && <span className="mr-1 opacity-80">{arg.timeText}</span>}
        {arg.event.title}
      </div>
    );
  }

  return (
    <div className={cn("cheer-calendar h-full overflow-auto p-3")}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, listPlugin]}
        initialView={view}
        // Re-init when the breakpoint flips desktop⇄mobile.
        key={view}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        locale="nl"
        firstDay={1}
        height="100%"
        events={events}
        eventClick={handleClick}
        eventClassNames={eventClassNames}
        eventContent={renderEventContent}
        eventMouseEnter={(arg) =>
          onHover(arg.event.extendedProps.clubId as string | null)
        }
        eventMouseLeave={() => onHover(null)}
        noEventsContent="Geen evenementen in deze periode"
        dayMaxEvents={3}
        buttonText={{ today: "Vandaag", month: "Maand", list: "Lijst" }}
        displayEventTime
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      />
    </div>
  );
}
