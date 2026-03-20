# Nebulance (NBL)

| Field | Value |
|---|---|
| Platform | Nebulance |
| Base URL | `https://nebulance.io` |
| API Endpoint | `https://nebulance.io/api.php` |
| Auth Method | Query parameter: `?api_token=TOKEN` |
| Enrichment | N/A |
| Auth Style | N/A |

## Notes

Nebulance is a Gazelle-derived fork that uses `api.php` as the endpoint path (not `ajax.php`) and authenticates via query parameter rather than HTTP header. Sister site of Anthelion (ANT).

## Slots

**Profile Card:** username · group · join date (Nebulance provides joinedDate for NBL)

**Badges:** `warned` (conditional — always `false`, no enrichment on Nebulance platform)

**Stat Cards:** `snatched-nebulance`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
