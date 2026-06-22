/**
 * Club profile (Server Component, dynamic route).
 *
 * Loads the club by slug (→ notFound on miss), then its teams, upcoming
 * events, and recurring sessions in parallel. The `open_gyms` collection holds
 * BOTH team trainings and public open gyms, split here by `sessionType`:
 * trainings render as a weekly schedule grouped per team, open gyms as their
 * weekly pattern — neither is expanded into dated occurrences. All reads are
 * wrapped so a missing/empty Firestore degrades to intentional empty states
 * rather than crashing.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  AtSign,
  CalendarClock,
  CalendarDays,
  DoorOpen,
  Globe,
  Mail,
  MapPin,
  Music2,
  Play,
  Trophy,
  Users,
} from "lucide-react";

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
import {
  getClubBySlug,
  getClubTeams,
  getPublishedEvents,
  getPublishedOpenGyms,
} from "@/lib/queries";
import type { ClubClient, EventClient, OpenGymClient, Team } from "@/lib/types";
import { safeUrl } from "@/lib/safeUrl";
import { TeamBadges } from "@/components/TeamBadges";
import { EventsList } from "@/components/clubs/EventsList";
import { OpenGymsList } from "@/components/clubs/OpenGymsList";
import { TrainingTimesList } from "@/components/clubs/TrainingTimesList";
import { CoachList } from "@/components/clubs/CoachList";
import { Achievements } from "@/components/clubs/Achievements";
import { Card } from "@/components/ui/Card";
import { dictionaryFor, getDictionary, getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getDictionary();
  let club: ClubClient | null = null;
  try {
    club = await getClubBySlug(slug);
  } catch {
    club = null;
  }
  if (!club) {
    return { title: t.club.notFoundTitle };
  }
  const title = club.city ? `${club.name} — ${club.city}` : club.name;
  const description = club.blurb ?? t.club.metaFallback(club.name, club.city);
  return { title, description };
}

export default async function ClubProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = dictionaryFor(locale);

  let club: ClubClient | null = null;
  try {
    club = await getClubBySlug(slug);
  } catch (err) {
    console.error("[club] lookup failed:", err);
    club = null;
  }
  if (!club) notFound();

  const now = new Date();

  let teams: Team[] = [];
  let events: EventClient[] = [];
  // The open_gyms collection mixes team trainings and public open gyms; split
  // them by sessionType (missing/anything-but-"training" => open gym).
  let trainings: OpenGymClient[] = [];
  let openGyms: OpenGymClient[] = [];

  try {
    const [teamList, eventList, gymList] = await Promise.all([
      getClubTeams(club.id),
      getPublishedEvents({ clubId: club.id, from: now }),
      getPublishedOpenGyms({ clubId: club.id }),
    ]);
    teams = teamList.filter((t) => t.status === "active");
    events = eventList;
    trainings = gymList.filter((g) => g.sessionType === "training");
    openGyms = gymList.filter((g) => g.sessionType !== "training");
  } catch (err) {
    console.error("[club] related data load failed:", err);
  }

  // Prefer full team docs; fall back to the denormalized summary on the club.
  const teamData = teams.length > 0 ? teams : club.teamsSummary;
  const osmUrl =
    club.lat != null && club.lng != null
      ? `https://www.openstreetmap.org/?mlat=${club.lat}&mlon=${club.lng}#map=15/${club.lat}/${club.lng}`
      : club.address
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${club.address}, ${club.city}`)}`
        : null;

  const coaches = club.coaches ?? [];
  const achievements = club.achievements ?? [];
  const contactEmail = club.contactEmail ?? club.email ?? null;

  // Instagram leads — it is the channel cheer clubs actually live on — and gets
  // the accent treatment so it reads as the primary call to action. Each href is
  // re-validated against the http(s) allowlist (defense-in-depth on Firestore data).
  const instagramUrl = safeUrl(club.instagramUrl);
  const websiteUrl = safeUrl(club.websiteUrl);
  const facebookUrl = safeUrl(club.facebookUrl);
  const tiktokUrl = safeUrl(club.tiktokUrl);
  const youtubeUrl = safeUrl(club.youtubeUrl);
  const logoUrl = safeUrl(club.logoUrl);
  const socials = [
    instagramUrl && {
      href: instagramUrl,
      label: "Instagram",
      icon: AtSign,
      primary: true,
    },
    websiteUrl && {
      href: websiteUrl,
      label: "Website",
      icon: Globe,
    },
    facebookUrl && {
      href: facebookUrl,
      label: "Facebook",
      icon: Facebook as typeof Globe,
    },
    tiktokUrl && {
      href: tiktokUrl,
      label: "TikTok",
      icon: Music2,
    },
    youtubeUrl && {
      href: youtubeUrl,
      label: "YouTube",
      icon: Play,
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    icon: typeof Globe;
    primary?: boolean;
  }[];

  const hasPractical = Boolean(
    club.trainingLocation || club.address || club.city || contactEmail,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <nav className="mb-6 text-sm">
        <Link
          href="/clubs"
          className="text-[var(--muted)] hover:text-[var(--ink)]"
        >
          {t.club.backToClubs}
        </Link>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {logoUrl ? (
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
            <Image
              src={logoUrl}
              alt=""
              width={80}
              height={80}
              priority
              className="size-full object-contain"
            />
          </span>
        ) : (
          <span
            aria-hidden
            className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] font-display text-xl font-extrabold text-[var(--accent)]"
          >
            {initials(club.name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            {club.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
            {club.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {club.city}
              </span>
            )}
            {club.foundedYear && <span>{t.club.founded(club.foundedYear)}</span>}
          </div>

          {socials.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {socials.map(({ href, label, icon: Icon, primary }) =>
                primary ? (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
                  >
                    <Icon className="size-4.5" aria-hidden />
                    {label}
                  </a>
                ) : (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </a>
                ),
              )}
            </div>
          )}

          {club.blurb && (
            <p className="mt-4 max-w-2xl text-[var(--ink)]">{club.blurb}</p>
          )}
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_18rem]">
        {/* Main column */}
        <div className="flex flex-col gap-10">
          <Section icon={Users} title={t.club.sectionTeams}>
            <TeamBadges teams={teamData} t={t} variant="full" />
          </Section>

          <Section icon={CalendarClock} title={t.club.sectionTrainingTimes}>
            <TrainingTimesList trainings={trainings} t={t} />
          </Section>

          {coaches.length > 0 && (
            <Section icon={Users} title={t.club.sectionCoaches}>
              <CoachList coaches={coaches} t={t} />
            </Section>
          )}

          {achievements.length > 0 && (
            <Section icon={Trophy} title={t.club.sectionAchievements}>
              <Achievements achievements={achievements} />
            </Section>
          )}

          <Section icon={CalendarDays} title={t.club.sectionUpcoming}>
            <EventsList events={events} t={t} locale={locale} />
          </Section>

          <Section icon={DoorOpen} title={t.club.sectionOpenGyms}>
            <OpenGymsList openGyms={openGyms} t={t} locale={locale} />
          </Section>
        </div>

        {/* Sidebar: practical info */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-[var(--ink)]">
              <MapPin className="size-4.5 text-[var(--muted)]" aria-hidden />
              {t.club.practical}
            </h2>

            {hasPractical ? (
              <dl className="flex flex-col gap-4 text-sm">
                {club.trainingLocation && (
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-[var(--muted)]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <dt className="font-medium text-[var(--ink)]">
                        {t.club.trainingLocation}
                      </dt>
                      <dd className="text-[var(--muted)]">
                        {club.trainingLocation}
                      </dd>
                    </div>
                  </div>
                )}

                {(club.address || club.city) && (
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-[var(--muted)]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <dt className="font-medium text-[var(--ink)]">
                        {t.club.address}
                      </dt>
                      <dd>
                        <address className="not-italic text-[var(--muted)]">
                          {club.address && (
                            <span className="block">{club.address}</span>
                          )}
                          {club.city && (
                            <span className="block">{club.city}</span>
                          )}
                        </address>
                      </dd>
                    </div>
                  </div>
                )}

                {contactEmail && (
                  <div className="flex items-start gap-2.5">
                    <Mail
                      className="mt-0.5 size-4 shrink-0 text-[var(--muted)]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <dt className="font-medium text-[var(--ink)]">
                        {t.club.contact}
                      </dt>
                      <dd>
                        <a
                          href={`mailto:${contactEmail}`}
                          className="break-words text-[var(--secondary)] hover:underline"
                        >
                          {contactEmail}
                        </a>
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                {t.club.noPractical}
              </p>
            )}

            {osmUrl && (
              <a
                href={osmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--secondary)] hover:underline"
              >
                <MapPin className="size-3.5" aria-hidden />
                {t.club.viewOnMap}
              </a>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Globe;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-[var(--ink)]">
        <Icon className="size-4.5 text-[var(--muted)]" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}
