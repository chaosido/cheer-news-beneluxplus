import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/home/EmptyState";
import { EVENT_TYPE_COLOR } from "@/lib/eventColors";
import { formatDateTimeRange } from "@/components/clubs/dateFormat";
import { safeUrl } from "@/lib/safeUrl";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { EventClient } from "@/lib/types";

/** Upcoming one-off events for a club, formatted in Amsterdam time. */
export function EventsList({
  events,
  t,
  locale,
}: {
  events: EventClient[];
  t: Dictionary;
  locale: Locale;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t.club.emptyEventsTitle}
        hint={t.club.emptyEventsHint}
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--border)]">
      {events.map((e) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-[var(--ink)]">{e.title}</p>
              <Badge color={EVENT_TYPE_COLOR[e.type]} className="shrink-0">
                {t.eventType[e.type]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {formatDateTimeRange(e.startsAt, e.endsAt, locale)}
            </p>
            {e.locationText && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--muted)]">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{e.locationText}</span>
              </p>
            )}
          </>
        );
        // Defense-in-depth: event URLs are validated at write time, but
        // re-check the protocol allowlist at render so a malformed/legacy DB
        // value can never reach an href (no javascript:/data: schemes).
        const href = safeUrl(e.url);
        return (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-1 transition-colors hover:bg-[var(--surface-2)]"
              >
                {body}
              </a>
            ) : (
              <div className="px-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
