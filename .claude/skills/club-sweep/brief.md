# Club sweep — research brief (hand this to every research agent)

You research a batch of Dutch/Benelux cheerleading clubs. Your input file holds, per club,
the CURRENT live DB state: `teams` (clubs/{id}/teams docs) and `sessions` (open_gyms docs;
sessionType "training" = team training slot, "open_gym" = public drop-in).
You are READ-ONLY with respect to the database. Your only output is one JSON file.

## What to verify, per club
1. **Teams** fielded THIS season: name, discipline, level, danceStyle, tier, division, ageGroup.
   Flag DB teams that no longer exist and teams missing from the DB.
2. **Training slots**: day(s), start/end (local HH:mm), venue/address, which team.
   Flag slots that are wrong, missing, or gone.

## Sources, in order of trust
1. The club's own website (team pages, "trainingstijden", "rooster", "lidmaatschap").
2. The club's Instagram/Facebook (bio, pinned posts, season-start posts). NOTE: plain fetches
   are usually blocked — try once, then move on. Instagram is covered by a separate
   Chrome pass (instagram.md); list what you would want checked there under `instagramTodo`.
3. Federation lists (cheersport.nl NK/entry lists, ICU/ECU results) for levels/divisions.

Every proposed change needs a source URL and a short quote/paraphrase. No source ⇒ no change.
Prefer sources dated for the current season. An older source contradicting the DB is a
`conflict`, not a change.

## Enums (exactly these)
- discipline: "cheer" | "performance_cheer"
- level: "1".."7" (ICU L-code) or null. Novice=1, Intermediate=2, Median=3, Advanced=4,
  Elite=5, Premier=6/7. Beginner/L0 → "1" with a note. USASF numbers run ~+1 vs ICU — convert.
  null is FINE when the level is unpublished.
- danceStyle: "pom" | "hip_hop" | "jazz" | "kick" | "pom_doubles" | "hip_hop_doubles" | null
- tier: "competition" | "prep" | "recreational"
- division: "all_girl" | "coed" | "all_boy"
- ageGroup: "mini" | "youth" | "junior" | "senior" | "open" (ICU: Mini ≤11, Youth U14, Junior U18, Senior 16+)
- byday: MO TU WE TH FR SA SU. Times "HH:mm", Europe/Amsterdam.

## Hard rules
- **Never guess a required team field.** A team `add` needs a SOURCED name, discipline, tier,
  division and ageGroup. If division (or any of those) isn't published, do NOT propose the add —
  put the team under `unverified` and, if it has a slot, carry the name in the slot's teamLabel.
  Do not copy a division from sibling teams. Every add must carry `sourced` with a verbatim
  quote for division, ageGroup and tier — the apply script refuses an add without all three.
- **Session `notes` render publicly on the club page.** Write them in Dutch, for visitors.
  Never put internal remarks in them ("status rejected", "division unknown", "per the site").
- Never propose deleting. Gone team → `deactivate`. Gone slot → `hide`.
- Don't duplicate: if a slot exists at the same club/day/time, `update` it.
- Every-other-week sessions need a known anchor date — if the source doesn't give one, list it
  as `unverified` rather than adding a weekly slot.
- Addresses/coordinates only from sources; never invent street numbers.
- Club looks defunct or suspended → evidence under `clubFlags`, no team changes.

## Output shape
{
  "clubs": [{
    "clubId": "...",
    "checkedSources": ["url", ...],
    "summary": "1-3 sentences",
    "clubFlags": ["..."],
    "teamChanges": [
      { "action": "update"|"add"|"deactivate"|"confirm", "docId": "existing doc id or null",
        "fields": { only fields that change; full team for add },
        "source": "url", "evidence": "quote/paraphrase", "confidence": "high"|"medium",
        "sourced": { "division": "quote", "ageGroup": "quote", "tier": "quote" }  // REQUIRED on add
      } ],
    "sessionChanges": [
      { "action": "update"|"add"|"hide"|"confirm", "id": "existing open_gyms id or null",
        "fields": { "teamLabel","byday","startTime","endTime","locationText","notes","price" — only what changes },
        "source": "url", "evidence": "...", "confidence": "high"|"medium" } ],
    "conflicts": ["..."],
    "unverified": ["..."],
    "instagramTodo": ["what an Instagram check should settle for this club"]
  }]
}
Use "confirm" for things you positively verified (lets us stamp lastVerifiedAt).
Finish with a short reply: path written + one line per club.
