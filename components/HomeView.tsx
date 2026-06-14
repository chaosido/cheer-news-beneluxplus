"use client";

/**
 * Front-page orchestrator (Client Component).
 *
 * Owns ALL interaction state shared between the map and the calendar:
 *  - `filters`              — client-side filtering over the in-memory dataset.
 *  - `hoveredClubId`        — transient hover highlight (map ⇄ agenda).
 *  - `selectedClubId`       — sticky selection (click a pin or an agenda entry).
 *  - `tab`                  — mobile-only Kaart/Agenda switch.
 *
 * SIGNATURE INTERACTION — pin ⇄ agenda sync:
 *   Both <Map> and <Calendar> receive `hoveredClubId`/`selectedClubId` plus
 *   `onHover`/`onSelect`. Hovering a pin sets `hoveredClubId`, which the
 *   calendar uses to ring that club's events and dim the rest; hovering an
 *   agenda entry reports its `clubId` back, which the map uses to enlarge/tint
 *   the matching pin and pan to it. Clicks promote to a sticky selection.
 *
 * The map is dynamically imported with `{ ssr: false }` because Leaflet needs
 * `window`.
 */
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, CalendarDays, Loader2 } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import { Filters } from "@/components/Filters";
import { RESET_HOME_EVENT } from "@/components/HomeNavLink";
import { EmptyState } from "@/components/home/EmptyState";
import { cn } from "@/lib/utils";
import type { CalendarItem, MapClub, HomeFilters } from "@/components/home/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[var(--surface-2)]">
      <Loader2 className="size-5 animate-spin text-[var(--muted)]" aria-hidden />
    </div>
  ),
});

const EMPTY_FILTERS: HomeFilters = {
  types: new Set(),
  province: null,
  from: null,
  to: null,
  openGymsOnly: false,
};

/** ISO instant → yyyy-MM-dd (local day, for date-range comparison). */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function HomeView({
  clubs,
  items,
}: {
  clubs: MapClub[];
  items: CalendarItem[];
}) {
  const [filters, setFilters] = useState<HomeFilters>(EMPTY_FILTERS);
  const [hoveredClubId, setHoveredClubId] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [tab, setTab] = useState<"map" | "calendar">("map");
  // Bumped to tell <Map> to recenter on the whole country.
  const [resetSignal, setResetSignal] = useState(0);

  // Clicking the header "Kaart & agenda" link while already on "/" dispatches
  // RESET_HOME_EVENT: clear selection/hover/province focus and recenter the map.
  useEffect(() => {
    function onReset() {
      setSelectedClubId(null);
      setHoveredClubId(null);
      setFilters((f) => ({ ...f, province: null }));
      setResetSignal((n) => n + 1);
    }
    window.addEventListener(RESET_HOME_EVENT, onReset);
    return () => window.removeEventListener(RESET_HOME_EVENT, onReset);
  }, []);

  // clubId → name, for the agenda's club line (passed to <Calendar>).
  const clubNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clubs) map[c.id] = c.name;
    return map;
  }, [clubs]);

  // Provinces for the dropdown — union of club regions and item provinces.
  const provinces = useMemo(() => {
    const set = new Set<string>();
    for (const c of clubs) if (c.region) set.add(c.region);
    for (const it of items) if (it.province) set.add(it.province);
    return [...set].sort((a, b) => a.localeCompare(b, "nl"));
  }, [clubs, items]);

  // Apply filters to the agenda items (small dataset → recompute each render).
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (filters.openGymsOnly && !it.isOpenGym) return false;
      if (filters.types.size > 0 && !filters.types.has(it.type)) return false;
      if (filters.province && it.province !== filters.province) return false;
      const d = dayKey(it.startsAt);
      if (filters.from && d < filters.from) return false;
      if (filters.to && d > filters.to) return false;
      return true;
    });
  }, [items, filters]);

  // Filter map pins to the province filter (event-type/date filters don't apply
  // to clubs themselves, but the province filter does so the two panels stay
  // coherent).
  const filteredClubs = useMemo(() => {
    if (!filters.province) return clubs;
    return clubs.filter((c) => c.region === filters.province);
  }, [clubs, filters.province]);

  // Toggle selection off when clicking the already-selected club.
  function handleSelect(id: string | null) {
    setSelectedClubId((prev) => (prev === id ? null : id));
  }

  const hasClubs = clubs.length > 0;
  const hasItems = items.length > 0;

  const mapPanel = hasClubs ? (
    <Map
      clubs={filteredClubs}
      hoveredClubId={hoveredClubId}
      selectedClubId={selectedClubId}
      onHover={setHoveredClubId}
      onSelect={handleSelect}
      resetSignal={resetSignal}
    />
  ) : (
    <EmptyState
      icon={MapIcon}
      title="Nog geen clubs op de kaart"
      hint="Zodra clubs met een locatie zijn toegevoegd, verschijnen ze hier als pins."
    />
  );

  const calendarPanel = hasItems ? (
    <div className="flex h-full flex-col">
      <Filters
        filters={filters}
        onChange={setFilters}
        provinces={provinces}
        resultCount={filteredItems.length}
      />
      <div className="min-h-0 flex-1">
        <Calendar
          items={filteredItems}
          clubNames={clubNames}
          hoveredClubId={hoveredClubId}
          selectedClubId={selectedClubId}
          onHover={setHoveredClubId}
          onSelect={handleSelect}
        />
      </div>
    </div>
  ) : (
    <EmptyState
      icon={CalendarDays}
      title="Nog geen evenementen"
      hint="Wedstrijden, open gyms en clinics verschijnen hier zodra ze bekend zijn."
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StyleOverrides />

      {/* Mobile tab switcher */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface)] md:hidden">
        <TabButton
          active={tab === "map"}
          onClick={() => setTab("map")}
          icon={<MapIcon className="size-4" aria-hidden />}
          label="Kaart"
        />
        <TabButton
          active={tab === "calendar"}
          onClick={() => setTab("calendar")}
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Agenda"
        />
      </div>

      {/* Split-view. Fills viewport under the 3.5rem sticky header. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[45%_1fr]">
        {/* Map panel */}
        <section
          className={cn(
            "relative min-h-0 border-[var(--border)] md:border-r",
            "h-[calc(100dvh-3.5rem-3rem)] md:h-[calc(100dvh-3.5rem)]",
            tab === "map" ? "block" : "hidden md:block",
          )}
          aria-label="Kaart van cheerleadingclubs"
        >
          {mapPanel}
        </section>

        {/* Calendar / agenda panel */}
        <section
          className={cn(
            "min-h-0 bg-[var(--bg)]",
            "h-[calc(100dvh-3.5rem-3rem)] md:h-[calc(100dvh-3.5rem)]",
            tab === "calendar" ? "block" : "hidden md:block",
          )}
          aria-label="Agenda van evenementen"
        >
          {calendarPanel}
        </section>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-12 flex-1 items-center justify-center gap-2 text-sm font-semibold transition-colors",
        active
          ? "border-b-2 border-[var(--accent)] text-[var(--ink)]"
          : "border-b-2 border-transparent text-[var(--muted)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Scoped style overrides for the Leaflet map chrome. We cannot edit globals.css,
 * so inject them here. Tokens reference the same CSS variables as the rest of
 * the app. (The agenda list is styled inline via Tailwind in Calendar.tsx and
 * needs no overrides here.)
 */
function StyleOverrides() {
  return (
    <style>{`
      /* Leaflet popup chrome → match app surfaces. */
      .leaflet-popup-content-wrapper { border-radius: var(--radius); box-shadow: var(--shadow-md); }
      .leaflet-popup-content { margin: 0.6rem 0.75rem; }
      .leaflet-container a.leaflet-popup-close-button { color: var(--muted); }
      .cheer-pin { background: transparent; border: none; filter: drop-shadow(0 1px 2px rgb(23 22 27 / 0.25)); }
    `}</style>
  );
}
