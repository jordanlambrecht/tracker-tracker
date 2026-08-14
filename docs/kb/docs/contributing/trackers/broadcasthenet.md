# BroadcasTheNet (BTN)

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Platform     | BTN (custom, JSON-RPC)                       |
| Base URL     | `https://broadcasthe.net`                    |
| API Endpoint | `https://api.broadcasthe.net/`               |
| Auth Method  | API key as the first JSON-RPC param          |
| Enrichment   | No                                           |
| Auth Style   | N/A                                          |

## Notes

BTN is **not** a Gazelle tracker. It was originally registered as
`platform: "gazelle"` by a bulk placeholder commit that also self-labelled the
entry "Unvalidated"; the label was never verified. BTN publishes a JSON-RPC 2.0
API, confirmed against their official API docs and cross-checked with how
Prowlarr and Jackett talk to it.

The adapter makes one call — a `POST` to the API host with:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "userInfo", "params": ["API_KEY"] }
```

The key travels in the params array, not in a header or query string.

### The API lives on a different host

`apiPath` is an absolute URL (`https://api.broadcasthe.net/`) rather than a path
appended to the tracker URL, which is what every other registry entry uses. BTN
genuinely serves its API off-domain, so the adapter reads `apiPath` as a
complete URL and never resolves it against the base URL.

This overloads one field with two meanings. A separate `apiBaseUrl` field would
be more honest, but the value is persisted per row at creation, so splitting it
is a schema change rather than a rename — worth doing before more off-domain
trackers arrive, not urgent while BTN is the only one.

### Migrating a BTN tracker added before this change

`platformType` is stored per row when a tracker is added, so an existing BTN
entry keeps running the Gazelle adapter after this update. It will not error —
it quietly stops enriching, because the registry entry no longer carries
`gazelleEnrich`.

**Existing BTN users must delete and re-add the tracker.** There is no automatic
migration: the Gazelle token and the BTN JSON-RPC key are different secrets, so
the stored credential cannot be reused.

### Fields BTN does not return

`userInfo` documents only `UserID`, `Username`, `Email`, `Upload`, `Download`,
`Title`, `Enabled`, `Paranoia`, `Invites`, and `ClassID`. Live responses also
carry `Class`, `Lumens`, `Bonus`, `HnR`, and `JoinDate`, none of which appear in
the published spec.

Seeding and leeching counts, required ratio, and the warned flag are **not in
the response at all** and are reported as unknown rather than as `0` — a
hardcoded zero renders identically to a measured zero, which would show a
confident wrong number.

`Lumens` and `Bonus` are left unmapped: their meaning is unconfirmed and `Bonus`
arrives fractional, which does not fit a freeleech token count. Hit-and-runs
come from `HnR` when present, but BTN publishes a separate `getUserSnatchlist`
endpoint for them, so the key may be absent.

### Rate limit

BTN allows 150 API calls per hour. The adapter surfaces a `503` as
"BTN API rate limited (150 calls/hour)" and a `401` as "Invalid BTN API key".

## Slots

**Profile Card:** username · class (`Class`, falling back to `Title`) · join
date (from the undocumented `JoinDate`, when present)

**Badges:** none — `warned` is unknown, not `false`

**Stat Cards:** `login-deadline` (loginIntervalDays: 60) · hit-and-runs (only
when `HnR` is present)

**Progress:** none
