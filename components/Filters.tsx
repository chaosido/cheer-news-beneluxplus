"use client";

import { Filter, X } from "lucide-react";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/eventColors";
import type { EventType } from "@/lib/types";
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
    filters.openGymsOnly;

  function reset() {
    onChange({
      types: new Set(),
      province: null,
      from: null,
      to: null,
      openGymsOnly: false,
    });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      {/* Top row: title + result count + reset */}
      <div className="flex items-center gap-2">
        <Filter className="size-4 text-[var(--muted)]" aria-hidden />
        <span className="font-display text-sm font-semibold">Filters</span>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {resultCount} {resultCount === 1 ? "item" : "items"}
        </span>
        {hasActive && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <X className="size-3" aria-hidden />
            Wissen
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
              {EVENT_TYPE_LABEL[type]}
            </button>
          );
        })}
      </div>

      {/* Row: city + date range + open-gym toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.province ?? ""}
          onChange={(e) =>
            onChange({ ...filters, province: e.target.value || null })
          }
          aria-label="Provincie"
          className="h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <option value="">Alle provincies</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          Van
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
          Tot
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
          role="switch"
          aria-checked={filters.openGymsOnly}
          onClick={() =>
            onChange({ ...filters, openGymsOnly: !filters.openGymsOnly })
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            filters.openGymsOnly
              ? "border-transparent bg-[var(--secondary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "relative h-3.5 w-6 rounded-full transition-colors",
              filters.openGymsOnly ? "bg-white/40" : "bg-[var(--border)]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-2.5 rounded-full bg-white transition-transform",
                filters.openGymsOnly ? "translate-x-2.5" : "translate-x-0.5",
              )}
            />
          </span>
          Alleen open gyms
        </button>
      </div>
    </div>
  );
}
