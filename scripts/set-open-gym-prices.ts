/**
 * One-off writer: set drop-in prices on public open-gym docs.
 *
 * Open gyms live in the `open_gyms` collection (mixed with team trainings,
 * split by `sessionType`). This sets `price` (euros) and optional `priceNote`
 * on the public open-gym docs the maintainer has gathered prices for. Team
 * trainings are skipped — they never carry a price.
 *
 * Run with:
 *   npm run set:open-gym-prices -- --dry-run   # print planned changes, write NOTHING
 *   npm run set:open-gym-prices                # apply
 *
 * Fill in PRICE_DATA below. Match by `venueId` (covers all weekly docs of one
 * hall, e.g. Mon + Thu) or by a specific doc `id` / `dedupKey`. Entries that
 * match no public open-gym doc are reported, never guessed.
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

const DRY_RUN = process.argv.includes("--dry-run");

/** Price per public open gym. Edit as prices are gathered. */
interface PriceEntry {
  /** Match all weekly docs of one venue … */
  venueId?: string;
  /** … or a single doc by id … */
  id?: string;
  /** … or by its dedupKey. */
  dedupKey?: string;
  price: number; // EUROS as a decimal, e.g. 7.5 => €7,50; 0 = free
  priceNote?: string | null;
}

const PRICE_DATA: PriceEntry[] = [
  // Example (remove once real data lands):
  // { venueId: "turnhal-best", price: 7.5, priceNote: "gratis voor leden / €7,50 drop-in" },
];

function matches(
  entry: PriceEntry,
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): boolean {
  const data = doc.data();
  if (entry.id) return doc.id === entry.id;
  if (entry.dedupKey) return data.dedupKey === entry.dedupKey;
  if (entry.venueId) return data.venueId === entry.venueId;
  return false;
}

async function main(): Promise<void> {
  if (PRICE_DATA.length === 0) {
    console.log(
      "PRICE_DATA is empty — nothing to write. Fill in the table at the top of the script first.",
    );
    return;
  }

  const { adminDb } = await import("../lib/firebaseAdmin");

  // Only public open gyms are eligible — trainings never carry a price.
  const snap = await adminDb.collection("open_gyms").get();
  const publicDocs = snap.docs.filter(
    (d) => d.data().sessionType !== "training",
  );

  let written = 0;
  for (const entry of PRICE_DATA) {
    const targets = publicDocs.filter((d) => matches(entry, d));
    const label = entry.venueId ?? entry.id ?? entry.dedupKey ?? "(no matcher)";
    if (targets.length === 0) {
      console.warn(`! UNMATCHED open gym: ${label}`);
      continue;
    }
    for (const doc of targets) {
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}${label} (${doc.id}): price=${entry.price}${
          entry.priceNote ? ` note="${entry.priceNote}"` : ""
        }`,
      );
      if (!DRY_RUN) {
        await doc.ref.update({
          price: entry.price,
          priceNote: entry.priceNote ?? null,
        });
      }
      written += 1;
    }
  }

  console.log(
    `\nDone. ${written} doc(s) ${DRY_RUN ? "would be" : ""} updated${DRY_RUN ? " (DRY RUN — no writes)" : ""}.`,
  );
}

main().catch((err) => {
  console.error("Failed to set open-gym prices:", err);
  process.exit(1);
});
