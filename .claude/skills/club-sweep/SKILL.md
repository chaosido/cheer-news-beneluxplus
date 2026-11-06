---
name: club-sweep
description: Full audit/enrichment sweep of every cheerleading club in the directory — verify websites, diff training times/teams/events/coaches/contacts against club websites AND Instagram, report findings, then apply approved changes to live Firestore. TRIGGER when the user asks to "sweep the clubs", "check all clubs", "bring the clubs up to date", "verify club websites", "run a club audit", "insta sweep", or asks whether club info is still current. Also handles single-club deep checks ("is Djalita still active?") by running just that club through the same pipeline.
---

# Club sweep

Audit all active clubs (websites + Instagram), report diffs vs what the site
shows, and — only after the user approves — apply changes to live Firestore.
Reference run: 2026-11-05 (see memory `frisian-cheer-stars`); example artifacts
lived in `tmp/sweep-2026-11-05/` (gitignored, may be gone).

**Order is findings first, writes second.** Never write to Firestore before
reporting findings and getting a go-ahead.

## Phase 0 — Preflight

1. Work in `tmp/sweep-<YYYY-MM-DD>/` (tmp/ is gitignored).
2. `.env.local` must exist in the working dir (worktrees: copy from the main
   checkout `/mnt/data/code/Personal-Projects/cheer-news-BeneluxPlus/.env.local`).
3. Firestore access = Admin SDK + ADC via the **csn** profile. Every script run
   needs BOTH env vars:
   `CLOUDSDK_CONFIG=$HOME/.gcloud/csn GOOGLE_APPLICATION_CREDENTIALS=$HOME/.gcloud/csn/application_default_credentials.json`
   ADC dies within ~24h (Workspace reauth policy, `invalid_rapt`). Test with a
   read-only script early. If dead, ask the user to run
   `! CLOUDSDK_CONFIG=~/.gcloud/csn gcloud auth application-default login`
   — the research phases don't need it, so keep going and apply later.
   NB the login regularly fails silently: verify the ADC file mtime changed /
   a read works before trusting it. Never `cat` credential files.
4. Scripts touching `lib/firebaseAdmin` need the re-exec guard
   (`--conditions=react-server`) — copy the header from `scripts/list-submissions.ts`.

## Phase 1 — Baseline (no ADC needed)

The live site is the readable mirror of Firestore:

- Club slugs: `curl -s https://overview.cheersport.nl/clubs | grep -oE 'href="/clubs/[a-z0-9-]+"'`
- Per-club stored state: `https://overview.cheersport.nl/clubs/<slug>` shows
  name+city (in `<title>`), socials/website (hrefs), trainings, teams, events.
- If ADC works, also export via a read-only dump script (clubs + `teams`
  subcollections + `open_gyms` + future `events`) — needed anyway for Phase 5.

## Phase 2 — Website fan-out (subagents)

Launch general-purpose subagents in parallel, ~4 clubs each, all in ONE message.
Each prompt must contain, per club: name, our directory URL (the baseline to
fetch first), the club website, known social handles, and any known quirks.
Ask each agent to collect and **diff against the baseline**:

- Trainings: weekday, HH:mm, venue, team label (changed/dropped/new slots)
- Upcoming one-off events: tryout / open_gym / workshop (never "clinic") /
  showcase / competition — with date, location, source URL
- Teams: names; division/age/level ONLY if explicitly published (never guess)
- Profile: coaches, contact email, venue, achievements (with year), socials,
  founded year, fees/trial info
- Anything our page shows that is now wrong

Rules to state verbatim in every prompt: sourced facts only, every fact needs
a source URL + date hint, flag uncertain as UNCERTAIN instead of omitting or
guessing. Instagram.com does NOT load from this machine — agents use
Google-indexed snippets only and flag IG-only facts (the real IG pass is
Phase 3). Each agent writes full findings to
`tmp/sweep-<date>/enrich-batch-<X>.md` and replies with compact diffs.

## Phase 3 — Instagram sweep (Claude in Chrome)

Instagram has no usable public API and blocks anonymous scraping; the ONLY
reliable read is the user's own Chrome session (`claude-in-chrome` tools —
load via ToolSearch in one batch; invoke the claude-in-chrome skill first).

Per club handle (collect handles from Phase 1 pages):

1. Navigate to `https://www.instagram.com/<handle>/` in one reusable tab.
2. `get_page_text` → bio, follower count, post grid. A login wall or
   "page isn't available" is itself a finding (dead/renamed handle).
3. Open the 2–3 most recent posts for captions + dates (schedule changes,
   tryouts, events and venue moves are often IG-only).
4. Record: handle alive?, last-post date, bio facts (venue/ages/teams), any
   dated announcements. Then move on — human pace, don't hammer; if IG shows a
   rate-limit or challenge screen, stop the pass and tell the user.

Append findings to the per-club notes; IG-sourced facts cite the post date.

## Phase 4 — Consolidate & report

Write `tmp/sweep-<date>/PLAN.md`: one section per club, every item marked
- ✅ apply-ready (sourced, unambiguous)
- ⚠️ needs the user's judgment or club confirmation (conflicting sources,
  unpublished times, un-sourced existing L-labels, dormancy calls)
- ℹ️ internal note only

Report the headline findings in chat (corrections first, then new events,
then watch-items) and stop. **Wait for the user's go before Phase 5.**

## Phase 5 — Apply (after approval, ADC required)

Dump current docs first and target exact doc IDs — never write blind. House
conventions (match `tmp/sweep-2026-11-05/apply-sweep.ts` if still present):

- All writes `set(..., {merge:true})` + `updatedAt: FieldValue.serverTimestamp()`.
- NEVER delete. Clubs: `status: "inactive"`. Teams have `status` too.
  Sessions that disappeared: `status: "rejected"` + a dated Dutch note.
  Uncertain new sessions: `status: "pending"` + note.
- New open_gym docs: id `<club>-tr-N`/`<club>-og-N`, dedupKey
  `<club>-tr-<BYDAY>-<HH:mm>`, `origin:"research"`, `confidence:0.9`,
  `locked:true`, `tz:"Europe/Amsterdam"`, `exdates:[]`. Changing a time means
  updating the dedupKey too.
- New events: doc id = canonicalEventId = `<club|org>-<yyyy-mm-dd>-<slug>`,
  `origin:"submission"`, `confidence:1`, `locked:true`, Timestamps via
  `Timestamp.fromDate`. Check existing future events first — CSN already
  seeds NK/Lowlands; don't duplicate.
- Before adding a club, check for an existing doc (even inactive) — reactivate,
  don't duplicate (Frisian Cheer Stars precedent).
- Geocode new venues via Nominatim (UA `CheerOverview/1.0`, ~1 req/s).
- Public notes are Dutch; user-facing text fields are Dutch.
- Stamp `lastVerifiedAt` on every verified club at the end.
- Script takes `--dry-run`; always dry-run, review output, then live-run.

Verify: re-dump and assert the changed fields; curl the live site for a
spot-check (new club page title, event visible).

## Phase 6 — Wrap up

- If the `changelog` collection/feature exists, append a release-notes entry
  for the sweep (date, headline items) so the site's "laatst bijgewerkt"
  banner updates.
- Update auto-memory: sweep date, what was applied, remaining ⚠️ items.
- Remind the user of leftover ⚠️ items that need club contact.
