/**
 * About page (Server Component).
 *
 * Static content: explains what Cheer News is, the roadmap of future regional
 * expansions, and who Cheersport Netherlands (CSN) is, the federation this
 * project is built for. No data fetching, so it's a plain Server Component.
 */
import Image from "next/image";
import Link from "next/link";
import {
  MapPinned,
  CalendarDays,
  Building2,
  Globe,
  ArrowUpRight,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Over Cheer News",
  description:
    "Cheer News brengt alle cheerleading in Nederland samen op één plek. Een initiatief gebouwd voor Cheersport Netherlands (CSN), de nationale cheerleadingfederatie.",
};

/** Future big expansions, in the order we plan to ship them. */
const ROADMAP = [
  {
    icon: Globe,
    title: "België",
    body: "Clubs, wedstrijden en open gyms uit België erbij, zodat de Lage Landen samen op één kaart staan.",
    when: "Binnenkort",
  },
  {
    icon: MapPinned,
    title: "Duitse grensstreek",
    body: "Het aangrenzende Ruhrgebied en de Duitse grensregio, waar veel clubs vlak bij Nederland zitten.",
    when: "Later",
  },
  {
    icon: UserCog,
    title: "Clubs beheren zichzelf",
    body: "Clubeigenaren kunnen straks zelf hun clubgegevens, teams en evenementen bijwerken — direct, zonder tussenkomst van een redacteur.",
    when: "Later",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Over dit project
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Alle cheerleading in Nederland, op één plek
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Cheer News is een open overzicht van de Nederlandse cheerleadingwereld:
          clubs, wedstrijden, open gyms en trainingstijden, samengebracht op een
          kaart, een agenda en een clubgids. Een initiatief gebouwd voor{" "}
          <strong className="text-[var(--ink)]">Cheersport Netherlands</strong>.
        </p>
      </header>

      {/* What we build */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Wat we bouwen
        </h2>
        <p className="mt-3 text-[var(--muted)]">
          Informatie over cheerleading staat nu verspreid over losse clubsites,
          social media en federatie-agenda&apos;s. Wij brengen het samen. Data
          wordt grotendeels automatisch verzameld en aangevuld met meldingen uit
          de community. Elke onzekere of gemelde toevoeging wordt handmatig
          gecontroleerd voordat die online komt.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium">
            <MapPinned className="size-4 text-[var(--accent)]" aria-hidden />
            Kaart
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium">
            <CalendarDays className="size-4 text-[var(--accent)]" aria-hidden />
            Agenda
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium">
            <Building2 className="size-4 text-[var(--accent)]" aria-hidden />
            Clubgids
          </span>
        </div>
      </section>

      {/* Roadmap: future regional expansions */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-bold tracking-tight">Roadmap</h2>
        <p className="mt-3 text-[var(--muted)]">
          Waar Cheer News naartoe groeit: van Nederland naar de bredere regio,
          zodat uiteindelijk de hele scene op één kaart komt.
        </p>
        <ol className="mt-6 space-y-5">
          {ROADMAP.map(({ icon: Icon, title, body, when }) => (
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
          Over Cheersport Netherlands
        </h2>
        <p className="mt-3 text-[var(--muted)]">
          Cheersport Netherlands (CSN) is de nationale cheerleadingfederatie van
          Nederland. CSN zet zich in om cheerleading in het hele land te laten
          groeien vanuit een visie van samenwerking, opleiding en inclusiviteit.
          Samen met coaches, sporters, scholen en clubs werkt de federatie aan
          een sterke cheerleadinggemeenschap. CSN is gevestigd in Maastricht.
        </p>
        <p className="mt-3 text-[var(--muted)]">
          Cheer News is gebouwd in naam van CSN, als publiek venster op de
          Nederlandse cheerscene.
        </p>
        <div className="mt-5">
          <Button asChild variant="secondary" size="sm">
            <a
              href="https://www.cheersport.nl/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bezoek cheersport.nl
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-[var(--radius)] bg-[var(--surface-2)] p-6 text-center">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Mis je iets?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          De agenda groeit met de community. Ontbreekt er een club, wedstrijd of
          open gym? Laat het ons weten.
        </p>
        <div className="mt-4">
          <Button asChild size="sm">
            <Link href="/submit">Ontbrekend item melden</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
