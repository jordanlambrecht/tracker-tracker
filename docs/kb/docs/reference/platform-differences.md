---
title: Platform Differences
description: Stat availability and behavior differences across UNIT3D, Gazelle, and GGn tracker platforms.
---

# Platform Differences

Tracker Tracker works with UNIT3D, Gazelle, GGn, Nebulance, MAM (MyAnonaMouse), AvistaZ, and BTN (BroadcasTheNet). Each has different stats and authentication methods.

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
