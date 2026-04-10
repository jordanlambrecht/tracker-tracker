# Great Poster Wall (GPW)

!!! Warning
    This tracker is marked **Unvalidated** and has not been tested it against a real account yet.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://greatposterwall.com`             |
| API Endpoint | `https://greatposterwall.com/ajax.php`    |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

- Standard Gazelle config.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` since there's no enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
