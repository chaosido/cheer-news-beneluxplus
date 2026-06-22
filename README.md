# Cheer News BeneluxPlus

Eén open overzicht van alle cheerleading in Nederland — **clubs, wedstrijden, open gyms en
trainingstijden** op één plek: een interactieve **kaart**, een **agenda** en een **clubgids**.
Later uitbreidbaar naar België en het Ruhrgebied.

Data wordt grotendeels automatisch verzameld (dagelijks) uit federatie-agenda's en clubsites,
aangevuld met inzendingen via een meldformulier. Onzekere of gemelde items komen eerst in een
review-wachtrij (`/admin`) voordat ze publiek worden.

## Stack

- **Next.js 16** (App Router, SSR) + **TypeScript** + **Tailwind v4**
- **Firebase**: Firestore (data) + Firebase Auth (admin) + **App Hosting** (SSR deploy)
- **Gemini** (`gemini-2.5-flash`) for structured event extraction — **currently DISABLED**
  (kill-switch in `lib/extract.ts`); the pipeline runs JSON-LD only and needs no Gemini key.
  Re-enable with `GEMINI_ENABLED=true` + a `GEMINI_API_KEY` (and restore the config blocks).
- **GitHub Actions** daily cron runs the aggregator
- Map: `react-leaflet` + OpenStreetMap · Calendar: FullCalendar · Geocoding: Nominatim

## Architecture

```
GitHub Actions (daily) ─▶ scripts/aggregate.ts: fetch → diff → extract(JSON-LD→Gemini)
                            → validate → geocode → dedupe → upsert (Firestore)
Next.js SSR (App Hosting) ◀─▶ Firestore (rules DENY all client access; all I/O via Admin SDK)
  /            map + calendar split-view (pin ↔ calendar sync)
  /clubs       club directory + /clubs/[slug] profiles
  /submit      public submission form (→ review queue)
  /admin       Firebase Auth-gated review queue (approve/reject)
```

Security: Firestore Security Rules deny all direct client access. Every read happens in SSR via
the Firebase Admin SDK; every write goes through a validated API route or the scraper service
account. There is no public-read or anon-write surface.

## Local development

### Using local firebase emulator
Create and pupulate your `.env.local` file


```
GCP_PROJECT_ID=<PROJECT_ID>

# Point both SDKs at the emulators
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=http://localhost:9099

# Dummy web config (Auth requires some value; the emulator ignores it)
NEXT_PUBLIC_FIREBASE_API_KEY=demo
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0
NEXT_PUBLIC_FIREBASE_APP_ID=demo

IP_HASH_SALT=local-dev-salt
```


Edit your `firebase.json` as below
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth":      { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui":        { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

In a terminal start the emulator
```bash
firebase emulators:start --project <projectname>
```

In a seperate terminal start the app
```bash
npm install
# Optional - seeds some test data to local firebase emulator
FIRESTORE_EMULATOR_HOST=localhost:8080 GCP_PROJECT_ID=cheer-overview-site npx tsx scripts/seed-emulator.ts
npm run dev
```

### Using your own firebase env

```bash
npm install
# .env.local holds Firebase config + GEMINI_API_KEY + GOOGLE_APPLICATION_CREDENTIALS
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # 25 unit tests (recurrence/DST, validation, dedup, extraction)
```

## Data scripts

Firestore is the single source of truth — there is **no seed/re-seed step** (it
was removed because re-seeding from `data/*.json` repeatedly overwrote
hand-verified data: logos, blurbs, schedules). Club/team/event data is edited
directly via the Admin SDK.

```bash
npm run submissions                # read the public "iets melden" pile from prod
npm run digest                     # send the daily submission digest (cron does this)
npm run aggregate                  # run the daily pipeline once
npm run aggregate -- --dry-run     # fetch + extract + COUNT, write nothing (quota estimation)
```

## Deployment

See [`DEPLOY.md`](./DEPLOY.md). The app deploys to **Firebase App Hosting**, which auto-builds on
every push to `main` once the GitHub repo is connected (a one-time step in the Firebase console).
