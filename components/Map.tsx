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
 * OVERLAPPING PINS — clustering + click-to-zoom:
 *   All pins (clubs, venues, events, coaches) live in one `<MarkerClusterGroup>`.
 *   Nearby pins collapse into an accent count badge (the "pink circle"), and the
 *   clusters break apart automatically as you zoom in. Clicking a cluster zooms
 *   to its bounds so the members become individual, reliably-clickable pins;
 *   only genuinely coincident pins spiderfy (at max zoom). We avoid in-place
 *   spiderfy because the transient spider collapses on any hover-driven rerender.
 *
 * Hover/select sync: hovering a pin calls `onHover`, clicking selects via
 * `onSelect`; the externally-controlled `hoveredClubId`/`selectedClubId` props
 * restyle the matching marker. Selecting a club (here or from the agenda) flies
 * the camera to that pin's spread position; hover never moves the camera.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.markercluster";
import {
  Globe,
  AtSign,
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

/** Facebook "f" glyph (lucide dropped brand icons), styled like a lucide icon. */
function Facebook({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const NL_CENTER: [number, number] = [52.2, 5.3];
const NL_ZOOM = 7;
// City-level cap so revealing a pin from the agenda surfaces it without flying
// all the way in.
const FOCUS_MAX_ZOOM = 11;

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

  /* ---- Cluster badge: an accent count bubble (the "pink circle"). ---- */
  .cheer-cluster { background: transparent; border: none; }
  .cheer-cluster-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background: var(--accent);
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
    line-height: 1;
    border: 2px solid #ffffff;
    box-shadow: 0 1px 4px rgb(23 22 27 / 0.35);
  }
  .leaflet-cluster-anim .leaflet-marker-icon,
  .leaflet-cluster-anim .leaflet-marker-shadow { transition: transform 0.25s ease-out, opacity 0.25s ease-in; }

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
 * Themed cluster icon: the accent "pink circle" count bubble. Clicking it
 * spiderfies the cluster in place (no zoom) — see the MarkerClusterGroup config.
 */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 34 : count < 100 ? 40 : 48;
  return L.divIcon({
    html: `<div class="cheer-cluster-badge" aria-label="${count} items">${count}</div>`,
    className: "cheer-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Surfaces a club focused from OUTSIDE the map (an agenda row), so its
 * highlighted pin is actually visible instead of being hidden inside a pink
 * cluster badge.
 *
 * Two intents, handled differently to avoid the camera jumping on every hover:
 *  - SELECTION (click): pan to the pin, and reveal it (zoom/spiderfy) if buried.
 *  - HOVER: reveal ONLY when the pin is buried in a cluster — zoom in as far as
 *    `zoomToShowLayer` needs so the individual pin (and its highlight) appears.
 *    When the pin is already an individual marker, do nothing (the highlight is
 *    already visible; moving the camera on hover would be jarring).
 *
 * We deliberately do NOT clamp the reveal zoom: clamping could stop short and
 * leave the pin still clustered, defeating the whole point. `zoomToShowLayer`
 * only zooms as far as needed (and spiderfies same-coordinate stacks), so it
 * won't overshoot.
 */
function FocusHighlight({
  selectedId,
  hoveredId,
  clubs,
  clusterRef,
  markerRefs,
}: {
  selectedId: string | null;
  hoveredId: string | null;
  clubs: MapClub[];
  clusterRef: React.RefObject<L.MarkerClusterGroup | null>;
  markerRefs: React.RefObject<globalThis.Map<string, L.Marker>>;
}) {
  const map = useMap();
  const focusId = selectedId ?? hoveredId;
  const isSelection = selectedId != null;
  useEffect(() => {
    if (!focusId) return;
    const club = clubs.find((c) => c.id === focusId);
    if (!club) return;
    const group = clusterRef.current;
    const marker = markerRefs.current.get(focusId);
    if (group && marker && group.hasLayer(marker)) {
      if (group.getVisibleParent(marker) === marker) {
        // Already an individual pin → highlight is visible. Pan only on a click.
        if (isSelection) map.panTo([club.lat, club.lng], { animate: true });
        return;
      }
      // Buried in a cluster → zoom/spiderfy until the pin surfaces so its
      // highlight shows. Pan to it afterward only when this was a click.
      group.zoomToShowLayer(marker, () => {
        if (isSelection) map.panTo([club.lat, club.lng], { animate: true });
      });
      return;
    }
    if (isSelection) map.panTo([club.lat, club.lng], { animate: true });
  }, [focusId, isSelection, clubs, map, clusterRef, markerRefs]);
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

/**
 * Pans to a hover-revealed event/coach pin ONLY when it sits outside the current
 * view, so the revealed pin is always visible without yanking the camera around
 * for pins already on screen. Zoom is never changed (a calm nudge, not a fly-in).
 */
function RevealPan({ point }: { point: { lat: number; lng: number } | null }) {
  const map = useMap();
  const lat = point?.lat ?? null;
  const lng = point?.lng ?? null;
  useEffect(() => {
    if (lat == null || lng == null) return;
    if (map.getBounds().contains([lat, lng])) return;
    map.panTo([lat, lng], { animate: true });
  }, [lat, lng, map]);
  return null;
}

/**
 * Flies to a SELECTED (clicked) event/coach pin and zooms in to city level,
 * mirroring what clicking a club pin does — so a club-less pin row zooms like
 * every other agenda row. Never zooms back out: a click that lands on an
 * already-closer view just recenters.
 */
function FocusEvent({ point }: { point: { lat: number; lng: number } | null }) {
  const map = useMap();
  const lat = point?.lat ?? null;
  const lng = point?.lng ?? null;
  useEffect(() => {
    if (lat == null || lng == null) return;
    const zoom = Math.max(map.getZoom(), FOCUS_MAX_ZOOM);
    map.flyTo([lat, lng], zoom, { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface MapProps {
  clubs: MapClub[];
  /** Club-independent open-gym venues, rendered as a distinct pin layer. */
  venues?: MapVenue[];
  /**
   * Located events — candidates for a revealed pin. Events have NO persistent
   * pin; only the one whose id matches `hoveredEventId`/`selectedEventId` shows.
   */
  events?: MapEvent[];
  /** Visiting coaches. Like events, shown only when hovered/selected. */
  coaches?: MapCoach[];
  /**
   * The agenda row currently HOVERED (`event:{id}` / `coach:{id}`). Reveals the
   * matching pin (kept out of the cluster group so it never collapses into a
   * count badge) and pans to it only if off-screen — a calm preview, no zoom.
   */
  hoveredEventId?: string | null;
  /**
   * The agenda row CLICKED (sticky). Keeps the pin shown after the cursor
   * leaves AND zooms the camera to it — the event/coach analogue of selecting a
   * club, so a club-less pin row zooms like every other row.
   */
  selectedEventId?: string | null;
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
  hoveredEventId = null,
  selectedEventId = null,
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

  // Cluster group + per-club marker handles, so FocusHighlight can reveal a
  // club's pin (zoomToShowLayer) when it's selected from the agenda.
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerRefs = useRef<globalThis.Map<string, L.Marker>>(
    new globalThis.Map(),
  );

  // Just store the cluster group ref (FocusHighlight uses it to reveal a buried
  // pin). Cluster CLICKS use the library's default zoom-to-bounds — see the
  // MarkerClusterGroup props below for why we no longer spiderfy in place.
  const setClusterGroup = useCallback((group: L.MarkerClusterGroup | null) => {
    clusterRef.current = group;
  }, []);

  // The single event/coach pin to show: the hovered row wins (live preview),
  // falling back to the selected (sticky) one so a clicked pin stays put after
  // the cursor leaves. Kept out of the cluster group below so a lone pin never
  // collapses into a count badge.
  const activeEventId = hoveredEventId ?? selectedEventId;
  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeEventId) ?? null,
    [events, activeEventId],
  );
  const activeCoach = useMemo(
    () => coaches.find((c) => c.id === activeEventId) ?? null,
    [coaches, activeEventId],
  );

  // Hovered point → gentle pan-if-offscreen (no zoom). Selected point → zoom-in
  // fly (matches clicking a club). Looked up across events + coaches by id.
  const hoveredPoint = useMemo(
    () =>
      events.find((e) => e.id === hoveredEventId) ??
      coaches.find((c) => c.id === hoveredEventId) ??
      null,
    [events, coaches, hoveredEventId],
  );
  const selectedPoint = useMemo(
    () =>
      events.find((e) => e.id === selectedEventId) ??
      coaches.find((c) => c.id === selectedEventId) ??
      null,
    [events, coaches, selectedEventId],
  );

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
        <FocusHighlight
          selectedId={selectedClubId}
          hoveredId={hoveredClubId}
          clubs={clubs}
          clusterRef={clusterRef}
          markerRefs={markerRefs}
        />
        <ResetViewControl onSelect={onSelect} />
        <ResetView signal={resetSignal} />

        {/* Pins merge into the accent count badge. Clicking a cluster ZOOMS in
            to its bounds (the library default) so the members become individual,
            reliably-clickable pins. We dropped the old in-place spiderfy: it fans
            out at the current zoom but the transient spider collapses the moment
            any hover re-renders the marker tree (a react-leaflet-cluster
            rebuild), so reaching a leg felt broken. Genuinely coincident pins
            (same coordinate, can't be split by zoom) still spiderfy at max zoom
            via `spiderfyOnMaxZoom`. */}
        <MarkerClusterGroup
          ref={setClusterGroup}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          spiderfyDistanceMultiplier={1.6}
          maxClusterRadius={50}
          chunkedLoading
          iconCreateFunction={clusterIcon}
        >
          {clubs.map((club) => (
            <ClubMarker
              key={club.id}
              club={club}
              icon={
                icons[club.id === selectedClubId ? "selected" : "default"]
              }
              isSelected={club.id === selectedClubId}
              isHovered={club.id === hoveredClubId}
              onHover={onHover}
              onSelect={onSelect}
              markerRefs={markerRefs}
            />
          ))}
          {venues.map((venue) => (
            <VenueMarker key={venue.id} venue={venue} icon={venueMarkerIcon} />
          ))}
        </MarkerClusterGroup>

        {/* Hover-revealed event / coach pin. Rendered OUTSIDE the cluster group
            (so a single pin can't be swallowed into a count badge) and only
            while its agenda row is hovered. */}
        {activeEvent && (
          <EventMarker
            event={activeEvent}
            icon={eventIcons[activeEvent.type]}
          />
        )}
        {activeCoach && (
          <CoachMarker coach={activeCoach} icon={coachMarkerIcon} />
        )}
        {/* Hover pans only if off-screen (calm preview); a click zooms in. */}
        <RevealPan point={hoveredPoint} />
        <FocusEvent point={selectedPoint} />
      </MapContainer>
    </>
  );
}

/** Format a venue slot as "Maandag · 19:00 – 22:00". */
function formatSlot(s: MapVenue["sessions"][number]): string {
  return `${s.weekday} · ${s.startTime} – ${s.endTime}`;
}

function VenueMarker({ venue, icon }: { venue: MapVenue; icon: L.DivIcon }) {
  return (
    <Marker position={[venue.lat, venue.lng]} icon={icon} riseOnHover>
      <Tooltip
        direction="top"
        offset={[0, -16]}
        opacity={1}
        className="cheer-tooltip"
      >
        {venue.name}
        {venue.city && <span className="cheer-tooltip-city">{venue.city}</span>}
      </Tooltip>

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

function EventMarker({ event, icon }: { event: MapEvent; icon: L.DivIcon }) {
  return (
    <Marker position={[event.lat, event.lng]} icon={icon} riseOnHover>
      {/* Permanent: the pin is revealed from an agenda-row hover, so the cursor
          is on the agenda — a hover-only tooltip would never show. */}
      <Tooltip
        direction="top"
        offset={[0, -14]}
        opacity={1}
        permanent
        className="cheer-tooltip"
      >
        {event.title}
        <span className="cheer-tooltip-city">
          {EVENT_TYPE_LABEL[event.type]}
        </span>
      </Tooltip>

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

function CoachMarker({ coach, icon }: { coach: MapCoach; icon: L.DivIcon }) {
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
    socials.push({ href: coach.facebookUrl, label: "Facebook", Icon: Facebook as typeof Globe });
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
    <Marker position={[coach.lat, coach.lng]} icon={icon} riseOnHover>
      {/* Permanent: revealed from a hover elsewhere, so show the label at once. */}
      <Tooltip
        direction="top"
        offset={[0, -30]}
        opacity={1}
        permanent
        className="cheer-tooltip"
      >
        {coach.name}
        <span className="cheer-tooltip-city">{coach.city}</span>
      </Tooltip>

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


function ClubMarker({
  club,
  icon,
  isSelected,
  isHovered,
  onHover,
  onSelect,
  markerRefs,
}: {
  club: MapClub;
  icon: L.DivIcon;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  markerRefs: React.RefObject<globalThis.Map<string, L.Marker>>;
}) {
  const markerRef = useRef<L.Marker>(null);

  // Leaflet doesn't re-key markers on icon prop change in react-leaflet v5
  // reliably for divIcons, so set it imperatively when it changes.
  useEffect(() => {
    markerRef.current?.setIcon(icon);
  }, [icon]);

  // Register the marker handle so FocusHighlight can reveal it (zoomToShowLayer)
  // when this club is selected from the agenda.
  useEffect(() => {
    const refs = markerRefs.current;
    const marker = markerRef.current;
    if (marker) refs.set(club.id, marker);
    return () => {
      refs.delete(club.id);
    };
  }, [club.id, markerRefs]);

  // Open the popup when the club becomes selected (e.g. from the agenda); a
  // direct pin click opens it via Leaflet's default behaviour.
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
    socials.push({ href: facebookUrl, label: "Facebook", Icon: Facebook as typeof Globe });
  if (tiktokUrl)
    socials.push({ href: tiktokUrl, label: "TikTok", Icon: Music2 });

  return (
    <Marker
      ref={markerRef}
      position={[club.lat, club.lng]}
      icon={icon}
      // Raise the hovered/selected pin above any neighbours it overlaps.
      riseOnHover
      zIndexOffset={isSelected ? 1000 : 0}
      eventHandlers={{
        mouseover: () => onHover(club.id),
        mouseout: () => onHover(null),
        click: () => onSelect(club.id),
      }}
    >
      {/*
        Club identity label. The label is shown (as a permanent tooltip) whenever
        the club is hovered OR selected — driven by React state, not Leaflet's
        own hover tooltip, so it reliably disappears on mouse-out (the old
        hover tooltip could get stuck when the icon swapped). Keyed by state so
        Leaflet rebuilds it with the right styling.
      */}
      {(isSelected || isHovered) && (
        <Tooltip
          key={isSelected ? "selected" : "hover"}
          direction="top"
          offset={[0, -28]}
          opacity={1}
          permanent
          className={`cheer-tooltip${isSelected ? " cheer-tooltip--selected" : ""}`}
        >
          {club.name}
          <span className="cheer-tooltip-city">{club.city}</span>
        </Tooltip>
      )}

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
