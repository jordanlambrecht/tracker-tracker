# MAM (MyAnonaMouse) API Response

MAM uses a custom JSON API with cookie-based authentication. A single endpoint returns all user stats including a detailed snatch summary breakdown.

## Endpoint

One request per poll:

```
GET {baseUrl}/jsonLoad.php?snatch_summary&notif
```

The `snatch_summary` query parameter enables the detailed torrent category breakdown. The `notif` parameter includes notification counts (PMs, tickets, requests). Without these, only basic stats (username, ratio, uploaded, downloaded) are returned.

Optional parameters (not used by the adapter):

- `clientStats` — includes per-client connectivity info from MAM's perspective (30min cache). Returns empty array without `?id=`, full breakdown with `?id={uid}`.
- `pretty` — pretty-prints the JSON output
- `id={userid}` — load a specific user's data. When set to your own UID, `clientStats` returns the full per-IP/port breakdown. When set to another user's UID, returns limited public data.

**Note:** The `?id=` parameter does NOT return additional profile fields (like join date). The response shape is identical to the self-lookup — `created` and `update` fields are cache timestamps that change between requests, not account dates.

## Authentication

MAM uses a `mam_id` session cookie instead of an API key or authorization header:

```
Cookie: mam_id={SESSION_COOKIE}
```

The session cookie is obtained from MAM's Security Settings page (User Preferences → Security). Users should create an IP-locked or ASN-locked session for API use. **Session cookies rotate monthly** — users must update the stored token periodically.

Auth failures return an HTML error string, not JSON:

```
Error, you are not signed in <br />Other error
```

The adapter detects this by checking for the absence of `username` in the response.

## Example Response

```json
{
  "username": "thesneakyrobot",
  "uid": 230500,
  "classname": "VIP",
  "ratio": 26.7,
  "uploaded": "5.125 TiB",
  "downloaded": "196.47 GiB",
  "uploaded_bytes": 5635036489461,
  "downloaded_bytes": 210957629456,
  "seedbonus": 99999,
  "wedges": 207,
  "vip_until": "2026-06-10 06:44:38",
  "connectable": "offline",
  "country_code": "us",
  "country_name": "United States",
  "created": 1774543581,
  "update": 1774543581,
  "ipv6_mac": false,
  "v6_connectable": null,
  "partial": false,
  "recently_deleted": 45,
  "leeching": { "name": "Leeching Torrents", "count": 0, "red": false, "size": null },
  "sSat": { "name": "Seeding - Satisfied", "count": 0, "red": false, "size": null },
  "seedHnr": { "name": "Seeding - H&R - Not Yet Satisfied", "count": 0, "red": true, "size": null },
  "seedUnsat": { "name": "Seeding - pre-H&R - Not Yet Satisfied", "count": 0, "red": false, "size": null },
  "upAct": { "name": "Seeding - Uploads", "count": 0, "red": false, "size": null },
  "upInact": { "name": "Not Seeding - Uploads", "count": 0, "red": false, "size": null },
  "inactHnr": { "name": "Not Seeding - H&R - Not Yet Satisfied", "count": 0, "red": true, "size": null },
  "inactSat": { "name": "Not Seeding - Satisfied", "count": 2306, "red": false, "size": 477079402691 },
  "inactUnsat": { "name": "Not Seeding - pre-H&R - Not Yet Satisfied", "count": 0, "red": true, "size": null },
  "unsat": { "name": "Unsatisfied", "count": 0, "red": false, "limit": 150, "size": null },
  "duplicates": { "name": "Duplicate peer entries", "count": 0, "red": true },
  "reseed": { "name": "Reseed requests", "count": 0, "inactive": 0, "red": false },
  "ite": { "name": "Important Tracker Errors", "count": 0, "latest": 0 }
}
```

## Field Mapping

| TrackerStats field | MAM path | Type | Notes |
| --- | --- | --- | --- |
| `username` | `username` | `string` | Direct |
| `group` | `classname` | `string` | Falls back to `"Unknown"` |
| `remoteUserId` | `uid` | `number` | Cached for future use |
| `uploadedBytes` | `uploaded_bytes` | `number` | `BigInt()` — raw bytes, no parsing needed |
| `downloadedBytes` | `downloaded_bytes` | `number` | `BigInt()` — raw bytes, no parsing needed |
| `ratio` | `ratio` | `number` | Direct float value |
| `bufferBytes` | — | — | Calculated: `uploadedBytes - downloadedBytes` (min `0`) |
| `seedingCount` | `sSat.count + seedHnr.count + seedUnsat.count + upAct.count` | `number` | Sum of all seeding snatch categories |
| `leechingCount` | `leeching.count` | `number` | Direct |
| `seedbonus` | `seedbonus` | `number` | Direct; MAM caps at 99,999 |
| `hitAndRuns` | `inactHnr.count` | `number` | Only inactive (not seeding) HnR torrents |
| `requiredRatio` | — | — | Always `null` — MAM uses class-based ratio thresholds |
| `warned` | — | — | Always `null` — not exposed in API |
| `freeleechTokens` | `wedges` | `number` | MAM calls them "FL Wedges" |
| `joinedDate` | — | — | Not available from this endpoint |
| `lastAccessDate` | — | — | Not available from this endpoint |
| `platformMeta` | Multiple fields | — | `MamPlatformMeta` object (see below) |

## Platform Meta (MamPlatformMeta)

| Field | MAM path | Type | Notes |
| --- | --- | --- | --- |
| `vipUntil` | `vip_until` | `string \| null` | VIP expiry date (`"2026-06-10 06:44:38"`) |
| `connectable` | `connectable` | `string` | `"offline"` or `"online"` |
| `unsatisfiedCount` | `unsat.count` | `number` | Current unsatisfied torrent count |
| `unsatisfiedLimit` | `unsat.limit` | `number` | Class-dependent limit (User=50, PU=100, VIP=150, above VIP=200) |
| `inactiveSatisfiedCount` | `inactSat.count` | `number` | Completed torrents no longer seeding |
| `seedingHnrCount` | `seedHnr.count` | `number` | HnR torrents being actively resolved |
| `inactiveUnsatisfiedCount` | `inactUnsat.count` | `number` | Pre-HnR torrents not being seeded (ticking clock) |
| `trackerErrorCount` | `ite.count` | `number` | Important Tracker Errors |
| `recentlyDeleted` | `recently_deleted` | `number` | Recently deleted torrents |

## Snatch Summary Categories

MAM's snatch summary groups all torrents into categories based on seeding status and satisfaction:

| Category | Field | Meaning | Red flag? |
| --- | --- | --- | --- |
| Seeding - Satisfied | `sSat` | Fully seeded past 72hrs, still active | No |
| Seeding - H&R - Not Yet Satisfied | `seedHnr` | Active HnR being resolved by seeding | Yes |
| Seeding - pre-H&R - Not Yet Satisfied | `seedUnsat` | Not yet HnR, still seeding toward 72hrs | No |
| Seeding - Uploads | `upAct` | User's own uploads, still seeding | No |
| Not Seeding - H&R - Not Yet Satisfied | `inactHnr` | **Danger:** inactive HnR, needs immediate attention | Yes |
| Not Seeding - pre-H&R - Not Yet Satisfied | `inactUnsat` | Ticking clock toward HnR status | Yes |
| Not Seeding - Satisfied | `inactSat` | Completed, no longer seeding | No |
| Not Seeding - Uploads | `upInact` | User's uploads, not currently seeding | No |
| Leeching | `leeching` | Currently downloading | No |
| Unsatisfied | `unsat` | Total unsatisfied (includes `limit` field) | No (has limit) |

Each category object has: `name` (human-readable), `count` (number), `red` (boolean — MAM flags it as concerning), `size` (bytes or null).

## Quirks

**Dual byte representation.** MAM returns both formatted strings (`uploaded`: `"5.125 TiB"`) and raw integers (`uploaded_bytes`: `5635036489461`). The adapter uses the raw integers directly via `BigInt()`, avoiding the `parseBytes()` parsing that UNIT3D requires.

**Bonus points cap at 99,999.** MAM has a hard cap on seedbonus. Points earned above this are lost. The notification system should alert when the cap is reached.

**FL Wedges are not bonus points.** Wedges (`wedges`) are a separate currency from seedbonus. They are earned from the Millionaire's Vault and can be exchanged for Personal or Staff Freeleech on individual torrents.

**Cookie auth, not API key.** MAM is the only platform using cookie-based auth. The `mam_id` session cookie must be set up in MAM's Security Settings as an IP-locked or ASN-locked session. Regular browser session cookies also work but are less stable. Cookies rotate monthly.

**`created` and `update` are cache timestamps, NOT account dates.** Verified: these values change between consecutive API calls (observed `1774552832` → `1774553470` seconds apart). They reflect when MAM's internal cache was last refreshed. **MAM does not expose account join date via any API endpoint** — users must enter it manually.

**`unsat.limit` is class-dependent.** The unsatisfied torrent limit varies by user class: User=50, Power User=100, VIP=150, above VIP=200. The API returns the current limit for the authenticated user.

**72-hour seed requirement.** MAM requires 72 hours of seeding within 30 days per torrent. Failure to meet this results in a Hit & Run. The `inactHnr` count represents torrents that have passed the deadline without sufficient seeding.

## Other MAM Endpoints (Not Used by Adapter)

The following endpoints exist in the MAM API but are not used by the Tracker Tracker adapter. They are documented here for reference and potential future use.

### `/jsonLoad.php?clientStats`

Returns torrent client connectivity information from MAM's perspective (30-minute cache). Not used by the adapter because Tracker Tracker has its own qBittorrent integration. However, the data is useful for diagnosing connectivity issues since it shows what MAM sees.

When called without `?id=`, `clientStats` is an empty array. When called with `?id={uid}` (your own user ID), it returns the full client breakdown:

```json
{
  "clientStats": {
    "uid": 230500,
    "username": "thesneakyrobot",
    "seedbonus": 99999,
    "uploaded": "5.125 TiB",
    "downloaded": "196.47 GiB",
    "uploaded_bytes": 5635036489461,
    "downloaded_bytes": 210957629456,
    "classname": "VIP",
    "wedges": 207,
    "vip_until": "2026-06-10 06:44:38",
    "ratio": 26.7,
    "country_name": "United States",
    "country_code": "us",
    "clientStats": [
      {
        "ip": "79.127.136.26",
        "port": 37649,
        "agent": "qBittorrent/5.1.4",
        "connectable": "no",
        "subResponse": "timeout",
        "startTime": 1774550236,
        "count": 17,
        "lastcheck": 1774552228,
        "timeTaken": 7166
      },
      {
        "ip": "79.127.136.70",
        "port": 42068,
        "agent": "qBittorrent/5.1.4",
        "connectable": "yes",
        "subResponse": "Connect",
        "startTime": 1774550262,
        "count": 2106,
        "lastcheck": 1774551105,
        "timeTaken": 250
      }
    ]
  }
}
```

**Client entry fields:**

| Field | Type | Description |
| --- | --- | --- |
| `ip` | string | IP address MAM sees the client connecting from |
| `port` | number | Port the client announces |
| `agent` | string | Torrent client user agent string |
| `connectable` | string | `"yes"` or `"no"` — whether MAM can reach the client |
| `subResponse` | string | `"Connect"` (success) or `"timeout"` (unreachable) |
| `startTime` | number | Unix timestamp of first seen |
| `count` | number | Number of torrents associated with this client entry |
| `lastcheck` | number | Unix timestamp of last connectivity check |
| `timeTaken` | number | Milliseconds for the connectivity check |

Note: A single user can have multiple client entries across different IPs/ports (e.g., home connection + VPN + seedbox). The top-level `"connectable"` field on the main response is `"yes"` if ANY client entry is connectable.

### `/jsonLoad.php?notif`

Returns notification counts (PMs, tickets, requests). The adapter includes `?notif` in every poll alongside `?snatch_summary`. The counts are stored in `MamPlatformMeta` (`unreadPMs`, `openTickets`, `pendingRequests`, `unreadTopics`) and surfaced as an unread badge on the tracker detail page.

The `notifs` object appears when `?notif` is included:

```json
{
  "notifs": {
    "pms": 0,
    "aboutToDropClient": 0,
    "tickets": 0,
    "waiting_tickets": 0,
    "requests": 0,
    "topics": 0
  }
}
```

These fields are merged into the standard `/jsonLoad.php` response alongside the other user data fields.

### `/json/userBonusHistory.php`

Shows a history of bonus points and wedge transactions. Requires `mam_id` cookie auth on `www.myanonamouse.net`.

**Parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `other_userid` | int | Filter to transactions with a specific user |
| `type[]` | list | Which transaction types to show: `giftPoints`, `giftWedge`, `wedgePF`, `wedgeGFL`, `torrentThanks`, `millionaires` |

**Example request:**

```
GET /json/userBonusHistory.php?type[]=giftWedge&type[]=wedgePF&type[]=wedgeGFL
```

**Example response:**

```json
[
  {
    "timestamp": 1644804607.0995,
    "amount": -1,
    "type": "wedgePF",
    "tid": 330896,
    "title": "1984",
    "other_userid": null,
    "other_name": null
  },
  {
    "timestamp": 1641914230.1078,
    "amount": -1,
    "type": "giftWedge",
    "tid": null,
    "title": null,
    "other_userid": 192566,
    "other_name": "pezzap7"
  },
  {
    "timestamp": 1610486584.1027,
    "amount": -10,
    "type": "wedgeGFL",
    "tid": 220870,
    "title": "Asimov's Robot, Empire, and Foundation Series",
    "other_userid": null,
    "other_name": null
  }
]
```

**Transaction types:**

| Type | Meaning |
| --- | --- |
| `giftPoints` | Bonus points gifted to/from another user |
| `giftWedge` | FL Wedge gifted to/from another user |
| `wedgePF` | Wedge spent on Personal Freeleech |
| `wedgeGFL` | Wedges spent on Staff Freeleech pick |
| `torrentThanks` | Points received from torrent "thank you" |
| `millionaires` | Wedges earned from Millionaire's Vault |

### `/json/dynamicSeedbox.php`

Sets the dynamic seedbox IP. Operational tool for VPN/seedbox users — not relevant to stats tracking. Requires a specially configured API session (ASN-locked + Dynamic Seedbox permission) on `t.myanonamouse.net`.

**Rate limit:** Once per hour (rolling window).

**Example response (success):**

```json
{
  "Success": true,
  "msg": "Completed",
  "ip": "10.2.3.4",
  "ASN": 1234,
  "AS": "Org for 1234"
}
```

**Example response (rate limited):**

```json
{
  "Success": false,
  "msg": "Last change too recent",
  "ip": "10.2.3.4",
  "ASN": 1234,
  "AS": "Org for 1234"
}
```

**Error codes:**

| HTTP | Message | Meaning |
| --- | --- | --- |
| 200 | `No Change` | IP already set to this address |
| 200 | `Completed` | IP updated successfully |
| 429 | `Last change too recent` | Rate limited (1 hour window) |
| 403 | `No Session Cookie` | Missing `mam_id` cookie |
| 403 | `Invalid session` | Bad cookie value or IP/ASN mismatch |
| 403 | `Incorrect session type - not allowed this function` | Session lacks Dynamic Seedbox permission |
| 403 | `Incorrect session type - non-API session` | Browser session used instead of API session |

### `/json/jsonIp.php`

Returns the caller's current IP, ASN, and AS organization name. Available on both `www.myanonamouse.net` and `t.myanonamouse.net`. No authentication required.

```json
{
  "ip": "10.2.3.4",
  "ASN": 123,
  "AS": "Some Provider Here"
}
```

## Supported Trackers

- [MyAnonaMouse](trackers/myanonamouse.md) *(to be created)*
