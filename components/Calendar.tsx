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
 * Hover/select sync: each row reports its `clubId` via `onHover` on mouse enter
 * (highlights the club's rows + tints its pin — no map movement); when a club is
 * focused (here or via a map pin), its rows get an accent ring and the others
 * dim. Clicking the row BODY promotes to a sticky selection (`onSelect`), which
 * makes the map zoom to that club's pin — it does NOT navigate. A separate
 * trailing link button is the only thing that navigates, to the club/coach/event
 * page (internal → next/link, external → new tab).
 *
 * Props are unchanged except `view` is dropped (no longer needed — the same
 * list serves the desktop right pane and the mobile "Agenda" tab) and an
 * optional `clubNames` map is accepted to render a clean club line.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, CalendarDays, ArrowRight, ExternalLink } from "lucide-react";
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
  /**
   * Reports the hovered row's CalendarItem id (`event:{id}` / `gym:...`), or
   * null on leave. The map uses this to reveal an event's location pin on hover
   * (events have no persistent pin). Independent of the club-keyed `onHover`.
   */
  onHoverItem?: (id: string | null) => void;
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
  onHoverItem,
  clubNames,
}: CalendarProps) {
  // Single "now" per mount so "Vandaag"/"Morgen" headers are stable across
  // renders. A lazy useState initializer runs exactly once on mount and is a
  // legitimate render-time value (unlike reading a ref during render).
  const [now] = useState(() => new Date());

  const groups = useMemo(() => buildAgenda(items, now), [items, now]);

  const focusId = selectedClubId ?? hoveredClubId;

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
                  onSelect={onSelect}
                  onHoverItem={onHoverItem}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Button label for the "go to page" link, tailored to where the url points. */
function linkLabel(url: string): string {
  if (url.startsWith("/clubs/")) return "Bekijk club";
  if (url.startsWith("/coaches")) return "Bekijk coach";
  if (url.startsWith("/")) return "Meer info";
  return "Website";
}

function AgendaRowItem({
  row,
  focusId,
  clubNames,
  onHover,
  onSelect,
  onHoverItem,
}: {
  row: AgendaRow;
  focusId: string | null;
  clubNames?: Record<string, string>;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onHoverItem?: (id: string | null) => void;
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

  // The row body selects the event's club → the map zooms to its location. The
  // trailing link (if the item has a url) is the ONLY thing that navigates away,
  // to the club/coach/event page. Splitting them lets a click reveal the pin
  // without leaving the page, and keeps the <a> out of the <button> (invalid).
  const canFocus = Boolean(item.clubId);
  const linkHref = item.url;
  const linkIsInternal = linkHref?.startsWith("/") ?? false;

  // Inner content is identical whether the row body is a <button> or a <div>.
  const content = (
    <>
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
          <span className="font-medium" style={{ color }}>
            {EVENT_TYPE_LABEL[item.type]}
          </span>
          {clubName && (
            <>
              <Dot />
              <span className="truncate text-[var(--ink)]">{clubName}</span>
            </>
          )}
          {item.locationText && (
            <>
              <Dot />
              <span className="inline-flex min-w-0 items-center gap-0.5">
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{item.locationText}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );

  // Row-level visual state (dim non-focused, highlight focused) wraps the whole
  // row — body + link button — so the accent ring frames both.
  const rowClass = cn(
    "flex items-stretch transition-colors",
    // Neutral hover background only when NOT focused, so the gray hover doesn't
    // override the red highlight on whichever row the cursor is on.
    !focused && (canFocus || linkHref) && "hover:bg-[var(--surface-2)]",
    dimmed && "opacity-40",
    focused && "bg-[var(--accent-soft)] ring-2 ring-inset ring-[var(--accent)]",
  );

  const bodyClass = cn(
    "flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-4 text-left",
    linkHref ? "pr-2" : "pr-4",
    canFocus &&
      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]",
  );

  const linkClass = cn(
    "my-1.5 mr-2 flex shrink-0 items-center gap-1 self-center rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors",
    "hover:border-[var(--accent)] hover:text-[var(--accent)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
  );

  return (
    <li
      onMouseEnter={() => {
        onHover(item.clubId);
        onHoverItem?.(item.id);
      }}
      onMouseLeave={() => {
        onHover(null);
        onHoverItem?.(null);
      }}
      className={rowClass}
    >
      {canFocus ? (
        <button
          type="button"
          onClick={() => onSelect(item.clubId)}
          aria-label={`${displayTitle(item)} — toon locatie op de kaart`}
          className={bodyClass}
        >
          {content}
        </button>
      ) : (
        <div className={bodyClass}>{content}</div>
      )}

      {linkHref &&
        (linkIsInternal ? (
          <Link
            href={linkHref}
            className={linkClass}
            aria-label={`${displayTitle(item)} — ${linkLabel(linkHref)}`}
          >
            {linkLabel(linkHref)}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            aria-label={`${displayTitle(item)} — ${linkLabel(linkHref)} (externe link)`}
          >
            {linkLabel(linkHref)}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ))}
    </li>
  );
}

/** Middot separator between metadata pieces. Hidden from assistive tech. */
function Dot() {
  return (
    <span aria-hidden className="text-[var(--border)]">
      ·
    </span>
  );
}

/** Recover the club name from a generated open-gym title ("Open gym · Club"). */
function clubNameFromTitle(title: string): string | null {
  const idx = title.indexOf("·");
  if (idx === -1) return null;
  const name = title.slice(idx + 1).trim();
  return name || null;
}
