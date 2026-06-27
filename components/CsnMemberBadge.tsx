import { BadgeCheck } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Filled pill marking a Cheersport Nederland (CSN) member club. Uses the brand
 * accent tokens so it re-themes automatically with the rest of the palette.
 * Shown on club cards and club profiles.
 */
export function CsnMemberBadge({
  t,
  className,
}: {
  t: Dictionary;
  className?: string;
}) {
  return (
    <span
      title={t.clubs.csnMemberAria}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-fg)]",
        className,
      )}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {t.clubs.csnMember}
    </span>
  );
}
