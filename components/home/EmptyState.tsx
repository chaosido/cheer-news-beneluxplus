import type { LucideIcon } from "lucide-react";

/** Intentional, on-brand empty state for a panel with no data. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-display text-sm font-semibold text-[var(--ink)]">
        {title}
      </p>
      {hint && <p className="max-w-xs text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
