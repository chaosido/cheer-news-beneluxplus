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
 * CO-LOCATED PINS — permanent micro-spread (no clustering):
 *   Clubs are pinned at their real gym address, so most sit at distinct points.
 *   A few still share an *identical* coordinate (e.g. two teams at one gym, or
 *   an address that only geocodes to street level). Rather than collapse those
 *   into a count-badge cluster, we fan the members of each shared coordinate out
 *   on a small fixed ring (`spreadPositions`). Every pin is therefore always
 *   individually visible, hoverable and clickable at any zoom — no blob, no
 *   click-to-expand. Pins that are merely *near* each other simply overlap at
 *   low zoom and separate as you zoom in.
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
  Dumbbell,
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
// Street-level zoom used when a club is selected, so any pins that were
// decluttered/fanned at the previous zoom separate onto their true spots.
const FOCUS_REVEAL_ZOOM = 14;
// Declutter: club pins whose screen positions fall within COLLISION_PX of each
// other at the current zoom are fanned out on a ring of ~SPREAD_PX radius so the
// back pin of a stack stays visible and clickable.
const COLLISION_PX = 28;
const SPREAD_PX = 16;

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

/** Round teal open-gym badge for a venue pin (a Dumbbell glyph inside). */
function venueIcon(): L.DivIcon {
  const size = 28;
  // lucide-react's Dumbbell path, inlined so it works in a Leaflet divIcon.
  const glyph = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>`;
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
  // Dumbbell
  open_gym: `<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>`,
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
 * Zoom-aware declutter: fan out only the club pins that actually *collide on
 * screen* at the current zoom, so the back pin of a stack is never hidden.
 *
 * We project every club to pixel space at `zoom`, greedily group pins whose
 * screen positions fall within `COLLISION_PX`, and lay each colliding group out
 * on a small pixel ring around its centroid (converted back to lat/lng). Pins
 * that don't collide keep their exact coordinate. As you zoom in and real pins
 * separate, groups dissolve and everything snaps back to its true location — so
 * we never misrepresent where a club is once there's room to show it.
 */
function declutterPositions(
  clubs: MapClub[],
  map: L.Map,
  zoom: number,
): globalThis.Map<string, [number, number]> {
  const pts = clubs.map((c) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    p: map.project([c.lat, c.lng], zoom),
  }));
  const out = new globalThis.Map<string, [number, number]>();
  const used = new Array<boolean>(pts.length).fill(false);

  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue;
    const group = [i];
    used[i] = true;
    for (let j = i + 1; j < pts.length; j++) {
      if (used[j]) continue;
      if (pts[i].p.distanceTo(pts[j].p) < COLLISION_PX) {
        group.push(j);
        used[j] = true;
      }
    }
    if (group.length === 1) {
      out.set(pts[i].id, [pts[i].lat, pts[i].lng]);
      continue;
    }
    // Fan the colliding group out on a pixel ring around its centroid.
    const cx = group.reduce((s, k) => s + pts[k].p.x, 0) / group.length;
    const cy = group.reduce((s, k) => s + pts[k].p.y, 0) / group.length;
    const radius = SPREAD_PX + group.length * 2;
    group.forEach((k, idx) => {
      const angle = (2 * Math.PI * idx) / group.length;
      const ll = map.unproject(
        L.point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)),
        zoom,
      );
      out.set(pts[k].id, [ll.lat, ll.lng]);
    });
  }
  return out;
}

/**
 * Flies the camera to a *selected* club's real pin location (clicking a pin or
 * an agenda row). `focusId` is selection-only — NOT hover — so the camera moves
 * only on an explicit click; hovering just restyles the matching pin (see the
 * marker `state`). We zoom in to at least street level so any pins that were
 * decluttered/fanned at the previous zoom separate onto their true spots.
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

        {/* Club pins — plain markers (no clustering). Pins that collide on
            screen at the current zoom are fanned out so each is clickable. */}
        <ClubMarkers
          clubs={clubs}
          icons={icons}
          hoveredClubId={hoveredClubId}
          selectedClubId={selectedClubId}
          onHover={onHover}
          onSelect={onSelect}
        />

        {/* Venue open-gym pins. */}
        {venues.map((venue) => (
          <VenueMarker key={venue.id} venue={venue} icon={venueMarkerIcon} />
        ))}

        {/* Located event pins (diamonds, colored by type). */}
        {events.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            icon={eventIcons[event.type]}
          />
        ))}

        {/* Visiting coach pins (amber teardrop). */}
        {coaches.map((coach) => (
          <CoachMarker key={coach.id} coach={coach} icon={coachMarkerIcon} />
        ))}
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
    <Marker position={[venue.lat, venue.lng]} icon={icon}>
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
            <Dumbbell
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
    <Marker position={[event.lat, event.lng]} icon={icon}>
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
    <Marker position={[coach.lat, coach.lng]} icon={icon}>
      <Tooltip
        direction="top"
        offset={[0, -30]}
        opacity={1}
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

/**
 * Renders all club pins, decluttered for the current zoom. Lives *inside*
 * <MapContainer> so it can read the map (project to pixels) and re-run on
 * `zoomend`. On each zoom we recompute which pins collide and where their
 * fanned-out display positions land, so the back pin of a stack is always
 * reachable; pins snap back to their true coordinate once they no longer
 * overlap.
 */
function ClubMarkers({
  clubs,
  icons,
  hoveredClubId,
  selectedClubId,
  onHover,
  onSelect,
}: {
  clubs: MapClub[];
  icons: Record<"default" | "hover" | "selected", L.DivIcon>;
  hoveredClubId: string | null;
  selectedClubId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const positions = useMemo(
    () => declutterPositions(clubs, map, zoom),
    [clubs, map, zoom],
  );

  return (
    <>
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
            position={positions.get(club.id) ?? [club.lat, club.lng]}
            icon={icons[state]}
            isSelected={club.id === selectedClubId}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

function ClubMarker({
  club,
  position,
  icon,
  isSelected,
  onHover,
  onSelect,
}: {
  club: MapClub;
  position: [number, number];
  icon: L.DivIcon;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  // Leaflet doesn't re-key markers on icon prop change in react-leaflet v5
  // reliably for divIcons, so set it imperatively when it changes.
  useEffect(() => {
    markerRef.current?.setIcon(icon);
  }, [icon]);

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
        click: () => onSelect(club.id),
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
    </Marker>
  );
}
