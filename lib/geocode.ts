/**
 * Free geocoding via OpenStreetMap Nominatim.
 *
 * Usage policy compliance:
 *  - descriptive User-Agent (required by Nominatim ToS),
 *  - <= 1 request/second (calls serialized through an internal queue),
 *  - in-memory cache keyed by normalized query.
 *
 * Never throws: returns null on no result / network / parse error.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "CheerNewsBeneluxPlus/1.0 (contact: wonnink.jesse@gmail.com)";
const MIN_INTERVAL_MS = 1100; // > 1s to stay safely under the rate limit.

export interface GeoResult {
  lat: number;
  lng: number;
}

// Cache: normalized query -> result (null is a valid cached "no match").
const cache = new Map<string, GeoResult | null>();

// Serialize requests: each call waits for the previous, then for the throttle.
let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

async function fetchNominatim(query: string): Promise<GeoResult | null> {
  await throttle();
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first: unknown = data[0];
    if (!first || typeof first !== "object") return null;
    const record = first as Record<string, unknown>;
    if (typeof record.lat !== "string" || typeof record.lon !== "string")
      return null;
    const lat = Number.parseFloat(record.lat);
    const lng = Number.parseFloat(record.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Geocode a free-text query (address / venue + city) to coordinates.
 * Returns null when nothing is found or any error occurs.
 */
export async function geocode(query: string): Promise<GeoResult | null> {
  const key = normalize(query);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  // Append our work to the serialized chain so concurrent callers queue up.
  const run = chain.then(() => fetchNominatim(key));
  // Keep the chain alive even if this run rejects (it won't — fetchNominatim
  // swallows errors — but be defensive).
  chain = run.then(
    () => undefined,
    () => undefined,
  );

  const result = await run;
  cache.set(key, result);
  return result;
}

/** Test/maintenance helper: clear the in-memory cache. */
export function __clearGeocodeCache(): void {
  cache.clear();
}
