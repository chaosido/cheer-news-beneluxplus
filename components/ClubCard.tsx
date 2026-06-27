import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CsnMemberBadge } from "@/components/CsnMemberBadge";
import { TeamBadges } from "@/components/TeamBadges";
import { safeUrl } from "@/lib/safeUrl";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { ClubClient } from "@/lib/types";

/** Up-to-two-letter initials from a club name, for the logo fallback. */
function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Directory tile for a single club. Logo contains (never distorts) and falls
 * back to tasteful initials; name is the typographic anchor.
 */
export function ClubCard({ club, t }: { club: ClubClient; t: Dictionary }) {
  return (
    <Card className="group relative flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start gap-3">
        <ClubLogo name={club.name} logoUrl={club.logoUrl} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold leading-tight text-[var(--ink)]">
            <Link
              href={`/clubs/${club.slug}`}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {club.name}
            </Link>
          </h2>
          {club.city && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--muted)]">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{club.city}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {club.csnMember && <CsnMemberBadge t={t} className="self-start" />}
        <TeamBadges teams={club.teamsSummary} t={t} max={4} />
      </div>
    </Card>
  );
}

function ClubLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  // Re-validate against the http(s) allowlist before using as <img src>.
  const safeLogoUrl = safeUrl(logoUrl);
  if (safeLogoUrl) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--radius)-0.25rem)] border border-[var(--border)] bg-[var(--surface-2)]">
        {/* Logos vary in aspect; contain so they never distort or crop badly. */}
        <Image
          src={safeLogoUrl}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="size-full object-contain"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-[calc(var(--radius)-0.25rem)] bg-[var(--accent-soft)] font-display text-sm font-extrabold text-[var(--accent)]"
    >
      {initials(name)}
    </span>
  );
}
