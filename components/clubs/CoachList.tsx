import { BadgeCheck } from "lucide-react";
import type { Coach } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Badge } from "@/components/ui/Badge";

/** Up-to-two-letter initials from a person's name, for an avatar chip. */
function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * The club's coaching staff. Each coach is an initials avatar + name, with the
 * role as supporting text when known and an ICU badge when certified. Renders
 * nothing for an empty roster — the caller decides whether to show the
 * surrounding section.
 */
export function CoachList({ coaches, t }: { coaches: Coach[]; t: Dictionary }) {
  if (coaches.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
      {coaches.map((coach, i) => (
        <li key={`${coach.name}:${i}`} className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-display text-sm font-bold text-[var(--accent)]"
          >
            {initials(coach.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <p className="truncate font-medium text-[var(--ink)]">
                {coach.name}
              </p>
              {coach.icuCertified && (
                <Badge
                  className="shrink-0 gap-1 text-[var(--accent)]"
                  title={t.club.icuCertified}
                  aria-label={t.club.icuCertified}
                >
                  <BadgeCheck className="size-3.5" aria-hidden />
                  ICU
                </Badge>
              )}
            </div>
            {coach.role && (
              <p className="truncate text-sm text-[var(--muted)]">
                {coach.role}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
