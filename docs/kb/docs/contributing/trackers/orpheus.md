# Orpheus (OPS)

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://orpheus.network`                 |
| API Endpoint | `https://orpheus.network/ajax.php`        |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

Standard Gazelle configuration. No tracker-specific quirks. Similar to REDacted — both are based on What.CD's Gazelle fork.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 120)

**Progress:** none
