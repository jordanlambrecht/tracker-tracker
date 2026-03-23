# Phoenix Project (PP)

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://phoenixproject.app`              |
| API Endpoint | `https://phoenixproject.app/ajax.php`     |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | Yes (`gazelleEnrich: true`)               |
| Auth Style   | standard                                  |

## Notes

Enrichment is enabled, which means a second `?action=user&id=X` call is made after the index request to retrieve `warned` status, join date, last access date, and more accurate seeding/leeching counts.

## Slots

**Profile Card:** username · group · avatar · join date (enrichment provides avatarUrl, joinedDate)

**Badges:** `warned`, `donor`, `disabled`, `gazelle-paranoia`, `gazelle-unread`, `gazelle-announcement`

**Stat Cards:** `seedbonus`, `gazelle-tokens`, `perfect-flacs`, `snatched-gazelle`, `torrents-uploaded`, `requests-filled`, `groups-contributed`, `invited`, `gazelle-bounty`, `gazelle-comments` (no `login-deadline` — loginIntervalDays is 0)

**Progress:** none

> `login-deadline` does not resolve for Phoenix Project because `loginIntervalDays` is set to `0` in the registry.
