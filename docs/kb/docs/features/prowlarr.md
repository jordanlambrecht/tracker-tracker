---
title: Prowlarr
description: Read indexer health from Prowlarr and flag trackers whose indexer is failing.
---

# Prowlarr

Tracker Tracker can read indexer health from one or more [Prowlarr](https://prowlarr.com) instances. When a tracker's indexer starts failing in Prowlarr, the tracker shows a warning, and the dashboard gets a Prowlarr card with each matched tracker's status and traffic.

Apart from the indexer test that **Resume** runs, only read requests are made. Prowlarr's settings are never changed.

## Adding an Instance

Go to **Settings → Prowlarr** and fill in:

| Field   | Notes                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Name    | A label for this instance                                                                               |
| URL     | The address Tracker Tracker can reach Prowlarr on, including any URL base, like `http://localhost:9696` |
| API key | Prowlarr → **Settings → General → Security**. Stored encrypted, and included in backups like other keys |

Use **Test Connection** to confirm the URL and key. Each enabled instance is polled every five minutes. Add a second instance the same way.

## Matching Trackers to Indexers

Trackers are matched to indexers by hostname: the tracker's URL and its registry URL are compared with each indexer's base URL, alternate URLs and legacy URLs, ignoring a leading `www.`. When no hostname matches exactly, the registrable domain is compared, so `example.org` still matches `tracker.example.org`.

When the hosts differ, open the tracker's settings and pick the indexer under **Prowlarr Indexer**. Pick **None** to keep a tracker out of it.

## What Counts as Failing

Prowlarr backs an indexer off after failed requests and retries it later. While it is backed off, the tracker:

- shows the amber warning dot in the sidebar, on the dashboard and on its page
- gets an **Indexer Failing** banner with when it started failing and when Prowlarr retries
- shows **Failing** on its Prowlarr card

The banner's **Resume** button runs Prowlarr's test for that indexer. A passing test clears the backoff, so the indexer is searched again immediately; a failed test shows Prowlarr's validation message under the banner.

The warning never hides a worse state. A tracker that is erroring, paused, offline or below its required ratio keeps that status.

If Prowlarr itself cannot be reached, the dashboard card shows the error and the trackers' statuses are unchanged. A Prowlarr outage is never shown as the tracker failing, and it does not affect tracker polling.

## Stats

Both cards show Prowlarr's own counters: queries (searches, RSS and auth requests), grabs, the share of requests that failed, and average response time. The dashboard card covers the last 24 hours, and the tracker's card adds the last 7 days.
