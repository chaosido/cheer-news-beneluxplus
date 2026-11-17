import { BadgeCheck } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Filled pill marking a Belgian Cheerleading Federation (BCF) member club —
 * the Belgian counterpart of the CSN badge, same category of tag, same
 * accent-token styling so it re-themes with the palette.
 */
export function BcfMemberBadge({
  t,
  className,
}: {
  t: Dictionary;
  className?: string;
}) {
  return (
    <span
      title={t.clubs.bcfMemberAria}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-fg)]",
        className,
      )}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {t.clubs.bcfMember}
    </span>
  );
}
