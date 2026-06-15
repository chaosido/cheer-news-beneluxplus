import { DoorOpen, MapPin } from "lucide-react";
import { EmptyState } from "@/components/home/EmptyState";
import { weeklySlots } from "@/lib/recurrence";
import type { OpenGymClient } from "@/lib/types";

/** Lowercased Dutch weekday for the "Elke <dag>" phrasing. */
function elke(weekday: string): string {
  return `Elke ${weekday.toLowerCase()}`;
}

interface OpenGymRow {
  key: string;
  weekdayIndex: number;
  label: string; // e.g. "Elke zaterdag 15:00–17:00"
  locationText: string | null;
  notes: string | null;
}

/** Public open gyms rendered as their recurring WEEKLY pattern (not dated). */
export function OpenGymsList({ openGyms }: { openGyms: OpenGymClient[] }) {
  const rows: OpenGymRow[] = [];
  for (const gym of openGyms) {
    for (const slot of weeklySlots(gym)) {
      rows.push({
        key: `${gym.id}:${slot.weekdayIndex}:${slot.startTime}`,
        weekdayIndex: slot.weekdayIndex,
        label: `${elke(slot.weekday)} ${slot.startTime}–${slot.endTime}`,
        locationText: gym.locationText,
        notes: gym.notes,
      });
    }
  }
  rows.sort(
    (a, b) => a.weekdayIndex - b.weekdayIndex || a.label.localeCompare(b.label),
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={DoorOpen}
        title="Nog geen open gyms bekend"
        hint="Terugkerende open-gym tijden verschijnen hier zodra ze bekend zijn."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--border)]">
      {rows.map((row) => (
        <li key={row.key} className="py-3 first:pt-0 last:pb-0">
          <p className="font-medium text-[var(--ink)]">{row.label}</p>
          {row.locationText && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--muted)]">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{row.locationText}</span>
            </p>
          )}
          {row.notes && (
            <p className="mt-0.5 text-sm text-[var(--muted)]">{row.notes}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
