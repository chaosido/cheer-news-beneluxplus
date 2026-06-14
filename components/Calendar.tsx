"use client";

/**
 * Agenda (Client Component) — a custom, date-grouped list.
 *
 * Replaces the former FullCalendar month grid, which was large and low-density
 * for a dataset that is mostly sparse one-offs plus many recurring open gyms.
 * Instead we render a tight, scannable list grouped by date ("Vandaag",
 * "Morgen", "ma 16 jun"). Each row shows, at a glance and with no clicking:
 *   - a type color dot + NL type label (EVENT_TYPE_LABEL / EVENT_TYPE_COLOR)
 *   - the time / duration (or "Hele dag", or a multi-day range)
 *   - the title
 *   - the club name
 *   - the location / city
 *
 * Open-gym occurrences for the same club on the same day are condensed into one
 * row (with an "×N" count) so the handful of one-off events stay prominent.
 *
 * Hover/select sync (unchanged contract): each row reports its `clubId` via
 * `onHover` on mouse enter; when a club is focused (here or via a map pin), its
 * rows get an accent ring and the others dim. Clicking a row promotes to a
 * sticky selection (`onSelect`) and, if the item has a url, navigates
 * (internal → router push, external → new tab).
 *
 * Props are unchanged except `view` is dropped (no longer needed — the same
 * list serves the desktop right pane and the mobile "Agenda" tab) and an
 * optional `clubNames` map is accepted to render a clean club line.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, CalendarDays } from "lucide-react";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/eventColors";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/components/home/types";
import { buildAgenda, type AgendaRow } from "@/components/home/agenda";

interface CalendarProps {
  items: CalendarItem[];
  hoveredClubId: string | null;
  selectedClubId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  /** clubId → display name, for the club line (events may not embed it). */
  clubNames?: Record<string, string>;
}

/**
 * Display title for a row. Open-gym titles are generated as "Open gym · Club";
 * since we render the type label and club name separately, strip that prefix to
 * a plain "Open gym" so the title column isn't redundant.
 */
function displayTitle(item: CalendarItem): string {
  if (item.isOpenGym) return EVENT_TYPE_LABEL.open_gym;
  return item.title;
}

export function Calendar({
  items,
  hoveredClubId,
  selectedClubId,
  onHover,
  onSelect,
  clubNames,
}: CalendarProps) {
  const router = useRouter();
  // Single "now" per mount so "Vandaag"/"Morgen" headers are stable across
  // renders. A lazy useState initializer runs exactly once on mount and is a
  // legitimate render-time value (unlike reading a ref during render).
  const [now] = useState(() => new Date());

  const groups = useMemo(
    () => buildAgenda(items, now),
    [items, now],
  );

  const focusId = selectedClubId ?? hoveredClubId;

  function navigate(item: CalendarItem) {
    if (item.clubId) onSelect(item.clubId);
    if (item.url) {
      if (item.url.startsWith("/")) router.push(item.url);
      else window.open(item.url, "_blank", "noopener,noreferrer");
    }
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <p className="font-display text-sm font-semibold text-[var(--ink)]">
          Geen evenementen
        </p>
        <p className="max-w-xs text-xs text-[var(--muted)]">
          Geen evenementen in deze periode of met deze filters.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ul className="divide-y divide-[var(--border)]">
        {groups.map((group) => (
          <li key={group.dayKey}>
            {/* Sticky date separator */}
            <h3 className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/95 px-4 py-1.5 backdrop-blur">
              <span className="font-display text-xs font-bold uppercase tracking-wide text-[var(--ink)]">
                {group.label}
              </span>
              <span className="text-[0.7rem] tabular-nums text-[var(--muted)]">
                {group.rows.length}
              </span>
            </h3>
            <ul>
              {group.rows.map((row) => (
                <AgendaRowItem
                  key={row.key}
                  row={row}
                  focusId={focusId}
                  clubNames={clubNames}
                  onHover={onHover}
                  onActivate={navigate}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgendaRowItem({
  row,
  focusId,
  clubNames,
  onHover,
  onActivate,
}: {
  row: AgendaRow;
  focusId: string | null;
  clubNames?: Record<string, string>;
  onHover: (id: string | null) => void;
  onActivate: (item: CalendarItem) => void;
}) {
  const { item } = row;
  const color = EVENT_TYPE_COLOR[item.type];
  // Highlight is keyed by club: focusing a club (via a pin or any of its agenda
  // rows) highlights EVERY row that belongs to it — so all of a club's open-gym
  // occurrences light up together, not just the hovered/clicked one.
  const dimmed = focusId != null && item.clubId !== focusId;
  const focused = focusId != null && item.clubId === focusId;

  const clubName =
    (item.clubId && clubNames?.[item.clubId]) ||
    (item.isOpenGym ? clubNameFromTitle(item.title) : null);

  const interactive = Boolean(item.url || item.clubId);

  return (
    <li
      onMouseEnter={() => onHover(item.clubId)}
      onMouseLeave={() => onHover(null)}
      onClick={interactive ? () => onActivate(item) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(item);
              }
            }
          : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      aria-label={interactive ? `${displayTitle(item)} — meer info` : undefined}
      className={cn(
        "flex items-start gap-3 px-4 py-2.5 transition-colors",
        interactive && "cursor-pointer",
        // Only show the neutral hover background when NOT focused; otherwise the
        // gray hover would override the red highlight on whichever row the cursor
        // is on (so the selected/hovered row would drop out of the club's red set).
        interactive && !focused && "hover:bg-[var(--surface-2)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]",
        dimmed && "opacity-40",
        focused &&
          "bg-[var(--accent-soft)] ring-2 ring-inset ring-[var(--accent)]",
      )}
    >
      {/* Type color marker */}
      <span
        aria-hidden
        className="mt-1 size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* Time / duration column */}
      <span className="mt-px flex w-[5.5rem] shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-[var(--ink)]">
        <Clock className="size-3 shrink-0 text-[var(--muted)]" aria-hidden />
        <span className="truncate">{row.timeLabel}</span>
      </span>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-[var(--ink)]">
            {displayTitle(item)}
          </span>
          {row.count > 1 && (
            <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-1.5 text-[0.65rem] font-semibold tabular-nums text-[var(--muted)]">
              {row.count}×
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
          <span
            className="font-medium"
            style={{ color }}
          >
            {EVENT_TYPE_LABEL[item.type]}
          </span>
          {clubName && (
            <>
              <span aria-hidden className="text-[var(--border)]">
                ·
              </span>
              <span className="truncate text-[var(--ink)]">{clubName}</span>
            </>
          )}
          {item.locationText && (
            <>
              <span aria-hidden className="text-[var(--border)]">
                ·
              </span>
              <span className="inline-flex min-w-0 items-center gap-0.5">
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{item.locationText}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** Recover the club name from a generated open-gym title ("Open gym · Club"). */
function clubNameFromTitle(title: string): string | null {
  const idx = title.indexOf("·");
  if (idx === -1) return null;
  const name = title.slice(idx + 1).trim();
  return name || null;
}
