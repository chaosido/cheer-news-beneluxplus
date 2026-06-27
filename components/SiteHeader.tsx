import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AdminNavLink } from "@/components/AdminNavLink";
import { HomeNavLink } from "@/components/HomeNavLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getDictionary } from "@/lib/i18n/server";

const NAV_LINK_CLASS =
  "rounded-full px-3 py-1.5 font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]";

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
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-display text-lg font-extrabold tracking-tight"
        >
          <Image
            src="/cheersport-netherlands.svg"
            alt={t.header.csnLogoAlt}
            width={200}
            height={60}
            className="h-7 w-auto"
            unoptimized
            priority
          />
          <span className="hidden sm:inline">
            Cheer<span className="text-[var(--accent)]">News</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((item) =>
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
          <AdminNavLink label={t.header.nav.admin} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <Button asChild size="sm">
            <Link href="/submit">{t.header.submitCta}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
