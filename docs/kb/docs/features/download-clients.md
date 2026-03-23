---
title: Download Clients
description: Connect qBittorrent to track per-tracker torrent stats, seeding counts, and live speeds.
---

# Download Clients

Tracker Tracker connects to qBittorrent's web interface to pull live torrent data. This powers the Torrents tab on the dashboard — showing active downloads and uploads, speeds, seeding counts, ratio histograms, and cross-seed stats.

## Supported Clients

| Client       | Status      |
| ------------ | ----------- |
| qBittorrent  | Supported   |
| Deluge       | Coming soon |
| Transmission | Coming soon |
| rTorrent     | Coming soon |

## Adding a Client

Go to **Settings → Download Clients** and fill in the connection details:

| Field    | Notes                                                       |
| -------- | ----------------------------------------------------------- |
| Name     | A label for this client                                     |
| Host     | Hostname or IP — do **not** include `http://` or `https://` |
| Port     | Default qBittorrent Web UI port is `8080`                   |
| Username | qBittorrent Web UI username                                 |
| Password | qBittorrent Web UI password                                 |
| Use SSL  | Enable if your qBittorrent Web UI is served over HTTPS      |

!!! warning "SSL/port mismatch"
The form will warn you if SSL is on with port 80, or SSL is off with port 443. These combinations are usually misconfigured. You can still save, but double-check your settings.

After saving, use the **Test Connection** button to confirm Tracker Tracker can reach and authenticate with qBittorrent.

## Linking Trackers to a Client

Each tracker can have a **qBittorrent tag** assigned to it. Set this tag to match the label you use in qBittorrent for that tracker's torrents.

When Tracker Tracker polls for torrent data, it fetches only torrents with the matching tag — so you get per-tracker stats rather than a combined total.

To assign a tag, open the tracker's settings page and fill in the qBittorrent tag field.

## How Polling Works

Tracker Tracker uses two separate polling loops:

=== "Live speed (every 30 seconds)"

    Fetches current upload/download speeds from qBittorrent. This is a single lightweight request. The result shows in the sidebar speed display and in the uptime tracker.

=== "Full torrent data (every 5 minutes)"

    Fetches the full torrent list for each configured tag, then aggregates per-tag stats: seeding count, leeching count, speeds. The result is saved as a snapshot.

    This loop also caches the torrent list so the Torrents tab has data to show even if qBittorrent is briefly unreachable.

Both loops reuse the existing session. qBittorrent only re-authenticates if the session expires (which shows up as a 403 response).

## Cross-Seed Detection

If you use [cross-seed](https://cross-seed.org/) to find matching torrents across trackers, you can configure cross-seed tags on the download client. Any torrent tagged with one of those tags is counted separately in the cross-seed stats on the Torrents tab — so you can see how many of your torrents are cross-seeded vs. original grabs.

Set the cross-seed tags in the client's settings after adding it. Common tags are `cross-seed` (the default from cross-seed) or category-based variants like `cs-link-movies`, `cs-link-tv`.

![Cross-seed ratio chart showing 741 cross-seeded vs 1307 unique](../assets/images/tracker-page-cross-seed-chart.png)

For more on setting up cross-seed itself, see the [cross-seed documentation](https://cross-seed.org/docs/basics/getting-started).

## Privacy: What Gets Stripped

Tracker Tracker deliberately removes certain fields from torrent data before caching or displaying it:

- Announce URLs (these contain your tracker passkey)
- File paths on disk

This applies everywhere — the dashboard, the cached torrent list, and any API response.

## Credential Security

Your qBittorrent username and password are encrypted at rest. They're decrypted in memory only when a poll is about to run, used for authentication, and never written to logs.

## Troubleshooting

| Error                                                      | Meaning                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED`                                             | qBittorrent is not running, or the port is wrong                                                  |
| `ENOTFOUND`                                                | The hostname couldn't be resolved — check for typos                                               |
| `ETIMEDOUT` / timed out after 15s                          | qBittorrent didn't respond in time — check that it's reachable from the Docker container          |
| `Authentication failed — check username and password`      | Wrong credentials                                                                                 |
| `Authentication failed — SID cookie not found in response` | Unexpected response from qBittorrent — check that the Web UI is enabled in qBittorrent's settings |

If the Test Connection button reports an error, it always forces a fresh login attempt — it won't reuse a cached session. So the error you see reflects the actual current state.
