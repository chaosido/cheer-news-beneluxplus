/**
 * One-off backfill: set ICU coach-certification fields on club coaches.
 *
 * The "≥1 ICU-certified coach per club" rule starts next season; this populates
 * the data so the indicators light up ahead of enforcement. Coaches live as a
 * `coaches` array on each club doc, so we read the club, patch the matching
 * coach entries by name, and write the whole array back.
 *
 * Run with:
 *   npm run backfill:coach-icu -- --dry-run   # print planned changes, write NOTHING
 *   npm run backfill:coach-icu                # apply
 *
 * Fill in ICU_DATA below as the maintainer gathers certs. Matching is by club
 * slug (preferred) or club name, then by coach name (case-insensitive, trimmed).
 * Unmatched clubs/coaches are reported, never guessed.
 *
 * Connects with the same Admin SDK credentials as the other scripts
 * (FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS via
 * --env-file=.env.local), so it writes LIVE production data.
 *
 * NOTE ON `server-only`: ../lib/firebaseAdmin imports the `server-only` marker
 * package; we re-exec once with `--conditions=react-server` so it resolves to
 * its no-op variant before importing the admin SDK. (re-exec guard below.)
 */
import { spawnSync } from "node:child_process";

const REACT_SERVER_CONDITION = "--conditions=react-server";

if (!process.execArgv.includes(REACT_SERVER_CONDITION)) {
  const result = spawnSync(
    process.argv[0],
    [...process.execArgv, REACT_SERVER_CONDITION, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

import type { Coach } from "../lib/types";

const DRY_RUN = process.argv.includes("--dry-run");

/** ICU certification per club coach. Edit as the data is gathered. */
interface IcuClubEntry {
  /** Match by slug (preferred) … */
  slug?: string;
  /** … or by club name when the slug isn't handy. */
  clubName?: string;
  coaches: {
    name: string;
    icuCertified?: boolean;
    icuLevel?: string | null;
    icuExpiresAt?: string | null; // ISO date
  }[];
}

const ICU_DATA: IcuClubEntry[] = [
  // Example (remove once real data lands):
  // {
  //   slug: "united-cheers",
  //   coaches: [
  //     { name: "Jane Doe", icuCertified: true, icuLevel: "Level 2" },
  //   ],
  // },
];

const norm = (s: string) => s.trim().toLowerCase();

async function main(): Promise<void> {
  if (ICU_DATA.length === 0) {
    console.log(
      "ICU_DATA is empty — nothing to backfill. Fill in the table at the top of the script first.",
    );
    return;
  }

  const { adminDb } = await import("../lib/firebaseAdmin");

  const snap = await adminDb.collection("clubs").get();
  const bySlug = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const byName = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.slug === "string") bySlug.set(norm(data.slug), d);
    if (typeof data.name === "string") byName.set(norm(data.name), d);
  }

  let updated = 0;
  for (const entry of ICU_DATA) {
    const doc =
      (entry.slug ? bySlug.get(norm(entry.slug)) : undefined) ??
      (entry.clubName ? byName.get(norm(entry.clubName)) : undefined);
    const label = entry.slug ?? entry.clubName ?? "(no slug/name)";
    if (!doc) {
      console.warn(`! UNMATCHED club: ${label}`);
      continue;
    }

    const coaches: Coach[] = Array.isArray(doc.data().coaches)
      ? (doc.data().coaches as Coach[])
      : [];
    const wanted = new Map(entry.coaches.map((c) => [norm(c.name), c]));
    const matchedNames = new Set<string>();

    const next = coaches.map((coach) => {
      const patch = wanted.get(norm(coach.name));
      if (!patch) return coach;
      matchedNames.add(norm(coach.name));
      return {
        ...coach,
        icuCertified: patch.icuCertified ?? coach.icuCertified,
        icuLevel: patch.icuLevel ?? coach.icuLevel ?? null,
        icuExpiresAt: patch.icuExpiresAt ?? coach.icuExpiresAt ?? null,
      };
    });

    for (const c of entry.coaches) {
      if (!matchedNames.has(norm(c.name))) {
        console.warn(`! UNMATCHED coach "${c.name}" at club ${label}`);
      }
    }

    if (matchedNames.size === 0) continue;
    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}${label}: updating ${matchedNames.size} coach(es)`,
    );
    if (!DRY_RUN) {
      await doc.ref.update({ coaches: next });
    }
    updated += 1;
  }

  console.log(
    `\nDone. ${updated} club(s) ${DRY_RUN ? "would be" : ""} updated${DRY_RUN ? " (DRY RUN — no writes)" : ""}.`,
  );
}

main().catch((err) => {
  console.error("Failed to backfill coach ICU data:", err);
  process.exit(1);
});
