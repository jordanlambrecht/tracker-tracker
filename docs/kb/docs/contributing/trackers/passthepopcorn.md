# PassThePopcorn (PTP)

!!! Warning
    Verified on 2026-11-13: an ApiUser/ApiKey request to `index.php?json=0` returns HTML (`X-IsApi: 1`) carrying the user bar, and the parser reads it correctly. The PTP wiki article "PTP API Documentation" lists querying user information among banned API uses.

| Field        | Value                                           |
| ------------ | ----------------------------------------------- |
| Platform     | `ptp`                                           |
| Base URL     | `https://passthepopcorn.me`                     |
| API Endpoint | `https://passthepopcorn.me/index.php?json=0`    |
| Auth Method  | HTTP headers: `ApiUser: USER`, `ApiKey: KEY`    |
| Enrichment   | No                                              |

## Notes

PTP's codebase split from Gazelle before `ajax.php` existed, so the Gazelle adapter cannot poll it. With the API headers set, a page answers JSON unless `json=0` is passed. `index.php` returns HTML, and its user bar carries upload, download, ratio, buffer, bonus points and the HnR count. `user.php` is blocked for API access, so class and seeding count are not reported.

A bad ApiUser or ApiKey returns `400 Malformed Api Credentials`. Disabled API access returns `401`.

## Slots

**Profile Card:** username (no class, avatar or join date)

**Stat Cards:** `seedbonus`, `hitAndRuns`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
