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
 * STACKED PINS — clustering + spiderfy:
 *   Many clubs are geocoded to their city centre, so several share *identical*
 *   coordinates and their pins would stack exactly on top of one another. We
 *   wrap every marker in a `<MarkerClusterGroup>` (leaflet.markercluster):
 *     - Nearby pins collapse into a themed count badge.
 *     - Clicking a cluster zooms toward its members.
 *     - Members at the *same* coordinate cannot be separated by zoom, so the
 *       group spiderfies them (fans them out on a ring) on click — every pin
 *       then becomes individually hoverable/clickable with its own tooltip and
 *       popup.
 *
 * Hover/select sync: hovering a pin calls `onHover`, clicking selects via
 * `onSelect`; the externally-controlled `hoveredClubId`/`selectedClubId` props
 * restyle the matching marker. When a club is highlighted from elsewhere (e.g.
 * the agenda) we ask the cluster group to reveal it (`zoomToShowLayer`, which
 * zooms/spiderfies as needed) so a buried pin surfaces and shows its highlight.
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
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import {
  Globe,
  AtSign,
  Share2,
  Music2,
  MapPin,
  ArrowRight,
  Maximize,
} from "lucide-react";
// Pull in the `@types/leaflet.markercluster` global augmentation of the
// "leaflet" module so `L.MarkerCluster` / `L.MarkerClusterGroup` resolve.
// `leaflet.markercluster` is already loaded at runtime (transitively via
// react-leaflet-cluster), so this side-effect import changes no behavior.
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import type { MapClub } from "@/components/home/types";
import { safeUrl } from "@/lib/safeUrl";

const NL_CENTER: [number, number] = [52.2, 5.3];
const NL_ZOOM = 7;
// City-level cap so focusing a pin surfaces it without flying all the way in.
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

  /* ---- Cluster badge: themed count bubble (replaces the default blue). ---- */
  .cheer-cluster {
    background: transparent;
    border: none;
  }
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
  /* A faint accent halo so dense clusters read as "more". */
  .cheer-cluster-badge--lg { font-size: 14px; }
  .leaflet-cluster-anim .leaflet-marker-icon,
  .leaflet-cluster-anim .leaflet-marker-shadow { transition: transform 0.25s ease-out, opacity 0.25s ease-in; }

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
  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.2 11.1 19.7 12.2 20.7a1.2 1.2 0 0 0 1.6 0C14.9 32.7 26 22.2 26 13 26 5.82 20.18 0 13 0Z" fill="${fill}"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "cheer-pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

/**
 * Themed cluster icon: an accent count bubble that grows slightly with the
 * number of children, so a "37" cluster reads heavier than a "3".
 */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  // Size scales gently with count (clamped) for legibility at any density.
  const size = count < 10 ? 34 : count < 100 ? 40 : 48;
  const lg = count >= 100 ? " cheer-cluster-badge--lg" : "";
  return L.divIcon({
    html: `<div class="cheer-cluster-badge${lg}" aria-label="${count} clubs">${count}</div>`,
    className: "cheer-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Reveals a club highlighted from OUTSIDE the map (e.g. the agenda/calendar
 * row sync), when its pin is currently buried inside an un-expanded cluster.
 *
 * Crucially, this must NOT move the camera for pins that are already visible on
 * the map. Hovering a pin (or a spiderfied leg) updates the focus id, and if we
 * reacted to that by zooming/panning, the camera would jump on every hover —
 * the spiderfy-hover bug. So before any camera move we check visibility:
 * `getVisibleParent(marker) === marker` means the marker is already shown
 * (standalone or spiderfied) → do nothing. We only reveal when the marker is
 * hidden (its visible parent is a cluster) or not yet on the map.
 *
 * When a reveal is warranted, `zoomToShowLayer` (markercluster) zooms in until
 * the marker is no longer inside a cluster, spiderfying when same-coordinate
 * markers can't be split by zoom — so a buried/stacked pin surfaces and shows
 * its highlight. It can fly in too deep, so we clamp to a city-level zoom in
 * its callback before gently panning to the pin.
 */
function FocusHighlight({
  clubs,
  focusId,
  clusterRef,
  markerRefs,
}: {
  clubs: MapClub[];
  focusId: string | null;
  clusterRef: React.RefObject<L.MarkerClusterGroup | null>;
  markerRefs: React.RefObject<globalThis.Map<string, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusId) return;
    const club = clubs.find((c) => c.id === focusId);
    if (!club) return;

    const group = clusterRef.current;
    const marker = markerRefs.current.get(focusId);

    if (group && marker && group.hasLayer(marker)) {
      // Already visible on the map (standalone pin or a spiderfied leg)? Then
      // this focus came from interacting with a pin that's right there — leave
      // the camera completely alone. This is what kills the spiderfy-hover jump.
      if (group.getVisibleParent(marker) === marker) return;

      // Otherwise the pin is buried in an un-expanded cluster (agenda→map
      // reveal): zoom/spiderfy until it surfaces, clamp the zoom, then nudge to it.
      group.zoomToShowLayer(marker, () => {
        if (map.getZoom() > FOCUS_MAX_ZOOM) {
          map.setZoom(FOCUS_MAX_ZOOM);
        }
        map.panTo([club.lat, club.lng], { animate: true });
      });
      return;
    }

    // Marker not on the cluster group yet (still mounting): pan toward it.
    map.panTo([club.lat, club.lng], { animate: true });
  }, [focusId, clubs, map, clusterRef, markerRefs]);
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
      const div = L.DomUtil.create(
        "div",
        "leaflet-bar cheer-reset-control",
      );
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
  hoveredClubId: string | null;
  selectedClubId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  /** Bumped by HomeView to trigger a reset to the whole-NL view. */
  resetSignal?: number;
}

export default function Map({
  clubs,
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

  // Cluster group + per-club marker handles, so FocusHighlight can reveal a
  // buried pin (zoomToShowLayer) when a club is highlighted from the agenda.
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerRefs = useRef<globalThis.Map<string, L.Marker>>(
    new globalThis.Map(),
  );

  // Focus = explicit selection wins over hover (used for revealing/panning).
  const focusId = selectedClubId ?? hoveredClubId;

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
          clubs={clubs}
          focusId={focusId}
          clusterRef={clusterRef}
          markerRefs={markerRefs}
        />
        <ResetViewControl onSelect={onSelect} />
        <ResetView signal={resetSignal} />

        <MarkerClusterGroup
          ref={clusterRef}
          // Same-coordinate pins fan out on click so each is clickable.
          spiderfyOnMaxZoom
          // Touch-friendly: spiderfy still works on tap; the legs stay clickable.
          showCoverageOnHover={false}
          // Keep the spiderfy ring roomy enough to tap individual pins on mobile.
          spiderfyDistanceMultiplier={1.6}
          // Group pins within ~50px; tighter than the default 80 so distinct
          // cities don't over-merge while true city-center stacks still group.
          maxClusterRadius={50}
          chunkedLoading
          iconCreateFunction={clusterIcon}
        >
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
                icon={icons[state]}
                isSelected={club.id === selectedClubId}
                onHover={onHover}
                onSelect={onSelect}
                markerRefs={markerRefs}
              />
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </>
  );
}

function ClubMarker({
  club,
  icon,
  isSelected,
  onHover,
  onSelect,
  markerRefs,
}: {
  club: MapClub;
  icon: L.DivIcon;
  isSelected: boolean;
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

  // Register the marker handle so FocusHighlight can reveal it from outside.
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
    socials.push({ href: facebookUrl, label: "Facebook", Icon: Share2 });
  if (tiktokUrl)
    socials.push({ href: tiktokUrl, label: "TikTok", Icon: Music2 });

  return (
    <Marker
      ref={markerRef}
      position={[club.lat, club.lng]}
      icon={icon}
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
