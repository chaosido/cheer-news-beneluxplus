"use client";

/**
 * Consent banner for analytics, plus the loader it gates.
 *
 * Renders nothing at all when no measurement id is configured, so a fork or a
 * local checkout never shows a banner asking about a tracker that cannot run.
 *
 * Deliberately not a modal: it does not trap focus or block the page. A visitor
 * who ignores it keeps full use of the site and is simply never measured, which
 * is what the regulation expects — refusing must be as easy as accepting, so
 * both buttons carry equal visual weight.
 *
 * The stored choice is read through `useSyncExternalStore` rather than an
 * effect: it lives outside React (localStorage, plus a window event so a second
 * tab or the same tab's other components stay in step). The server snapshot is
 * "denied" so the markup never contains a banner — the client then re-renders
 * with the real value, which keeps it from flashing at visitors who already
 * answered.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/context";
import { analyticsAvailable, startAnalytics } from "@/lib/analytics/analytics";
import {
  CONSENT_EVENT,
  readConsent,
  writeConsent,
  type Consent,
} from "@/lib/analytics/consent";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  // `storage` fires in OTHER tabs, so a choice made once applies everywhere.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Server and hydration snapshot: never show a banner in the initial markup. */
const serverSnapshot = (): Consent => "denied";

export function AnalyticsConsent() {
  const { t } = useI18n();
  const consent = useSyncExternalStore(subscribe, readConsent, serverSnapshot);

  // Loading gtag.js is a side effect on an external system, which is what
  // effects are for. It sets no state, so it cannot cascade renders.
  useEffect(() => {
    if (consent === "granted") startAnalytics();
  }, [consent]);

  if (!analyticsAvailable || consent !== "unset") return null;

  return (
    <div
      role="region"
      aria-label={t.consent.title}
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--ink)]">
          {t.consent.body}{" "}
          <a href="/privacy" className="underline hover:no-underline">
            {t.consent.privacyLink}
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => writeConsent("denied")}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)]"
          >
            {t.consent.decline}
          </button>
          <button
            type="button"
            onClick={() => writeConsent("granted")}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90"
          >
            {t.consent.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
