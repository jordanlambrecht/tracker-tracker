# Tracker Tracker

Self-hosted dashboard for monitoring your private tracker stats over time.

## What is Tracker Tracker?

Tracker Tracker connects to your private tracker accounts and records your upload, download, ratio, buffer, seed count, and bonus points over time. It polls each tracker on a schedule, stores the results, and charts the trends.

Supports UNIT3D, Gazelle, GGn, Nebulance, MAM, and AvistaZ networks. Over 40 trackers come pre-configured.

## Quick Links

- [Installation guide](getting-started/installation.md): get running in a few minutes with Docker
- [Adding a tracker](trackers/adding-a-tracker.md): connect your first tracker
- [Troubleshooting](troubleshooting.md): something not working?

## Features

- Upload, download, ratio, buffer, rank, and bonus points for every tracker in one place
- Historical charts over days, weeks, and months
- qBittorrent, Transmission and rTorrent integration with per-tracker torrent details, seeding counts, cross-seed stats, and live speeds
- Tag groups that turn client tags into donut charts, bar charts, and treemaps
- Discord alerts when your ratio drops, a tracker goes down, you hit a buffer milestone, or your rank changes
