# Anthelion (ANT)

| Field        | Value                               |
| ------------ | ----------------------------------- |
| Platform     | Nebulance                           |
| Base URL     | `https://anthelion.me`              |
| API Endpoint | `https://anthelion.me/api.php`      |
| Auth Method  | Query parameter: `?apikey=KEY`      |
| Enrichment   | N/A                                 |
| Auth Style   | N/A                                 |

## Notes

Anthelion runs on Nebulance, a Gazelle fork. It has two quirks: the endpoint is `api.php` (not `ajax.php`), and it authenticates via query parameter instead of HTTP header. It's the sister site to Nebulance (NBL).

## Slots

**Profile Card:** username · group · join date (no avatar)

**Badges:** none (the API sends no warned flag, so `warned` stays null)

**Stat Cards:** `snatched-nebulance`, `seedbonus` (labelled Orbs, from the API's `Orbs` field), `login-deadline` (loginIntervalDays: 90)

**Progress:** none
