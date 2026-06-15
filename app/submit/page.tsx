/**
 * Public submission page (Server Component shell).
 *
 * Renders intro copy + the client `SubmitForm`. The Turnstile site key is read
 * here (server) and passed to the client; it's a public key so this is safe.
 */
import { SubmitForm } from "@/components/submit/SubmitForm";

export const metadata = {
  title: "Inzenden · Cheer News",
  description:
    "Mis je een evenement, open gym of club? Stuur het in. Wij controleren elke inzending voordat die online komt.",
};

export default function SubmitPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Iets inzenden
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Mis je een wedstrijd, open gym of club op de kaart? Of klopt er iets
          niet? Stuur het hieronder in. We bekijken elke inzending handmatig
          voordat die online komt — zo houden we de agenda betrouwbaar.
        </p>
      </header>

      <SubmitForm turnstileSiteKey={turnstileSiteKey} />
    </main>
  );
}
