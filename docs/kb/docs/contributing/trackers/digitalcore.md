# DigitalCore (DCC)

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Platform     | DigitalCore (custom)                           |
| Base URL     | `https://digitalcore.club`                     |
| API Endpoint | `https://digitalcore.club/api/v1/status`       |
| Auth Method  | Session cookies: `uid` and `pass`              |
| Enrichment   | Yes — second call to `/api/v1/users/:id`       |
| Auth Style   | N/A                                            |

## Notes

DigitalCore uses a custom API. The adapter makes two calls:

1. `GET /api/v1/status` — core stats (upload, download, class, bonus points, connectable, hit-and-runs)
2. `GET /api/v1/users/:id` — enrichment (join date, last access, peer counts, forum activity)

Credentials are the `uid` and `pass` **session cookies**, stored as a JSON blob
`{"uid": "...", "pass": "...", "userAgent": "..."}`. Users copy the cookies from
DevTools → Network → any request → the `Cookie` header; the UI captures
`userAgent` automatically from the browser doing the pasting, since that is the
browser the session was issued to.

`userAgent` is **optional**. Blobs saved before it existed contain only `uid` and
`pass`, still parse, and fall back to the app's default `tracker-tracker/<major>.<minor>`.
Both writers (`AddTrackerDialog` and `TrackerSettingsSheet`) must capture it: the
stored blob never reaches the client, so a writer that omits it silently reverts
the tracker to the default UA on the next credential change.

### API keys do not work for stats

DigitalCore also offers an API-key mechanism (`X-API-KEY`, `Authorization: Bearer`,
or `?apikey=`), but **normal API keys cannot reach any endpoint this app needs.**
Their documentation states that normal API-key access blocks "direct torrent
detail, comments, peers, snatchlog, **profile data**, mailbox, admin tools,
delete/edit actions, and request actions."

Verified against the live API — every user endpoint returns HTTP 403 with
`"This action (GET:...) is not allowed for API key access."`:

```
GET /api/v1/status     403
GET /api/v1/users/me   403
GET /api/v1/user       403
GET /api/v1/users      403
```

Normal keys are limited to `GET /api/v1/torrents`,
`GET /api/v1/torrents/download/{id}`, `POST /api/v1/torrents/upload`, and the
`moviedata` lookup routes.

**So the session-cookie flow is required, not a legacy choice.** Don't spend time
trying to replace it with an API key for a nicer setup experience — it cannot work
unless DigitalCore changes their key scopes.

### Mixed value conventions

The API mixes types within a single response: `connectable` is a number (`0`/`1`)
while `warned`, `enabled`, `donor` and `seedboxdonor` are strings. There is no
inferable rule, so never assume a field's type from a sibling — check a real
response before writing a coercion.

## Slots

**Profile Card:** username · class · avatar · join date (from enrichment)

**Badges:** `warned` · `dc-unconnectable` (rendered when `connectable !== false`
is falsy — note this badge id is our own label, not a field name in DigitalCore's
response)

**Stat Cards:** bonus points (`bonuspoang`) · hit-and-runs · seeding count ·
invites · peer counts (from enrichment)
