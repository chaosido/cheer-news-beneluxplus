"use client";

/**
 * Language switcher (Client Component) — a compact two-segment NL / EN toggle.
 *
 * Sets the locale cookie and calls `router.refresh()`, which re-runs the Server
 * Components with the new cookie value so the whole page re-renders in the chosen
 * language (no full reload, no flash). The active segment is `aria-pressed`; both
 * are real <button>s, so the control is keyboard-usable.
 */
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const router = useRouter();
  const { locale, t } = useI18n();

  function setLocale(next: Locale) {
    if (next === locale) return;
    // `SameSite=Lax` is enough for a UI preference; `path=/` so it applies
    // site-wide. No `Secure` flag so it also works on http during local dev.
    // Writing document.cookie is the whole point of this user-event handler.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  const fullName: Record<Locale, string> = {
    nl: t.language.nlFull,
    en: t.language.enFull,
  };

  return (
    <div
      role="group"
      aria-label={t.language.label}
      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs font-semibold"
    >
      {LOCALES.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={active}
            aria-label={t.language.switchTo(fullName[loc])}
            onClick={() => setLocale(loc)}
            className={cn(
              "rounded-full px-2 py-1 uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            {loc === "nl" ? t.language.nl : t.language.en}
          </button>
        );
      })}
    </div>
  );
}
