# LST (LST)

| Field        | Value                               |
| ------------ | ----------------------------------- |
| Platform     | UNIT3D                              |
| Base URL     | `https://lst.gg`                    |
| API Endpoint | `https://lst.gg/api/user`           |
| Auth Method  | Query parameter: `?api_token=TOKEN` |
| Enrichment   | N/A                                 |
| Auth Style   | N/A                                 |

## Notes

Since late August 2026 LST wraps the user resource in a Laravel `data` envelope and adds a sibling `api_key.expires_at` (also sent as the `X-Api-Key-Expires-At` header). The adapter reads through the envelope. Bearer and `?api_token=` both authenticate. See [issue #214](https://github.com/jordanlambrecht/tracker-tracker/issues/214).

## Slots

**Profile Card:** username · group (no avatar or join date, UNIT3D platform)

**Badges:** `warned` (shows up only if `warned === true` in the API response)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90), `api-key-expiry` (from `api_key.expires_at`)

**Progress:** none
