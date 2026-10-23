# AnimeBytes (AB)

!!! Warning
    This tracker is marked **Unvalidated**: the adapter follows AnimeBytes' published API documentation but has not yet been tested against a real account.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Platform     | AnimeBytes                                   |
| Base URL     | `https://animebytes.tv`                      |
| API Endpoint | `https://animebytes.tv/api/stats/personal`   |
| Auth Method  | HTTP header: `Authorization: Bearer API_KEY` |

## Notes

AnimeBytes is not a stock Gazelle site: `/ajax.php` redirects to an HTML page. Its own API returns class, account upload/download, yen, active and potential H&Rs, and seeding/leeching counts. It does not return the username, so the credential form asks for it next to the API key.

## Slots

**Profile Card:** username · group (no avatar or join date, no enrichment)

**Badges:** `warned` (conditional, always `false` without enrichment)

**Stat Cards:** `seedbonus`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
