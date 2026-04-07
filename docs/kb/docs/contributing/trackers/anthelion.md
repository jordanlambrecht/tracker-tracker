# Anthelion (ANT)

| Field        | Value                               |
| ------------ | ----------------------------------- |
| Platform     | Nebulance                           |
| Base URL     | `https://anthelion.me`              |
| API Endpoint | `https://anthelion.me/api.php`      |
| Auth Method  | Query parameter: `?api_token=TOKEN` |
| Enrichment   | N/A                                 |
| Auth Style   | N/A                                 |

## Notes

Anthelion runs on Nebulance, a Gazelle fork. It has two quirks: the endpoint is `api.php` (not `ajax.php`), and it authenticates via query parameter instead of HTTP header. It's the sister site to Nebulance (NBL).

## Slots

**Profile Card:** username · group (no avatar — Nebulance platform does not provide join date for ANT)

**Badges:** `warned` (conditional — always `false`, no enrichment on Nebulance platform)

**Stat Cards:** `snatched-nebulance`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
