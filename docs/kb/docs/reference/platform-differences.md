---
title: Platform Differences
description: Stat availability and behavior differences across UNIT3D, Gazelle, and GGn tracker platforms.
---

# Platform Differences

Tracker Tracker works with UNIT3D, Gazelle, GGn, Nebulance and Anthelion, MAM (MyAnonaMouse), AvistaZ, BTN (BroadcasTheNet), AnimeBytes, C411, DigitalCore, FileList, HAWKE-UNO, IPTorrents, Luminance, RetroToon World, TorrentLeech, and TR4KER. Each has different stats and authentication methods.

---

## Authentication

Paste your token when you add a tracker. Tracker Tracker handles authentication.

| Platform    | How the token is sent                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UNIT3D**  | Appended as a query parameter on every request (`?api_token=TOKEN`). HTTPS is required to prevent the token from being exposed in server logs.                                                           |
| **Gazelle** | Sent as an HTTP `Authorization` header (`Authorization: token TOKEN`). Some Gazelle forks accept the token without the `token` prefix, and Tracker Tracker handles both.                                 |
| **GGn**     | Appended as a query parameter (`?key=TOKEN`), similar to UNIT3D but using a different parameter name.                                                                                                    |
| **MAM**     | Sent as a `Cookie: mam_id=VALUE` header. Uses a session cookie from MAM's Security Settings page, not a traditional API key. Session cookies rotate monthly.                                             |
| **AvistaZ** | Browser cookies (`cf_clearance` + session cookies) sent as a `Cookie` header, with the matching `User-Agent`. Uses HTML scraping instead of a JSON API. Cookies expire when Cloudflare clearance lapses. |
| **BTN**     | Sent as the first parameter of a JSON-RPC `userInfo` call (a `POST` to `api.broadcasthe.net`), not in a header or query parameter. |
| **AnimeBytes**            | Sent as an `Authorization: Bearer` header. The credential also holds your username, because the API does not report it. |
| **C411**                  | Sent as an `Authorization: Bearer` header. The key needs the "Profile (reading)" scope, which a new key does not get by default. |
| **HAWKE-UNO**             | Sent as an `Authorization: Bearer` header to `/api/profile`. |
| **Nebulance / Anthelion** | Sent as a query parameter on `api.php`. Nebulance names it `api_key` and Anthelion names it `apikey`. |
| **TR4KER**                | Sent as an `X-Api-Key` header. |
| **DigitalCore**           | Browser cookies (`uid` and `pass`), and optionally the browser's User-Agent. Reads JSON from `/api/v1/status`. |
| **FileList**              | Browser cookies (for example `uid` and `pass`) plus the exact User-Agent the session was issued to. FileList's passkey only covers its search API, so it gives no stats. Uses HTML scraping. |
| **IPTorrents**            | Browser cookies (for example `uid` and `pass`) plus the User-Agent they were issued to. Uses HTML scraping. |
| **Luminance**             | Your username and password. Tracker Tracker logs in for you. If the account uses two-factor login, paste the `sid` session cookie and its User-Agent instead. Uses HTML scraping. |
| **RetroToon World**       | Browser cookies (for example `PHPSESSID`) plus the User-Agent they were issued to. The `rt_` API key only uploads and the passkey only signs searches, so neither gives stats. Uses HTML scraping. |
| **TorrentLeech**          | Your username and password, plus the Alt 2FA Token if the account has 2FA. Tracker Tracker logs in and keeps the session. Uses HTML scraping. |

---

## Stat Availability

Notes in cells mean the stat exists but with limitations.

| Stat                      | UNIT3D                   | Gazelle                          | GGn                              | MAM                                 | AvistaZ                           | BTN |
| ------------------------- | ------------------------ | -------------------------------- | -------------------------------- | ----------------------------------- | --------------------------------- | --- |
| Upload / Download / Ratio | Yes                      | Yes                              | Yes                              | Yes (raw bytes + formatted strings) | Yes (HTML scraped, decimal units) | Yes (ratio calculated from bytes) |
| Buffer                    | Yes (tracker-calculated) | Approximate (calculated locally) | Approximate (calculated locally) | Approximate (calculated locally)    | Yes (tracker-calculated)          | Approximate (calculated locally) |
| Seeding count             | Yes                      | Some forks only                  | Paranoia-dependent               | Yes (sum of snatch_summary seeding) | Yes                               | No |
| Leeching count            | Yes                      | Some forks only                  | Paranoia-dependent               | Yes                                 | Yes                               | No |
| Seedbonus / Bonus Points  | Yes                      | Yes (most forks)                 | Yes (called "gold")              | Yes                                 | Yes                               | No |
| Required Ratio            | No                       | Yes                              | Yes                              | No                                  | No                                | No |
| Hit & Runs                | Yes                      | No                               | Partial (may be null)            | Yes (inactive unsatisfied HnRs)     | Yes                               | Partial (only when BTN sends it) |
| Freeleech Tokens          | No                       | Some forks only                  | No                               | Yes (called "wedges")               | No                                | No |
| Warned status             | No                       | Some sites only                  | Yes                              | No                                  | No                                | No |
| Class / Rank              | Yes                      | Yes                              | Yes                              | Yes                                 | Yes                               | Yes |
| Join date                 | No                       | Some sites only                  | Yes                              | No                                  | Yes                               | Partial (only when BTN sends it) |
| Last access date          | No                       | Some sites only                  | Yes                              | No                                  | Yes                               | No |
| Share Score               | No                       | No                               | Yes                              | No                                  | No                                | No |
| Donor status              | No                       | Some sites only                  | Yes                              | No (VIP status + expiry available)  | Yes                               | No |
| Snatched count            | No                       | Some sites only                  | Yes                              | Yes (via snatch_summary categories) | No                                | No |
| Community / rank data     | No                       | Some sites only                  | Yes                              | No                                  | No                                | No |
| Upload / download buffs   | No                       | No                               | Yes                              | No                                  | No                                | No |
| Avatar                    | No                       | Some sites only                  | No                               | No                                  | No                                | No |

### Notes on specific cells

**Buffer (Gazelle and GGn):** Approximate buffer = upload minus download. It shows surplus or deficit, but doesn't account for required ratio like UNIT3D's server-side calculation.

**Seeding / Leeching on GGn:** GGn's paranoia setting controls public profiles, but not your own account. Since Tracker Tracker polls as you, seeding and leeching counts work unless GGn changes them.

**Gazelle "some forks only":** The Gazelle codebase has many forks with varying field support. See [Gazelle Fork Variations](#gazelle-fork-variations).

**Warned / Join date / Last access on Gazelle:** These need an extended profile call that not all sites support. Tracker Tracker fetches them when available.

### Stat availability: token platforms

Same rows as above. "Yes" means Tracker Tracker reads it. "No" means the adapter does not return it.

| Stat                      | AnimeBytes | C411 | HAWKE-UNO | Nebulance / Anthelion | TR4KER |
| ------------------------- | ---------- | ---- | --------- | --------------------- | ------ |
| Upload / Download / Ratio | Yes (ratio calculated) | Yes (ratio calculated) | Yes (HAWKE's ratio, calculated if nothing is downloaded) | Yes (ratio calculated) | Yes (bonus added, ratio calculated) |
| Buffer                    | Approximate (calculated locally) | Approximate (calculated locally) | Yes (tracker-reported, can be negative) | Approximate (calculated locally) | Approximate (calculated locally) |
| Seeding count             | Yes | No | Yes | Yes | No |
| Leeching count            | Yes | No | Yes | No | No |
| Seedbonus / Bonus Points  | Yes | Yes | Yes (called "hunos") | Yes (called "orbs", Anthelion only) | Yes |
| Required Ratio            | No | No | No | No | No |
| Hit & Runs                | Yes (active) | No | Yes | Nebulance only | No |
| Freeleech Tokens          | No | No | No | No | No |
| Warned status             | No | No | No (a warning count is stored) | No | No |
| Class / Rank              | Yes | Yes (grade, such as "Gold 411") | Yes | Yes (class and subclass) | Yes |
| Join date                 | No | Yes | Yes | Yes | Yes |
| Last access date          | No | No | No | Yes | Yes |
| Avatar                    | No | Yes | No | No | Yes |

### Stat availability: cookie and login platforms

| Stat                      | DigitalCore | FileList | IPTorrents | Luminance | RetroToon World | TorrentLeech |
| ------------------------- | ----------- | -------- | ---------- | --------- | --------------- | ------------ |
| Upload / Download / Ratio | Yes (ratio calculated) | Yes (HTML scraped, ratio calculated) | Yes (HTML scraped, ratio calculated) | Yes (HTML scraped, ratio calculated) | Yes (HTML scraped, ratio calculated) | Yes (HTML scraped, ratio calculated) |
| Buffer                    | Approximate (calculated locally) | Approximate (calculated locally) | Approximate (calculated locally) | Approximate (calculated locally) | Approximate (calculated locally) | Approximate (calculated locally) |
| Seeding count             | Yes | Yes | Yes | Yes | Yes | Yes |
| Leeching count            | Yes | No | Yes | No | No | Yes |
| Seedbonus / Bonus Points  | Yes | Yes (called "FLCoins") | Yes | Yes (called "credits") | Yes | Yes (called "TL Points") |
| Required Ratio            | No | No | No | Yes | No | No |
| Hit & Runs                | Yes | No | No | No | Partial (0 when none are pending; a count isn't read) | Yes |
| Freeleech Tokens          | No | Yes | No | Yes | Yes | No |
| Warned status             | Yes | No | No | No | No | No |
| Class / Rank              | Yes | Yes | Yes | Yes | Yes | Yes |
| Join date                 | Yes | Yes | Yes | Yes | Yes | No |
| Last access date          | Yes | Yes | Yes | Yes | Yes | No |
| Avatar                    | Yes | No | No | No | No | No |

---

## GGn Polling

The first GGn poll makes two API calls: one to get your username and user ID, then one for stats. Tracker Tracker caches your user ID, so later polls skip straight to stats.

---

## Gazelle Fork Variations

Field names vary across Gazelle forks. Here's what Tracker Tracker tracks:

| Site                 | Seedbonus field | Freeleech Tokens | Seeding count in basic response |
| -------------------- | --------------- | ---------------- | ------------------------------- |
| Redacted (RED)       | `bonusPoints`   | Sometimes        | No                              |
| Orpheus (OPS)        | `bonusPoints`   | Sometimes        | No                              |
| PassThePopcorn (PTP) | Varies          | No               | No                              |

GGn is a Gazelle fork but uses its own dedicated adapter due to significant API differences. It is not interchangeable with the `gazelle` platform type. BTN is not a Gazelle fork at all. It has its own adapter and a JSON-RPC API (see [BroadcasTheNet](../contributing/trackers/broadcasthenet.md)).

---

## Platform-Specific Extras

Each platform offers extras beyond core stats. Tracker Tracker stores and displays them.

### Gazelle (extended profile)

When available, Tracker Tracker also fetches:

- Donor status
- Account enabled / paranoia level
- Community rank positions (upload, download, requests, posts, overall)
- Community activity totals (posts, comments, snatched, bounty, invites)
- Unread message and notification counts
- Gift tokens and merit tokens (some forks)

### GGn

GGn's full user profile includes:

- Donor status, parked flag, account enabled flag
- Number of available invites
- IRC presence
- Gold earned per hour from seeding
- Total and unique snatch counts
- Active multiplier buffs (such as upload, download, and forum posts)
- Achievement level, points, and progress toward next level

### MAM (MyAnonaMouse)

Tracker Tracker uses a single `/jsonLoad.php` endpoint with `?snatch_summary` that returns everything at once. Extras include:

- VIP status and expiry date
- Connectivity status (connectable/offline)
- Unsatisfied torrent count and limit (class-dependent: User=50, PU=100, VIP=150, above VIP=200)
- Detailed snatch summary breakdown (such as seeding satisfied, seeding HnR, and inactive satisfied)
- Tracker error count (important tracker errors)
- Recently deleted torrent count
- FL Wedge count (freeleech tokens)

**Authentication note:** MAM uses a `mam_id` session cookie, not an API key. Get it from **User Preferences → Security**. Cookies rotate monthly, so refresh periodically.

### BTN (BroadcasTheNet)

BTN makes one JSON-RPC `userInfo` call per poll. It returns upload, download, and class. Join date and hit & runs come back only when BTN sends them. BTN does not return seeding or leeching counts, a required ratio, or a warned flag, so Tracker Tracker shows those as unknown.

### AnimeBytes

One call to `/api/stats/personal`. Extras include:

- Potential H&R count
- Yen earn rate per hour and per day
- Raw upload and download, next to the account totals
- Snatched count, total seed size, and average seed time
- Torrents uploaded and pruned
- Personal freeleech expiry, when one is active

### C411

One call to `/api/user/profile`. Upload and download include purchased or gifted credit, the same way C411 counts them for your ratio. Tracker Tracker also stores whether downloads are allowed on your account.

### HAWKE-UNO

One call to `/api/profile`. Extras include:

- Warning count (a number, not a yes or no flag)
- Whether you can upload, download, request, and invite
- Seed divisions

### Nebulance and Anthelion

One call to `api.php`. Extras include snatched, grabbed, forum post, and invite counts. Anthelion sends orbs and no H&R count. Nebulance sends an H&R count and may leave orbs out.

### TR4KER

One call to `/api/me`. Your bonus upload and bonus download are added to your upload and download, because TR4KER counts them toward ratio. Class names show as the site writes them, in French.

### DigitalCore

Two calls. `/api/v1/status` gives the core stats. `/api/v1/users/<id>` adds join date, last access, and leeching count, and its warned flag replaces the one from the first call. If the second call fails, Tracker Tracker keeps the core stats, and join date, last access, and leeching count stay unknown. Extras include:

- Donor and seedbox donor status
- Parked and enabled flags
- Invite and invitee counts
- Leech bonus
- H&R count and H&R warned flag
- Download and upload bans
- Connectable status
- Torrent, request, forum post, and comment counts
- Real upload and download
- Hearts, plus the crown, skull, pokal, and coin flags

### FileList

Reads `userdetails.php`. Seed bonus is the FLCoins figure from the header. Extras include invites, reputation, and total seed size.

### IPTorrents

Reads the stats bar and your profile page. The class badge and the dates come from your own profile page only.

### Luminance (Cathode-Ray.Tube)

Reads your profile page. Of the platforms in this section, it is the only one that returns a required ratio.

### RetroToon World

Three pages. The profile gives the core stats, `bonus.php` gives the seeding count, and `myhr.php` shows whether any H&R are pending. Tracker Tracker stores 0 when the page says none are pending and does not read a count, so H&R is otherwise unknown. If the H&R page fails, the rest of the stats are kept. Extras include forum post and torrent comment counts, bonus earn rate per hour, and H&R cleanup tokens.

### TorrentLeech

Reads the top bar and profile page. Seeding, leeching, and H&R counts come from the top bar, and bonus points are the TL Points figure.

### AvistaZ Network

AvistaZ uses HTML scraping instead of a JSON API. The profile page provides:

- Donor status and VIP expiry date
- Invite count
- Account permission flags (can download, can upload)
- Total upload and download torrent counts
- Reseed request count
- Two-factor authentication status
- Bonus point earning rate per hour (from the bonus page, enrichment call)

**Authentication note:** AvistaZ uses browser cookies, not an API key. Paste your cookies (include Cloudflare `cf_clearance`), and Tracker Tracker captures the User-Agent automatically. Refresh when Cloudflare clearance expires.

**Sites in the network:** AvistaZ, AnimeZ, PrivateHD, CinemaZ, and ExoticaZ all share the same platform and HTML structure.

**Minimum rank:** Newbie accounts have restricted profiles. You need **Member** rank or above (5 GB upload, ratio ≥ 1.0, 7+ days old) to use the adapter.
