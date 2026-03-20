---
title: Platform Differences
description: Stat availability and behavior differences across UNIT3D, Gazelle, and GGn tracker platforms.
---

# Platform Differences

Tracker Tracker supports three tracker platforms: **UNIT3D**, **Gazelle**, and **GGn**. Each platform exposes different stats and uses a different authentication method. This page tells you what to expect when adding a tracker of each type.

---

## Authentication

How you authenticate with each platform's API depends on the platform type. In all cases, Tracker Tracker handles this for you — you just paste your API token when adding the tracker.

| Platform    | How the token is sent                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UNIT3D**  | Appended as a query parameter on every request (`?api_token=TOKEN`). HTTPS is required to prevent the token from being exposed in server logs.                         |
| **Gazelle** | Sent as an HTTP `Authorization` header (`Authorization: token TOKEN`). Some Gazelle forks accept the token without the `token ` prefix — Tracker Tracker handles both. |
| **GGn**     | Appended as a query parameter (`?key=TOKEN`), similar to UNIT3D but using a different parameter name.                                                                  |

---

## Stat Availability

The table below shows which stats Tracker Tracker can collect from each platform. A note in the cell means the stat is available but with caveats.

| Stat                      | UNIT3D                   | Gazelle                          | GGn                              |
| ------------------------- | ------------------------ | -------------------------------- | -------------------------------- |
| Upload / Download / Ratio | Yes                      | Yes                              | Yes                              |
| Buffer                    | Yes (tracker-calculated) | Approximate (calculated locally) | Approximate (calculated locally) |
| Seeding count             | Yes                      | Some forks only                  | Paranoia-dependent               |
| Leeching count            | Yes                      | Some forks only                  | Paranoia-dependent               |
| Seedbonus / Bonus Points  | Yes                      | Yes (most forks)                 | Yes (called "gold")              |
| Required Ratio            | No                       | Yes                              | Yes                              |
| Hit & Runs                | Yes                      | No                               | Partial (may be null)            |
| Freeleech Tokens          | No                       | Some forks only                  | No                               |
| Warned status             | No                       | Some sites only                  | Yes                              |
| Class / Rank              | Yes                      | Yes                              | Yes                              |
| Join date                 | No                       | Some sites only                  | Yes                              |
| Last access date          | No                       | Some sites only                  | Yes                              |
| Share Score               | No                       | No                               | Yes                              |
| Donor status              | No                       | Some sites only                  | Yes                              |
| Snatched count            | No                       | Some sites only                  | Yes                              |
| Community / rank data     | No                       | Some sites only                  | Yes                              |
| Upload / download buffs   | No                       | No                               | Yes                              |
| Avatar                    | No                       | Some sites only                  | No                               |

### Notes on specific cells

**Buffer (Gazelle and GGn):** The approximate buffer shown is your uploaded total minus your downloaded total. This tells you whether you are in surplus or deficit, but it does not account for your required ratio the way UNIT3D's server-calculated value does.

**Seeding / Leeching on GGn:** GGn's paranoia setting controls what information is visible on public profiles. The API responses for your own account are not affected — Tracker Tracker always polls as you, so seeding and leeching counts are available unless GGn changes how it reports them.

**Gazelle "some forks only":** The Gazelle codebase has been forked many times. Fields like seeding count, freeleech tokens, and extended profile data are not present on every site. See [Gazelle Fork Variations](#gazelle-fork-variations) below.

**Warned / Join date / Last access on Gazelle:** These require an extended profile call that not all Gazelle sites support. Tracker Tracker fetches it where available.

---

## GGn Polling

GGn requires two API calls per poll cycle instead of one. The first call fetches your username and user ID. The second call fetches all of your stats using that ID.

After the first successful poll, Tracker Tracker caches your GGn user ID. Subsequent polls go directly to the stats call, skipping the first step.

---

## Gazelle Fork Variations

The Gazelle codebase has been forked many times, and field names are not consistent across sites. Here is what Tracker Tracker knows about the sites it supports:

| Site                 | Seedbonus field | Freeleech Tokens | Seeding count in basic response |
| -------------------- | --------------- | ---------------- | ------------------------------- |
| Redacted (RED)       | `bonusPoints`   | Sometimes        | No                              |
| Orpheus (OPS)        | `bonusPoints`   | Sometimes        | No                              |
| BroadcasTheNet (BTN) | Varies          | No               | No                              |
| PassThePopcorn (PTP) | Varies          | No               | No                              |
| AnimeBytes (AB)      | Varies          | Varies           | No                              |

GGn is a Gazelle fork but uses its own dedicated adapter due to significant API differences. It is not interchangeable with the `gazelle` platform type.

---

## Platform-Specific Extras

Beyond the core stats, each platform surfaces additional information that Tracker Tracker stores and displays where relevant.

### Gazelle (extended profile)

When the extended profile call is available, Tracker Tracker also collects:

- Donor status
- Account enabled / paranoia level
- Community rank positions (upload, download, requests, posts, overall)
- Community activity totals (posts, comments, snatched, bounty, invites)
- Unread messages and notification counts
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
