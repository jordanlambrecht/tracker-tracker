# MoreThanTV (MTV)

| Field | Value |
|---|---|
| Platform | Gazelle |
| Base URL | `https://morethantv.me` |
| API Endpoint | `https://morethantv.me/ajax.php` |
| Auth Method | HTTP header: `Authorization: token TOKEN` |
| Enrichment | No |
| Auth Style | standard |

## Notes

Standard Gazelle configuration. This tracker is marked **Unvalidated** — the API integration has not been confirmed against a live account. Field names and response structure are assumed to match the standard Gazelle layout.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
