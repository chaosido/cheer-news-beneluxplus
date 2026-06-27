import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";

export async function SiteFooter() {
  const t = await getDictionary();
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/cheersport-netherlands.svg"
            alt={t.footer.csnLogoAlt}
            width={200}
            height={60}
            className="h-8 w-auto shrink-0"
            unoptimized
          />
          <p>{t.footer.tagline}</p>
        </div>
        <nav className="flex gap-4">
          <Link href="/over" className="hover:text-[var(--ink)]">
            {t.footer.about}
          </Link>
          <Link href="/submit" className="hover:text-[var(--ink)]">
            {t.footer.contribute}
          </Link>
          <Link href="/privacy" className="hover:text-[var(--ink)]">
            {t.footer.privacy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
