/**
 * Updates / release notes page (Server Component).
 *
 * Lists the `changelog` collection newest-first: data refreshes (club sweeps,
 * new events) and site features. Entry TEXT is Firestore data and therefore
 * Dutch regardless of UI locale (same rule as club/event data); only the chrome
 * translates. Entries are written by maintainer scripts — no write surface here.
 */
import type { Metadata } from "next";
import { getChangelog } from "@/lib/queries";
import type { ChangelogEntryClient } from "@/lib/types";
import { formatDate } from "@/lib/dateFormat";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.updates.metaTitle,
    description: t.updates.metaDescription,
  };
}

export default async function UpdatesPage() {
  const locale = await getLocale();
  const t = await getDictionary();
  let entries: ChangelogEntryClient[] = [];
  try {
    entries = await getChangelog();
  } catch (err) {
    console.error("[updates] data load failed, rendering empty state:", err);
    entries = [];
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
          {t.updates.heading}
        </h1>
        <p className="mt-2 text-[var(--muted)]">{t.updates.intro}</p>
      </header>

      {entries.length === 0 ? (
        <p className="text-[var(--muted)]">{t.updates.empty}</p>
      ) : (
        <ol className="space-y-6">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <time
                  dateTime={entry.date}
                  className="font-medium text-[var(--muted)]"
                >
                  {formatDate(entry.date, locale)}
                </time>
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                  {t.updates.kind[entry.kind] ?? t.updates.kind.data}
                </span>
              </div>
              <h2 className="mt-2 font-display text-lg font-bold text-[var(--ink)]">
                {entry.title}
              </h2>
              {entry.items.length > 0 && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--muted)]">
                  {entry.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
