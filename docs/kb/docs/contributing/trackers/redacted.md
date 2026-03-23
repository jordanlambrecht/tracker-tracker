# REDacted (RED)

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://redacted.sh`                     |
| API Endpoint | `https://redacted.sh/ajax.php`            |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | Yes (`gazelleEnrich: true`)               |
| Auth Style   | raw (`gazelleAuthStyle: "token"`)         |

## Notes

REDacted uses `gazelleAuthStyle: "token"` — the `Authorization` header value is the raw token string rather than the `token TOKEN` prefixed form used by most other Gazelle sites.

Enrichment is enabled, which means a second `?action=user&id=X` call is made after the index request to retrieve `warned` status, join date, last access date, and more accurate seeding/leeching counts.

## Slots

**Profile Card:** username · group · avatar · join date (enrichment provides avatarUrl, joinedDate)

**Badges:** `warned`, `donor`, `disabled`, `gazelle-paranoia`, `gazelle-unread`, `gazelle-announcement`

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 120), `gazelle-tokens`, `perfect-flacs`, `snatched-gazelle`, `torrents-uploaded`, `requests-filled`, `groups-contributed`, `invited`, `gazelle-bounty`, `gazelle-comments`

**Progress:** none
