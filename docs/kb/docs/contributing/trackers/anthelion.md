# Anthelion (ANT)

| Field | Value |
|---|---|
| Platform | Nebulance |
| Base URL | `https://anthelion.me` |
| API Endpoint | `https://anthelion.me/api.php` |
| Auth Method | Query parameter: `?api_token=TOKEN` |
| Enrichment | N/A |
| Auth Style | N/A |

## Notes

Anthelion uses the Nebulance platform, which is a Gazelle-derived fork. It uses `api.php` as the endpoint path (not `ajax.php`) and authenticates via query parameter rather than HTTP header. Sister site of Nebulance (NBL).

## Slots

**Profile Card:** username · group (no avatar — Nebulance platform does not provide join date for ANT)

**Badges:** `warned` (conditional — always `false`, no enrichment on Nebulance platform)

**Stat Cards:** `snatched-nebulance`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
