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

Enrichment is on, so we make a second `?action=user&id=X` call after the first one to grab `warned` status, join date, last access, and better seeding/leeching numbers.

## Slots

**Profile Card:** username · group · avatar · join date (enrichment provides avatarUrl, joinedDate)

**Badges:** `warned`, `donor`, `disabled`, `gazelle-paranoia`, `gazelle-unread`, `gazelle-announcement`

**Stat Cards:** `seedbonus`, `gazelle-tokens`, `perfect-flacs`, `snatched-gazelle`, `torrents-uploaded`, `requests-filled`, `groups-contributed`, `invited`, `gazelle-bounty`, `gazelle-comments` (no `login-deadline` — loginIntervalDays is 0)

**Progress:** none

> `login-deadline` won't show for Phoenix Project because we set `loginIntervalDays` to `0` in the registry.
