import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AdminNavLink } from "@/components/AdminNavLink";
import { HomeNavLink } from "@/components/HomeNavLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

const NAV_LINK_CLASS =
  "rounded-full px-2 py-1.5 font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] sm:px-3";

export async function SiteHeader() {
  const t = await getDictionary();
  const nav = [
    { href: "/", label: t.header.nav.home },
    { href: "/clubs", label: t.header.nav.clubs },
    { href: "/coaches", label: t.header.nav.coaches },
    { href: "/over", label: t.header.nav.about },
  ];

  return (
    <header className="sticky top-0 z-[1000] border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
        {/* Federation logo → external CSN site. Compact hexagon mark on phones,
            full wordmark logo from sm up. */}
        <a
          href="https://www.cheersport.nl/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.header.csnLogoAlt}
          className="shrink-0"
        >
          <Image
            src="/csn-mark.png"
            alt=""
            width={800}
            height={800}
            className="h-8 w-auto sm:hidden"
            unoptimized
            priority
          />
          <Image
            src="/cheersport-netherlands.svg"
            alt=""
            width={200}
            height={60}
            className="hidden h-7 w-auto sm:block"
            unoptimized
            priority
          />
        </a>
        <Link
          href="/"
          className="hidden shrink-0 font-display text-lg font-extrabold tracking-tight sm:inline"
        >
          Cheer <span className="text-[var(--accent)]">Overview</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          {nav.map((item) =>
            item.href === "/" ? (
              <HomeNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                // On phones the logo/wordmark already navigates home; hide the
                // pill so the row fits ~360px.
                className={cn(NAV_LINK_CLASS, "hidden sm:inline-block")}
              />
            ) : (
              <Link key={item.href} href={item.href} className={NAV_LINK_CLASS}>
                {item.label}
              </Link>
            ),
          )}
          <AdminNavLink label={t.header.nav.admin} />
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LanguageToggle />
          {/* The full CTA label ("Ontbrekend item melden") is ~190px — anything
              wider than the phone viewport makes mobile Chrome zoom the whole
              page out. Icon-only below sm. */}
          <Button asChild size="sm">
            <Link href="/submit" aria-label={t.header.submitCta}>
              <Plus className="size-4 sm:hidden" aria-hidden />
              <span className="hidden sm:inline">{t.header.submitCta}</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
