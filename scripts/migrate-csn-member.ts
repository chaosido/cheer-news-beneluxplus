/**
 * One-off backfill: set `csnMember = true` on Cheersport Nederland (CSN) member
 * clubs.
 *
 * Run with: `npm run migrate:csn-member`
 *   --dry-run   report matched/unmatched names, but write NOTHING.
 *
 * Matches each name on the canonical CSN member list (below) to an existing
 * club by a normalized comparison of its `name` and `slug` (case- and
 * diacritic-insensitive, punctuation/whitespace collapsed). Every match and
 * every UNMATCHED list entry is logged so unmatched names can be reported to
 * the maintainer (some may need a new club doc or a slug alias) rather than
 * guessed at.
 *
 * NOTE ON `server-only`: ../lib/firebaseAdmin imports the `server-only` marker
 * package, whose default export throws outside a React Server environment. We
 * re-exec once with `--conditions=react-server` so it resolves to its no-op
 * variant; only then do we import the Admin SDK. (See the re-exec guard below.)
 */
import { spawnSync } from "node:child_process";

const REACT_SERVER_CONDITION = "--conditions=react-server";

// Re-exec guard. Must run before anything imports a `server-only` module.
if (!process.execArgv.includes(REACT_SERVER_CONDITION)) {
  const result = spawnSync(
    process.argv[0],
    [...process.execArgv, REACT_SERVER_CONDITION, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Canonical CSN member list (Jun 2026). Match by name; several already exist as
 * clubs. "University Cheer Amsterdam" is expected to be the existing
 * "University Cheerleading Amsterdam" (UCA). Unmatched names are reported.
 */
const CSN_MEMBER_NAMES = [
  "Inclusive Cheer and Dance",
  "Inferno Athletics",
  "UM Cheerleading",
  "Everest Cheerleading Academy",
  "Djalita",
  "Dynamite Cheer",
  "United Cheers Cheerleaders",
  "E.S.T.C. Twist",
  "Hikari Cheerleading",
  "Invicta Tilburg Cheer",
  "Ravens Cheerleading Utrecht",
  "University Cheer Amsterdam",
  "Dutch Lions",
  "ASH",
  "Partisans Athletics",
  "Cheer Together",
  "DANSJA",
];

/**
 * Explicit slug aliases for CSN list names that don't match an existing club
 * by a plain normalized name comparison (the club doc uses a longer name).
 * Each was verified to be the single unambiguous existing club. Resolved by
 * exact slug so the mapping stays auditable rather than fuzzy.
 */
const SLUG_ALIASES: Record<string, string> = {
  Djalita: "djalita-cheerleaders",
  "Dynamite Cheer": "dynamite-cheer-academy-amstelveen",
  "United Cheers Cheerleaders": "united-cheers",
  "University Cheer Amsterdam": "university-cheerleading-amsterdam", // UCA
  "Dutch Lions": "dutch-lions-cheerleading",
  ASH: "ash-cheer-sport",
  "Cheer Together": "e-c-v-cheer-together",
  DANSJA: "dansja-cheerleading",
};

/**
 * Normalize a name/slug for fuzzy comparison: lowercase, strip diacritics, and
 * collapse everything that isn't a letter or digit to a single space.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip combining marks from NFD decomposition
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main(): Promise<void> {
  const { adminDb } = await import("../lib/firebaseAdmin");

  const clubsSnap = await adminDb.collection("clubs").get();

  type Entry = { id: string; name: string; slug: string };

  // Build a lookup from normalized name AND normalized slug → club doc, so we
  // can match a list entry on either field; plus an exact-slug index for the
  // alias map.
  const byNormalized = new Map<string, Entry>();
  const bySlug = new Map<string, Entry>();
  for (const doc of clubsSnap.docs) {
    const name = (doc.get("name") as string | undefined) ?? "";
    const slug = (doc.get("slug") as string | undefined) ?? "";
    const entry = { id: doc.id, name, slug };
    if (name) byNormalized.set(normalize(name), entry);
    if (slug) byNormalized.set(normalize(slug), entry);
    if (slug) bySlug.set(slug, entry);
  }

  const stats = { matched: 0, updated: 0, alreadyMember: 0, unmatched: 0 };
  const unmatchedNames: string[] = [];

  for (const listName of CSN_MEMBER_NAMES) {
    const aliasSlug = SLUG_ALIASES[listName];
    const match = aliasSlug
      ? bySlug.get(aliasSlug)
      : byNormalized.get(normalize(listName));
    if (!match) {
      stats.unmatched += 1;
      unmatchedNames.push(listName);
      console.log(`  ✗ UNMATCHED: "${listName}"`);
      continue;
    }

    stats.matched += 1;
    const doc = clubsSnap.docs.find((d) => d.id === match.id)!;
    const already = doc.get("csnMember") === true;
    if (already) {
      stats.alreadyMember += 1;
      console.log(
        `  = "${listName}" → ${match.slug} (${match.id}) [already member]`,
      );
      continue;
    }

    console.log(`  ✓ "${listName}" → ${match.slug} (${match.id})`);
    if (!DRY_RUN) {
      await doc.ref.update({ csnMember: true });
      stats.updated += 1;
    }
  }

  console.log("");
  console.log(
    `[csn-member]${DRY_RUN ? " (dry-run)" : ""} ` +
      `${stats.matched}/${CSN_MEMBER_NAMES.length} matched, ` +
      `${stats.updated} updated, ${stats.alreadyMember} already members, ` +
      `${stats.unmatched} unmatched.`,
  );
  if (unmatchedNames.length > 0) {
    console.log(
      `[csn-member] Report to maintainer (no club match): ${unmatchedNames
        .map((n) => `"${n}"`)
        .join(", ")}`,
    );
  }
  if (DRY_RUN) {
    console.log("[csn-member] Dry run — no writes performed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
