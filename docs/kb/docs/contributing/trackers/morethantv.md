# MoreThanTV (MTV)

!!! Warning
    This tracker is marked **Unvalidated** and has not been tested it against a real account yet.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://morethantv.me`                   |
| API Endpoint | `https://morethantv.me/ajax.php`          |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

Standard Gazelle.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` since there's no enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
