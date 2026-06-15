import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Privacyverklaring van Cheer News: welke gegevens we tonen en hoe we ermee omgaan.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
        Privacy
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Laatst bijgewerkt: juni 2026
      </p>

      <div className="mt-8 flex flex-col gap-8 text-[var(--ink)]">
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Wat dit is</h2>
          <p className="text-[var(--muted)]">
            Cheer News is een open overzicht van cheerleading in
            Nederland: clubs, wedstrijden, open gyms en trainingstijden. We
            verzamelen en tonen publiek beschikbare informatie over clubs en
            evenementen.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Welke gegevens</h2>
          <p className="text-[var(--muted)]">
            De getoonde clubgegevens (naam, locatie, teams, contactgegevens,
            social media) komen uit openbare bronnen of zijn door clubs zelf
            aangeleverd. We slaan geen persoonlijke accountgegevens van
            bezoekers op en gebruiken geen tracking-cookies voor advertenties.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Bijdragen</h2>
          <p className="text-[var(--muted)]">
            Wanneer je via het bijdrageformulier informatie aanlevert, gebruiken
            we die uitsluitend om het overzicht aan te vullen en te controleren.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Correcties</h2>
          <p className="text-[var(--muted)]">
            Klopt er iets niet of wil je dat gegevens worden aangepast of
            verwijderd? Laat het ons weten via het bijdrageformulier, dan passen
            we het aan.
          </p>
        </section>
      </div>
    </div>
  );
}
