---
name: club-sweep
description: Refresh sweep of every active club's teams, levels and training times against the clubs' own websites, Instagram and federation lists, written to live Firestore through a dry-run → approve → apply flow. TRIGGER when the user asks for a sweep/refresh/re-check of clubs, teams, levels, divisions or training times ("do a sweep", "check all teams", "is the club data still current", "new season update"), or for a subset ("sweep the Utrecht clubs", "re-check Hikari's teams"). Also handles an Instagram-only pass over clubs left uncertain by a previous sweep.
---

# Club sweep

Keeps `clubs/{id}/teams` and the `open_gyms` training slots in step with what clubs
actually publish. Live Firestore (project **cheer-overview-site**) is the only source of
truth and the site pages are `force-dynamic`, so an applied change is visible immediately.
A sweep is a prod write: take a snapshot first, do a dry run, and get the maintainer's call
on anything ambiguous.

Files in this folder: `brief.md` (research brief for agents), `instagram.md` (Chrome pass),
`merge-prs.sh` (merge helper). Repo scripts: `scripts/sweep-snapshot.ts`, `scripts/apply-sweep.ts`.
Temporary files go in `tmp/sweep/` (gitignored).

## 0. Environment
```bash
cp ../../../.env.local . 2>/dev/null   # in a worktree; gitignored
export CLOUDSDK_CONFIG=$HOME/.gcloud/csn GOOGLE_APPLICATION_CREDENTIALS=$HOME/.gcloud/csn/application_default_credentials.json
```
Every Firestore script must log `Firestore target project: cheer-overview-site`. Never use the
Firebase MCP for data — it points at the stale legacy project.
On `invalid_rapt` / `PERMISSION_DENIED`: the cheersport.nl credential expired (≤24h policy).
Ask the maintainer to run
`! CLOUDSDK_CONFIG=$HOME/.gcloud/csn gcloud auth application-default login --account=jesse@cheersport.nl`
and wait — don't try to script around it.

## 1. Snapshot
```bash
mkdir -p tmp/sweep
npx tsx --env-file=.env.local scripts/sweep-snapshot.ts tmp/sweep/snapshot-before.json
```
This is the research input AND the rollback record. Only `status: "active"` clubs are swept
(inactive ones are hidden from the site). Split the active clubs into ~5 batch files
`tmp/sweep/batch-N.json` of 3–5 clubs each; put the heavy clubs (many teams/slots) in
different batches.

Before researching, also check memory for time-boxed notes on slots (e.g. temporary
competition-prep notes) whose expiry has passed — clear those in this sweep.

## 2. Research — two tracks
**a. Web agents (parallel).** One `general-purpose` agent per batch, all launched in one
message. Prompt: "Read `.claude/skills/club-sweep/brief.md` and follow it exactly. Input
`tmp/sweep/batch-N.json`, output `tmp/sweep/result-N.json`. Load WebSearch/WebFetch via
ToolSearch. Do not write to any database." Add club-specific hints (known gaps, expiring notes).

**b. Instagram pass (main session, Chrome).** Follow `instagram.md`. Agents can't read
Instagram, and clubs announce the new season there first — so this is a standard step, not
optional. Prioritise clubs whose web result is `unverified`/`conflict`/`instagramTodo`,
clubs whose website is stale (last edit before the season), and clubs with no slots.

## 3. Curate (this is where quality is decided)
Merge the results, check every `docId`/`id` exists in the snapshot, then build
`scripts/data/sweep-YYYY-MM-DD.json` = `{ teams: [...], sessions: [...], verifiedClubs: [...] }`
(op shape in `scripts/apply-sweep.ts`). Rules:
- **Team adds need sourced division, ageGroup and tier** — each op carries a `sourced` quote per
  field, and the apply script refuses adds without them. Drop any add with a guessed or
  copied value; the team stays visible through its slot's `teamLabel`. `level: null` is fine.
  (2026-09: 10 guessed adds had to be deactivated after the fact — don't repeat it.)
- **Session `notes` are public**: Dutch, visitor-facing, no internal remarks. Team `notes` are
  internal (not rendered) and may hold provenance.
- Never delete — `deactivate` / `hide`. Merge duplicate ops on the same id.
- "Om de week" slots need an `rrule` with `INTERVAL=2` plus a sourced `validFrom` anchor, or
  they stay out.
- Old source vs DB, or site vs site disagreement → not a change; list it for the maintainer.
- Clubs that look defunct → propose `status: inactive` only with dated evidence (see memory on
  defunct clubs); a temporary suspension → hide the slots, keep the club.

## 4. Dry run → decisions → apply
```bash
npx tsx --env-file=.env.local scripts/apply-sweep.ts scripts/data/sweep-YYYY-MM-DD.json
```
The script validates first and refuses the whole file on any bad enum, missing required field,
guessed-looking add, bad time/day, or missing source. Read the dry-run diff yourself for
anything surprising (big renames, many hides at one club, provisional "onder voorbehoud" data).

Put every judgement call to the maintainer in ONE AskUserQuestion round (tier changes,
republishing hidden slots, suspect times with no replacement, club-level status). Then get an
explicit go for `--apply` — the answers to those questions are not by themselves approval.
Update the data file with the decisions, then:
```bash
npx tsx --env-file=.env.local scripts/apply-sweep.ts scripts/data/sweep-YYYY-MM-DD.json --apply
```
`--apply` is not idempotent for adds — never re-run it; take a new snapshot instead.

## 5. Verify
```bash
npx tsx --env-file=.env.local scripts/sweep-snapshot.ts tmp/sweep/snapshot-after.json
```
Check the before→after counts match the op count (adds − deactivations for teams; adds − hides
+ republishes for slots) and no active team lacks division/ageGroup/tier.

## 6. Record + report
Commit only the data file (plus any script change) on a branch, open a PR stating it is
**already applied**. Report to the maintainer: net team/slot counts, changes per club, what
was deliberately left alone, and the open questions (conflicts, suspected defunct clubs).

## Merging PRs
The auto-mode classifier blocks `gh pr merge` from Claude. Don't try to work around it — hand
the maintainer one command:
```
! bash .claude/skills/club-sweep/merge-prs.sh <pr> [pr...]
```
It updates each branch with main (checking `behind_by` via git compare, not the lagging
`mergeStateStatus`), waits for CI, and squash-merges only green PRs, never deleting branches.
The `gh` default account is `jesse-adapta`, which can't push here — use
`GH_TOKEN=$(gh auth token --user chaosido)` per command, never switch the global account.

If the CI `npm audit` gate is red for all PRs: `npm audit fix` crashes in this repo
(`edgesOut` null). Bump `overrides` in package.json and run a normal `npm install` in a
scratch copy of package.json + lockfile, then copy both back. Never `npm install` in a worktree:
its node_modules is a symlink to the main checkout.
