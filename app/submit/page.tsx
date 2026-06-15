/**
 * Public submission page (Server Component shell).
 *
 * Renders intro copy + the client `SubmitForm`. The Turnstile site key is read
 * here (server) and passed to the client; it's a public key so this is safe.
 */
import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit/SubmitForm";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.submit.metaTitle,
    description: t.submit.metaDescription,
  };
}

export default async function SubmitPage() {
  const t = await getDictionary();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t.submit.heading}
        </h1>
        <p className="mt-3 text-[var(--muted)]">{t.submit.intro}</p>
      </header>

      <SubmitForm turnstileSiteKey={turnstileSiteKey} />
    </main>
  );
}
