#!/usr/bin/env bash
# Merge open PRs one at a time: update branch with main -> wait for CI -> squash-merge.
# Pass PR numbers in merge order. A red PR is skipped, never force-merged.
# Never uses --delete-branch.
set -u
export GH_TOKEN=$(gh auth token --user chaosido)
REPO=chaosido/cheer-news-beneluxplus
PRS=("$@")
[ ${#PRS[@]} -eq 0 ] && { echo "usage: merge-prs.sh <pr> [pr...]"; exit 1; }

for n in "${PRS[@]}"; do
  echo "=== #$n: $(gh pr view $n -R $REPO --json title --jq .title)"
  state=$(gh pr view $n -R $REPO --json state --jq .state)
  [ "$state" != OPEN ] && { echo "    $state, skipping"; continue; }

  # Ask git, not mergeStateStatus: that flag lags right after the previous merge.
  head=$(gh pr view $n -R $REPO --json headRefName --jq .headRefName)
  behind=$(gh api "repos/$REPO/compare/main...$head" --jq .behind_by)
  if [ "$behind" != 0 ]; then
    if ! gh api -X PUT repos/$REPO/pulls/$n/update-branch >/dev/null 2>&1; then
      echo "    conflicts with main -> asked Dependabot to recreate; rerun this script later"
      gh pr comment $n -R $REPO --body "@dependabot recreate" >/dev/null
      continue
    fi
    echo "    branch updated, waiting for CI to start..."; sleep 45
  fi

  if ! gh pr checks $n -R $REPO --watch --interval 20 >/dev/null; then
    echo "    CI FAILED -> not merging: https://github.com/$REPO/pull/$n"
    continue
  fi
  gh pr merge $n -R $REPO --squash && echo "    merged ✅"
  sleep 5
done
echo "=== done. Still open:"; gh pr list -R $REPO --state open
