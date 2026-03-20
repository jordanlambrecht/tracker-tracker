# GazelleGames (GGn)

| Field | Value |
|---|---|
| Platform | GGn |
| Base URL | `https://gazellegames.net` |
| API Endpoint | `https://gazellegames.net/api.php` |
| Auth Method | Query parameter: `?key=TOKEN` |
| Enrichment | N/A (two-step fetch built into the GGn adapter) |
| Auth Style | N/A |

## Notes

GGn uses its own dedicated adapter rather than the standard Gazelle one. Key differences:

- Auth is via query parameter `?key=TOKEN`, not a header.
- First poll makes two requests: `?request=quick_user&key=TOKEN` to resolve the numeric user ID, then `?request=user&id=X&key=TOKEN` for full stats. Subsequent polls skip the first request and go directly to `request=user`.
- The currency field is called `gold` (not `bonusPoints` or `seedbonus`) — mapped to `seedbonus` in the dashboard.
- `stats.ratio` is a string (`"0.99699"`), not a number. The adapter handles the conversion.
- Seeding and leeching counts are paranoia-dependent and may return `null`.
- `freeleechTokens` is always `null` — GGn does not expose FL token counts via the API.

See the [GGn platform page](../tracker-responses-ggn.md) for full field mapping details.

## Slots

**Profile Card:** username · group · join date (GGn adapter provides joinedDate)

**Badges:** `warned`, `donor`, `disabled`, `ggn-parked`, `ggn-invites`, `ggn-irc`

**Stat Cards:** `gold`, `ggn-share-score-card`, `login-deadline` (loginIntervalDays: 60)

**Progress:** `ggn-achievement-progress`, `ggn-share-score-progress`, `ggn-buffs`
