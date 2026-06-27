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
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, CalendarDays, Loader2 } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import { Filters } from "@/components/Filters";
import { RESET_HOME_EVENT } from "@/components/HomeNavLink";
import { EmptyState } from "@/components/home/EmptyState";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/dateFormat";
import type {
  CalendarItem,
  MapClub,
  MapVenue,
  MapEvent,
  MapCoach,
  HomeFilters,
} from "@/components/home/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[var(--surface-2)]">
      <Loader2
        className="size-5 animate-spin text-[var(--muted)]"
        aria-hidden
      />
    </div>
  ),
});

const EMPTY_FILTERS: HomeFilters = {
  types: new Set(),
  province: null,
  from: null,
  to: null,
  membersOnly: false,
};

export function HomeView({
  clubs,
  venues,
  events,
  coaches,
  items,
}: {
  clubs: MapClub[];
  venues: MapVenue[];
  events: MapEvent[];
  coaches: MapCoach[];
  items: CalendarItem[];
}) {
  const { t } = useI18n();
  const [filters, setFilters] = useState<HomeFilters>(EMPTY_FILTERS);
  const [hoveredClubId, setHoveredClubId] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  // The agenda row currently hovered, keyed by CalendarItem id (`event:{id}` /
  // `gym:{id}:{i}`). Events have NO persistent map pin; hovering their row
  // reveals a single pin on the map (matched by id in <Map>). Independent of the
  // club-keyed highlight above, since an event is its own location, not a club's.
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  // Sticky pick of a club-less item with its own pin (e.g. an event at a venue).
  // Clicking such a row zooms the map to its pin and keeps it shown. Mutually
  // exclusive with `selectedClubId` — selecting one clears the other.
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // Club-independent open-gym venues live INSIDE the map cluster (like clubs),
  // so they get their own hover/select channel: hovering/clicking a venue open-
  // gym row reveals (spiders open) and highlights its buried pin via <MapFocus>.
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [tab, setTab] = useState<"map" | "calendar">("map");
  // Bumped to tell <Map> to recenter on the whole country.
  const [resetSignal, setResetSignal] = useState(0);

  // Clicking the header "Kaart & agenda" link while already on "/" dispatches
  // RESET_HOME_EVENT: clear selection/hover/province focus and recenter the map.
  useEffect(() => {
    function onReset() {
      setSelectedClubId(null);
      setHoveredClubId(null);
      setHoveredItemId(null);
      setSelectedItemId(null);
      setHoveredVenueId(null);
      setSelectedVenueId(null);
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
    for (const v of venues) if (v.region) set.add(v.region);
    for (const co of coaches) if (co.region) set.add(co.region);
    for (const it of items) if (it.province) set.add(it.province);
    return [...set].sort((a, b) => a.localeCompare(b, "nl"));
  }, [clubs, venues, coaches, items]);

  // Apply filters to the agenda items (small dataset → recompute each render).
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (filters.types.size > 0 && !filters.types.has(it.type)) return false;
      if (filters.province && it.province !== filters.province) return false;
      const d = dayKey(it.startsAt);
      if (filters.from && d < filters.from) return false;
      if (filters.to && d > filters.to) return false;
      return true;
    });
  }, [items, filters]);

  // Filter map pins to the province filter (event-type/date filters don't apply
  // to clubs/venues themselves, but the province filter does so the two panels
  // stay coherent). The "CSN members only" toggle additionally narrows clubs.
  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      if (filters.province && c.region !== filters.province) return false;
      if (filters.membersOnly && !c.csnMember) return false;
      return true;
    });
  }, [clubs, filters.province, filters.membersOnly]);

  const filteredVenues = useMemo(() => {
    if (!filters.province) return venues;
    return venues.filter((v) => v.region === filters.province);
  }, [venues, filters.province]);

  // Coaches don't carry a province (we only geocode their city), so a coach
  // with no region stays visible under any province filter rather than vanishing.
  const filteredCoaches = useMemo(() => {
    if (!filters.province) return coaches;
    return coaches.filter(
      (c) => c.region == null || c.region === filters.province,
    );
  }, [coaches, filters.province]);

  // Events have no persistent pins, so they aren't pre-filtered for the map: the
  // single revealed pin is matched by `hoveredItemId` below, and that id always
  // comes from a currently-visible (filtered) agenda row — so reveal is
  // inherently consistent with the active filters, no Set membership needed.

  // Ids of agenda items that have their OWN map pin (located events + coaches),
  // so the Calendar knows which club-less rows are clickable-to-zoom.
  const pinnableItemIds = useMemo(
    () => new Set<string>([...events.map((e) => e.id), ...coaches.map((c) => c.id)]),
    [events, coaches],
  );

  // Toggle selection off when clicking the already-selected club. Only one
  // sticky pick at a time, so selecting a club clears any item/venue selection.
  // `useCallback` keeps these referentially stable — the Map memoizes its whole
  // cluster subtree on these callbacks, and a new identity each render would
  // rebuild the cluster and collapse any open spider.
  const handleSelect = useCallback((id: string | null) => {
    setSelectedClubId((prev) => (prev === id ? null : id));
    setSelectedItemId(null);
    setSelectedVenueId(null);
  }, []);

  // Select a club-less item (its own pin) → the map zooms to it. Toggles off on
  // re-click, and clears any club/venue selection.
  const handleSelectItem = useCallback((id: string | null) => {
    setSelectedItemId((prev) => (prev === id ? null : id));
    setSelectedClubId(null);
    setSelectedVenueId(null);
  }, []);

  // Select a club-independent open-gym venue → <MapFocus> spiders its cluster
  // open and opens its popup. Toggles off on re-click; clears club/item picks.
  const handleSelectVenue = useCallback((id: string | null) => {
    setSelectedVenueId((prev) => (prev === id ? null : id));
    setSelectedClubId(null);
    setSelectedItemId(null);
  }, []);

  const hasClubs = clubs.length > 0;
  const hasVenues = venues.length > 0;
  const hasMapEvents = events.length > 0;
  const hasCoaches = coaches.length > 0;
  const hasItems = items.length > 0;

  const mapPanel =
    hasClubs || hasVenues || hasMapEvents || hasCoaches ? (
      <Map
        clubs={filteredClubs}
        venues={filteredVenues}
        events={events}
        coaches={filteredCoaches}
        hoveredEventId={hoveredItemId}
        selectedEventId={selectedItemId}
        hoveredClubId={hoveredClubId}
        selectedClubId={selectedClubId}
        onHover={setHoveredClubId}
        onSelect={handleSelect}
        hoveredVenueId={hoveredVenueId}
        selectedVenueId={selectedVenueId}
        onHoverVenue={setHoveredVenueId}
        onSelectVenue={handleSelectVenue}
        resetSignal={resetSignal}
      />
    ) : (
      <EmptyState
        icon={MapIcon}
        title={t.home.emptyMap.title}
        hint={t.home.emptyMap.hint}
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
          onHoverItem={setHoveredItemId}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          pinnableItemIds={pinnableItemIds}
          hoveredVenueId={hoveredVenueId}
          selectedVenueId={selectedVenueId}
          onHoverVenue={setHoveredVenueId}
          onSelectVenue={handleSelectVenue}
        />
      </div>
    </div>
  ) : (
    <EmptyState
      icon={CalendarDays}
      title={t.home.emptyAgenda.title}
      hint={t.home.emptyAgenda.hint}
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
          label={t.home.mobileTab.map}
        />
        <TabButton
          active={tab === "calendar"}
          onClick={() => setTab("calendar")}
          icon={<CalendarDays className="size-4" aria-hidden />}
          label={t.home.mobileTab.agenda}
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
          aria-label={t.home.mapAriaLabel}
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
          aria-label={t.home.agendaAriaLabel}
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
