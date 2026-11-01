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

An existing AnimeBytes entry is polled with the AnimeBytes adapter, but its saved credential is a Gazelle token with no username, so its polls fail until the credential is replaced. Nothing migrates it automatically, because the username was never stored.

Open the tracker's settings, click **Change** under Credentials, and enter your username and API token. The new credential is tested before it saves. Saving doesn't resume polling, so if the tracker was paused, click **Resume Polling** on its page.

## Slots

**Profile Card:** username as entered in the credential form · group (no avatar, and a join date only if entered by hand)

**Badges:** none, because the API does not report `warned`

**Stat Cards:** `yen`, `login-deadline` (loginIntervalDays: 90)

**Progress:** none
