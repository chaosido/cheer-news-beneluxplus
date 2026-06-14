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
  Share2,
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coaches op bezoek",
  description:
    "Gast- en touringcoaches die ons land bezoeken: zie waar en wanneer ze zijn en neem rechtstreeks contact op.",
};

const STAY_DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function stripDot(s: string): string {
  return s.replace(/\.(?=\s|$)/g, "");
}

/** "15 jun 2026 – 20 jun 2026", or "Vanaf 15 jun 2026" when open-ended. */
function formatStay(coach: VisitingCoachClient): string {
  const start = stripDot(STAY_DATE_FMT.format(new Date(coach.startsAt)));
  if (!coach.endsAt) return `Vanaf ${start}`;
  return `${start} – ${stripDot(STAY_DATE_FMT.format(new Date(coach.endsAt)))}`;
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
          Coaches op bezoek
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Gast- en touringcoaches die ons land bezoeken. Zie waar en wanneer ze
          zijn en neem rechtstreeks contact op. Ben jij zelf op bezoek?{" "}
          <a
            href="/submit"
            className="font-medium text-[var(--accent)] underline underline-offset-2"
          >
            Meld je aan
          </a>
          .
        </p>
      </header>

      {coaches.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nog geen coaches op bezoek"
          hint="Zodra een gastcoach zich aanmeldt en is goedgekeurd, verschijnt die hier."
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
    socials.push({ href: coach.facebookUrl, label: "Facebook", Icon: Share2 });
  if (coach.websiteUrl)
    socials.push({ href: coach.websiteUrl, label: "Website", Icon: Globe });
  if (coach.contactEmail)
    socials.push({
      href: `mailto:${coach.contactEmail}`,
      label: "E-mail",
      Icon: Mail,
    });
  if (coach.phone)
    socials.push({
      href: `tel:${coach.phone.replace(/[^\d+]/g, "")}`,
      label: "Telefoon",
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
