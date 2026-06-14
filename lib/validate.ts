/**
 * Validation TRUST BOUNDARY for extracted events.
 *
 * Everything coming out of JSON-LD parsing or the LLM is UNTRUSTED. This module
 * is the single chokepoint that stops prompt-injected / malformed garbage from
 * being published:
 *
 *  - shape-checks against `ExtractedEvent` (zod),
 *  - dates must parse and fall in a sane window (now-1y .. now+2y),
 *  - `url`/`ticketUrl` must share the source's registrable domain OR be on a
 *    known ticketing allowlist, else dropped to null,
 *  - HTML is stripped from all text fields,
 *  - length caps (title <= 200, description <= 5000),
 *  - confidence clamped to 0..1.
 */
import { z } from "zod";
import type { ExtractedEvent, EventType, ExtractionMethod } from "@/lib/types";

const EVENT_TYPES: readonly EventType[] = [
  "competition",
  "open_gym",
  "clinic",
  "tryout",
  "showcase",
  "training",
  "other",
];

const EXTRACTION_METHODS: readonly ExtractionMethod[] = ["json-ld", "llm"];

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const NAME_MAX = 300;
const ADDRESS_MAX = 500;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Known ticketing / event hosts that are allowed even when they differ from the
 * source domain. Matched on registrable domain (any TLD via `.*`).
 */
const TICKETING_ALLOWLIST = new Set([
  "eventbrite",
  "ticketmaster",
  "ticketkantoor",
  "eventix",
  "meetup",
  "facebook",
  "fb",
  "ticketswap",
  "yesplan",
  "google", // calendar links
]);

// ---- zod schema mirroring ExtractedEvent ----

const locationSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export const extractedEventSchema = z.object({
  title: z.string(),
  type: z.enum(EVENT_TYPES as [EventType, ...EventType[]]),
  clubSlug: z.string().nullable(),
  start: z.string(),
  end: z.string().nullable(),
  allDay: z.boolean(),
  recurrence: z.string().nullable(),
  location: locationSchema,
  description: z.string().nullable(),
  url: z.string().nullable(),
  ticketUrl: z.string().nullable(),
  sourceUrl: z.string(),
  extractionMethod: z.enum(
    EXTRACTION_METHODS as [ExtractionMethod, ...ExtractionMethod[]],
  ),
  confidence: z.number(),
});

export type ValidationResult =
  | { ok: true; value: ExtractedEvent }
  | { ok: false; errors: string[] };

// ---- helpers ----

/** Strip HTML tags + decode the few entities we care about; collapse spaces. */
function stripHtml(input: string): string {
  let s = input;
  // Remove script/style blocks wholesale (content too).
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // Remove any remaining tags.
  s = s.replace(/<[^>]*>/g, " ");
  // Decode a minimal set of entities.
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'");
  // Collapse whitespace.
  return s.replace(/\s+/g, " ").trim();
}

/** Clean a nullable text field: strip HTML, cap length, null out if empty. */
function cleanText(value: string | null, cap: number): string | null {
  if (value == null) return null;
  const cleaned = stripHtml(value).slice(0, cap);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Extract the registrable domain (eTLD+1, approximated) from a hostname.
 * Approximation: take the last two labels, but for known two-part public
 * suffixes (co.uk, org.uk, com.au, ...) take three. Good enough for the
 * same-site check here.
 */
const TWO_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "com.au",
  "co.nz",
  "co.za",
]);

function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  if (TWO_PART_SUFFIXES.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

/** The base name of a registrable domain, e.g. "eventbrite" from "eventbrite.nl". */
function domainBaseName(hostname: string): string {
  const reg = registrableDomain(hostname);
  return reg.split(".")[0] ?? reg;
}

/**
 * Keep `candidate` only if it is http(s) AND shares the source's registrable
 * domain OR is on the ticketing allowlist. Otherwise return null.
 */
function sanitizeUrl(
  candidate: string | null,
  sourceUrl: string,
): string | null {
  if (!candidate) return null;
  let cand: URL;
  let src: URL;
  try {
    cand = new URL(candidate);
    src = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (cand.protocol !== "http:" && cand.protocol !== "https:") return null;

  const candReg = registrableDomain(cand.hostname);
  const srcReg = registrableDomain(src.hostname);
  if (candReg === srcReg) return cand.toString();

  if (TICKETING_ALLOWLIST.has(domainBaseName(cand.hostname))) {
    return cand.toString();
  }
  return null;
}

/** Parse an ISO date; return the Date if valid AND within the sane window. */
function parseSaneDate(value: string, now: number): Date | null {
  const d = new Date(value);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  if (t < now - ONE_YEAR_MS) return null;
  if (t > now + 2 * ONE_YEAR_MS) return null;
  return d;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Validate + sanitize one untrusted extracted-event object against the source.
 */
export function validateExtractedEvent(
  raw: unknown,
  sourceUrl: string,
): ValidationResult {
  // sourceUrl itself must be a usable http(s) URL for the domain check.
  try {
    const su = new URL(sourceUrl);
    if (su.protocol !== "http:" && su.protocol !== "https:") {
      return { ok: false, errors: ["sourceUrl is not an http(s) URL"] };
    }
  } catch {
    return { ok: false, errors: ["sourceUrl is not a valid URL"] };
  }

  const parsed = extractedEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const e = parsed.data;
  const errors: string[] = [];
  const now = Date.now();

  // --- dates ---
  const start = parseSaneDate(e.start, now);
  if (!start) {
    errors.push("start: unparseable or outside sane window (now-1y..now+2y)");
  }
  let endIso: string | null = null;
  if (e.end != null) {
    const end = parseSaneDate(e.end, now);
    if (!end) {
      // An out-of-window / bad end is dropped rather than failing the event.
      endIso = null;
    } else if (start && end.getTime() < start.getTime()) {
      // End before start is incoherent: drop it.
      endIso = null;
    } else {
      endIso = e.end;
    }
  }

  // --- text fields ---
  const title = cleanText(e.title, TITLE_MAX);
  if (!title) errors.push("title: empty after sanitization");

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const value: ExtractedEvent = {
    title: title as string,
    type: e.type,
    clubSlug: cleanText(e.clubSlug, NAME_MAX),
    start: e.start,
    end: endIso,
    allDay: e.allDay,
    recurrence: e.recurrence ? e.recurrence.slice(0, 1000) : null,
    location: {
      name: cleanText(e.location.name, NAME_MAX),
      address: cleanText(e.location.address, ADDRESS_MAX),
      // The extractor must never set coordinates; the geocoder fills them.
      lat: null,
      lng: null,
    },
    description: cleanText(e.description, DESCRIPTION_MAX),
    url: sanitizeUrl(e.url, sourceUrl),
    ticketUrl: sanitizeUrl(e.ticketUrl, sourceUrl),
    sourceUrl,
    extractionMethod: e.extractionMethod,
    confidence: clamp01(e.confidence),
  };

  return { ok: true, value };
}
