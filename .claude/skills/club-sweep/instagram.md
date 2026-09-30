# Instagram pass (Claude in Chrome)

Instagram is where Dutch clubs announce season teams, tryouts and schedule changes first,
but it blocks plain fetches. So this pass runs in the MAIN session with Claude in Chrome,
using the maintainer's logged-in browser. It cannot be delegated to a fetch-only agent.

## Setup
1. Invoke the `claude-in-chrome` skill, then load the Chrome tools in ONE ToolSearch call
   (tabs_context_mcp, tabs_create_mcp, navigate, get_page_text, find, computer, tabs_close_mcp).
2. `tabs_context_mcp` first; open ONE new tab for the whole pass and reuse it.
3. If Instagram shows a login wall, stop and ask the maintainer to log in — never type credentials.

## Per club (only clubs with an `instagramUrl`, prioritise those with `instagramTodo` items)
1. Navigate to the profile. Read the **bio** (often holds the training times or a linktree).
2. Read the **pinned posts** and posts from the **season window** (for 2026–27: Aug–Oct 2026).
   Open a post to read its caption; carousel images with schedules need a screenshot — read the
   image, don't guess from the caption.
3. Highlights named "trainingen", "teams", "rooster", "tryouts" are worth one look.
4. Capture per finding: post URL, post date, and the quoted caption text. A post URL + date is the
   `source`; without a date it's only `medium` confidence.
5. Budget: ~6 posts per club. Don't scroll the whole feed; don't like/follow/comment/DM — read only.

## What counts
- A dated season post beats the website when they disagree (clubs update IG first) — but record
  the disagreement under `conflicts` so the maintainer sees it.
- Tryout/new-team posts can add a team only if they state (or clearly show) division AND age group.
  "Nieuw team! Try-outs zondag" alone → `unverified`, not an add.
- Stories are ephemeral — never use them as the only source.

Write findings in the same JSON shape as brief.md, to tmp/sweep/result-instagram.json, and fold
them into the change set like any other batch.
