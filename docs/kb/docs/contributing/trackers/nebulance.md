# Nebulance (NBL)

| Field        | Value                               |
| ------------ | ----------------------------------- |
| Platform     | Nebulance                           |
| Base URL     | `https://nebulance.io`              |
| API Endpoint | `https://nebulance.io/api.php`      |
| Auth Method  | Query parameter: `?api_token=TOKEN` |
| Enrichment   | N/A                                 |
| Auth Style   | N/A                                 |

## Notes

Nebulance is a Gazelle fork that uses `api.php` instead of `ajax.php` and authenticates via query parameter rather than HTTP header. Sister site to Anthelion (ANT).

## Slots

**Profile Card:** username · group · join date (Nebulance gives us joinedDate)

**Badges:** `warned` (always `false` — Nebulance doesn't provide enrichment)

**Stat Cards:** `snatched-nebulance`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
