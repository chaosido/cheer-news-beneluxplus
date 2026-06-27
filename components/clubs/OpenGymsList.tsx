import { Coins, DoorOpen, MapPin } from "lucide-react";
import { EmptyState } from "@/components/home/EmptyState";
import { weeklySlots } from "@/lib/recurrence";
import { formatPrice } from "@/lib/priceFormat";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { OpenGymClient } from "@/lib/types";

interface OpenGymRow {
  key: string;
  weekdayIndex: number;
  label: string; // e.g. "Elke zaterdag 15:00–17:00" / "Every saturday 15:00–17:00"
  locationText: string | null;
  notes: string | null;
  priceLabel: string | null; // formatted amount or "free" label, or null when unknown
  priceNote: string | null;
}

/** Public open gyms rendered as their recurring WEEKLY pattern (not dated). */
export function OpenGymsList({
  openGyms,
  t,
  locale,
}: {
  openGyms: OpenGymClient[];
  t: Dictionary;
  locale: Locale;
}) {
  const rows: OpenGymRow[] = [];
  for (const gym of openGyms) {
    // Pricing is only meaningful for public open gyms, never team trainings.
    const showPrice = gym.sessionType !== "training";
    const priceLabel =
      showPrice && gym.price != null
        ? gym.price === 0
          ? t.club.openGymFree
          : formatPrice(gym.price, locale)
        : null;
    for (const slot of weeklySlots(gym)) {
      // Localize the weekday via its index (slot.weekday is NL by construction).
      const weekday = t.weekdays[slot.weekdayIndex] ?? slot.weekday;
      rows.push({
        key: `${gym.id}:${slot.weekdayIndex}:${slot.startTime}`,
        weekdayIndex: slot.weekdayIndex,
        label: `${t.club.every(weekday)} ${slot.startTime}–${slot.endTime}`,
        locationText: gym.locationText,
        notes: gym.notes,
        priceLabel,
        priceNote: showPrice ? (gym.priceNote ?? null) : null,
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
        title={t.club.emptyOpenGymsTitle}
        hint={t.club.emptyOpenGymsHint}
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
          {row.priceLabel && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--ink)]">
              <Coins
                className="size-3.5 shrink-0 text-[var(--muted)]"
                aria-hidden
              />
              <span>{row.priceLabel}</span>
            </p>
          )}
          {row.priceNote && (
            <p className="mt-0.5 text-sm text-[var(--muted)]">{row.priceNote}</p>
          )}
          {row.notes && (
            <p className="mt-0.5 text-sm text-[var(--muted)]">{row.notes}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
