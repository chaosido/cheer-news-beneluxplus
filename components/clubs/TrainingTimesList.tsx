import { CalendarClock, MapPin } from "lucide-react";
import { EmptyState } from "@/components/home/EmptyState";
import { weeklySlots } from "@/lib/recurrence";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { OpenGymClient } from "@/lib/types";

/** One team's weekly training slots, derived from its recurring docs. */
interface TrainingGroup {
  label: string; // team name, or "Overig"/"Other" for unlabeled trainings
  isOther: boolean; // sorts last
  rows: {
    key: string;
    weekday: string; // localized weekday, e.g. "Maandag" / "Monday"
    weekdayIndex: number;
    startTime: string;
    endTime: string;
    locationText: string | null;
    notes: string | null;
  }[];
}

/** Group recurring training docs by `teamLabel` into weekly schedule rows. */
function buildGroups(
  trainings: OpenGymClient[],
  dict: Dictionary,
): TrainingGroup[] {
  const byLabel = new Map<string, TrainingGroup>();

  for (const t of trainings) {
    const label = t.teamLabel?.trim() || null;
    const key = label ?? "__other__";
    let group = byLabel.get(key);
    if (!group) {
      group = {
        label: label ?? dict.club.otherTeam,
        isOther: label == null,
        rows: [],
      };
      byLabel.set(key, group);
    }
    for (const slot of weeklySlots(t)) {
      group.rows.push({
        key: `${t.id}:${slot.weekdayIndex}:${slot.startTime}`,
        weekday: dict.weekdays[slot.weekdayIndex] ?? slot.weekday,
        weekdayIndex: slot.weekdayIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
        locationText: t.locationText,
        notes: t.notes,
      });
    }
  }

  const groups = [...byLabel.values()].filter((g) => g.rows.length > 0);
  for (const g of groups) {
    g.rows.sort(
      (a, b) =>
        a.weekdayIndex - b.weekdayIndex ||
        a.startTime.localeCompare(b.startTime),
    );
  }
  // Named teams first (alphabetical), "Overig"/null last.
  groups.sort((a, b) => {
    if (a.isOther !== b.isOther) return a.isOther ? 1 : -1;
    return a.label.localeCompare(b.label, "nl");
  });
  return groups;
}

/** Recurring weekly team training schedule, grouped per team. */
export function TrainingTimesList({
  trainings,
  t,
}: {
  trainings: OpenGymClient[];
  t: Dictionary;
}) {
  const groups = buildGroups(trainings, t);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={t.club.emptyTrainingTitle}
        hint={t.club.emptyTrainingHint}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="mb-2 font-display text-sm font-semibold text-[var(--ink)]">
            {group.label}
          </h3>
          <ul className="flex flex-col divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3">
            {group.rows.map((row) => (
              <li key={row.key} className="py-2.5">
                <p className="font-medium text-[var(--ink)]">
                  {row.weekday} {row.startTime}–{row.endTime}
                </p>
                {row.locationText && (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--muted)]">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{row.locationText}</span>
                  </p>
                )}
                {row.notes && (
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {row.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
