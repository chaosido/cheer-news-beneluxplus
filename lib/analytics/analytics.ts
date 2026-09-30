/**
 * Google Analytics loader, gated on consent.
 *
 * The Firebase Analytics SDK is deliberately NOT used: it pulls the whole
 * firebase/analytics module into the client bundle for what is ultimately a
 * gtag.js call, and it initialises on import, which is exactly what a consent
 * gate must prevent. Loading gtag.js by hand keeps "no consent" meaning "no
 * network request at all".
 */
"use client";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

let loaded = false;

/**
 * Load gtag.js and start measuring. Safe to call repeatedly — only the first
 * call does anything. No-ops when no measurement id is configured, so forks and
 * local development never phone home.
 */
export function startAnalytics(): void {
  if (loaded || typeof window === "undefined" || !MEASUREMENT_ID) return;
  loaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);

  // gtag pushes onto this array; it must exist before the script evaluates.
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  }
  gtag("js", new Date());
  // anonymize_ip trims the last octet before storage — required for a lawful
  // basis under Dutch DPA guidance even with consent in hand.
  gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
}

/** True when a measurement id is configured; used to skip the banner entirely. */
export const analyticsAvailable = Boolean(MEASUREMENT_ID);
