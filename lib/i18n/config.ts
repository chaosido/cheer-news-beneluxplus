/**
 * i18n configuration — locales, default, and the persistence cookie.
 *
 * Approach: cookie-based locale + typed dictionaries (no URL-locale routing).
 * The site is small (~10 routes), mostly Server Components, and the Firestore
 * DATA stays Dutch regardless of UI language, so locale-prefixed routes would
 * add restructuring for no gain. The chosen locale lives in a cookie; the root
 * layout reads it server-side so SSR renders the right language with no flash.
 */

/** Supported UI locales. NL is the default; EN and FR are the alternates. */
export const LOCALES = ["nl", "en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

/** New visitors see Dutch. */
export const DEFAULT_LOCALE: Locale = "nl";

/** Cookie that persists the visitor's chosen UI language. */
export const LOCALE_COOKIE = "cheer_locale";

/** A year — the choice should stick across sessions. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Narrow an arbitrary string to a supported Locale, falling back to default. */
export function normalizeLocale(value: string | undefined | null): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : DEFAULT_LOCALE;
}
