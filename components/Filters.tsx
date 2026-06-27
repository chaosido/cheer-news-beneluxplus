"use client";

import { BadgeCheck, Filter, X } from "lucide-react";
import { EVENT_TYPE_COLOR } from "@/lib/eventColors";
import type { EventType } from "@/lib/types";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import type { HomeFilters } from "@/components/home/types";

const ALL_TYPES: EventType[] = [
  "competition",
  "open_gym",
  "clinic",
  "tryout",
  "showcase",
  "training",
  "other",
];

interface FiltersProps {
  filters: HomeFilters;
  onChange: (next: HomeFilters) => void;
  /** Provinces present in the dataset (sorted), for the province dropdown. */
  provinces: string[];
  /** Count of items after filtering, shown as a live result count. */
  resultCount: number;
}

export function Filters({
  filters,
  onChange,
  provinces,
  resultCount,
}: FiltersProps) {
  const { t } = useI18n();

  function toggleType(type: EventType) {
    const next = new Set(filters.types);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange({ ...filters, types: next });
  }

  const hasActive =
    filters.types.size > 0 ||
    filters.province !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.membersOnly;

  function reset() {
    onChange({
      types: new Set(),
      province: null,
      from: null,
      to: null,
      membersOnly: false,
    });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      {/* Top row: title + result count + reset */}
      <div className="flex items-center gap-2">
        <Filter className="size-4 text-[var(--muted)]" aria-hidden />
        <span className="font-display text-sm font-semibold">
          {t.filters.title}
        </span>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {resultCount} {resultCount === 1 ? t.filters.item : t.filters.items}
        </span>
        {hasActive && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <X className="size-3" aria-hidden />
            {t.filters.clear}
          </button>
        )}
      </div>

      {/* Event-type chips */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_TYPES.map((type) => {
          const active = filters.types.has(type);
          const color = EVENT_TYPE_COLOR[type];
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-transparent text-white"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
              )}
              style={active ? { backgroundColor: color } : undefined}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.9)" : color,
                }}
              />
              {t.eventType[type]}
            </button>
          );
        })}
      </div>

      {/* Row: city + date range */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.province ?? ""}
          onChange={(e) =>
            onChange({ ...filters, province: e.target.value || null })
          }
          aria-label={t.filters.province}
          className="h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <option value="">{t.filters.allProvinces}</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          {t.filters.from}
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) =>
              onChange({ ...filters, from: e.target.value || null })
            }
            className="h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
        </label>
        <label className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          {t.filters.to}
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) =>
              onChange({ ...filters, to: e.target.value || null })
            }
            className="h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
        </label>

        <button
          type="button"
          aria-pressed={filters.membersOnly}
          onClick={() =>
            onChange({ ...filters, membersOnly: !filters.membersOnly })
          }
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            filters.membersOnly
              ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
          )}
        >
          <BadgeCheck className="size-3.5" aria-hidden />
          {t.filters.csnMembersOnly}
        </button>
      </div>
    </div>
  );
}
