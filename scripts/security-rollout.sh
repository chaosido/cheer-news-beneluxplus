#!/usr/bin/env bash
#
# Post-deploy security rollout for Cheer News BeneluxPlus.
#
# Run this ONCE, on `main`, AFTER PR #38 is merged and App Hosting has deployed
# the report-only build. It walks the two manual follow-ups in order:
#
#   1. Enable the Firestore TTL policy on auditLog.expireAt (safe, idempotent).
#   2. Verify the live site is serving CSP in report-only mode.
#   3. After you confirm the browser soak is clean, flip CSP to ENFORCE
#      (edits apphosting.yaml, commits, pushes -> triggers an App Hosting
#      rollout) and verifies the enforcing header is live.
#
# Nothing here is destructive: the TTL only acts on a future timestamp, and the
# CSP flip is gated behind an explicit "yes" and is reversible (set CSP_MODE
# back to report-only / off and redeploy, or `git revert`).
#
# Requirements: gcloud (authenticated), git, curl. Run from the repo root.

set -euo pipefail

PROJECT="cheer-news-beneluxplus"
SITE_URL="${SITE_URL:-https://cheer-news-beneluxplus.web.app}"
APPHOSTING="apphosting.yaml"
DEPLOY_BRANCH="main"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m! %s\033[0m\n' "$1"; }
err()  { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; }

confirm() {
  # Returns 0 only on an explicit "yes".
  local prompt="$1" reply
  read -r -p "$prompt [type 'yes' to proceed] " reply
  [ "$reply" = "yes" ]
}

# --- Pre-flight ------------------------------------------------------------
command -v gcloud >/dev/null || { err "gcloud not found"; exit 1; }
command -v git    >/dev/null || { err "git not found";    exit 1; }
command -v curl   >/dev/null || { err "curl not found";   exit 1; }
[ -f "$APPHOSTING" ] || { err "Run me from the repo root ($APPHOSTING not here)."; exit 1; }

bold "Cheer News — security rollout"
echo "Project:     $PROJECT"
echo "Site URL:    $SITE_URL"
echo

# --- Phase 1: Firestore TTL on auditLog.expireAt ---------------------------
bold "[1/3] Enable Firestore TTL on auditLog.expireAt"
echo "Old audit-log entries auto-delete one year after they're written."
if confirm "Enable the TTL policy now?"; then
  gcloud firestore fields ttls update expireAt \
    --collection-group=auditLog \
    --enable-ttl \
    --project="$PROJECT"
  ok "TTL policy submitted (takes a few minutes to become active)."
else
  warn "Skipped TTL."
fi
echo

# --- Phase 2: verify report-only is live -----------------------------------
bold "[2/3] Verify the live site is in CSP report-only mode"
HEADERS="$(curl -fsS -D - -o /dev/null "$SITE_URL/" || true)"
if grep -qi '^content-security-policy-report-only:' <<<"$HEADERS"; then
  ok "Live site is serving Content-Security-Policy-Report-Only."
elif grep -qi '^content-security-policy:' <<<"$HEADERS"; then
  warn "Site is already ENFORCING CSP. Nothing to flip — you're done after Phase 1."
  exit 0
else
  err "No CSP header found at $SITE_URL. Is the report-only build deployed yet?"
  err "Deploy first, then re-run. (Set SITE_URL=... if the URL differs.)"
  exit 1
fi
echo

# --- Phase 3: flip to enforce (gated) --------------------------------------
bold "[3/3] Flip CSP to ENFORCE"
cat <<'SOAK'
Before flipping, confirm in a REAL browser on the live site that, with the
DevTools console open, there are NO "[Report Only] Refused to..." CSP messages
while you:
  - load the home page and the map (tiles + clustering render),
  - open /submit and confirm the Turnstile widget appears,
  - complete a Google sign-in popup on /admin AND /submit,
  - open a club detail page.
Also skim the server logs / the /api/csp-report sink for violations.
SOAK
echo
if ! confirm "Browser soak is clean and you want to ENFORCE the CSP?"; then
  warn "Leaving CSP in report-only. Re-run when ready."
  exit 0
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "$DEPLOY_BRANCH" ] || warn "You are on '$branch', not '$DEPLOY_BRANCH'. Push will deploy from this branch."

count="$(grep -c 'value: report-only' "$APPHOSTING" || true)"
if [ "$count" != "1" ]; then
  err "Expected exactly one 'value: report-only' in $APPHOSTING, found $count. Edit it by hand."
  exit 1
fi

# Flip the CSP_MODE value.
sed -i.bak 's/value: report-only/value: enforce/' "$APPHOSTING"
rm -f "$APPHOSTING.bak"
ok "Set CSP_MODE=enforce in $APPHOSTING."

git add "$APPHOSTING"
git commit -m "security: enforce Content-Security-Policy (was report-only)"
git push origin "$branch"
ok "Pushed. App Hosting will roll out the enforcing policy shortly."
echo
warn "Verify after the rollout completes:"
echo "  curl -sI $SITE_URL/ | grep -i '^content-security-policy:'"
echo "Rollback if anything breaks: set CSP_MODE back to report-only (or off)"
echo "in $APPHOSTING and push, or 'git revert' this commit."
