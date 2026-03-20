# GGn (GazelleGames) API Response

GGn shares Gazelle's overall architecture but differs enough to warrant its own adapter. It uses query-parameter auth instead of headers, a two-step fetch on first poll, and its own field naming conventions.

## Endpoint

Two requests per poll (first poll only — subsequent polls skip step 1 using the cached `remoteUserId`):

```
GET {baseUrl}/api.php?request=quick_user&key={TOKEN}
GET {baseUrl}/api.php?request=user&id={USER_ID}&key={TOKEN}
```

## Authentication

API token passed as a query parameter: `?key=TOKEN`. No authorization header.

## Example quick_user Response

```json
{
  "status": "success",
  "response": {
    "username": "ExampleUser",
    "id": 74360
  }
}
```

The only purpose of this call is to resolve the user's numeric ID. Once the adapter has stored this as `remoteUserId` in the database, it skips this call on all future polls and goes straight to `request=user`.

## Example user Response

```json
{
  "status": "success",
  "response": {
    "id": 74360,
    "username": "ExampleUser",
    "avatar": "",
    "avatarType": 1,
    "isFriend": false,
    "bbProfileText": "",
    "profileText": "",
    "bbTitle": "",
    "title": "",
    "stats": {
      "joinedDate": "2025-02-18 08:59:21",
      "lastAccess": "2026-03-07 17:03:24",
      "onIRC": true,
      "uploaded": 372518353895,
      "downloaded": 373640248681,
      "fullDownloaded": 2854978605675,
      "purchasedDownload": null,
      "ratio": "0.99699",
      "requiredRatio": 0.012,
      "shareScore": 10.82,
      "gold": 39858
    },
    "personal": {
      "class": "Elite Gamer",
      "facilitator": false,
      "hnrs": null,
      "paranoia": [],
      "paranoiaText": "Off",
      "donor": false,
      "warned": false,
      "enabled": true,
      "publicKey": "",
      "parked": false,
      "ip": "xxx.xxx.xxx.xxx",
      "passkey": "...",
      "donated": "",
      "invites": 2
    },
    "community": {
      "clan": "None",
      "profileViews": 14,
      "hourlyGold": 9,
      "posts": 2,
      "actualPosts": 2,
      "threads": null,
      "forumLikes": 0,
      "forumDislikes": 0,
      "ircLines": 0,
      "ircActualLines": null,
      "torrentComments": 1,
      "collections": null,
      "requestsFilled": null,
      "bountyEarnedUpload": null,
      "bountyEarnedGold": null,
      "requestsVoted": 11,
      "bountySpentUpload": null,
      "bountySpentGold": 260,
      "reviews": 1,
      "uploaded": null,
      "seeding": null,
      "leeching": null,
      "snatched": 4425,
      "uniqueSnatched": 4413,
      "seedSize": null,
      "invited": null
    },
    "buffs": {
      "Upload": 2,
      "Download": 0.5,
      "ForumPosts": 1,
      "IRCLines": 1,
      "IRCBonus": 2,
      "CommunityXP": 1,
      "TorrentsXP": 1,
      "CommunityGold": 1.2,
      "TorrentsGold": 1,
      "ItemCost": 1,
      "BountyFrom": 1,
      "BountyOn": 1,
      "Chance": 2
    },
    "achievements": {
      "userLevel": "Elite Gamer",
      "nextLevel": "Legendary Gamer",
      "totalPoints": 2100,
      "pointsToNextLvl": 900
    }
  }
}
```

## Field Mapping

| TrackerStats field | GGn path | Type | Notes |
|---|---|---|---|
| `username` | `response.username` | `string` | From user response; quick_user value used as fallback |
| `group` | `response.personal.class` | `string` | Falls back to `"Unknown"` |
| `remoteUserId` | `response.id` | `number` | Stored after first poll to skip quick_user |
| `uploadedBytes` | `response.stats.uploaded` | `number` | `BigInt(Math.floor(...))` |
| `downloadedBytes` | `response.stats.downloaded` | `number` | `BigInt(Math.floor(...))` |
| `ratio` | `response.stats.ratio` | `string \| number` | Parsed via `parseFloat()` if string |
| `bufferBytes` | — | — | Calculated: `uploadedBytes - downloadedBytes` (min `0`) |
| `seedingCount` | `response.community.seeding` | `number \| null` | Defaults to `0`; null when paranoia hides it |
| `leechingCount` | `response.community.leeching` | `number \| null` | Defaults to `0`; null when paranoia hides it |
| `seedbonus` | `response.stats.gold` | `number` | GGn uses "gold" as its currency, not "bonus points" |
| `hitAndRuns` | `response.personal.hnrs` | `number \| null` | `null` when not tracked or hidden |
| `requiredRatio` | `response.stats.requiredRatio` | `number` | Available directly in the user call |
| `warned` | `response.personal.warned` | `boolean` | Available directly — no second call needed |
| `freeleechTokens` | — | — | Always `null` — GGn does not expose FL tokens |
| `joinedDate` | `response.stats.joinedDate` | `string \| null` | ISO-style datetime string |
| `lastAccessDate` | `response.stats.lastAccess` | `string \| null` | ISO-style datetime string |
| `shareScore` | `response.stats.shareScore` | `number \| null` | GGn-specific metric |
| `platformMeta` | `response.personal`, `response.community`, `response.buffs`, `response.achievements` | — | `GGnPlatformMeta` object |

## Quirks

**`ratio` is a string.** Unlike every other platform, GGn returns `stats.ratio` as a string (`"0.99699"`), not a number. The adapter handles this with:

```typescript
const ratio =
  typeof resp.stats.ratio === "number"
    ? resp.stats.ratio
    : parseFloat(resp.stats.ratio) || 0
```

**Seedbonus is called `gold`.** GGn has a currency called gold, not bonus points. The adapter maps `stats.gold` → `seedbonus` in the `TrackerStats` output so the dashboard can display it consistently.

**Seeding and leeching are paranoia-dependent.** `community.seeding` and `community.leeching` return `null` when the user's paranoia level hides community stats. The adapter defaults to `0` in that case, but `null` in the raw response is expected and normal for many GGn users.

**`hnrs` (hit and runs) can be `null`.** GGn tracks hit-and-runs as `personal.hnrs`, but it can be `null` if the user has none or the field is hidden. The adapter passes `null` through directly to `hitAndRuns`.

**Two-step fetch, first poll only.** The `quick_user` call exists solely to resolve the numeric user ID. After the first successful poll, the adapter stores `remoteUserId` in the database and skips `quick_user` on all subsequent polls, going directly to `request=user&id=X`. This saves one round-trip per poll cycle.

**Buffs are upload/download multipliers.** The `buffs` object contains per-category multipliers active on the user's account (e.g. `Upload: 2` means 2x upload credit). These are stored in `GGnPlatformMeta.buffs` but not currently used in the dashboard display — tracked for future buffer projection features.

## Supported Trackers

- [GazelleGames](trackers/gazellegames.md)
