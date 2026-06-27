/**
 * About page (Server Component).
 *
 * Static content: a first-person intro to what Cheer News is, the roadmap of
 * future regional expansions, and short profiles of the two national bodies it
 * references — Cheersport Netherlands (CSN) and Team Cheerleading Nederland
 * (TCNL). No data fetching, so it's a plain Server Component. Copy comes from
 * the active locale's dictionary.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  MapPinned,
  CalendarDays,
  Building2,
  Globe,
  ArrowUpRight,
  BookOpen,
  Sparkles,
  Contact,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.about.metaTitle,
    description: t.about.metaDescription,
  };
}

export default async function AboutPage() {
  const t = await getDictionary();

  /** Future big expansions, in the order we plan to ship them. */
  const roadmap = [
    {
      icon: Globe,
      title: t.about.roadmap.belgiumTitle,
      body: t.about.roadmap.belgiumBody,
      when: t.about.roadmap.belgiumWhen,
    },
    {
      icon: MapPinned,
      title: t.about.roadmap.germanyTitle,
      body: t.about.roadmap.germanyBody,
      when: t.about.roadmap.germanyWhen,
    },
    {
      icon: BookOpen,
      title: t.about.roadmap.sourcesTitle,
      body: t.about.roadmap.sourcesBody,
      when: t.about.roadmap.sourcesWhen,
    },
    {
      icon: Sparkles,
      title: t.about.roadmap.rulesAiTitle,
      body: t.about.roadmap.rulesAiBody,
      when: t.about.roadmap.rulesAiWhen,
    },
    {
      icon: Contact,
      title: t.about.roadmap.coachesTitle,
      body: t.about.roadmap.coachesBody,
      when: t.about.roadmap.coachesWhen,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          {t.about.eyebrow}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t.about.heading}
        </h1>
        <p className="mt-3 text-[var(--muted)]">{t.about.introBefore}</p>
      </header>

      {/* What we build */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-bold tracking-tight">
          {t.about.whatHeading}
        </h2>
        <p className="mt-3 text-[var(--muted)]">{t.about.whatBody}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium">
            <MapPinned className="size-4 text-[var(--accent)]" aria-hidden />
            {t.about.chipMap}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium">
            <CalendarDays className="size-4 text-[var(--accent)]" aria-hidden />
            {t.about.chipAgenda}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium">
            <Building2 className="size-4 text-[var(--accent)]" aria-hidden />
            {t.about.chipClubs}
          </span>
        </div>
      </section>

      {/* Roadmap: future regional expansions */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-bold tracking-tight">
          {t.about.roadmapHeading}
        </h2>
        <p className="mt-3 text-[var(--muted)]">{t.about.roadmapIntro}</p>
        <ol className="mt-6 space-y-5">
          {roadmap.map(({ icon: Icon, title, body, when }) => (
            <li key={title} className="flex gap-4">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                <Icon className="size-5 text-[var(--accent)]" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-bold tracking-tight">
                    {title}
                  </h3>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                    {when}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* About CSN */}
      <section className="mb-12 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <Image
          src="/cheersport-netherlands.svg"
          alt="Cheersport Netherlands"
          width={200}
          height={60}
          className="mb-5 h-auto w-44"
          unoptimized
        />
        <h2 className="font-display text-xl font-bold tracking-tight">
          {t.about.csnHeading}
        </h2>
        <p className="mt-3 text-[var(--muted)]">{t.about.csnBody1}</p>
        <div className="mt-5">
          <Button asChild variant="secondary" size="sm">
            <a
              href="https://www.cheersport.nl/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.about.csnVisit}
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </Button>
        </div>
      </section>

      {/* About TCNL */}
      <section className="mb-12 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <Image
          src="/team-cheerleading-nederland.svg"
          alt="Team Cheerleading Nederland"
          width={117}
          height={157}
          className="mb-5 h-20 w-auto"
          unoptimized
        />
        <h2 className="font-display text-xl font-bold tracking-tight">
          {t.about.tcnlHeading}
        </h2>
        <p className="mt-3 text-[var(--muted)]">{t.about.tcnlBody1}</p>
        <div className="mt-5">
          <Button asChild variant="secondary" size="sm">
            <a
              href="https://www.teamcheerleading.nl/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.about.tcnlVisit}
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-[var(--radius)] bg-[var(--surface-2)] p-6 text-center">
        <h2 className="font-display text-lg font-bold tracking-tight">
          {t.about.ctaHeading}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          {t.about.ctaBody}
        </p>
        <div className="mt-4">
          <Button asChild size="sm">
            <Link href="/submit">{t.about.ctaButton}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
