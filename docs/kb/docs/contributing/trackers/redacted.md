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

REDacted uses `gazelleAuthStyle: "token"` — it takes the raw token string in the `Authorization` header, not the `token TOKEN` format most Gazelle sites expect.

Enrichment is on, so we make a second `?action=user&id=X` call after the first one to grab `warned` status, join date, last access, and better seeding/leeching numbers.

## Slots

**Profile Card:** username · group · avatar · join date (enrichment provides avatarUrl, joinedDate)

**Badges:** `warned`, `donor`, `disabled`, `gazelle-paranoia`, `gazelle-unread`, `gazelle-announcement`

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 120), `gazelle-tokens`, `perfect-flacs`, `snatched-gazelle`, `torrents-uploaded`, `requests-filled`, `groups-contributed`, `invited`, `gazelle-bounty`, `gazelle-comments`

**Progress:** none
