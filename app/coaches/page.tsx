/**
 * Visiting coaches directory (Server Component).
 *
 * Lists guest/touring coaches who are currently in the country or arriving soon
 * (see `getPublishedVisitingCoaches`, which drops past stays), with their city,
 * dates, and contact handles so people can reach out directly. Firestore may be
 * empty/unreachable in dev, so the read is wrapped and degrades to an empty state.
 */
import type { Metadata } from "next";
import {
  Globe,
  AtSign,
  Music2,
  Mail,
  Phone,
  MapPin,
  CalendarRange,
  Users,
} from "lucide-react";
import { getPublishedVisitingCoaches } from "@/lib/queries";
import type { VisitingCoachClient } from "@/lib/types";
import { EmptyState } from "@/components/home/EmptyState";
import { dictionaryFor, getDictionary, getLocale } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { dateFnsLocale, TZ } from "@/lib/dateFormat";
import { formatInTimeZone } from "date-fns-tz";

/** Facebook "f" glyph (lucide dropped brand icons), styled like a lucide icon. */
function Facebook({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.coaches.metaTitle,
    description: t.coaches.metaDescription,
  };
}

/** "15 jun 2026 – 20 jun 2026" / "15 Jun 2026 – …", or "Vanaf …"/"From …". */
function formatStay(
  coach: VisitingCoachClient,
  t: Dictionary,
  locale: Locale,
): string {
  const dfns = dateFnsLocale(locale);
  const start = formatInTimeZone(new Date(coach.startsAt), TZ, "d MMM yyyy", {
    locale: dfns,
  });
  if (!coach.endsAt) return t.coaches.fromDate(start);
  const end = formatInTimeZone(new Date(coach.endsAt), TZ, "d MMM yyyy", {
    locale: dfns,
  });
  return `${start} – ${end}`;
}

export default async function CoachesPage() {
  const locale = await getLocale();
  const t = dictionaryFor(locale);
  let coaches: VisitingCoachClient[] = [];
  try {
    coaches = await getPublishedVisitingCoaches();
  } catch (err) {
    console.error("[coaches] data load failed, rendering empty state:", err);
    coaches = [];
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-6 max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
          {t.coaches.heading}
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {t.coaches.introBefore}{" "}
          <a
            href="/submit"
            className="font-medium text-[var(--accent)] underline underline-offset-2"
          >
            {t.coaches.introLink}
          </a>
          .
        </p>
      </header>

      {coaches.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t.coaches.emptyTitle}
          hint={t.coaches.emptyHint}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {coaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} t={t} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CoachCard({
  coach,
  t,
  locale,
}: {
  coach: VisitingCoachClient;
  t: Dictionary;
  locale: Locale;
}) {
  const socials: { href: string; label: string; Icon: typeof Globe }[] = [];
  if (coach.instagramUrl)
    socials.push({
      href: coach.instagramUrl,
      label: "Instagram",
      Icon: AtSign,
    });
  if (coach.tiktokUrl)
    socials.push({ href: coach.tiktokUrl, label: "TikTok", Icon: Music2 });
  if (coach.facebookUrl)
    socials.push({
      href: coach.facebookUrl,
      label: "Facebook",
      Icon: Facebook as typeof Globe,
    });
  if (coach.websiteUrl)
    socials.push({ href: coach.websiteUrl, label: "Website", Icon: Globe });
  if (coach.contactEmail)
    socials.push({
      href: `mailto:${coach.contactEmail}`,
      label: "Email",
      Icon: Mail,
    });
  if (coach.phone)
    socials.push({
      href: `tel:${coach.phone.replace(/[^\d+]/g, "")}`,
      label: "Phone",
      Icon: Phone,
    });

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">
          {coach.name}
        </h2>
        {coach.role && (
          <p className="text-sm text-[var(--muted)]">{coach.role}</p>
        )}
      </div>

      <p className="inline-flex items-center gap-1.5 text-sm text-[var(--ink)]">
        <MapPin className="size-4 text-[var(--muted)]" aria-hidden />
        {coach.city}
      </p>
      <p className="inline-flex items-center gap-1.5 text-sm text-[var(--ink)]">
        <CalendarRange className="size-4 text-[var(--muted)]" aria-hidden />
        {formatStay(coach, t, locale)}
      </p>

      {coach.bio && (
        <p className="mt-1 text-sm text-[var(--muted)]">{coach.bio}</p>
      )}

      {socials.length > 0 && (
        <div className="mt-auto flex items-center gap-3 border-t border-[var(--border)] pt-3">
          {socials.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.map.coachVia(coach.name, label)}
              title={label}
              className="text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <Icon className="size-5" aria-hidden />
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
