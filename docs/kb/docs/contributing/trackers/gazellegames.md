# GazelleGames (GGn)

| Field        | Value                                           |
| ------------ | ----------------------------------------------- |
| Platform     | GGn                                             |
| Base URL     | `https://gazellegames.net`                      |
| API Endpoint | `https://gazellegames.net/api.php`              |
| Auth Method  | Query parameter: `?key=TOKEN`                   |
| Enrichment   | N/A (two-step fetch built into the GGn adapter) |
| Auth Style   | N/A                                             |

## Notes

GGn needs its own adapter — not the standard Gazelle one. Here's what makes it different:

- Auth uses a query parameter (`?key=TOKEN`), not a header.
- The first poll does two requests: first hits `?request=quick_user&key=TOKEN` to get your numeric user ID, then `?request=user&id=X&key=TOKEN` to grab the full stats. After that, we skip the ID lookup and go straight to `request=user`.
- Currency is called `gold` here (not `bonusPoints` or `seedbonus`), but we map it to `seedbonus` in the dashboard.
- `stats.ratio` comes back as a string like `"0.99699"`, not a number. The adapter converts it.
- Seeding and leeching counts depend on your paranoia level and might be `null`.
- `freeleechTokens` is always `null` — GGn doesn't expose those via the API.

See the [GGn platform page](../tracker-responses-ggn.md) for the full field mapping.

## Slots

**Profile Card:** username · group · join date (GGn's adapter gives us joinedDate)

**Badges:** `warned`, `donor`, `disabled`, `ggn-parked`, `ggn-invites`, `ggn-irc` (GGn-specific statuses)

**Stat Cards:** `gold`, `ggn-share-score-card`, `login-deadline` (loginIntervalDays: 60)

**Progress:** `ggn-achievement-progress`, `ggn-share-score-progress`, `ggn-buffs`
