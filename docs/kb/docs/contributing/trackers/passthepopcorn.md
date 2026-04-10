# PassThePopcorn (PTP)

!!! Warning
    This tracker is marked **Unvalidated** and has not been tested it against a real account yet. The `bonusPoints` field might be named differently than we expect.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://passthepopcorn.me`               |
| API Endpoint | `https://passthepopcorn.me/ajax.php`      |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

Standard Gazelle setup.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
