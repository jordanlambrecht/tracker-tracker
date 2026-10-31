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

### Migrating an AnimeBytes tracker added before this change

`platformType` is stored per row when a tracker is added, so an existing AnimeBytes entry keeps running the Gazelle adapter against `/ajax.php` after this update, and keeps failing the way it did before.

**Existing AnimeBytes users must delete and re-add the tracker.** There is no automatic migration: the Gazelle token and the new credential differ, and the username the new credential carries was never stored. Changing the credential from the tracker's settings does not work either. That row still gets the Gazelle token field, and the connection test, which now runs the AnimeBytes adapter, rejects a key sent without a username.

## Slots

**Profile Card:** username as entered in the credential form · group (no avatar, and a join date only if entered by hand)

**Badges:** none, because the API does not report `warned`

**Stat Cards:** `yen`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
