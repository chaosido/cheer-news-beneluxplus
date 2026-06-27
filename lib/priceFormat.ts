import type { Locale } from "@/lib/i18n/config";

/**
 * Format a price stored in EUROS (e.g. 7.5 => "€ 7,50" in NL, "€7.50" in EN).
 *
 * Prices live on open-gym docs as a plain decimal number of euros (see
 * `OpenGymBase.price`). Callers should handle the `null`/absent (unknown) and
 * `0` (free) cases themselves — this only renders a concrete amount.
 */
export function formatPrice(euros: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}
