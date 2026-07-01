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
  // Verified 2026-06-27 against each venue's own site. See handoffs/ research run.
  {
    venueId: "turnz-ookmeer-amsterdam",
    price: 11.5,
    priceNote:
      "Losse sessie €11,50 (2 uur) / €16,50 (3 uur); rittenkaart 11 sessies €115 (15 mnd geldig)",
  },
  {
    venueId: "gymxl-vathorst-amersfoort",
    price: 8,
    priceNote: "€8 voor leden, €12 voor niet-leden; vooraf betalen aan de kassa (pin)",
  },
  {
    venueId: "flik-flak-den-bosch",
    price: 8.5,
    priceNote:
      "Los kaartje €8,50 (zelfstandige volwassenentraining 16+, per pin in de zaal); eerste proeftraining gratis",
  },
  // Ravens Utrecht — €7,50 "x practice" published on ravenscheerleadingutrecht.com/memberships.
  {
    id: "ravens-cheerleading-utrecht-og-0",
    price: 7.5,
    priceNote: "Open Gym €7,50 per losse training (drop-in); eerste keer gratis proeftraining. Open voor niet-leden",
  },
  {
    id: "ravens-cheerleading-utrecht-og-1",
    price: 7.5,
    priceNote: "Open Gym €7,50 per losse training (drop-in); eerste keer gratis proeftraining. Open voor niet-leden",
  },
  // Price still unknown (?) for these club-run open gyms — no per-visit drop-in
  // rate is published (checked 2026-06-27). Left out of PRICE_DATA until a real
  // figure is confirmed with the club; do NOT guess a number.
  //  - gymnastiekhal-best                       price: ?  (GV Best is membership-only; Wed slot likely a club renting the hall)
  //  - hikari-og-mon / hikari-og-sun            price: ?  (only a €25/month subscription, no per-visit rate)
  //  - university-cheerleading-amsterdam-og-2   price: ?  (RSVP, open to anyone, "free" not stated)
  //  - e-s-t-c-twist-og-0                       price: ?  (monthly open training, no card needed, likely free but unstated)
  //  - blue-wolves-cheerleading-og-0            price: ?  (listed under Seniors schedule, reads as an internal session)
  // (djalita-cheerleaders-og-1..7 were mislabeled team trainings — already
  //  reclassified to sessionType=training 2026-06-27, so they carry no price.)
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
