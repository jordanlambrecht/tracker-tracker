# BroadcasTheNet (BTN)

| Field | Value |
|---|---|
| Platform | Gazelle |
| Base URL | `https://broadcasthe.net` |
| API Endpoint | `https://broadcasthe.net/ajax.php` |
| Auth Method | HTTP header: `Authorization: token TOKEN` |
| Enrichment | No |
| Auth Style | standard |

## Notes

Standard Gazelle configuration. This tracker is marked **Unvalidated** — the API integration has not been confirmed against a live account. The `bonusPoints` field naming may vary from standard.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 60)

**Progress:** none
