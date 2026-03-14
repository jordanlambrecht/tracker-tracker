<p align="center">
  <img src="public/img/trackerTracker_logo.svg" alt="Tracker Tracker" width="200" />
</p>

<h1 align="center">Tracker Tracker</h1>

![CI](https://github.com/jordanlambrecht/tracker-tracker/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/github/package-json/v/jordanlambrecht/tracker-tracker)
![License](https://img.shields.io/github/license/jordanlambrecht/tracker-tracker)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![Self-Hosted](https://img.shields.io/badge/self--hosted-Docker-2496ed)

Self-hosted dashboard for monitoring private tracker stats over time. One place for upload, download, ratio, buffer, seedbonus, and rank data across all your trackers.

## Features

- Centralized, self-hosted dashboard for all your private trackers
- Periodic collection of upload, download, ratio, buffer, seedbonus, and rank
- Per-tracker and aggregated views of your stats over time
- Historical charts to visualize progress and detect trends
- Pluggable tracker adapters to support multiple tracker platforms
## Supported Trackers

| Tracker               | Platform  | Status                 | Note                                                |
|-----------------------|-----------|----------------------- |-----------------------------------------------------|
| Aither                | UNIT3D    | ✅ Verified            |                                                     |
| Anthelion             | Nebulance | ✅ Verified            |                                                     |
| Blutopia              | UNIT3D    | ✅ Verified            |                                                     |
| Concertos             | UNIT3D    | ✅ Verified            |                                                     |
| FearNoPeer            | UNIT3D    | ✅ Verified            |                                                     |
| GazelleGames (GGn)    | GGn       | ✅ Verified            |                                                     |
| LST                   | UNIT3D    | ✅ Verified            |                                                     |
| Nebulance             | Nebulance | ✅ Verified            |                                                     |
| OldToons              | UNIT3D    | ✅ Verified            |                                                     |
| OnlyEncodes           | UNIT3D    | ✅ Verified            |                                                     |
| Orpheus (OPS)         | Gazelle   | ✅ Verified            |                                                     |
| Phoenix Project (PP)  | Gazelle   | ✅ Verified            |                                                     |
| Racing4Everyone       | UNIT3D    | ✅ Verified            |                                                     |
| Redacted (RED)        | Gazelle   | ✅ Verified            |                                                     |
| ReelFlix              | UNIT3D    | ✅ Verified            |                                                     |
| SkipTheCommercials    | UNIT3D    | ✅ Verified            |                                                     |
| Upload.cx             | UNIT3D    | ✅ Verified            |                                                     |
| AlphaRatio            | Gazelle   | 🟡 Unverified ⛔ Stuck |                                                     |
| AnimeBytes            | Gazelle   | 🟡 Unverified ⛔ Stuck |                                                     |
| BroadcastheNet (BTN)  | Gazelle   | 🟡 Unverified ⛔ Stuck |                                                     |
| Empornium             | Gazelle   | 🟡 Unverified ⛔ Stuck | XXX trackers aren't really my jam, so PRs welcome   |
| GreatPosterWall (GPW) | Gazelle   | 🟡 Unverified          |                                                     |
| MoreThanTV (MTV)      | Gazelle   | 🟡 Unverified          |                                                     |
| PassThePopcorn (PTP)  | Gazelle   | 🟡 Unverified          |                                                     |
| 720pier               | Custom    | 📋 Needs adapter       |                                                     |
| ABTorrents            | Custom    | 📋 Needs adapter       |                                                     |
| AvistaZ               | Custom    | 📋 Needs adapter       |                                                     |
| CathodeRayTube (CRT)  | UNIT3D    | 📋 Draft               |                                                     |
| CinemaZ               | Custom    | 📋 Needs adapter       |                                                     |
| HDBits                | Custom    | 📋 Needs adapter       |                                                     |
| MyAnonamouse (MAM)    | Custom    | 📋 Needs adapter       |                                                     |
| SecretCinema          | Custom    | 📋 Needs adapter       |                                                     |
| SportsCult            | Custom    | 📋 Needs adapter       |                                                     |
| TorrentLeech          | Custom    | 📋 Needs adapter       |                                                     |
| BeyondHD              | Custom    | ⛔ Stuck               |                                                     |
| Cinemageddon          | Custom    | ⛔ Stuck               |                                                     |
| ExotikaZ              | Custom    | ⛔ Stuck               |                                                     |
| FileList              | Custom    | ⛔ Stuck               |                                                     |
| HD-Torrents           | Custom    | ⛔ Stuck               |                                                     |
| IPTorrents            | Custom    | ⛔ Stuck               |                                                     |
| PrivateHD             | Custom    | ⛔ Stuck               |                                                     |
| TVVault               | Custom    | ⛔ Stuck               |                                                     |
| HawkeUno              | UNIT3D    | ❌ Broken              | API does not permit /user requests                  |

**Legend:**

- ✅ **Verified** — tested against a live tracker
- 🟡 **Unverified** — platform adapter exists and *should* work, but not yet tested.
- 📋 **Needs adapter** — registry entry exists, but the platform requires a custom adapter that I haven't gotten around to yet
- ⛔ **Stuck** - These are trackers I'm not a member of and have no way of implementing
- ❌ **Broken** — known issue prevents polling (i.e API blocks required endpoints, etc)

## Download Clients

| Client       | Status       | Notes                                                                |
|--------------|------------- |----------------------------------------------------------------------|
| qBittorrent  | ✅ Supported | Torrent stats, cross-seed tracking, activity heatmaps, speed history  |
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

2. Generate a session secret and a database password:

    ```bash
    echo "SESSION_SECRET=$(openssl rand -base64 48)"
    echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
    ```

3. Edit `.env` with the generated values. Make sure the password in `DATABASE_URL` matches `POSTGRES_PASSWORD`:

    ```env
    DATABASE_URL=postgresql://postgres:your-password-here@db:5432/tracker_tracker
    POSTGRES_PASSWORD=your-password-here
    SESSION_SECRET=your-generated-secret-here
    ```

4. Start the stack:

    ```bash
    docker compose up -d
    ```

5. Visit `http://localhost:3000` to set your master password and start adding trackers.

### Updating

```bash
docker compose pull && docker compose up -d
```

The database schema is synced automatically on startup.

### Using an external database

If you already run Postgres, remove the `db` service and `depends_on` block from `docker-compose.yml`, then point `DATABASE_URL` at your existing instance. The `POSTGRES_PASSWORD` var is only used by the bundled `db` service and can be removed.

### Local Development

Requires Node.js 24+, pnpm, and PostgreSQL.

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and SESSION_SECRET
pnpm db:push
pnpm dev
```

## Configuration

| Variable            | Required | Default | Description                                              |
|---------------------|----------|---------|----------------------------------------------------------|
| `DATABASE_URL`      | Yes      | —       | PostgreSQL connection string                             |
| `POSTGRES_PASSWORD` | Docker   | —       | Password for the bundled Postgres container              |
| `SESSION_SECRET`    | Yes      | —       | AES-256 key for session cookies (min 32 characters)      |
| `TZ`                | No       | `UTC`   | Timezone for logs and scheduled tasks                    |
| `PORT`              | No       | `3000`  | Port the app listens on                                  |
| `LOG_LEVEL`         | No       | `info`  | Log verbosity: `error`, `warn`, `info`, `debug`          |
| `LOG_FILE`          | No       | —       | Path for log file output (logs always go to stdout too)  |

All other settings — polling interval, privacy mode, proxy, backups — are configured in the app's Settings page after login.

## Data & Volumes

| Host path        | Container path   | Contents                                 |
|------------------|------------------|------------------------------------------|
| `./data/backups` | `/data/backups`  | Scheduled backup files                   |
| `./data/logs`    | `/data/logs`     | Application log files                    |
| `pgdata` (named) | PG data dir      | PostgreSQL database (managed by Docker)  |

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

## Data Storage

All data stays on your machine. No external services, analytics, or telemetry.

- **API tokens** — encrypted with AES-256-GCM using a key derived from your master password
- **Snapshots** — stored in PostgreSQL with configurable retention (7 days - 10 years)
- **Backups** — JSON export, optionally encrypted, stored locally or downloaded

## Contributing

PRs welcome. Areas where help matters most:

- **New trackers & missing data** — copy [`src/data/trackers/_template.ts`](src/data/trackers/_template.ts), fill in what you know, and submit a PR. Partial entries are fine — set `draft: true` and CI will accept it. Filling in user classes, rules, release groups, and banned groups on existing trackers is just as valuable.
- **Download client adapters** — only qBittorrent is supported. Deluge, Transmission, and rTorrent all need adapters. See `src/lib/qbt/` for the pattern.
- **Tracker verification** — if you belong to a tracker marked 🟡 above, testing and confirming it works helps greatly.
- **Custom platform adapters** — trackers marked "Custom" need bespoke adapters since they don't run UNIT3D or Gazelle.
- Someone to convince the mods over at Hawke to add a /users endpoint :D

## License

[GPL-3.0](LICENSE)
