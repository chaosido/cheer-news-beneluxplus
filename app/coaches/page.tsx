/**
 * Coaches directory (Server Component).
 *
 * Two tiers: (1) the coaching staff of each club, grouped by club, as the
 * primary section; (2) guest/touring coaches currently in the country or
 * arriving soon (see `getPublishedVisitingCoaches`, which drops past stays),
 * with city, dates, and contact handles so people can reach out directly.
 * Firestore may be empty/unreachable in dev, so reads are wrapped and degrade
 * to an empty state.
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
  BadgeCheck,
  Users,
} from "lucide-react";
import { clubHasIcuCoach, getClubs, getPublishedVisitingCoaches } from "@/lib/queries";
import type { ClubClient, VisitingCoachClient } from "@/lib/types";
import { CoachList } from "@/components/clubs/CoachList";
import { Badge } from "@/components/ui/Badge";
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
  let clubs: ClubClient[] = [];
  let visiting: VisitingCoachClient[] = [];
  try {
    [clubs, visiting] = await Promise.all([
      getClubs(),
      getPublishedVisitingCoaches(),
    ]);
  } catch (err) {
    console.error("[coaches] data load failed, rendering empty state:", err);
  }

  const clubsWithCoaches = clubs.filter((c) => (c.coaches ?? []).length > 0);
  const isEmpty = clubsWithCoaches.length === 0 && visiting.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-6 max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
          {t.coaches.pageHeading}
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

      {isEmpty ? (
        <EmptyState
          icon={Users}
          title={t.coaches.emptyTitle}
          hint={t.coaches.emptyHint}
        />
      ) : (
        <div className="flex flex-col gap-10">
          {clubsWithCoaches.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-[var(--ink)]">
                {t.coaches.clubCoachesHeading}
              </h2>
              <div className="mt-4 flex flex-col gap-6">
                {clubsWithCoaches.map((club) => (
                  <div
                    key={club.id}
                    className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <a
                        href={`/clubs/${club.slug}`}
                        className="font-display text-lg font-bold text-[var(--ink)] hover:text-[var(--accent)]"
                      >
                        {club.name}
                      </a>
                      {clubHasIcuCoach(club.coaches) && (
                        <Badge
                          className="shrink-0 gap-1 text-[var(--accent)]"
                          title={t.coaches.clubHasIcuCoach}
                          aria-label={t.coaches.clubHasIcuCoach}
                        >
                          <BadgeCheck className="size-3.5" aria-hidden />
                          ICU
                        </Badge>
                      )}
                    </div>
                    <CoachList coaches={club.coaches ?? []} t={t} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {visiting.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-[var(--ink)]">
                {t.coaches.visitingHeading}
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visiting.map((coach) => (
                  <CoachCard
                    key={coach.id}
                    coach={coach}
                    t={t}
                    locale={locale}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
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
