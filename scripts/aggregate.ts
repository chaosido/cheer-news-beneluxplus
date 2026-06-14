/**
 * Daily aggregation pipeline for Cheer News BeneluxPlus.
 *
 * Run with: `npm run aggregate` (tsx --env-file=.env.local scripts/aggregate.ts)
 *   --dry-run   fetch + extract + count, but write NOTHING (use for cold-start
 *               quota estimation: it reports how many Gemini calls a real run
 *               would make).
 *
 * Per source: fetch -> diff (skip unchanged) -> extract (JSON-LD first, Gemini
 * fallback within an LLM-call budget) -> validate -> geocode -> dedupe ->
 * upsert. High-confidence events publish; low-confidence go to `pending` for
 * the /admin review queue. Locked docs (manually edited) are never clobbered.
 *
 * See scripts/seed.ts for the `server-only` re-exec rationale.
 */
import { spawnSync } from "node:child_process";

const REACT_SERVER_CONDITION = "--conditions=react-server";
if (!process.execArgv.includes(REACT_SERVER_CONDITION)) {
  const result = spawnSync(
    process.argv[0],
    [...process.execArgv, REACT_SERVER_CONDITION, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

import { createHash } from "node:crypto";
import type { ExtractedEvent, PublishStatus } from "../lib/types";
import { EXTRACTOR_VERSION } from "../lib/types";

const DRY_RUN = process.argv.includes("--dry-run");
/**
 * Gemini / LLM extraction kill-switch (mirrors lib/extract.ts). DISABLED by
 * default: the pipeline runs JSON-LD only and needs NO GEMINI_API_KEY. To
 * re-enable, set GEMINI_ENABLED=true (and provide GEMINI_API_KEY) — the
 * MAX_LLM_CALLS budget logic below is kept intact but stays inert while off.
 */
const GEMINI_ENABLED = process.env.GEMINI_ENABLED === "true";
/** Max Gemini calls per run — keep safely below the free-tier daily quota. */
const MAX_LLM_CALLS = Number(process.env.MAX_LLM_CALLS_PER_RUN ?? 40);
/** Confidence at/above which a scraped event auto-publishes; below goes to review. */
const PUBLISH_THRESHOLD = 0.85;
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "CheerNewsBeneluxPlus/1.0 (+https://cheer-news-beneluxplus.web.app; wonnink.jesse@gmail.com)";

interface RunStats {
  sources: number;
  skippedUnchanged: number;
  fetchErrors: number;
  llmCalls: number;
  quota429: number;
  eventsUpserted: number;
  eventsPublished: number;
  eventsPending: number;
  lockedSkipped: number;
}

function normalizedHash(text: string): string {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  // Dynamic imports AFTER the react-server re-exec so `server-only` is a no-op.
  const { adminDb } = await import("../lib/firebaseAdmin");
  const { FieldValue, Timestamp } = await import("firebase-admin/firestore");
  const { parseJsonLdEvents, extractWithGemini, htmlToText } = await import("../lib/extract");
  const { validateExtractedEvent } = await import("../lib/validate");
  const { dedupeEvents } = await import("../lib/dedup");
  const { geocode } = await import("../lib/geocode");

  const stats: RunStats = {
    sources: 0,
    skippedUnchanged: 0,
    fetchErrors: 0,
    llmCalls: 0,
    quota429: 0,
    eventsUpserted: 0,
    eventsPublished: 0,
    eventsPending: 0,
    lockedSkipped: 0,
  };

  console.log(`[aggregate] start ${DRY_RUN ? "(DRY RUN)" : ""} extractorVersion=${EXTRACTOR_VERSION}`);
  if (!GEMINI_ENABLED) {
    console.log("[aggregate] Gemini disabled — JSON-LD only");
  }

  // Build slug -> club lookup for clubId resolution + city coords.
  const clubsSnap = await adminDb.collection("clubs").get();
  const clubBySlug = new Map<string, { id: string; lat: number | null; lng: number | null; city: string }>();
  for (const d of clubsSnap.docs) {
    const c = d.data();
    clubBySlug.set(c.slug, { id: d.id, lat: c.lat ?? null, lng: c.lng ?? null, city: c.city ?? "" });
  }

  const sourcesSnap = await adminDb.collection("sources").get();
  stats.sources = sourcesSnap.size;

  for (const srcDoc of sourcesSnap.docs) {
    const src = srcDoc.data();
    const sourceUrl: string = src.url;
    // SSRF guard: only ever fetch http(s) sources. A non-http URL in Firestore
    // (e.g. file://, internal/metadata endpoints) must never be fetched.
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        console.warn(`[skip] non-http source skipped: ${sourceUrl}`);
        continue;
      }
    } catch {
      console.warn(`[skip] invalid source URL: ${sourceUrl}`);
      continue;
    }
    let html: string;
    try {
      html = await fetchHtml(sourceUrl);
    } catch (err) {
      stats.fetchErrors++;
      console.warn(`[fetch-error] ${sourceUrl}: ${(err as Error).message}`);
      if (!DRY_RUN) {
        await srcDoc.ref.update({
          lastStatus: `error: ${(err as Error).message}`.slice(0, 200),
          lastFetchedAt: FieldValue.serverTimestamp(),
        });
      }
      continue;
    }

    // ---- Diff gate ----
    const hash = normalizedHash(htmlToText(html));
    const unchanged = src.contentHash === hash && src.extractorVersion === EXTRACTOR_VERSION;
    if (unchanged) {
      stats.skippedUnchanged++;
      if (!DRY_RUN) await srcDoc.ref.update({ lastFetchedAt: FieldValue.serverTimestamp() });
      continue;
    }

    // ---- Extract: JSON-LD first, Gemini fallback within budget ----
    // When Gemini is disabled the LLM fallback is skipped entirely (no budget
    // accounting, no SDK call); extraction is JSON-LD only.
    let raw: ExtractedEvent[] = parseJsonLdEvents(html, sourceUrl);
    if (GEMINI_ENABLED && raw.length === 0) {
      if (stats.llmCalls >= MAX_LLM_CALLS) {
        console.warn(`[budget] LLM cap (${MAX_LLM_CALLS}) reached — skipping Gemini for ${sourceUrl}`);
      } else {
        stats.llmCalls++;
        try {
          raw = await extractWithGemini(htmlToText(html), sourceUrl);
        } catch (err) {
          const msg = (err as Error).message ?? "";
          if (msg.includes("429") || /quota|rate/i.test(msg)) {
            stats.quota429++;
            console.error(`[QUOTA-429] Gemini quota hit on ${sourceUrl}: ${msg}`);
          } else {
            console.error(`[gemini-error] ${sourceUrl}: ${msg}`);
          }
        }
      }
    }

    // ---- Validate (trust boundary) ----
    const valid: ExtractedEvent[] = [];
    for (const e of raw) {
      const r = validateExtractedEvent(e, sourceUrl);
      if (r.ok) valid.push(r.value);
    }

    // ---- Dedupe within this source ----
    const clusters = dedupeEvents(valid);

    // ---- Geocode + upsert ----
    for (const cluster of clusters) {
      const rep = cluster.members.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      const club = rep.clubSlug ? clubBySlug.get(rep.clubSlug) : undefined;

      let lat = rep.location.lat ?? null;
      let lng = rep.location.lng ?? null;
      if ((lat == null || lng == null) && rep.location.address) {
        const geo = await geocode(rep.location.address);
        if (geo) { lat = geo.lat; lng = geo.lng; }
      }
      if (lat == null || lng == null) { lat = club?.lat ?? null; lng = club?.lng ?? null; }

      const status: PublishStatus = rep.confidence >= PUBLISH_THRESHOLD ? "published" : "pending";
      const docId = cluster.canonicalEventId;
      const ref = adminDb.collection("events").doc(docId);

      stats.eventsUpserted++;
      if (status === "published") stats.eventsPublished++; else stats.eventsPending++;

      if (DRY_RUN) continue;

      const existing = await ref.get();
      if (existing.exists && existing.data()?.locked === true) {
        stats.lockedSkipped++;
        continue;
      }

      await ref.set(
        {
          canonicalEventId: docId,
          clubId: club?.id ?? null,
          title: rep.title,
          description: rep.description,
          type: rep.type,
          allDay: rep.allDay ?? false,
          startsAt: Timestamp.fromDate(new Date(rep.start)),
          endsAt: rep.end ? Timestamp.fromDate(new Date(rep.end)) : null,
          locationText: rep.location.name ?? rep.location.address ?? null,
          lat,
          lng,
          url: rep.url,
          ticketUrl: rep.ticketUrl,
          origin: "scrape",
          confidence: rep.confidence,
          extractorVersion: EXTRACTOR_VERSION,
          status,
          locked: existing.exists ? (existing.data()?.locked ?? false) : false,
          sources: cluster.members.map((m) => ({
            sourceId: srcDoc.id,
            sourceUrl: m.sourceUrl,
            lastSeenAt: new Date().toISOString(),
            consecutiveMisses: 0,
          })),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (!DRY_RUN) {
      await srcDoc.ref.update({
        contentHash: hash,
        extractorVersion: EXTRACTOR_VERSION,
        lastFetchedAt: FieldValue.serverTimestamp(),
        lastStatus: `ok: ${clusters.length} events`,
      });
    }
  }

  console.log("[aggregate] summary:", JSON.stringify(stats, null, 2));
  if (stats.quota429 > 0) {
    console.error(`[aggregate] WARNING: hit Gemini quota ${stats.quota429}x — some sources not extracted.`);
  }
}

main().catch((err) => {
  console.error("[aggregate] fatal:", err);
  process.exit(1);
});
