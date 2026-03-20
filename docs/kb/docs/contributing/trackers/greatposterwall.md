# Great Poster Wall (GPW)

| Field | Value |
|---|---|
| Platform | Gazelle |
| Base URL | `https://greatposterwall.com` |
| API Endpoint | `https://greatposterwall.com/ajax.php` |
| Auth Method | HTTP header: `Authorization: token TOKEN` |
| Enrichment | No |
| Auth Style | standard |

## Notes

Standard Gazelle configuration. This tracker is marked **Unvalidated** — the API integration has not been confirmed against a live account. The site is primarily Chinese-language.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
