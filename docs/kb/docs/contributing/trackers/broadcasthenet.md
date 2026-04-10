# BroadcasTheNet (BTN)

!!! Warning
    This tracker is marked **Unvalidated** and has not been tested it against a real account yet.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Platform     | Gazelle                                   |
| Base URL     | `https://broadcasthe.net`                 |
| API Endpoint | `https://broadcasthe.net/ajax.php`        |
| Auth Method  | HTTP header: `Authorization: token TOKEN` |
| Enrichment   | No                                        |
| Auth Style   | standard                                  |

## Notes

This is a standard Gazelle setup. It's marked **Unvalidated** because no one's tested it against a real account yet. Fair warning: the `bonusPoints` field might not match the standard Gazelle naming.

## Slots

**Profile Card:** username · group (no avatar or join date — no enrichment)

**Badges:** `warned` (conditional — always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 60)

**Progress:** none
