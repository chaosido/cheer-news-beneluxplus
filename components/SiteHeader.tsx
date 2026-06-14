import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AdminNavLink } from "@/components/AdminNavLink";
import { HomeNavLink } from "@/components/HomeNavLink";

const NAV_LINK_CLASS =
  "rounded-full px-3 py-1.5 font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]";

const NAV = [
  { href: "/", label: "Kaart & agenda" },
  { href: "/clubs", label: "Clubs" },
  { href: "/coaches", label: "Coaches" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[1000] border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight"
        >
          <span
            className="inline-block size-3 rounded-sm bg-[var(--accent)]"
            aria-hidden
          />
          Cheer<span className="text-[var(--accent)]">NL</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) =>
            item.href === "/" ? (
              <HomeNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                className={NAV_LINK_CLASS}
              />
            ) : (
              <Link key={item.href} href={item.href} className={NAV_LINK_CLASS}>
                {item.label}
              </Link>
            ),
          )}
          <AdminNavLink />
        </nav>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href="/submit">Ontbrekend item melden</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
