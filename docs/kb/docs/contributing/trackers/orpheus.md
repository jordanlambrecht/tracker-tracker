# Orpheus (OPS)

!!! Outdated
    This doc page needs to be updated with correct response shapes.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://orpheus.network`                 |
| API Endpoint | `https://orpheus.network/ajax.php`        |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

Standard Gazelle setup with no quirks. Like REDacted, it's built on the What.CD Gazelle fork.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 120)

**Progress:** none
