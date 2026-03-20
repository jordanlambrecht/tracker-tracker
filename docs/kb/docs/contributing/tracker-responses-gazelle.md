# Gazelle API Response

## Endpoint (action=index)

```
GET {baseUrl}/ajax.php?action=index
```

The path `ajax.php` comes from the tracker's `apiPath` field. This is standard across all Gazelle forks.

## Authentication

API token passed as an HTTP header:

```
Authorization: token TOKEN
```

Some forks (configured with `authStyle: "raw"`) use the token value directly without the `token ` prefix. The adapter checks `options.authStyle` to handle this.

## Example Response

```json
{
  "status": "success",
  "response": {
    "username": "JohnDoe",
    "id": 12345,
    "giftTokens": 3,
    "meritTokens": 0,
    "notifications": {
      "messages": 0,
      "notifications": 2,
      "newAnnouncement": false,
      "newBlog": false,
      "newSubscriptions": false
    },
    "userstats": {
      "uploaded": 536870912000,
      "downloaded": 134217728000,
      "ratio": 4.0,
      "requiredratio": 0.6,
      "class": "Power User",
      "bonusPoints": 12500,
      "seedingcount": 42,
      "leechingcount": 1,
      "freeleechTokens": 3
    }
  }
}
```

Byte values are **raw integers** (bytes), not formatted strings. The `id` field in the top-level response is the user's remote ID — the adapter caches this as `remoteUserId` for use in the enrichment call.

## Field Mapping (action=index)

| TrackerStats field | Gazelle path | Type | Notes |
|---|---|---|---|
| `username` | `response.username` | `string` | Direct copy |
| `group` | `response.userstats.class` | `string` | Falls back to `"Unknown"` |
| `uploadedBytes` | `response.userstats.uploaded` | `number` | `BigInt(Math.floor(...))` |
| `downloadedBytes` | `response.userstats.downloaded` | `number` | `BigInt(Math.floor(...))` |
| `ratio` | `response.userstats.ratio` | `number` | Defaults to `0` if not a number |
| `bufferBytes` | — | — | Calculated: `uploadedBytes - downloadedBytes` (min `0`) |
| `seedingCount` | `response.userstats.seedingcount` | `number?` | Defaults to `0` — many forks omit this |
| `leechingCount` | `response.userstats.leechingcount` | `number?` | Defaults to `0` — many forks omit this |
| `seedbonus` | `response.userstats.bonusPoints` or `.bonuspoints` | `number?` | Checks both casing variants |
| `hitAndRuns` | — | — | Always `null` — not in Gazelle index response |
| `requiredRatio` | `response.userstats.requiredratio` | `number?` | `null` if absent |
| `warned` | — | — | Defaults to `false` from index; overridden if enrichment runs |
| `freeleechTokens` | `response.userstats.freeleechTokens` or `response.giftTokens` | `number?` | Checks `userstats` first, falls back to top-level `giftTokens` |
| `remoteUserId` | `response.id` | `number` | Cached to skip re-parsing on future polls |

---

## Enrichment Response (action=user)

Trackers configured with `enrich: true` make a second call after the index request:

```
GET {baseUrl}/ajax.php?action=user&id={USER_ID}
```

This call fetches the full user profile including warned status, join date, seeding/leeching counts from the community object, ranks, and avatar.

### Example Response

```json
{
  "status": "success",
  "response": {
    "username": "JohnDoe",
    "avatar": "https://example.com/avatars/johndoe.jpg",
    "stats": {
      "joinedDate": "2021-04-12 09:34:00",
      "lastAccess": "2026-03-19 14:22:11",
      "uploaded": 536870912000,
      "downloaded": 134217728000,
      "ratio": 4.0,
      "buffer": 402653184000,
      "requiredRatio": 0.6
    },
    "ranks": {
      "uploaded": 1842,
      "downloaded": 5210,
      "uploads": 304,
      "requests": 88,
      "bounty": 0,
      "posts": 127,
      "artists": 14,
      "overall": 980
    },
    "personal": {
      "class": "Power User",
      "paranoia": 0,
      "paranoiaText": "Off",
      "donor": false,
      "warned": false,
      "enabled": true
    },
    "community": {
      "posts": 127,
      "torrentComments": 43,
      "artistComments": 12,
      "collageComments": 3,
      "requestComments": 8,
      "collagesStarted": 2,
      "collagesContrib": 11,
      "requestsFilled": 5,
      "requestsVoted": 29,
      "perfectFlacs": 18,
      "uploaded": 304,
      "groups": 48,
      "seeding": 42,
      "leeching": 1,
      "snatched": 1204,
      "invited": 3,
      "bountyEarned": null,
      "bountySpent": null
    }
  }
}
```

### What the enrichment step overrides

| TrackerStats field | Source in action=user response | Notes |
|---|---|---|
| `warned` | `personal.warned` | Overrides the `false` default from index |
| `joinedDate` | `stats.joinedDate` | Not available from index |
| `lastAccessDate` | `stats.lastAccess` | Not available from index |
| `bufferBytes` | `stats.buffer` | Richer than the calculated value |
| `seedingCount` | `community.seeding` | More reliable than index for many forks |
| `leechingCount` | `community.leeching` | More reliable than index for many forks |
| `avatarUrl` | `avatar` | Not available from index |
| `platformMeta` | `personal`, `ranks`, `community` | Full `GazellePlatformMeta` object |

If the enrichment call fails for any reason, the adapter continues with core stats from the index response — the failure is non-fatal.

---

## Gazelle Fork Variations

| Site | bonusPoints field | freeleechTokens | seedingcount in index |
|---|---|---|---|
| Redacted (RED) | `bonusPoints` | Sometimes | No |
| Orpheus (OPS) | `bonusPoints` | Sometimes | No |
| BroadcasTheNet (BTN) | Varies | No | No |
| PassThePopcorn (PTP) | Varies | No | No |
| AnimeBytes (AB) | Varies | Varies | No |

GazelleGames (GGn) is handled by its own separate adapter — see the [GGn page](tracker-responses-ggn.md).

## Supported Trackers

- [AlphaRatio](trackers/alpharatio.md)
- [AnimeBytes](trackers/animebytes.md)
- [BroadcasTheNet](trackers/broadcasthenet.md)
- [Empornium](trackers/empornium.md)
- [Great Poster Wall](trackers/greatposterwall.md)
- [MoreThanTV](trackers/morethantv.md)
- [Orpheus](trackers/orpheus.md)
- [PassThePopcorn](trackers/passthepopcorn.md)
- [Phoenix Project](trackers/phoenixproject.md)
- [REDacted](trackers/redacted.md)
