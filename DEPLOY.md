# Deployment & operations

GCP project: **`cheer-news-beneluxplus`** · GitHub repo: **`chaosido/cheer-news-beneluxplus`**

Most infrastructure is already provisioned (Firestore, Gemini API key, scraper service account,
GitHub Actions secrets, Secret Manager `gemini-api-key`, Firebase web app). Two steps need a human
because they involve interactive OAuth / console toggles.

## 1. Firebase App Hosting (deploy the website) — one-time GitHub connect

App Hosting builds and serves the Next.js app, and redeploys automatically on every push to `main`.

**Console (easiest):**

1. https://console.firebase.google.com/project/cheer-news-beneluxplus/apphosting
2. **Get started** → connect the GitHub repo `chaosido/cheer-news-beneluxplus` (authorize the
   Firebase GitHub app), live branch `main`, root directory `/`.
3. App Hosting reads `apphosting.yaml` (env vars + the `gemini-api-key` secret are already set up).
4. First rollout builds and deploys; the URL is `https://<backend>--cheer-news-beneluxplus.web.app`.

After the backend exists, grant it access to the Gemini secret and Firestore:

```bash
npx firebase-tools apphosting:secrets:grantaccess gemini-api-key --project cheer-news-beneluxplus
# Grant the App Hosting compute service account Firestore access:
gcloud projects add-iam-policy-binding cheer-news-beneluxplus \
  --member="serviceAccount:firebase-app-hosting-compute@cheer-news-beneluxplus.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## 2. Enable Firebase Authentication (for the /admin review queue)

1. https://console.firebase.google.com/project/cheer-news-beneluxplus/authentication
2. **Get started** → enable the **Email/Password** provider.
3. Create the maintainer user the simplest way: **Authentication → Users → Add user**, entering the
   maintainer email + a password in the console. (You can also script it with the Admin SDK
   `getAuth().createUser({ email, password })` — read both values from environment variables, never
   hard-code them.)
4. The allowlist of admin emails is `ADMIN_EMAILS` (set in `apphosting.yaml` / `.env.local`).

## Gemini / LLM extraction — currently DISABLED

Gemini-based (Tier 2) event extraction is turned off via a kill-switch (`GEMINI_ENABLED`,
default `false`, in `lib/extract.ts` and `scripts/aggregate.ts`). The app builds and deploys
with **no `gemini-api-key` secret** and the aggregator runs JSON-LD only. The
`GEMINI_API_KEY` / `GEMINI_MODEL` blocks in `apphosting.yaml` and the workflow are commented out.

To re-enable LLM extraction:

1. Set `GEMINI_ENABLED=true` and provide `GEMINI_API_KEY` (env / Secret Manager).
2. Uncomment the `GEMINI_API_KEY` + `GEMINI_MODEL` blocks in `apphosting.yaml` and
   re-grant the secret: `npx firebase-tools apphosting:secrets:grantaccess gemini-api-key`.
3. Uncomment the `GEMINI_*` env in `.github/workflows/aggregate.yml` (and the `schedule:` block
   to resume the daily cron).

## Daily aggregation

Scheduled run is **PAUSED** (the cron in `.github/workflows/aggregate.yml` is commented out)
while Gemini is disabled. The workflow can still be triggered manually from the Actions tab
(**Daily aggregation** → Run workflow → optional dry-run); it uses the `FIREBASE_SERVICE_ACCOUNT`
repo secret and extracts JSON-LD only. The `MAX_LLM_CALLS_PER_RUN=40` guard (kept intact but inert
while Gemini is off) keeps usage under the Gemini free-tier quota when re-enabled; HTTP 429s are
surfaced distinctly in the run summary.

## Notes

- **Turnstile** (submission anti-spam) is optional and currently off; the form degrades gracefully.
  To enable: create a Cloudflare Turnstile widget, then add `TURNSTILE_SECRET_KEY` +
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` as App Hosting secrets and to `apphosting.yaml`.
- Scraped events from Gemini land as `pending` (need review in `/admin`); JSON-LD / high-confidence
  events auto-publish. Manually-edited docs set `locked: true` and are never overwritten by re-scrapes.
- `www.dutchcheer.nl` (a federation source) is dormant with a TLS issue and currently fails to fetch
  — harmless; the run continues. Remove or replace that source if desired.
