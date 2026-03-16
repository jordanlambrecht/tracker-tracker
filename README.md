![CI](https://github.com/jordanlambrecht/tracker-tracker/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/github/package-json/v/jordanlambrecht/tracker-tracker)
![Self-Hosted](https://img.shields.io/badge/self--hosted-Docker-2496ed)

<p align="center">
  <img src="public/img/trackerTracker_logo.svg" alt="Tracker Tracker" width="400" />
</p>

Self-hosted dashboard for monitoring private tracker stats over time. Track upload, download, ratio, buffer, seedbonus, and rank across all your trackers from one place.

## Features

- Per-tracker and fleet-wide stats with 30+ charts
- UNIT3D, Gazelle, GGn, and Nebulance support out of the box
- qBittorrent integration — cross-seed tracking, activity heatmaps, speed history
- Configurable polling intervals, snapshot retention, and scheduled backups
- Everything stays on your machine. No telemetry, no phoning home.

## Screenshots

<p align="center">
  <img src="docs/trackerTracker_screenshot_dashboard.png" alt="Tracker Tracker Dashboard" width="1080" />
</p>

<p align="center">
  <img src="docs/trackerTracker_screenshot_trackerPage.png" alt="Tracker Tracker Dashboard" width="1080" />
</p>

## Supported Trackers

| Tracker               | Platform  | Status                 | Note                                              |
| --------------------- | --------- | ---------------------- | ------------------------------------------------- |
| Aither                | UNIT3D    | ✅ Verified            |                                                   |
| Anthelion             | Nebulance | ✅ Verified            |                                                   |
| Blutopia              | UNIT3D    | ✅ Verified            |                                                   |
| Concertos             | UNIT3D    | ✅ Verified            |                                                   |
| FearNoPeer            | UNIT3D    | ✅ Verified            |                                                   |
| GazelleGames (GGn)    | GGn       | ✅ Verified            |                                                   |
| LST                   | UNIT3D    | ✅ Verified            |                                                   |
| Nebulance             | Nebulance | ✅ Verified            |                                                   |
| OldToons              | UNIT3D    | ✅ Verified            |                                                   |
| OnlyEncodes           | UNIT3D    | ✅ Verified            |                                                   |
| Orpheus (OPS)         | Gazelle   | ✅ Verified            |                                                   |
| Phoenix Project (PP)  | Gazelle   | ✅ Verified            |                                                   |
| Racing4Everyone       | UNIT3D    | ✅ Verified            |                                                   |
| Redacted (RED)        | Gazelle   | ✅ Verified            |                                                   |
| ReelFlix              | UNIT3D    | ✅ Verified            |                                                   |
| SkipTheCommercials    | UNIT3D    | ✅ Verified            |                                                   |
| Upload.cx             | UNIT3D    | ✅ Verified            |                                                   |
| AlphaRatio            | Gazelle   | 🟡 Unverified ⛔ Stuck |                                                   |
| AnimeBytes            | Gazelle   | 🟡 Unverified ⛔ Stuck |                                                   |
| BroadcastheNet (BTN)  | Gazelle   | 🟡 Unverified ⛔ Stuck |                                                   |
| Empornium             | Gazelle   | 🟡 Unverified ⛔ Stuck | XXX trackers aren't really my jam, so PRs welcome |
| GreatPosterWall (GPW) | Gazelle   | 🟡 Unverified          |                                                   |
| MoreThanTV (MTV)      | Gazelle   | 🟡 Unverified          |                                                   |
| PassThePopcorn (PTP)  | Gazelle   | 🟡 Unverified          |                                                   |
| 720pier               | Custom    | 📋 Needs adapter       |                                                   |
| ABTorrents            | Custom    | 📋 Needs adapter       |                                                   |
| AvistaZ               | Custom    | 📋 Needs adapter       |                                                   |
| CathodeRayTube (CRT)  | UNIT3D    | 📋 Draft               |                                                   |
| CinemaZ               | Custom    | 📋 Needs adapter       |                                                   |
| HDBits                | Custom    | 📋 Needs adapter       |                                                   |
| MyAnonamouse (MAM)    | Custom    | 📋 Needs adapter       |                                                   |
| SecretCinema          | Custom    | 📋 Needs adapter       |                                                   |
| SportsCult            | Custom    | 📋 Needs adapter       |                                                   |
| TorrentLeech          | Custom    | 📋 Needs adapter       |                                                   |
| BeyondHD              | Custom    | ⛔ Stuck               |                                                   |
| Cinemageddon          | Custom    | ⛔ Stuck               |                                                   |
| ExotikaZ              | Custom    | ⛔ Stuck               |                                                   |
| FileList              | Custom    | ⛔ Stuck               |                                                   |
| HD-Torrents           | Custom    | ⛔ Stuck               |                                                   |
| IPTorrents            | Custom    | ⛔ Stuck               |                                                   |
| PrivateHD             | Custom    | ⛔ Stuck               |                                                   |
| TVVault               | Custom    | ⛔ Stuck               |                                                   |
| HawkeUno              | UNIT3D    | ❌ Broken              | API does not permit /user requests                |

**Legend:**

- ✅ **Verified** — tested against a live tracker
- 🟡 **Unverified** — platform adapter exists and _should_ work, but not yet tested.
- 📋 **Needs adapter** — registry entry exists, but the platform requires a custom adapter that I haven't gotten around to yet
- ⛔ **Stuck** — trackers I'm not a member of and have no way of implementing
- ❌ **Broken** — known issue prevents polling (i.e API blocks required endpoints, etc)

## Download Clients

| Client       | Status       | Notes                                                                |
| ------------ | ------------ | -------------------------------------------------------------------- |
| qBittorrent  | ✅ Supported | Torrent stats, cross-seed tracking, activity heatmaps, speed history |
| Deluge       | 📋 Planned   |                                                                      |
| Transmission | 📋 Planned   |                                                                      |
| rTorrent     | 📋 Planned   |                                                                      |

## Quick Start

### Docker (recommended)

```bash
mkdir tracker-tracker && cd tracker-tracker
```

1. Download the compose file and example env:

   ```bash
   curl -LO https://raw.githubusercontent.com/jordanlambrecht/tracker-tracker/main/docker-compose.yml
   curl -L https://raw.githubusercontent.com/jordanlambrecht/tracker-tracker/main/.env.example -o .env
   ```

2. Generate secrets and paste them into `.env`:

   ```bash
   # Run these, then copy the output into .env
   openssl rand -base64 24   # → POSTGRES_PASSWORD
   openssl rand -base64 48   # → SESSION_SECRET
   ```

3. Start the stack:

   ```bash
   docker compose up -d
   ```

4. Visit `http://localhost:3000` to set your master password and start adding trackers.

### Updating

```bash
docker compose pull && docker compose up -d
```

The database schema is synced automatically on startup.

### Using an external database

If you already run Postgres, remove the `tracker-tracker-db` service and `depends_on` block from `docker-compose.yml`. Set `DATABASE_URL` in your `.env` and remove `POSTGRES_PASSWORD` and `POSTGRES_USER`.

### Local Development

Requires Node.js 24+, pnpm, and PostgreSQL.

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL to your local Postgres and SESSION_SECRET
pnpm db:push
pnpm dev
```

## Configuration

| Variable            | Required | Default           | Description                                         |
| ------------------- | -------- | ----------------- | --------------------------------------------------- |
| `POSTGRES_PASSWORD` | Yes\*    | —                 | Database password                                   |
| `SESSION_SECRET`    | Yes      | —                 | AES-256 key for session cookies (min 32 characters) |
| `TZ`                | No       | `UTC`             | Timezone for cron schedules and log timestamps      |
| `PORT`              | No       | `3000`            | Port the app listens on                             |
| `LOG_LEVEL`         | No       | `info`            | Log verbosity: `error`, `warn`, `info`, `debug`     |
| `POSTGRES_USER`     | No       | `postgres`        | Database user                                       |
| `POSTGRES_DB`       | No       | `tracker_tracker` | Database name                                       |
| `DATABASE_URL`      | No\*     | _(auto-built)_    | Override to use an external Postgres instance       |

\* Set either `POSTGRES_PASSWORD` (bundled DB) or `DATABASE_URL` (external DB).

All other settings — polling interval, privacy mode, proxy, backups — are configured in the app's Settings page after login.

## Data & Volumes

| Host path        | Container path  | Contents                                |
| ---------------- | --------------- | --------------------------------------- |
| `./data/backups` | `/data/backups` | Scheduled backup files                  |
| `./data/logs`    | `/data/logs`    | Application log files                   |
| `pgdata` (named) | PG data dir     | PostgreSQL database (managed by Docker) |

## Architecture

- **Next.js 16** (App Router) — server components + API routes
- **PostgreSQL** + **Drizzle ORM** — schema-first, no raw SQL migrations
- **ECharts** — interactive time-series charts
- **node-cron** — background polling scheduler
- **Argon2** — master password hashing
- **jose** — JWE session tokens (AES-256-GCM)

## Adding a Tracker

1. Click **+ Add Tracker** in the sidebar
2. Select from the registry or enter details manually
3. Paste your API token (found in your tracker's security/API settings)
4. The app validates the connection and starts polling automatically

## Contributing

PRs welcome. Areas where help matters most:

- **New trackers & missing data** — copy [`src/data/trackers/_template.ts`](src/data/trackers/_template.ts), fill in what you know, and submit a PR. Partial entries are fine — set `draft: true` and CI will accept it. Filling in user classes, rules, release groups, and banned groups on existing trackers is just as valuable.
- **Download client adapters** — only qBittorrent is supported. Deluge, Transmission, and rTorrent all need adapters. See `src/lib/qbt/` for the pattern.
- **Tracker verification** — if you belong to a tracker marked 🟡 above, testing and confirming it works helps greatly.
- **Security auditing** — Check out SECURITY.md for threat surfice info.
- **Responsiveness** – I only have my 16" MBP to work off of, so feedback of different screen experiences is much appreciated
- **Data Visualization** – I ain't no math wizard, so any contributions for data viz, charts/graphs, etc.
- **Custom platform adapters** — trackers marked "Custom" need bespoke adapters since they don't run UNIT3D or Gazelle.
- **HawkeUno lobbying** — convince the Hawke mods to add a `/users` endpoint so the adapter can work

## License

[GPL-3.0](LICENSE)
