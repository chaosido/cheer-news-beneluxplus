"use client";

/**
 * Leaflet map of club pins (Client Component).
 *
 * MUST be loaded via `dynamic(..., { ssr: false })` because Leaflet (and
 * leaflet.markercluster, which it pulls in) touch `window` at import time. We
 * avoid Leaflet's broken default icon URLs (they 404 under a bundler) by
 * building markers from inline SVG `divIcon`s, which also lets us tint the
 * selected/hovered pin with the spirit accent.
 *
 * OVERLAPPING PINS — no clustering, on-demand spiderfy (see MapPins):
 *   Every pin (club, venue, event, coach) sits at its true coordinate. Pins that
 *   share an *identical* coordinate get a small fixed offset (`fixedSpread`) so
 *   they don't fully stack. Nothing moves on zoom. When you click a pin that
 *   overlaps others on screen, the whole overlapping group (any mix of kinds)
 *   fans out on a ring with connector legs so each is reachable; the fan
 *   collapses on zoom or a background click. No count-badge blob.
 *
 * Hover/select sync: hovering a pin calls `onHover`, clicking selects via
 * `onSelect`; the externally-controlled `hoveredClubId`/`selectedClubId` props
 * restyle the matching marker. Selecting a club (here or from the agenda) flies
 * the camera to that pin's spread position; hover never moves the camera.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Globe,
  AtSign,
  Share2,
  Music2,
  MapPin,
  ArrowRight,
  Maximize,
  Users,
  Mail,
  Phone,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/eventColors";
import type { EventType } from "@/lib/types";
import type {
  MapClub,
  MapVenue,
  MapEvent,
  MapCoach,
} from "@/components/home/types";
import { safeUrl } from "@/lib/safeUrl";

const NL_CENTER: [number, number] = [52.2, 5.3];
const NL_ZOOM = 7;
// Street-level zoom used when a club is selected, so overlapping pins separate.
const FOCUS_REVEAL_ZOOM = 14;
// Two club pins whose screens positions fall within COLLISION_PX of each other
// count as "overlapping": clicking one spiderfies the whole group.
const COLLISION_PX = 30;
// Pixel radius of the on-click spiderfy ring (scaled up a little per member).
const SPIDERFY_PX = 38;
// Fixed geographic offset (~0.0008° lat ≈ 90 m) used to fan apart clubs that
// share an IDENTICAL coordinate, so true duplicates are visible (and separate
// once you zoom in) without any zoom-dependent movement.
const DUP_SPREAD_DEG = 0.0008;

/**
 * Theme Leaflet's tooltip/popup/cluster chrome with our design tokens. Injected
 * once (scoped by the `cheer-` class names we set) so the default white-box
 * Leaflet styling doesn't clash with the surface/ink palette.
 */
const MAP_THEME_CSS = `
  .cheer-tooltip.leaflet-tooltip {
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    padding: 4px 8px;
    font-weight: 600;
    font-size: 12px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .cheer-tooltip .cheer-tooltip-city {
    display: block;
    color: var(--muted);
    font-weight: 500;
    font-size: 11px;
  }
  /* Selected pin's permanent label gets the accent treatment. */
  .cheer-tooltip--selected.leaflet-tooltip {
    background: var(--accent);
    border-color: var(--accent);
    color: #ffffff;
  }
  .cheer-tooltip--selected .cheer-tooltip-city {
    color: rgba(255, 255, 255, 0.85);
  }
  /* Neutralize Leaflet's directional tooltip arrow (we omit it for clarity). */
  .cheer-tooltip.leaflet-tooltip::before { display: none; }

  /* ---- Venue (club-independent open gym) pin: a teal round badge so it
     reads as a different category from the dark teardrop club pins. ---- */
  .cheer-venue-pin { background: transparent; border: none; filter: drop-shadow(0 1px 2px rgb(23 22 27 / 0.3)); }
  .cheer-event-pin { background: transparent; border: none; filter: drop-shadow(0 1px 2px rgb(23 22 27 / 0.3)); }
  .cheer-coach-pin { background: transparent; border: none; filter: drop-shadow(0 1px 2px rgb(23 22 27 / 0.3)); }
  .cheer-venue-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background: ${EVENT_TYPE_COLOR.open_gym};
    color: #ffffff;
    border: 2px solid #ffffff;
    box-shadow: 0 1px 4px rgb(23 22 27 / 0.3);
  }

  /* ---- "Heel Nederland" reset control. ---- */
  .cheer-reset-control .cheer-reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--border);
    box-shadow: 0 1px 4px rgb(23 22 27 / 0.18);
    font-weight: 600;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
  }
  .cheer-reset-control .cheer-reset-btn:hover { border-color: var(--accent); }
  .cheer-reset-control .cheer-reset-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

/** Build a teardrop pin as an inline-SVG divIcon, tinted by state. */
function pinIcon(state: "default" | "hover" | "selected"): L.DivIcon {
  const fill =
    state === "selected"
      ? "#ff2d6b"
      : state === "hover"
        ? "#0e7c7b"
        : "#17161b";
  const scale = state === "default" ? 1 : 1.18;
  const w = Math.round(26 * scale);
  const h = Math.round(34 * scale);
  // An "all-star" star glyph reads as the club/team's home base.
  const star = `<svg x="6" y="5.5" width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/></svg>`;
  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.2 11.1 19.7 12.2 20.7a1.2 1.2 0 0 0 1.6 0C14.9 32.7 26 22.2 26 13 26 5.82 20.18 0 13 0Z" fill="${fill}"/>
      ${star}
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "cheer-pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

/** Round teal open-gym badge for a venue pin (a Users glyph inside). */
function venueIcon(): L.DivIcon {
  const size = 28;
  // lucide-react's Users path, inlined so it works in a Leaflet divIcon.
  const glyph = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/></svg>`;
  return L.divIcon({
    html: `<div class="cheer-venue-badge" aria-label="Open gym locatie">${glyph}</div>`,
    className: "cheer-venue-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Per-type lucide glyph (inner paths, drawn white-stroked) so each event pin
// carries a symbol that matches its kind.
const EVENT_GLYPH: Record<EventType, string> = {
  // Trophy
  competition: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  // Users
  open_gym: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/>`,
  // GraduationCap (Workshop)
  clinic: `<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`,
  // ClipboardCheck
  tryout: `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>`,
  // Sparkles
  showcase: `<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>`,
  // Activity
  training: `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>`,
  // Calendar
  other: `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`,
};

/**
 * Teardrop event pin, colored by type, with a per-type glyph. The pointed pin
 * shape distinguishes a located *event* from the round open-gym *hall* (venue)
 * badge, so an open-gym-type event never looks like an open-gym venue.
 */
function eventIcon(type: EventType): L.DivIcon {
  const fill = EVENT_TYPE_COLOR[type];
  const w = 26;
  const h = 34;
  const glyph = `<svg x="6.5" y="5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${EVENT_GLYPH[type]}</svg>`;
  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.2 11.1 19.7 12.2 20.7a1.2 1.2 0 0 0 1.6 0C14.9 32.7 26 22.2 26 13 26 5.82 20.18 0 13 0Z" fill="${fill}"/>
      ${glyph}
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "cheer-event-pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

// Amber so a visiting coach reads as its own category (not club/venue/event).
const COACH_COLOR = "#e8920c";

/** Teardrop coach pin in amber with a person glyph. */
function coachIcon(): L.DivIcon {
  const w = 26;
  const h = 34;
  const glyph = `<svg x="6.5" y="5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.2 11.1 19.7 12.2 20.7a1.2 1.2 0 0 0 1.6 0C14.9 32.7 26 22.2 26 13 26 5.82 20.18 0 13 0Z" fill="${COACH_COLOR}"/>
      ${glyph}
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "cheer-coach-pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

/**
 * Base display positions: every club sits at its TRUE coordinate, except clubs
 * that share an IDENTICAL coordinate (e.g. two teams at one gym, or a duplicate
 * listing), which are fanned onto a small FIXED ring so they don't hide behind
 * each other. This is zoom-INDEPENDENT — pins never move as you zoom; the only
 * on-demand movement is the click spiderfy (see ClubMarkers).
 */
function fixedSpread(
  items: ReadonlyArray<{ id: string; lat: number; lng: number }>,
): globalThis.Map<string, [number, number]> {
  const byCoord = new globalThis.Map<
    string,
    Array<{ id: string; lat: number; lng: number }>
  >();
  for (const c of items) {
    const key = `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
    const list = byCoord.get(key);
    if (list) list.push(c);
    else byCoord.set(key, [c]);
  }
  const out = new globalThis.Map<string, [number, number]>();
  for (const group of byCoord.values()) {
    if (group.length === 1) {
      out.set(group[0].id, [group[0].lat, group[0].lng]);
      continue;
    }
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / sorted.length;
      const lat = c.lat + DUP_SPREAD_DEG * Math.sin(angle);
      // Scale lng by 1/cos(lat) so the ring reads circular, not oval.
      const lng =
        c.lng +
        (DUP_SPREAD_DEG * Math.cos(angle)) / Math.cos((c.lat * Math.PI) / 180);
      out.set(c.id, [lat, lng]);
    });
  }
  return out;
}

/**
 * On-demand spiderfy: fan a group of overlapping pins out onto a pixel ring
 * around their shared centre at the current zoom (converted back to lat/lng),
 * returning the fanned position + the centre, so legs can be drawn to it.
 */
function spiderfyLayout(
  ids: string[],
  base: globalThis.Map<string, [number, number]>,
  map: L.Map,
  zoom: number,
): { center: [number, number]; legs: Array<{ id: string; pos: [number, number] }> } {
  const pts = ids
    .map((id) => ({ id, ll: base.get(id) }))
    .filter((p): p is { id: string; ll: [number, number] } => p.ll != null)
    .map((p) => ({ id: p.id, p: map.project(p.ll, zoom) }));
  const cx = pts.reduce((s, p) => s + p.p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.p.y, 0) / pts.length;
  const radius = SPIDERFY_PX + pts.length * 3;
  const center = map.unproject(L.point(cx, cy), zoom);
  const legs = pts.map((p, idx) => {
    const angle = (2 * Math.PI * idx) / pts.length - Math.PI / 2;
    const ll = map.unproject(
      L.point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)),
      zoom,
    );
    return { id: p.id, pos: [ll.lat, ll.lng] as [number, number] };
  });
  return { center: [center.lat, center.lng], legs };
}

/**
 * Flies the camera to a *selected* club's real pin location (clicking a pin or
 * an agenda row). `focusId` is selection-only — NOT hover — so the camera moves
 * only on an explicit click; hovering just restyles the matching pin (see the
 * marker `state`). We zoom in to at least street level so nearby pins separate.
 */
function FocusHighlight({
  clubs,
  focusId,
}: {
  clubs: MapClub[];
  focusId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusId) return;
    const club = clubs.find((c) => c.id === focusId);
    if (!club) return;
    map.flyTo([club.lat, club.lng], Math.max(map.getZoom(), FOCUS_REVEAL_ZOOM), {
      animate: true,
    });
  }, [focusId, clubs, map]);
  return null;
}

/**
 * A "Heel Nederland" reset control: resets the view to the full-country
 * overview and clears any active selection. Rendered into a real Leaflet
 * control container (top-left, below the zoom buttons) via a portal so it lives
 * inside the map's control pane and doesn't overlap the zoom controls. The
 * button is a real <button>, so it's keyboard-focusable and Enter/Space work.
 */
function ResetViewControl({
  onSelect,
}: {
  onSelect: (id: string | null) => void;
}) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const onReset = () => {
    map.setView(NL_CENTER, NL_ZOOM, { animate: true });
    onSelect(null);
  };

  useEffect(() => {
    const control = new L.Control({ position: "topleft" });
    control.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-bar cheer-reset-control");
      // Don't let clicks/scroll on the control fall through to the map.
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      setContainer(div);
      return div;
    };
    control.addTo(map);
    return () => {
      control.remove();
      setContainer(null);
    };
  }, [map]);

  if (!container) return null;
  return createPortal(
    <button
      type="button"
      className="cheer-reset-btn"
      onClick={onReset}
      aria-label="Toon heel Nederland"
    >
      <Maximize className="size-3.5" aria-hidden />
      Heel Nederland
    </button>,
    container,
  );
}

/**
 * Resets the map to the full-country overview whenever `signal` changes (bumped
 * by HomeView when the user clicks the "Kaart & agenda" nav while already on
 * "/"). Skips the initial mount so the map doesn't snap on first render.
 */
function ResetView({ signal }: { signal: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    map.setView(NL_CENTER, NL_ZOOM, { animate: true });
  }, [signal, map]);
  return null;
}

interface MapProps {
  clubs: MapClub[];
  /** Club-independent open-gym venues, rendered as a distinct pin layer. */
  venues?: MapVenue[];
  /** Located events, rendered as diamond pins colored by type. */
  events?: MapEvent[];
  /** Visiting coaches, rendered as amber teardrop pins. */
  coaches?: MapCoach[];
  hoveredClubId: string | null;
  selectedClubId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  /** Bumped by HomeView to trigger a reset to the whole-NL view. */
  resetSignal?: number;
}

export default function Map({
  clubs,
  venues = [],
  events = [],
  coaches = [],
  hoveredClubId,
  selectedClubId,
  onHover,
  onSelect,
  resetSignal = 0,
}: MapProps) {
  // Memoize the three icon variants (cheap, but avoids re-creating per render).
  const icons = useMemo(
    () => ({
      default: pinIcon("default"),
      hover: pinIcon("hover"),
      selected: pinIcon("selected"),
    }),
    [],
  );
  const venueMarkerIcon = useMemo(() => venueIcon(), []);
  const coachMarkerIcon = useMemo(() => coachIcon(), []);
  // One memoized diamond icon per event type (re-used across all event pins).
  const eventIcons = useMemo(() => {
    const types = Object.keys(EVENT_TYPE_COLOR) as EventType[];
    return Object.fromEntries(types.map((t) => [t, eventIcon(t)])) as Record<
      EventType,
      L.DivIcon
    >;
  }, []);

  // Camera reveal/pan is driven by an explicit *selection* only. Hover must
  // never move the map — it only restyles the matching pin (see the marker
  // `state` below). This is what keeps hovering an agenda event from moving the
  // camera; you get the highlight without the camera jump.
  const focusId = selectedClubId;

  return (
    <>
      <style>{MAP_THEME_CSS}</style>
      <MapContainer
        center={NL_CENTER}
        zoom={NL_ZOOM}
        scrollWheelZoom
        className="h-full w-full bg-[var(--surface-2)]"
        // Keep the map below the sticky header (z-1000) and popups usable.
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FocusHighlight clubs={clubs} focusId={focusId} />
        <ResetViewControl onSelect={onSelect} />
        <ResetView signal={resetSignal} />

        {/* All pins (clubs, venues, events, coaches). No clustering: pins sit
            at their true spots and any that overlap on screen fan out together
            on click, regardless of category. */}
        <MapPins
          clubs={clubs}
          venues={venues}
          events={events}
          coaches={coaches}
          clubIcons={icons}
          venueMarkerIcon={venueMarkerIcon}
          eventIcons={eventIcons}
          coachMarkerIcon={coachMarkerIcon}
          hoveredClubId={hoveredClubId}
          selectedClubId={selectedClubId}
          onHover={onHover}
          onSelect={onSelect}
        />
      </MapContainer>
    </>
  );
}

/** Format a venue slot as "Maandag · 19:00 – 22:00". */
function formatSlot(s: MapVenue["sessions"][number]): string {
  return `${s.weekday} · ${s.startTime} – ${s.endTime}`;
}

function VenueMarker({
  venue,
  position,
  icon,
  open,
  onActivate,
}: {
  venue: MapVenue;
  position: [number, number];
  icon: L.DivIcon;
  open: boolean;
  onActivate: (id: string) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  useEffect(() => {
    if (open) markerRef.current?.openPopup();
  }, [open]);
  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      riseOnHover
      eventHandlers={{ click: () => onActivate(venue.id) }}
    >
      <Tooltip
        direction="top"
        offset={[0, -16]}
        opacity={1}
        className="cheer-tooltip"
      >
        {venue.name}
        {venue.city && <span className="cheer-tooltip-city">{venue.city}</span>}
      </Tooltip>

      {open && (
      <Popup>
        <div className="flex min-w-52 flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[var(--ink)]">
            <Users
              className="size-3.5 text-[var(--type-open_gym,#0e7c7b)]"
              aria-hidden
            />
            {venue.name}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <MapPin className="size-3" aria-hidden />
            {venue.address ?? venue.city}
          </span>

          {venue.sessions.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5 border-t border-[var(--border)] pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Open gym
              </span>
              {venue.sessions.map((s) => (
                <span
                  key={`${s.weekdayIndex}-${s.startTime}`}
                  className="text-xs text-[var(--ink)]"
                >
                  {formatSlot(s)}
                </span>
              ))}
            </div>
          )}

          {venue.websiteUrl && (
            <a
              href={venue.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Naar de website
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </Popup>
      )}
    </Marker>
  );
}

const EVENT_DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const EVENT_TIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "ma 15 jun · 19:00 – 21:00" (or just the date for all-day events). */
function formatEventWhen(event: MapEvent): string {
  const start = new Date(event.startsAt);
  const date = EVENT_DATE_FMT.format(start).replace(/\.(?=\s|$)/g, "");
  if (event.allDay) return date;
  const startTime = EVENT_TIME_FMT.format(start);
  if (!event.endsAt) return `${date} · ${startTime}`;
  return `${date} · ${startTime} – ${EVENT_TIME_FMT.format(new Date(event.endsAt))}`;
}

function EventMarker({
  event,
  position,
  icon,
  open,
  onActivate,
}: {
  event: MapEvent;
  position: [number, number];
  icon: L.DivIcon;
  open: boolean;
  onActivate: (id: string) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  useEffect(() => {
    if (open) markerRef.current?.openPopup();
  }, [open]);
  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      riseOnHover
      eventHandlers={{ click: () => onActivate(event.id) }}
    >
      <Tooltip
        direction="top"
        offset={[0, -14]}
        opacity={1}
        className="cheer-tooltip"
      >
        {event.title}
        <span className="cheer-tooltip-city">
          {EVENT_TYPE_LABEL[event.type]}
        </span>
      </Tooltip>

      {open && (
      <Popup>
        <div className="flex min-w-48 flex-col gap-1">
          <span className="font-display text-sm font-bold text-[var(--ink)]">
            {event.title}
          </span>
          <span
            className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{ background: EVENT_TYPE_COLOR[event.type] }}
          >
            {EVENT_TYPE_LABEL[event.type]}
          </span>
          <span className="mt-0.5 text-xs text-[var(--ink)]">
            {formatEventWhen(event)}
          </span>
          {event.locationText && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <MapPin className="size-3" aria-hidden />
              {event.locationText}
            </span>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Meer info
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </Popup>
      )}
    </Marker>
  );
}

const STAY_DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});

/** "15 jun – 20 jun", or "vanaf 15 jun" when open-ended. */
function formatStay(coach: MapCoach): string {
  const start = STAY_DATE_FMT.format(new Date(coach.startsAt)).replace(
    /\.(?=\s|$)/g,
    "",
  );
  if (!coach.endsAt) return `Vanaf ${start}`;
  const end = STAY_DATE_FMT.format(new Date(coach.endsAt)).replace(
    /\.(?=\s|$)/g,
    "",
  );
  return `${start} – ${end}`;
}

function CoachMarker({
  coach,
  position,
  icon,
  open,
  onActivate,
}: {
  coach: MapCoach;
  position: [number, number];
  icon: L.DivIcon;
  open: boolean;
  onActivate: (id: string) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  useEffect(() => {
    if (open) markerRef.current?.openPopup();
  }, [open]);
  // Icon-row contact links, mirroring ClubMarker's `socials` pattern.
  const socials: { href: string; label: string; Icon: typeof Globe }[] = [];
  if (coach.instagramUrl)
    socials.push({
      href: coach.instagramUrl,
      label: "Instagram",
      Icon: AtSign,
    });
  if (coach.tiktokUrl)
    socials.push({ href: coach.tiktokUrl, label: "TikTok", Icon: Music2 });
  if (coach.facebookUrl)
    socials.push({ href: coach.facebookUrl, label: "Facebook", Icon: Share2 });
  if (coach.websiteUrl)
    socials.push({ href: coach.websiteUrl, label: "Website", Icon: Globe });
  if (coach.contactEmail)
    socials.push({
      href: `mailto:${coach.contactEmail}`,
      label: "E-mail",
      Icon: Mail,
    });
  if (coach.phone)
    socials.push({
      href: `tel:${coach.phone.replace(/[^\d+]/g, "")}`,
      label: "Telefoon",
      Icon: Phone,
    });

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      riseOnHover
      eventHandlers={{ click: () => onActivate(coach.id) }}
    >
      <Tooltip
        direction="top"
        offset={[0, -30]}
        opacity={1}
        className="cheer-tooltip"
      >
        {coach.name}
        <span className="cheer-tooltip-city">{coach.city}</span>
      </Tooltip>

      {open && (
      <Popup>
        <div className="flex min-w-48 flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[var(--ink)]">
            <UserGlyph />
            {coach.name}
          </span>
          {coach.role && (
            <span className="text-xs text-[var(--muted)]">{coach.role}</span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <MapPin className="size-3" aria-hidden />
            {coach.city}
          </span>
          <span className="mt-0.5 text-xs text-[var(--ink)]">
            {formatStay(coach)}
          </span>
          {socials.length > 0 && (
            <div className="mt-2 flex items-center gap-3 border-t border-[var(--border)] pt-2">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${coach.name} via ${label}`}
                  title={label}
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <Icon className="size-4" aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>
      </Popup>
      )}
    </Marker>
  );
}

/** Small amber person glyph used in the coach popup header. */
function UserGlyph() {
  return (
    <span
      aria-hidden
      className="inline-flex size-3.5 items-center justify-center"
      style={{ color: COACH_COLOR }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
      >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  );
}

/**
 * Renders all club pins at their true (fixed-spread) coordinates and adds an
 * on-demand spiderfy: clicking a pin that overlaps others on screen fans the
 * whole group out on a ring (with connector legs) so each is clickable; clicking
 * a leg selects it. Lives *inside* <MapContainer> to read the map for pixel
 * projection. Nothing moves on zoom — the spiderfy collapses on zoom or on a
 * background click.
 */
type PinKind = "club" | "venue" | "event" | "coach";

function MapPins({
  clubs,
  venues,
  events,
  coaches,
  clubIcons,
  venueMarkerIcon,
  eventIcons,
  coachMarkerIcon,
  hoveredClubId,
  selectedClubId,
  onHover,
  onSelect,
}: {
  clubs: MapClub[];
  venues: MapVenue[];
  events: MapEvent[];
  coaches: MapCoach[];
  clubIcons: Record<"default" | "hover" | "selected", L.DivIcon>;
  venueMarkerIcon: L.DivIcon;
  eventIcons: Record<EventType, L.DivIcon>;
  coachMarkerIcon: L.DivIcon;
  hoveredClubId: string | null;
  selectedClubId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [spiderfied, setSpiderfied] = useState<string[] | null>(null);
  // Which non-club pin has its popup open (clubs use selection for that).
  const [opened, setOpened] = useState<string | null>(null);
  // A click on a marker can also bubble to the map's 'click'; suppress that one
  // bubbled event so a spiderfy isn't collapsed by the very click that opened it.
  const suppressMapClick = useRef(false);
  useMapEvents({
    zoomstart: () => setSpiderfied(null),
    zoomend: () => setZoom(map.getZoom()),
    click: () => {
      if (suppressMapClick.current) {
        suppressMapClick.current = false;
        return;
      }
      setSpiderfied(null);
      setOpened(null);
    },
  });

  // Every pin (any kind) indexed by its unique id, so overlap detection and the
  // spiderfy work across all categories — a club behind a venue still fans out.
  const allPins = useMemo(() => {
    const arr: { id: string; lat: number; lng: number; kind: PinKind }[] = [];
    for (const c of clubs) arr.push({ id: c.id, lat: c.lat, lng: c.lng, kind: "club" });
    for (const v of venues) arr.push({ id: v.id, lat: v.lat, lng: v.lng, kind: "venue" });
    for (const e of events) arr.push({ id: e.id, lat: e.lat, lng: e.lng, kind: "event" });
    for (const c of coaches) arr.push({ id: c.id, lat: c.lat, lng: c.lng, kind: "coach" });
    return arr;
  }, [clubs, venues, events, coaches]);

  const base = useMemo(() => fixedSpread(allPins), [allPins]);
  const kindOf = useMemo(() => {
    const m = new globalThis.Map<string, PinKind>();
    for (const p of allPins) m.set(p.id, p.kind);
    return m;
  }, [allPins]);

  // Pin ids whose positions fall within COLLISION_PX of `id` at the current zoom.
  const overlapGroup = (id: string): string[] => {
    const seedLL = base.get(id);
    if (!seedLL) return [id];
    const seed = map.project(seedLL, zoom);
    const group: string[] = [];
    for (const p of allPins) {
      const ll = base.get(p.id);
      if (ll && map.project(ll, zoom).distanceTo(seed) < COLLISION_PX) {
        group.push(p.id);
      }
    }
    return group;
  };

  // Open a single pin: clubs select (drives agenda sync + their popup); other
  // kinds just open their popup.
  const activate = (id: string) => {
    if (kindOf.get(id) === "club") {
      onSelect(id);
      setOpened(null);
    } else {
      setOpened(id);
    }
  };

  const handleActivate = (id: string) => {
    // Any marker click should swallow the bubbled map 'click' (rAF resets the
    // flag so a later genuine background click still collapses the fan).
    suppressMapClick.current = true;
    requestAnimationFrame(() => {
      suppressMapClick.current = false;
    });
    // A click on an already-fanned leg opens/selects it and collapses the fan.
    if (spiderfied?.includes(id)) {
      setSpiderfied(null);
      activate(id);
      return;
    }
    // A click on a pin that overlaps others fans the group out (no open yet).
    const group = overlapGroup(id);
    if (group.length > 1) {
      setSpiderfied(group);
      setOpened(null);
      return;
    }
    // A lone pin opens directly.
    setSpiderfied(null);
    activate(id);
  };

  const spider = spiderfied ? spiderfyLayout(spiderfied, base, map, zoom) : null;
  const legPos = new globalThis.Map<string, [number, number]>(
    spider?.legs.map((l) => [l.id, l.pos]) ?? [],
  );
  const pos = (id: string, lat: number, lng: number): [number, number] =>
    legPos.get(id) ?? base.get(id) ?? [lat, lng];

  return (
    <>
      {/* Connector legs from the spiderfy centre to each fanned pin. */}
      {spider?.legs.map((l) => (
        <Polyline
          key={`leg:${l.id}`}
          positions={[spider.center, l.pos]}
          pathOptions={{ color: "#ff2d6b", weight: 1.5, opacity: 0.7 }}
        />
      ))}
      {clubs.map((club) => {
        const state =
          club.id === selectedClubId
            ? "selected"
            : club.id === hoveredClubId
              ? "hover"
              : "default";
        return (
          <ClubMarker
            key={club.id}
            club={club}
            position={pos(club.id, club.lat, club.lng)}
            icon={clubIcons[state]}
            isSelected={club.id === selectedClubId}
            onHover={onHover}
            onActivate={handleActivate}
          />
        );
      })}
      {venues.map((venue) => (
        <VenueMarker
          key={venue.id}
          venue={venue}
          position={pos(venue.id, venue.lat, venue.lng)}
          icon={venueMarkerIcon}
          open={opened === venue.id}
          onActivate={handleActivate}
        />
      ))}
      {events.map((event) => (
        <EventMarker
          key={event.id}
          event={event}
          position={pos(event.id, event.lat, event.lng)}
          icon={eventIcons[event.type]}
          open={opened === event.id}
          onActivate={handleActivate}
        />
      ))}
      {coaches.map((coach) => (
        <CoachMarker
          key={coach.id}
          coach={coach}
          position={pos(coach.id, coach.lat, coach.lng)}
          icon={coachMarkerIcon}
          open={opened === coach.id}
          onActivate={handleActivate}
        />
      ))}
    </>
  );
}

function ClubMarker({
  club,
  position,
  icon,
  isSelected,
  onHover,
  onActivate,
}: {
  club: MapClub;
  position: [number, number];
  icon: L.DivIcon;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onActivate: (id: string) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  // Leaflet doesn't re-key markers on icon prop change in react-leaflet v5
  // reliably for divIcons, so set it imperatively when it changes.
  useEffect(() => {
    markerRef.current?.setIcon(icon);
  }, [icon]);

  // The popup is bound (and auto-opens) only for the selected club, so a click
  // that merely spiderfies an overlapping group never pops anything. Open it
  // imperatively once selected (the child Popup has mounted/bound by now).
  useEffect(() => {
    if (isSelected) markerRef.current?.openPopup();
  }, [isSelected]);

  // Re-validate each href against the http(s) allowlist (defense-in-depth).
  const websiteUrl = safeUrl(club.websiteUrl);
  const instagramUrl = safeUrl(club.instagramUrl);
  const facebookUrl = safeUrl(club.facebookUrl);
  const tiktokUrl = safeUrl(club.tiktokUrl);
  const socials: { href: string; label: string; Icon: typeof Globe }[] = [];
  if (websiteUrl)
    socials.push({ href: websiteUrl, label: "Website", Icon: Globe });
  if (instagramUrl)
    socials.push({ href: instagramUrl, label: "Instagram", Icon: AtSign });
  if (facebookUrl)
    socials.push({ href: facebookUrl, label: "Facebook", Icon: Share2 });
  if (tiktokUrl)
    socials.push({ href: tiktokUrl, label: "TikTok", Icon: Music2 });

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      // Raise the hovered/selected pin above any neighbours it overlaps so it's
      // never trapped behind another teardrop.
      riseOnHover
      zIndexOffset={isSelected ? 1000 : 0}
      eventHandlers={{
        mouseover: () => onHover(club.id),
        mouseout: () => onHover(null),
        click: () => onActivate(club.id),
      }}
    >
      {/*
        Club identity label. The selected club's label is `permanent` so it
        stays readable during the pin↔agenda sync; all others show on hover.
        Re-keyed on selection so Leaflet rebuilds the tooltip with the right
        permanence/styling (it can't toggle `permanent` in place).
      */}
      <Tooltip
        key={isSelected ? "permanent" : "hover"}
        direction="top"
        offset={[0, -28]}
        opacity={1}
        permanent={isSelected}
        className={`cheer-tooltip${isSelected ? " cheer-tooltip--selected" : ""}`}
      >
        {club.name}
        <span className="cheer-tooltip-city">{club.city}</span>
      </Tooltip>

      {isSelected && (
      <Popup>
        <div className="flex min-w-48 flex-col gap-1">
          <span className="font-display text-sm font-bold text-[var(--ink)]">
            {club.name}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <MapPin className="size-3" aria-hidden />
            {club.city}
          </span>
          <Link
            href={`/clubs/${club.slug}`}
            className="mt-2 inline-flex items-center justify-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Bekijk clubpagina
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          {socials.length > 0 && (
            <div className="mt-2 flex items-center gap-3 border-t border-[var(--border)] pt-2">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${club.name} op ${label}`}
                  title={label}
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <Icon className="size-4" aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>
      </Popup>
      )}
    </Marker>
  );
}
