---
title: Platform Differences
description: Stat availability and behavior differences across UNIT3D, Gazelle, and GGn tracker platforms.
---

# Platform Differences

Tracker Tracker works with **UNIT3D**, **Gazelle**, **GGn**, **Nebulance**, **MAM** (MyAnonaMouse), and **AvistaZ**. Each has different stats and authentication methods.

---

## Authentication

Tracker Tracker handles auth behind the scenes — just paste your token when adding a tracker.

| Platform    | How the token is sent                                                                                                                                                                                    |
|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **UNIT3D**  | Appended as a query parameter on every request (`?api_token=TOKEN`). HTTPS is required to prevent the token from being exposed in server logs.                                                           |
| **Gazelle** | Sent as an HTTP `Authorization` header (`Authorization: token TOKEN`). Some Gazelle forks accept the token without the `token` prefix — Tracker Tracker handles both.                                    |
| **GGn**     | Appended as a query parameter (`?key=TOKEN`), similar to UNIT3D but using a different parameter name.                                                                                                    |
| **MAM**     | Sent as a `Cookie: mam_id=VALUE` header. Uses a session cookie from MAM's Security Settings page, not a traditional API key. Session cookies rotate monthly.                                             |
| **AvistaZ** | Browser cookies (`cf_clearance` + session cookies) sent as a `Cookie` header, with the matching `User-Agent`. Uses HTML scraping instead of a JSON API. Cookies expire when Cloudflare clearance lapses. |

---

## Stat Availability

Notes in cells mean the stat exists but with limitations.

| Stat                      | UNIT3D                   | Gazelle                          | GGn                              | MAM                                 | AvistaZ                           |
|---------------------------|--------------------------|----------------------------------|----------------------------------|-------------------------------------|-----------------------------------|
| Upload / Download / Ratio | Yes                      | Yes                              | Yes                              | Yes (raw bytes + formatted strings) | Yes (HTML scraped, decimal units) |
| Buffer                    | Yes (tracker-calculated) | Approximate (calculated locally) | Approximate (calculated locally) | Approximate (calculated locally)    | Yes (tracker-calculated)          |
| Seeding count             | Yes                      | Some forks only                  | Paranoia-dependent               | Yes (sum of snatch_summary seeding) | Yes                               |
| Leeching count            | Yes                      | Some forks only                  | Paranoia-dependent               | Yes                                 | Yes                               |
| Seedbonus / Bonus Points  | Yes                      | Yes (most forks)                 | Yes (called "gold")              | Yes                                 | Yes                               |
| Required Ratio            | No                       | Yes                              | Yes                              | No                                  | No                                |
| Hit & Runs                | Yes                      | No                               | Partial (may be null)            | Yes (inactive unsatisfied HnRs)     | Yes                               |
| Freeleech Tokens          | No                       | Some forks only                  | No                               | Yes (called "wedges")               | No                                |
| Warned status             | No                       | Some sites only                  | Yes                              | No                                  | No                                |
| Class / Rank              | Yes                      | Yes                              | Yes                              | Yes                                 | Yes                               |
| Join date                 | No                       | Some sites only                  | Yes                              | No                                  | Yes                               |
| Last access date          | No                       | Some sites only                  | Yes                              | No                                  | Yes                               |
| Share Score               | No                       | No                               | Yes                              | No                                  | No                                |
| Donor status              | No                       | Some sites only                  | Yes                              | No (VIP status + expiry available)  | Yes                               |
| Snatched count            | No                       | Some sites only                  | Yes                              | Yes (via snatch_summary categories) | No                                |
| Community / rank data     | No                       | Some sites only                  | Yes                              | No                                  | No                                |
| Upload / download buffs   | No                       | No                               | Yes                              | No                                  | No                                |
| Avatar                    | No                       | Some sites only                  | No                               | No                                  | No                                |

### Notes on specific cells

**Buffer (Gazelle and GGn):** Approximate buffer = upload minus download. It shows surplus or deficit, but doesn't account for required ratio like UNIT3D's server-side calculation.

**Seeding / Leeching on GGn:** GGn's paranoia setting controls public profiles, but not your own account. Since we poll as you, seeding and leeching counts work unless GGn changes them.

**Gazelle "some forks only":** The Gazelle codebase has many forks with varying field support. See [Gazelle Fork Variations](#gazelle-fork-variations).

**Warned / Join date / Last access on Gazelle:** These need an extended profile call that not all sites support. We fetch them when available.

---

## GGn Polling

GGn requires two API calls per poll: one to get your username and user ID, then one for stats.

We cache your user ID after the first poll, so later polls skip straight to stats.

---

## Gazelle Fork Variations

Field names vary across Gazelle forks. Here's what we track:

| Site                 | Seedbonus field | Freeleech Tokens | Seeding count in basic response |
|----------------------|-----------------|------------------|---------------------------------|
| Redacted (RED)       | `bonusPoints`   | Sometimes        | No                              |
| Orpheus (OPS)        | `bonusPoints`   | Sometimes        | No                              |
| BroadcasTheNet (BTN) | Varies          | No               | No                              |
| PassThePopcorn (PTP) | Varies          | No               | No                              |
| AnimeBytes (AB)      | Varies          | Varies           | No                              |

GGn is a Gazelle fork but uses its own dedicated adapter due to significant API differences. It is not interchangeable with the `gazelle` platform type.

---

## Platform-Specific Extras

Each platform offers extras beyond core stats that we store and display.

### Gazelle (extended profile)

When available, we also fetch:

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
- Active multiplier buffs (upload, download, forum posts, etc.)
- Achievement level, points, and progress toward next level

### MAM (MyAnonaMouse)

We use a single `/jsonLoad.php` endpoint with `?snatch_summary` that returns everything at once. Extras include:

- VIP status and expiry date
- Connectivity status (connectable/offline)
- Unsatisfied torrent count and limit (class-dependent: User=50, PU=100, VIP=150, above VIP=200)
- Detailed snatch summary breakdown (seeding satisfied, seeding HnR, inactive satisfied, etc.)
- Tracker error count (important tracker errors)
- Recently deleted torrent count
- FL Wedge count (freeleech tokens)

**Authentication note:** MAM uses a `mam_id` session cookie, not an API key. Get it from **User Preferences → Security**. Cookies rotate monthly, so refresh periodically.

### AvistaZ Network

AvistaZ uses HTML scraping instead of a JSON API. The profile page provides:

- Donor status and VIP expiry date
- Invite count
- Account permission flags (can download, can upload)
- Total upload and download torrent counts
- Reseed request count
- Two-factor authentication status
- Bonus point earning rate per hour (from the bonus page, enrichment call)

**Authentication note:** AvistaZ uses browser cookies, not an API key. Paste your cookies (include Cloudflare `cf_clearance`), and we capture the User-Agent automatically. Refresh when Cloudflare clearance expires.

**Sites in the network:** AvistaZ, AnimeZ, PrivateHD, CinemaZ, ExoticaZ — all share the same platform and HTML structure.

**Minimum rank:** Newbie accounts have restricted profiles. You need **Member** rank or above (5 GB upload, ratio ≥ 1.0, 7+ days old) to use the adapter.
