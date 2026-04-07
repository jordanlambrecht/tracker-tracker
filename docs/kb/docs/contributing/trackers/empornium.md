# Empornium (EMP)

!!! Warning
    This tracker is marked **Unvalidated** and has not been tested it against a real account yet. The field names and response structure should match the standard Gazelle layout, but there's no proof yet.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://empornium.is`                    |
| API Endpoint | `https://empornium.is/ajax.php`           |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

Uses standard Gazelle.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` since there's no enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
