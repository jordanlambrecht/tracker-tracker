# API Comparison: UNIT3D vs Gazelle vs GGn

Reference document for adapter development. Compares the three tracker platform APIs and maps their fields to the shared `TrackerStats` interface.

---

## Connection Details

| Aspect | UNIT3D | Gazelle (RED/OPS) | GGn |
|---|---|---|---|
| **Base endpoint** | `/api/user` | `/ajax.php?action=index` | `/api.php?request=quick_user` + `/api.php?request=user&id=X` |
| **Auth method** | Query parameter: `?api_token=TOKEN` | Header: `Authorization: token TOKEN` | Query parameter: `?key=TOKEN` |
| **Response format** | Flat JSON object | Nested: `{ status, response: { userstats } }` | Nested: `{ status, response: { stats, personal, community } }` |
| **Status indication** | HTTP status codes only | HTTP codes + `status` field (`"success"` / `"failure"`) | HTTP codes + `status` field |
| **Byte representation** | Formatted strings (`"500.25 GiB"`) | Raw integers (bytes) | Raw integers (bytes) |
| **API calls per poll** | 1 | 1 | 2 (quick_user → user) |
| **Timeout** | 15s `AbortSignal` | 15s `AbortSignal` | 15s `AbortSignal` per call |

## Field Mapping

### Core Fields (always available)

| TrackerStats field | UNIT3D source | Gazelle source | GGn source | Notes |
|---|---|---|---|---|
| `username` | `username` (string) | `response.username` (string) | `response.username` (string) | Direct on all platforms |
| `group` | `group` (string) | `userstats.class` (string) | `personal.class` (string) | Different locations per platform |
| `uploadedBytes` | `uploaded` → `parseBytes()` | `userstats.uploaded` → `BigInt()` | `stats.uploaded` → `BigInt()` | UNIT3D needs string parsing |
| `downloadedBytes` | `downloaded` → `parseBytes()` | `userstats.downloaded` → `BigInt()` | `stats.downloaded` → `BigInt()` | UNIT3D needs string parsing |
| `ratio` | `ratio` → `parseFloat()` | `userstats.ratio` (number) | `stats.ratio` (string or number) | GGn full response returns string |
| `bufferBytes` | `buffer` → `parseBytes()` | Calculated: `uploaded - downloaded` | Calculated: `uploaded - downloaded` | Only UNIT3D provides directly |
| `seedbonus` | `seedbonus` → `parseFloat()` | `userstats.bonusPoints` or `.bonuspoints` | `stats.gold` (number) | GGn uses "gold" currency system |

### Platform-Dependent Fields

| TrackerStats field | UNIT3D | Gazelle (RED/OPS) | GGn | Notes |
|---|---|---|---|---|
| `seedingCount` | `seeding` (number) | `userstats.seedingcount` (optional) | `community.seeding` (nullable) | GGn depends on paranoia settings |
| `leechingCount` | `leeching` (number) | `userstats.leechingcount` (optional) | `community.leeching` (nullable) | GGn depends on paranoia settings |
| `hitAndRuns` | `hit_and_runs` (number) | **Not available** (0) | `personal.hnrs` (nullable) | Defaults to 0 when absent |
| `requiredRatio` | **Not available** (null) | `userstats.requiredratio` (number) | `stats.requiredRatio` (number) | UNIT3D returns null |
| `warned` | **Not available** (null) | **Requires 2nd call** (false) | `personal.warned` (boolean) | GGn gets it in the user call |
| `freeleechTokens` | **Not available** (null) | `userstats.freeleechTokens` (optional) | **Not available** (null) | GGn does not expose FL tokens |

### Platform Capabilities Summary

| Capability | UNIT3D | Gazelle | GGn | Status |
|---|---|---|---|---|
| Upload / Download / Ratio | Yes | Yes | Yes | **Implemented** |
| Buffer | Yes (direct) | Yes (calculated) | Yes (calculated) | **Implemented** |
| Seedbonus / Gold | Yes | Yes (most forks) | Yes (gold) | **Implemented** |
| Seeding / Leeching counts | Yes | Partial (some forks) | Paranoia-dependent | **Implemented** (defaults to 0) |
| Hit & Runs | Yes | No | Partial (nullable) | **Implemented** |
| Required Ratio | No | Yes | Yes | **Implemented** |
| Freeleech Tokens | No | Yes (some forks) | No | **Implemented** |
| Warned status | No | Needs 2nd call | Yes | **Implemented** (Gazelle defaults false) |
| Snatched count | No | Needs 2nd call | Available | **Not implemented** — future |
| Last access time | No | Needs 2nd call | Available | **Not implemented** — future |
| Upload/Download buffs | No | No | Yes (multipliers) | **Not implemented** — GGn-specific |

## Response Shapes

### UNIT3D `/api/user`

```json
{
  "username": "JohnDoe",
  "group": "Power User",
  "uploaded": "500.25 GiB",
  "downloaded": "125.50 GiB",
  "ratio": "3.99",
  "buffer": "374.75 GiB",
  "seeding": 156,
  "leeching": 2,
  "seedbonus": "12500.00",
  "hit_and_runs": 0
}
```

### Gazelle `?action=index`

```json
{
  "status": "success",
  "response": {
    "username": "JohnDoe",
    "id": 12345,
    "authkey": "...",
    "passkey": "...",
    "notifications": {
      "messages": 0,
      "notifications": 0,
      "newAnnouncement": false,
      "newBlog": false
    },
    "userstats": {
      "uploaded": 536870912000,
      "downloaded": 134217728000,
      "ratio": 4.0,
      "requiredratio": 0.6,
      "class": "Power User",
      "bonusPoints": 12500,
      "freeleechTokens": 3
    }
  }
}
```

### GGn `?request=quick_user`

```json
{
  "status": "success",
  "response": {
    "username": "thesneakyrobot",
    "id": 74360,
    "authkey": "...",
    "passkey": "...",
    "notifications": { "messages": 0, "notifications": 0, "newAnnouncement": 0 },
    "userstats": {
      "uploaded": 372518353895,
      "downloaded": 373640248681,
      "ratio": 0.99,
      "requiredratio": 0.012,
      "class": "Elite Gamer"
    }
  }
}
```

### GGn `?request=user&id=X`

```json
{
  "status": "success",
  "response": {
    "id": 12345,
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

## Known Gazelle Fork Variations

| Fork / Site | Platform | Auth Method | bonusPoints field | freeleechTokens | seedingcount in index |
|---|---|---|---|---|---|
| Redacted (RED) | `gazelle` | Header token | `bonusPoints` | Sometimes | No |
| Orpheus (OPS) | `gazelle` | Header token | `bonusPoints` | Sometimes | No |
| GazelleGames (GGn) | `ggn` | Query key | N/A (uses `gold`) | No | No (paranoia) |
| BroadcasTheNet (BTN) | `gazelle` | Header token | Varies | No | No |
| PassThePopcorn (PTP) | `gazelle` | Header token | Varies | No | No |
| AnimeBytes (AB) | `gazelle` | Header token | Varies | Varies | No |

## Future Work

- **Gazelle enrichment**: Add optional `?action=user&id=X` call to fetch warned/snatched for standard Gazelle sites
- **GGn buffs tracking**: Store upload/download multipliers for buffer projection
- **Per-site overrides**: Allow registry entries to specify custom field mappings
- **Rate limiting**: Some sites (especially RED) have strict API rate limits; adapter should respect them
