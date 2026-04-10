# AlphaRatio (AR)

!!! Warning
    This tracker is marked **Unvalidated** and has not been tested it against a real account yet. The field names and response structure should match the standard Gazelle layout, but there's no proof yet.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://alpharatio.cc`                   |
| API Endpoint | `https://alpharatio.cc/ajax.php`          |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

This is a standard Gazelle setup.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 120)

**Progress:** none
