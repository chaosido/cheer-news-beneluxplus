"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Search, SlidersHorizontal, X } from "lucide-react";
import { ClubCard } from "@/components/ClubCard";
import { EmptyState } from "@/components/home/EmptyState";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { AgeGroup, CheerLevel, ClubClient, Division } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVEL_OPTIONS: CheerLevel[] = ["1", "2", "3", "4", "5", "6", "7"];
const DIVISION_OPTIONS: Division[] = ["all_girl", "coed", "all_boy"];
const AGE_OPTIONS: AgeGroup[] = ["mini", "youth", "junior", "senior", "open"];

/**
 * Second classification axis (orthogonal to numeric level): performance-cheer
 * discipline + the non-leveled tiers. Lets pom/prep/recreational teams — which
 * carry no numeric level — stay filterable.
 */
type TeamType = "performance_cheer" | "prep" | "recreational";
const TYPE_OPTIONS: TeamType[] = ["performance_cheer", "prep", "recreational"];

interface ClubGridProps {
  clubs: ClubClient[];
}

/**
 * Searchable, filterable directory grid. All filtering is in-memory over the
 * server-provided list: free-text on name/city plus level / division / age /
 * province facets (province derived from each club's `region`).
 */
export function ClubGrid({ clubs }: ClubGridProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<CheerLevel | "">("");
  const [type, setType] = useState<TeamType | "">("");
  const [division, setDivision] = useState<Division | "">("");
  const [age, setAge] = useState<AgeGroup | "">("");
  const [province, setProvince] = useState("");
  // CSN-member clubs are the default base view; toggle off to show all clubs.
  const [csnOnly, setCsnOnly] = useState(true);

  // Provinces present in the dataset, sorted NL-style for the dropdown.
  const provinces = useMemo(
    () =>
      [
        ...new Set(
          clubs.map((c) => c.region).filter((r): r is string => Boolean(r)),
        ),
      ].sort((a, b) => a.localeCompare(b, "nl")),
    [clubs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (q) {
        const haystack = `${c.name} ${c.city}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (csnOnly && !c.csnMember) return false;
      if (province && c.region !== province) return false;
      const summary = c.teamsSummary ?? [];
      if (level && !summary.some((t) => t.level === level)) return false;
      if (
        type &&
        !summary.some((t) =>
          type === "performance_cheer"
            ? (t.discipline ?? "cheer") === "performance_cheer"
            : (t.tier ?? "competition") === type,
        )
      )
        return false;
      if (division && !summary.some((t) => t.division === division))
        return false;
      if (age && !summary.some((t) => t.ageGroup === age)) return false;
      return true;
    });
  }, [clubs, query, province, level, type, division, age, csnOnly]);

  const hasActive =
    query !== "" ||
    level !== "" ||
    type !== "" ||
    division !== "" ||
    age !== "" ||
    province !== "" ||
    // CSN-only is the default; showing all clubs is the deviation.
    !csnOnly;

  function reset() {
    setQuery("");
    setLevel("");
    setType("");
    setDivision("");
    setAge("");
    setProvince("");
    setCsnOnly(true);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.clubs.searchPlaceholder}
          aria-label={t.clubs.searchAria}
          className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)]">
          <SlidersHorizontal className="size-4" aria-hidden />
          {t.clubs.filter}
        </span>

        <FilterSelect
          label={t.clubs.level}
          value={level}
          onChange={(v) => setLevel(v as CheerLevel | "")}
          options={LEVEL_OPTIONS.map((l) => [l, t.level[l]])}
        />
        <FilterSelect
          label={t.clubs.type}
          value={type}
          onChange={(v) => setType(v as TeamType | "")}
          options={TYPE_OPTIONS.map((v) => [
            v,
            v === "performance_cheer"
              ? t.discipline.performance_cheer
              : t.tier[v],
          ])}
        />
        <FilterSelect
          label={t.clubs.division}
          value={division}
          onChange={(v) => setDivision(v as Division | "")}
          options={DIVISION_OPTIONS.map((d) => [d, t.division[d]])}
        />
        <FilterSelect
          label={t.clubs.age}
          value={age}
          onChange={(v) => setAge(v as AgeGroup | "")}
          options={AGE_OPTIONS.map((a) => [a, t.ageGroup[a]])}
        />
        <FilterSelect
          label={t.clubs.province}
          value={province}
          onChange={setProvince}
          options={provinces.map((p) => [p, p])}
        />

        <button
          type="button"
          aria-pressed={csnOnly}
          onClick={() => setCsnOnly((v) => !v)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            csnOnly
              ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
          )}
        >
          <BadgeCheck className="size-3.5" aria-hidden />
          {t.clubs.csnMembersOnly}
        </button>

        {hasActive && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <X className="size-3" aria-hidden />
            {t.clubs.clear}
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        <span className="font-semibold tabular-nums text-[var(--ink)]">
          {filtered.length}
        </span>{" "}
        {filtered.length === 1 ? t.clubs.one : t.clubs.many}
        {hasActive && clubs.length !== filtered.length
          ? t.clubs.ofTotal(clubs.length)
          : ""}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)]">
          <EmptyState
            icon={Users}
            title={
              clubs.length === 0
                ? t.clubs.emptyNoneTitle
                : t.clubs.emptyFilteredTitle
            }
            hint={
              clubs.length === 0
                ? t.clubs.emptyNoneHint
                : t.clubs.emptyFilteredHint
            }
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((club) => (
            <li key={club.id}>
              <ClubCard club={club} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const { t } = useI18n();
  const active = value !== "";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        "h-9 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]",
      )}
    >
      <option value="">{t.clubs.filterAll(label)}</option>
      {options.map(([val, lbl]) => (
        <option key={val} value={val}>
          {lbl}
        </option>
      ))}
    </select>
  );
}
