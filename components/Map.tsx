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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { EVENT_TYPE_COLOR } from "@/lib/eventColors";
import type { EventType } from "@/lib/types";
import type {
  MapClub,
  MapVenue,
  MapEvent,
  MapCoach,
} from "@/components/home/types";
import { useI18n } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { dateFnsLocale } from "@/lib/dateFormat";
import { formatInTimeZone } from "date-fns-tz";
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
function venueIcon(label: string): L.DivIcon {
  const size = 28;
  // lucide-react's Users path, inlined so it works in a Leaflet divIcon.
  const glyph = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/></svg>`;
  return L.divIcon({
    html: `<div class="cheer-venue-badge" aria-label="${label}">${glyph}</div>`,
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

/** HTML-escape text before injecting it into an imperative Leaflet tooltip. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/** Name + city markup mirroring the `cheer-tooltip` React label. */
function pinTooltipHtml(name: string, city: string | null): string {
  const cityHtml = city
    ? `<span class="cheer-tooltip-city">${escapeHtml(city)}</span>`
    : "";
  return `${escapeHtml(name)}${cityHtml}`;
}

/**
 * Imperative highlight + reveal driver for clustered pins (clubs and venues).
 *
 * WHY IMPERATIVE: the cluster subtree is memoized so it never re-renders — that
 * is what stops an open spider from collapsing (react-leaflet-cluster rebuilds
 * all layers on any child change). Per-pin focus visuals therefore can't be
 * React props; we apply them straight onto the Leaflet markers via the ref maps.
 *
 * For the active pin of each kind (a click/selection wins over a hover):
 *  - CLUB: swap to the hover/selected icon, raise it, show a permanent name
 *    tooltip, and on selection open its popup.
 *  - VENUE (club-independent open gym): no icon variants, so reveal it and, on
 *    selection, open its popup — the "spider opens + the gym is highlighted"
 *    behaviour these rows were missing.
 *
 * If the pin is buried in a cluster, `zoomToShowLayer` zooms/spiderfies until it
 * surfaces first (we never clamp the zoom — that could stop short and leave it
 * clustered). HOVER only surfaces/zooms when buried; SELECTION also pans + opens
 * the popup. The previously-active pin of each kind is reverted before the next.
 */
function MapFocus({
  selectedClubId,
  hoveredClubId,
  hoveredVenueId,
  selectedVenueId,
  clubs,
  venues,
  clusterRef,
  markerRefs,
  venueRefs,
  icons,
}: {
  selectedClubId: string | null;
  hoveredClubId: string | null;
  hoveredVenueId: string | null;
  selectedVenueId: string | null;
  clubs: MapClub[];
  venues: MapVenue[];
  clusterRef: React.RefObject<L.MarkerClusterGroup | null>;
  markerRefs: React.RefObject<globalThis.Map<string, L.Marker>>;
  venueRefs: React.RefObject<globalThis.Map<string, L.Marker>>;
  icons: { default: L.DivIcon; hover: L.DivIcon; selected: L.DivIcon };
}) {
  const map = useMap();
  const prevClub = useRef<L.Marker | null>(null);
  const prevVenue = useRef<L.Marker | null>(null);

  // --- Clubs ---
  const clubFocus = selectedClubId ?? hoveredClubId;
  const clubIsSelection = selectedClubId != null;
  useEffect(() => {
    // Revert the previously highlighted club to its resting state.
    if (prevClub.current) {
      prevClub.current.setIcon(icons.default);
      prevClub.current.setZIndexOffset(0);
      prevClub.current.unbindTooltip();
      prevClub.current.closePopup();
      prevClub.current = null;
    }
    if (!clubFocus) return;
    const club = clubs.find((c) => c.id === clubFocus);
    const marker = markerRefs.current.get(clubFocus);
    if (!club || !marker) return;

    marker.setIcon(clubIsSelection ? icons.selected : icons.hover);
    marker.setZIndexOffset(1000);
    prevClub.current = marker;

    const group = clusterRef.current;
    const buried = group
      ? group.hasLayer(marker) && group.getVisibleParent(marker) !== marker
      : false;

    if (clubIsSelection) {
      // A CLICK travels to the pin: reveal it (zoom/spiderfy if buried), then
      // pan and open its popup. No name-tag tooltip here — the popup already
      // carries the club name, and the tooltip is reserved for hover.
      const reveal = () => {
        map.panTo([club.lat, club.lng], { animate: true });
        marker.openPopup();
      };
      if (buried && group) group.zoomToShowLayer(marker, reveal);
      else reveal();
    } else if (!buried) {
      // HOVER shows the name-tag tooltip and highlights — never moves the
      // camera. A pin buried in a cluster stays put; its tooltip can't show
      // until a click reveals it.
      marker.bindTooltip(pinTooltipHtml(club.name, club.city), {
        permanent: true,
        direction: "top",
        offset: [0, -28],
        opacity: 1,
        className: "cheer-tooltip",
      });
      marker.openTooltip();
    }
  }, [clubFocus, clubIsSelection, clubs, icons, map, clusterRef, markerRefs]);

  // --- Venues (club-independent open gyms) ---
  // Venues live INSIDE the cluster exactly like clubs (they hide under the count
  // badge when zoomed out), so they follow the club pattern verbatim: HOVER
  // shows the name tag and highlights; a CLICK reveals the buried pin
  // (zoomToShowLayer) or pans to a visible one, then opens its popup — never a
  // bespoke zoom-to-max flyTo.
  const venueFocus = selectedVenueId ?? hoveredVenueId;
  const venueIsSelection = selectedVenueId != null;
  useEffect(() => {
    if (prevVenue.current) {
      prevVenue.current.setZIndexOffset(0);
      prevVenue.current.unbindTooltip();
      prevVenue.current.closePopup();
      prevVenue.current = null;
    }
    if (!venueFocus) return;
    const venue = venues.find((v) => v.id === venueFocus);
    const marker = venueRefs.current.get(venueFocus);
    if (!venue || !marker) return;

    marker.setZIndexOffset(1000);
    prevVenue.current = marker;

    const group = clusterRef.current;
    const buried = group
      ? group.hasLayer(marker) && group.getVisibleParent(marker) !== marker
      : false;

    if (venueIsSelection) {
      // A CLICK travels to the pin: reveal it (zoom/spiderfy if buried), then
      // pan and open its popup. No name-tag tooltip — the popup carries the name.
      const reveal = () => {
        map.panTo([venue.lat, venue.lng], { animate: true });
        marker.openPopup();
      };
      if (buried && group) group.zoomToShowLayer(marker, reveal);
      else reveal();
    } else if (!buried) {
      // HOVER shows the name-tag tooltip and highlights — never moves the
      // camera. A pin buried in a cluster stays put; its tooltip can't show
      // until a click reveals it.
      marker.bindTooltip(pinTooltipHtml(venue.name, venue.city), {
        permanent: true,
        direction: "top",
        offset: [0, -16],
        opacity: 1,
        className: "cheer-tooltip",
      });
      marker.openTooltip();
    }
  }, [venueFocus, venueIsSelection, venues, map, clusterRef, venueRefs]);

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
  t,
}: {
  onSelect: (id: string | null) => void;
  t: Dictionary;
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
      aria-label={t.map.resetViewAria}
    >
      <Maximize className="size-3.5" aria-hidden />
      {t.map.resetView}
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
  /**
   * Venue channel — the club-independent open-gym pin currently hovered/selected
   * from the agenda (or by clicking the pin itself). Venues live INSIDE the
   * cluster like clubs, so they reveal via the same `zoomToShowLayer` machinery:
   * hovering surfaces the buried pin, selecting also opens its popup.
   */
  hoveredVenueId?: string | null;
  selectedVenueId?: string | null;
  onHoverVenue?: (id: string | null) => void;
  onSelectVenue?: (id: string | null) => void;
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
  hoveredVenueId = null,
  selectedVenueId = null,
  onHoverVenue,
  onSelectVenue,
  resetSignal = 0,
}: MapProps) {
  const { t, locale } = useI18n();
  // Memoize the three icon variants (cheap, but avoids re-creating per render).
  const icons = useMemo(
    () => ({
      default: pinIcon("default"),
      hover: pinIcon("hover"),
      selected: pinIcon("selected"),
    }),
    [],
  );
  const venueMarkerIcon = useMemo(
    () => venueIcon(t.map.openGymLocation),
    [t.map.openGymLocation],
  );
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
  // Venue marker handles, so MapFocus can reveal a buried open-gym pin the same
  // way it reveals a buried club pin (zoomToShowLayer → spiderfy).
  const venueRefs = useRef<globalThis.Map<string, L.Marker>>(
    new globalThis.Map(),
  );
  // Stable no-op fallbacks so the venue handlers are always referentially
  // constant — the memoized cluster subtree below depends on them not changing.
  const noop = useCallback(() => {}, []);
  const handleHoverVenue = onHoverVenue ?? noop;
  const handleSelectVenue = onSelectVenue ?? noop;

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
  // Whether the shown pin is the CLICKED one (not just a hover preview), mirror
  // of a club's `clubIsSelection`: a selection wins. Drives the hover-tag vs
  // click-popup split on the event/coach marker (HOVER → name tag, CLICK →
  // popup only).
  const eventIsSelection =
    selectedEventId != null && selectedEventId === activeEventId;

  // Selected point → zoom-in fly (matches clicking a club). Looked up across
  // events + coaches by id. Hover never moves the camera — see <FocusEvent>.
  const selectedPoint = useMemo(
    () =>
      events.find((e) => e.id === selectedEventId) ??
      coaches.find((c) => c.id === selectedEventId) ??
      null,
    [events, coaches, selectedEventId],
  );

  // The cluster subtree is memoized on data + STABLE callbacks only — never on
  // hover/selection. This is the crux of the spiderfy fix: react-leaflet-cluster
  // tears down and rebuilds all its layers whenever its React children change,
  // which collapses any open spider and drops buried pins before their popup can
  // show. By keeping this element referentially constant across hover/select
  // renders, the cluster is never reconciled, so a spider stays open and the
  // imperative MapFocus driver can highlight/reveal pins in place. Markers carry
  // only a constant default icon + an always-mounted popup; MapFocus swaps icons
  // and opens popups/tooltips imperatively via the ref maps.
  const clusterGroup = useMemo(
    () => (
      <MarkerClusterGroup
        ref={setClusterGroup}
        // Clicking a cluster spiderfies it IN PLACE (no zoom change) and the
        // spider stays open, so its members can be clicked (popup) or hovered
        // (name tag). `zoomToBoundsOnClick={false}` stops the old zoom-to-bounds;
        // `spiderfyOnEveryZoom` makes the fan-out happen at any zoom, not just
        // max zoom. This is only safe because the cluster subtree is memoized —
        // an open spider used to collapse on the next hover-driven rebuild.
        zoomToBoundsOnClick={false}
        spiderfyOnEveryZoom
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
            defaultIcon={icons.default}
            onHover={onHover}
            onSelect={onSelect}
            markerRefs={markerRefs}
            t={t}
          />
        ))}
        {venues.map((venue) => (
          <VenueMarker
            key={venue.id}
            venue={venue}
            icon={venueMarkerIcon}
            onHover={handleHoverVenue}
            onSelect={handleSelectVenue}
            venueRefs={venueRefs}
            t={t}
          />
        ))}
      </MarkerClusterGroup>
    ),
    [
      clubs,
      venues,
      icons.default,
      venueMarkerIcon,
      onHover,
      onSelect,
      handleHoverVenue,
      handleSelectVenue,
      setClusterGroup,
      t,
    ],
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
        <MapFocus
          selectedClubId={selectedClubId}
          hoveredClubId={hoveredClubId}
          hoveredVenueId={hoveredVenueId}
          selectedVenueId={selectedVenueId}
          clubs={clubs}
          venues={venues}
          clusterRef={clusterRef}
          markerRefs={markerRefs}
          venueRefs={venueRefs}
          icons={icons}
        />
        <ResetViewControl onSelect={onSelect} t={t} />
        <ResetView signal={resetSignal} />

        {/* Pins merge into the accent count badge. Clicking a cluster spiderfies
            it in place (no zoom) and the spider stays open for clicking/hovering
            its members — see the MarkerClusterGroup config. The subtree is
            memoized (see `clusterGroup`) so hover/selection never rebuilds it —
            that rebuild is what used to collapse an open spider. Highlighting and
            reveal are done imperatively by <MapFocus> above. */}
        {clusterGroup}

        {/* Hover-revealed event / coach pin. Rendered OUTSIDE the cluster group
            (so a single pin can't be swallowed into a count badge) and only
            while its agenda row is hovered. */}
        {activeEvent && (
          <EventMarker
            event={activeEvent}
            icon={eventIcons[activeEvent.type]}
            t={t}
            locale={locale}
            selected={eventIsSelection}
          />
        )}
        {activeCoach && (
          <CoachMarker
            coach={activeCoach}
            icon={coachMarkerIcon}
            t={t}
            locale={locale}
            selected={eventIsSelection}
          />
        )}
        {/* Camera only moves on a click; hovering just reveals the pin in place. */}
        <FocusEvent point={selectedPoint} />
      </MapContainer>
    </>
  );
}

/** Format a venue slot as "Maandag · 19:00 – 22:00" / "Monday · …". */
function formatSlot(s: MapVenue["sessions"][number], t: Dictionary): string {
  const weekday = t.weekdays[s.weekdayIndex] ?? s.weekday;
  return `${weekday} · ${s.startTime} – ${s.endTime}`;
}

/**
 * A club-independent open-gym venue pin. Like <ClubMarker> it is stable +
 * memoized (constant icon, always-mounted popup, an always-mounted native-hover
 * tooltip) so it never rebuilds the cluster. It registers its handle in
 * `venueRefs` so <MapFocus> can reveal it (zoomToShowLayer → spiderfy) and open
 * its popup when its agenda row is clicked, and reports its own hover/click so
 * the agenda row stays in sync.
 */
const VenueMarker = memo(function VenueMarker({
  venue,
  icon,
  onHover,
  onSelect,
  venueRefs,
  t,
}: {
  venue: MapVenue;
  icon: L.DivIcon;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  venueRefs: React.RefObject<globalThis.Map<string, L.Marker>>;
  t: Dictionary;
}) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    const refs = venueRefs.current;
    const marker = markerRef.current;
    if (marker) refs.set(venue.id, marker);
    return () => {
      refs.delete(venue.id);
    };
  }, [venue.id, venueRefs]);

  return (
    <Marker
      ref={markerRef}
      position={[venue.lat, venue.lng]}
      icon={icon}
      riseOnHover
      eventHandlers={{
        mouseover: () => onHover(venue.id),
        mouseout: () => onHover(null),
        click: () => onSelect(venue.id),
      }}
    >
      {/* No declarative tooltip: the hover name-tag is bound imperatively by
          <MapFocus> (like <ClubMarker>), keeping this subtree constant so the
          cluster never rebuilds and collapses an open spider. */}
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
                {t.map.openGym}
              </span>
              {venue.sessions.map((s) => (
                <span
                  key={`${s.weekdayIndex}-${s.startTime}`}
                  className="text-xs text-[var(--ink)]"
                >
                  {formatSlot(s, t)}
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
              {t.map.toWebsite}
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

const TZ = "Europe/Amsterdam";

/** "ma 15 jun · 19:00 – 21:00" / "Mon 15 Jun · …" (date only when all-day). */
function formatEventWhen(event: MapEvent, locale: Locale): string {
  const dfns = dateFnsLocale(locale);
  const start = new Date(event.startsAt);
  const date = formatInTimeZone(start, TZ, "eee d MMM", { locale: dfns });
  if (event.allDay) return date;
  const startTime = formatInTimeZone(start, TZ, "HH:mm");
  if (!event.endsAt) return `${date} · ${startTime}`;
  const endTime = formatInTimeZone(new Date(event.endsAt), TZ, "HH:mm");
  return `${date} · ${startTime} – ${endTime}`;
}

function EventMarker({
  event,
  icon,
  t,
  locale,
  selected,
}: {
  event: MapEvent;
  icon: L.DivIcon;
  t: Dictionary;
  locale: Locale;
  /** True when the pin is the CLICKED row (popup), not a hover preview (tag). */
  selected: boolean;
}) {
  const markerRef = useRef<L.Marker>(null);
  // Click → open the popup (the camera is moved by <FocusEvent>); hover → leave
  // the popup closed so only the name tag shows. Mirrors a club's behaviour.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (selected) marker.openPopup();
    else marker.closePopup();
  }, [selected]);
  return (
    <Marker
      ref={markerRef}
      position={[event.lat, event.lng]}
      icon={icon}
      riseOnHover
    >
      {/* HOVER name tag only. Permanent because the pin is revealed from an
          agenda-row hover, so the cursor is on the agenda — a hover-only tooltip
          would never show. On selection it's dropped so only the popup shows. */}
      {!selected && (
        <Tooltip
          direction="top"
          offset={[0, -14]}
          opacity={1}
          permanent
          className="cheer-tooltip"
        >
          {event.title}
          <span className="cheer-tooltip-city">{t.eventType[event.type]}</span>
        </Tooltip>
      )}

      <Popup autoPan={false}>
        <div className="flex min-w-48 flex-col gap-1">
          <span className="font-display text-sm font-bold text-[var(--ink)]">
            {event.title}
          </span>
          <span
            className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{ background: EVENT_TYPE_COLOR[event.type] }}
          >
            {t.eventType[event.type]}
          </span>
          <span className="mt-0.5 text-xs text-[var(--ink)]">
            {formatEventWhen(event, locale)}
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
              {t.map.moreInfo}
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

/** "15 jun – 20 jun" / "15 Jun – 20 Jun", or "Vanaf …"/"From …" when open-ended. */
function formatStay(coach: MapCoach, t: Dictionary, locale: Locale): string {
  const dfns = dateFnsLocale(locale);
  const start = formatInTimeZone(new Date(coach.startsAt), TZ, "d MMM", {
    locale: dfns,
  });
  if (!coach.endsAt) return t.map.fromDate(start);
  const end = formatInTimeZone(new Date(coach.endsAt), TZ, "d MMM", {
    locale: dfns,
  });
  return `${start} – ${end}`;
}

function CoachMarker({
  coach,
  icon,
  t,
  locale,
  selected,
}: {
  coach: MapCoach;
  icon: L.DivIcon;
  t: Dictionary;
  locale: Locale;
  /** True when the pin is the CLICKED row (popup), not a hover preview (tag). */
  selected: boolean;
}) {
  // Icon-row contact links, mirroring ClubMarker's `socials` pattern. Network
  // names (Instagram/TikTok/…) are brand proper nouns; only Email/Phone are
  // localized labels.
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
    socials.push({
      href: coach.facebookUrl,
      label: "Facebook",
      Icon: Facebook as typeof Globe,
    });
  if (coach.websiteUrl)
    socials.push({ href: coach.websiteUrl, label: "Website", Icon: Globe });
  if (coach.contactEmail)
    socials.push({
      href: `mailto:${coach.contactEmail}`,
      label: "Email",
      Icon: Mail,
    });
  if (coach.phone)
    socials.push({
      href: `tel:${coach.phone.replace(/[^\d+]/g, "")}`,
      label: "Phone",
      Icon: Phone,
    });

  const markerRef = useRef<L.Marker>(null);
  // Click → open the popup (the camera is moved by <FocusEvent>); hover → leave
  // the popup closed so only the name tag shows. Mirrors a club's behaviour.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (selected) marker.openPopup();
    else marker.closePopup();
  }, [selected]);
  return (
    <Marker
      ref={markerRef}
      position={[coach.lat, coach.lng]}
      icon={icon}
      riseOnHover
    >
      {/* HOVER name tag only; revealed from a hover elsewhere so it's permanent.
          On selection it's dropped so only the popup shows. */}
      {!selected && (
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
      )}

      <Popup autoPan={false}>
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
            {formatStay(coach, t, locale)}
          </span>
          {socials.length > 0 && (
            <div className="mt-2 flex items-center gap-3 border-t border-[var(--border)] pt-2">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.map.coachVia(coach.name, label)}
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

/**
 * A club pin. Deliberately STABLE: its rendered tree never changes with
 * hover/selection (constant `defaultIcon`, an always-mounted popup, no
 * conditional tooltip) and it's wrapped in `React.memo`. That stability is what
 * lets the parent memoize the whole cluster subtree, so hovering/selecting never
 * rebuilds the cluster (which would collapse an open spider). All focus visuals
 * — icon swap, name tooltip, opening the popup — are applied imperatively by
 * <MapFocus> through the registered marker handle.
 */
const ClubMarker = memo(function ClubMarker({
  club,
  defaultIcon,
  onHover,
  onSelect,
  markerRefs,
  t,
}: {
  club: MapClub;
  defaultIcon: L.DivIcon;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  markerRefs: React.RefObject<globalThis.Map<string, L.Marker>>;
  t: Dictionary;
}) {
  const markerRef = useRef<L.Marker>(null);

  // Register the marker handle so <MapFocus> can highlight/reveal it imperatively
  // (setIcon, openPopup, zoomToShowLayer) without re-rendering this component.
  useEffect(() => {
    const refs = markerRefs.current;
    const marker = markerRef.current;
    if (marker) refs.set(club.id, marker);
    return () => {
      refs.delete(club.id);
    };
  }, [club.id, markerRefs]);

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
    socials.push({
      href: facebookUrl,
      label: "Facebook",
      Icon: Facebook as typeof Globe,
    });
  if (tiktokUrl)
    socials.push({ href: tiktokUrl, label: "TikTok", Icon: Music2 });

  return (
    <Marker
      ref={markerRef}
      position={[club.lat, club.lng]}
      icon={defaultIcon}
      // Raise the hovered/selected pin above any neighbours it overlaps.
      riseOnHover
      eventHandlers={{
        mouseover: () => onHover(club.id),
        mouseout: () => onHover(null),
        click: () => onSelect(club.id),
      }}
    >
      {/*
        Popup is ALWAYS mounted (a closed popup is invisible) so this marker's
        child tree never changes on selection — a changing tree would force the
        cluster to rebuild and collapse any open spider. <MapFocus> opens it
        imperatively; a direct pin click opens it via Leaflet's bound-popup
        default. The hover/selected name label is a tooltip bound imperatively by
        <MapFocus>, not a React child here, for the same stability reason.
      */}
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
            {t.map.viewClubPage}
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
                  aria-label={t.map.clubVia(club.name, label)}
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
});
