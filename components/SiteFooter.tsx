import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Cheer News BeneluxPlus — een open overzicht van cheerleading in
          Nederland.
        </p>
        <nav className="flex gap-4">
          <Link href="/over" className="hover:text-[var(--ink)]">
            Over
          </Link>
          <Link href="/submit" className="hover:text-[var(--ink)]">
            Bijdragen
          </Link>
          <Link href="/privacy" className="hover:text-[var(--ink)]">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
