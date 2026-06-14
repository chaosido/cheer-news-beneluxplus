import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/home/EmptyState";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/eventColors";
import { formatNlDateTimeRange } from "@/components/clubs/dateFormat";
import type { EventClient } from "@/lib/types";

/** Upcoming one-off events for a club, NL-formatted in Amsterdam time. */
export function EventsList({ events }: { events: EventClient[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nog geen evenementen bekend"
        hint="Aankomende wedstrijden en workshops verschijnen hier zodra ze bekend zijn."
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
                {EVENT_TYPE_LABEL[e.type]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {formatNlDateTimeRange(e.startsAt, e.endsAt)}
            </p>
            {e.locationText && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--muted)]">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{e.locationText}</span>
              </p>
            )}
          </>
        );
        return (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            {e.url ? (
              <a
                href={e.url}
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
