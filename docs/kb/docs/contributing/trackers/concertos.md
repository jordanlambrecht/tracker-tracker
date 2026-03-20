# Concertos (CON)

| Field | Value |
|---|---|
| Platform | UNIT3D |
| Base URL | `https://concertos.live` |
| API Endpoint | `https://concertos.live/api/user` |
| Auth Method | Query parameter: `?api_token=TOKEN` |
| Enrichment | N/A |
| Auth Style | N/A |

## Notes

Standard UNIT3D configuration. No tracker-specific quirks.

## Slots

**Profile Card:** username · group (no avatar or join date — UNIT3D platform)

**Badges:** `warned` (conditional — only resolves when `warned === true` in snapshot)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
