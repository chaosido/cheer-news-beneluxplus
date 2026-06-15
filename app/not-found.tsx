import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getDictionary();
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="font-display text-6xl font-extrabold text-[var(--accent)]">
        404
      </p>
      <h1 className="font-display text-2xl font-bold text-[var(--ink)]">
        {t.notFound.title}
      </h1>
      <p className="text-[var(--muted)]">{t.notFound.body}</p>
      <Link
        href="/"
        className="mt-2 inline-flex h-11 items-center rounded-[var(--radius)] bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {t.notFound.backHome}
      </Link>
    </div>
  );
}
