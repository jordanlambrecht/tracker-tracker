# MAM (MyAnonaMouse) API Response

MAM uses a custom JSON API with cookie auth. One endpoint returns stats plus a detailed snatch breakdown.

## Endpoint

```bash
GET {baseUrl}/jsonLoad.php?snatch_summary&notif
```

Add `snatch_summary` for torrent breakdown by category, and `notif` for notification counts (PMs, tickets, requests). Without them, you get only basic stats.

Optional parameters (not used by the adapter):

- `clientStats` — per-client connectivity info (30-min cache)
- `pretty` — pretty-prints JSON
- `id={userid}` — load specific user data (limited public data for others)

**Note:** The `?id=` parameter doesn't add fields like join date. The `created` and `update` fields are cache timestamps, not account dates (see Quirks).

## Authentication

Use a session cookie (`mam_id`) instead of an API key:

```bash
Cookie: mam_id={SESSION_COOKIE}
```

Get it from User Preferences → Security. Create an IP-locked or ASN-locked session for API use. MAM rotates these monthly, so refresh periodically.

Auth fails silently — you get HTML instead of JSON. We detect it by checking if `username` is missing.

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

| Category | Field | Meaning | Alert? |
| --- | --- | --- | --- |
| Seeding - Satisfied | `sSat` | Past 72h, active | No |
| Seeding - H&R - Not Yet Satisfied | `seedHnr` | Active HnR being resolved | Yes |
| Seeding - pre-H&R - Not Yet Satisfied | `seedUnsat` | Seeding toward 72h | No |
| Seeding - Uploads | `upAct` | Own uploads, seeding | No |
| Not Seeding - H&R - Not Yet Satisfied | `inactHnr` | Inactive HnR — urgent | Yes |
| Not Seeding - pre-H&R - Not Yet Satisfied | `inactUnsat` | Ticking clock to HnR | Yes |
| Not Seeding - Satisfied | `inactSat` | Completed | No |
| Not Seeding - Uploads | `upInact` | Own uploads, inactive | No |
| Leeching | `leeching` | Downloading | No |
| Unsatisfied | `unsat` | Total unsatisfied | No |

Each object: `name`, `count`, `red` (boolean alert flag), `size` (bytes or null).

## Quirks

**Dual byte representation.** Both formatted strings (`"5.125 TiB"`) and raw bytes. We use raw bytes with `BigInt()` — no parsing needed.

**Bonus points cap at 99,999.** Hard ceiling. Anything above is lost.

**FL Wedges are separate currency.** Earned from Millionaire's Vault, traded for personal or staff freeleech.

**Cookie auth only.** Set `mam_id` as IP-locked or ASN-locked in Security Settings. Monthly rotations are normal.

**`created` and `update` are cache timestamps.** They change on each API call — they're not account dates. MAM doesn't expose join date via API.

**`unsat.limit` is class-dependent.** User=50, Power User=100, VIP=150, above VIP=200.

**72-hour seed requirement.** 72h seeding per torrent within 30 days, or it's an H&R. `inactHnr` = torrents past deadline that you stopped seeding.

## Other MAM Endpoints (Not Used by Adapter)

Alternative endpoints for reference and future use.

### `/jsonLoad.php?clientStats`

Torrent client connectivity info from MAM's perspective (30-min cache). Not used because Tracker Tracker has its own qBT integration, but useful for diagnosing MAM-side connectivity.

Without `?id=`: empty array. With `?id={uid}` (your ID): full breakdown:

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

Notification counts (PMs, tickets, requests). Included in every poll alongside `?snatch_summary`. Stored in `MamPlatformMeta` and surfaced as an unread badge on the tracker detail page.

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

Bonus points and wedge transaction history. Requires `mam_id` cookie auth on `www.myanonamouse.net`.

**Parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `other_userid` | int | Filter by user |
| `type[]` | list | Transaction types: `giftPoints`, `giftWedge`, `wedgePF`, `wedgeGFL`, `torrentThanks`, `millionaires` |

**Example:**

```bash
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

Sets the dynamic seedbox IP. For VPN/seedbox users, not relevant to stats tracking. Requires specially configured API session (ASN-locked + Dynamic Seedbox permission) on `t.myanonamouse.net`.

**Rate limit:** Once per hour.

**Success:**

```json
{
  "Success": true,
  "msg": "Completed",
  "ip": "10.2.3.4",
  "ASN": 1234,
  "AS": "Org for 1234"
}
```

**Rate limited:**

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

Current IP, ASN, and organization name. Available on both `www` and `t` subdomains. No auth required.

```json
{
  "ip": "10.2.3.4",
  "ASN": 123,
  "AS": "Some Provider Here"
}
```

## Supported Trackers

- MyAnonaMouse
