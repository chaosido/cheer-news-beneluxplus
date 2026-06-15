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

export const metadata: Metadata = {
  title: "Visiting coaches",
  description:
    "Guest and touring coaches visiting the Netherlands: see where and when they are, and get in touch directly.",
};

const STAY_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "15 Jun 2026 – 20 Jun 2026", or "From 15 Jun 2026" when open-ended. */
function formatStay(coach: VisitingCoachClient): string {
  const start = STAY_DATE_FMT.format(new Date(coach.startsAt));
  if (!coach.endsAt) return `From ${start}`;
  return `${start} – ${STAY_DATE_FMT.format(new Date(coach.endsAt))}`;
}

export default async function CoachesPage() {
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
          Visiting coaches
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Guest and touring coaches visiting the Netherlands. See where and when
          they are, and reach out directly. Visiting yourself?{" "}
          <a
            href="/submit"
            className="font-medium text-[var(--accent)] underline underline-offset-2"
          >
            Submit your stay
          </a>
          .
        </p>
      </header>

      {coaches.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No visiting coaches yet"
          hint="Once a guest coach submits their stay and it's approved, they'll appear here."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {coaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CoachCard({ coach }: { coach: VisitingCoachClient }) {
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
        {formatStay(coach)}
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
              aria-label={`${coach.name} via ${label}`}
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
