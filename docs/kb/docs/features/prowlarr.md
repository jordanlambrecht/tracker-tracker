---
title: Prowlarr
description: Show the status of each tracker's indexer in one or more Prowlarr instances.
---

# Prowlarr

Tracker Tracker can read indexer status from one or more [Prowlarr](https://prowlarr.com) instances and show it next to each matching tracker. Apart from the indexer test that **Resume** runs, only read requests are made, and Prowlarr's settings are never changed.

## Adding an Instance

Go to **Settings → General → Prowlarr** and fill in:

| Field   | Notes                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Name    | A label for this instance                                                                               |
| URL     | The address Tracker Tracker can reach Prowlarr on, including any URL base, like `http://localhost:9696` |
| API key | Prowlarr → **Settings → General → Security**. Stored encrypted, and included in backups like other keys |

Use **Test Connection** to confirm the URL and key. Add another instance the same way, for example one that reaches some trackers through a different network.

Each enabled instance's indexer status is read every five minutes and its 24-hour indexer stats every hour. The indexer list and the 7-day stats are read when an instance is saved and every six hours: Prowlarr returns each indexer's site credentials with the list, and loads a week of history to count the 7-day stats. An indexer added in Prowlarr shows up after the next list read; save the instance to read it at once.

## Matching Trackers to Indexers

Trackers are matched to indexers by hostname: the tracker's URL and its registry URL are compared with each indexer's base URL, alternate URLs and legacy URLs, ignoring a leading `www.`. When no hostname matches exactly, the registrable domain is compared, so `example.org` still matches `tracker.example.org`.

When the hosts differ, open the tracker's settings and pick the indexer under **Prowlarr Indexer**. Pick **None** to keep a tracker out of it. Removing an instance sends the trackers you assigned to it back to hostname matching.

## What Is Shown

The tracker's page gets a card for each matched indexer, beside the TrackerHub card and laid out the same way. Its header shows the indexer's status, collapses the details below it, and links to that Prowlarr's indexer list, its home page. The link uses the instance's URL, so it opens only if your browser can reach that address too, which a Docker container name usually is not. The status is one of:

| Status         | Meaning                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------- |
| OK             | Prowlarr is not backing the indexer off                                                     |
| Failing        | Prowlarr backed the indexer off after failed requests; shows since when and when it retries |
| Disabled       | The indexer is disabled in Prowlarr                                                         |
| Prowlarr error | Prowlarr could not be read, for example a rejected API key or a wrong URL base              |
| No recent data | No reading for over 30 minutes, usually because polling has stopped                         |

Below the header the card shows Prowlarr's own counters for the last 24 hours and 7 days: queries (searches, RSS and auth requests), grabs, the share of all requests including grabs that failed, and average response time. Stats that could not be read for two refresh intervals, two hours for the 24-hour stats and twelve for the 7-day stats, are left out and the card says when they were last read.

The dashboard lists failing indexers, and each Prowlarr instance that cannot be read, in a short line below the alerts. Nothing is shown there while everything is fine.

Prowlarr lists an indexer as backed off only until the backoff ends, so the first reading after that shows **OK** whether or not Prowlarr has retried it yet.

## Resume

A failing indexer's row has a **Resume** button that runs Prowlarr's test for that indexer, the same as testing it in Prowlarr:

- A passing test clears the backoff, so Prowlarr searches the indexer again immediately.
- A failed test shows Prowlarr's reason under the button, and Prowlarr extends the backoff.
- Prowlarr counts a test that hits the site's request limit as passed, which also clears the backoff.
- Each test is a search on the site with your account, so one indexer can be tested once a minute from here.

URLs in Prowlarr's messages are cut down to their host, since some indexers carry an API key in the URL.

## Marking Trackers

By default Prowlarr's status does not change a tracker's health. Prowlarr reports a backoff without its cause, so stale credentials in Prowlarr, a problem with Prowlarr's own proxy or FlareSolverr, and a real tracker outage all look the same.

Turn on **Mark trackers with a failing indexer** on an instance to have its failing indexers turn an otherwise healthy tracker amber, with the **Indexer Failing** status in the sidebar, on the dashboard and on the tracker's page. A tracker that is erroring, paused, offline, without seeds or below its required ratio keeps that status.
