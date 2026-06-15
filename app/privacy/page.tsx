import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.privacy.metaTitle,
    description: t.privacy.metaDescription,
  };
}

export default async function PrivacyPage() {
  const t = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
        {t.privacy.heading}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{t.privacy.lastUpdated}</p>

      <div className="mt-8 flex flex-col gap-8 text-[var(--ink)]">
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">
            {t.privacy.whatHeading}
          </h2>
          <p className="text-[var(--muted)]">{t.privacy.whatBody}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">
            {t.privacy.dataHeading}
          </h2>
          <p className="text-[var(--muted)]">{t.privacy.dataBody}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">
            {t.privacy.contributeHeading}
          </h2>
          <p className="text-[var(--muted)]">{t.privacy.contributeBody}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">
            {t.privacy.correctionsHeading}
          </h2>
          <p className="text-[var(--muted)]">{t.privacy.correctionsBody}</p>
        </section>
      </div>
    </div>
  );
}
