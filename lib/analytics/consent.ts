/**
 * Analytics consent, stored per browser.
 *
 * Google Analytics sets identifiers, so under the GDPR/ePrivacy rules that apply
 * to a public Dutch site it may not run until the visitor opts in. Nothing here
 * loads a tracker; this module only records the answer and lets callers react.
 *
 * The default is DENIED. An absent or unreadable value is treated as denial, so
 * a visitor who never answers — or blocks storage entirely — is never measured.
 */
"use client";

const KEY = "cheer-analytics-consent";

export type Consent = "granted" | "denied" | "unset";

/** Read the stored choice. Any failure is treated as "unset", never as consent. */
export function readConsent(): Consent {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    // Private mode, blocked storage, or a browser that throws on access.
    return "unset";
  }
}

/** Record a choice. Silently gives up if storage is unavailable. */
export function writeConsent(value: Exclude<Consent, "unset">): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* nothing sensible to do — the visitor simply gets asked again */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/** Fired on the window when the choice changes, so listeners can react at once. */
export const CONSENT_EVENT = "cheer-analytics-consent-change";
