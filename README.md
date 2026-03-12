# Tracker Tracker

Self-hosted dashboard for monitoring your private tracker stats over time. Track upload, download, ratio, buffer, seedbonus, and more across multiple trackers — all in one place.

<!-- TODO: Add screenshot here -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->

## Features

- **Multi-tracker dashboard** — aggregate stats, comparison charts, and tracker leaderboard
- **Tracker detail pages** — upload/download history, ratio, buffer, seedbonus, seeding counts, and rank progression
- **40+ supported trackers** across UNIT3D, Gazelle, and GGn platforms
- **qBittorrent integration** — torrent stats, cross-seed tracking, activity heatmaps
- **Encrypted at rest** — API tokens stored with AES-256-GCM, derived from your master password
- **Privacy mode** — redact usernames and group names from stored data
- **Scheduled polling** — configurable global interval (15 min – 24 hours) with automatic snapshot retention
- **SOCKS5/HTTP/HTTPS proxy** — per-tracker opt-in for proxied API requests
- **Two-factor auth** — optional TOTP with backup codes
- **Backup & restore** — scheduled or manual, with optional encryption
- **Dark neumorphic UI** — per-tracker accent colors, drag-and-drop sidebar, responsive charts

## Supported Trackers

| Tracker | Platform | Status | Notes |
|---------|----------|--------|-------|
| Aither | UNIT3D | ✅ Implemented | |
| Blutopia | UNIT3D | ✅ Implemented | |
| FearNoPeer | UNIT3D | ✅ Implemented | |
| OnlyEncodes | UNIT3D | ✅ Implemented | |
| Upload.cx | UNIT3D | ✅ Implemented | |
| AlphaRatio | Gazelle | | |
| AnimeBytes | Gazelle | | |
| Anthelion | Gazelle | | |
| BroadcastheNet (BTN) | Gazelle | | |
| CathodeRayTube (CRT) | UNIT3D | | |
| Concertos | UNIT3D | | |
| Empornium | Gazelle | | |
| GazelleGames (GGn) | GGn | ✅ Implemented | |
| GreatPosterWall (GPW) | Gazelle | | |
| HawkeUno | UNIT3D | ❌ Unsupported | API blocks `/user` polling |
| LST | UNIT3D | | |
| MoreThanTV (MTV) | Gazelle | | |
| Nebulance | Gazelle | | |
| OldToons | UNIT3D | | |
| Orpheus (OPS) | Gazelle | ✅ Implemented | |
| PassThePopcorn (PTP) | Gazelle | | |
| Phoenix Project (PP) | Gazelle | ✅ Implemented | |
| Racing4Everyone | UNIT3D | | |
| Redacted (RED) | Gazelle | ✅ Implemented | |
| ReelFlix | UNIT3D | | |
| SkipTheCommercials | UNIT3D | | |
| 720pier | Custom | | |
| ABTorrents | Custom | | |
| AvistaZ | Custom | | |
| BeyondHD | Custom | | |
| CinemaZ | Custom | | |
| Cinemageddon | Custom | | |
| ExotikaZ | Custom | | |
| FileList | Custom | | |
| HDBits | Custom | | |
| HD-Torrents | Custom | | |
| IPTorrents | Custom | | |
| MyAnonamouse (MAM) | Custom | | |
| PrivateHD | Custom | | |
| SecretCinema | Custom | | |
| SportsCult | Custom | | |
| TorrentLeech | Custom | | |
| TVVault | Custom | | |

✅ **Implemented** — tested and verified against a live tracker.
🟡 **Supported** — platform adapter exists and should work, but not yet verified.
📋 **Planned** — registry entry exists but needs a custom adapter.
🚧 **Stuck** — I'm not a member of these trackers and have no way of completing the integration. PRs welcome :)

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/yourusername/tracker-tracker.git
cd tracker-tracker
cp .env.example .env
```

Edit `.env` and set your secrets:

```env
POSTGRES_PASSWORD=your-secure-password
SESSION_SECRET=your-random-string-at-least-32-characters
```

Generate a session secret:

```bash
openssl rand -base64 48
```

Start everything:

```bash
docker compose up -d
```

Visit `http://localhost:3000` to set your master password and add trackers.

### Local Development

Requires Node.js 20+, pnpm, and PostgreSQL.

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and SESSION_SECRET
pnpm db:push
pnpm dev
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes (Docker) | PostgreSQL password |
| `SESSION_SECRET` | Yes | AES-256 key for session cookies. Min 32 characters |
| `PORT` | No | App port (default: `3000`) |
| `DATABASE_URL` | Yes (local dev) | PostgreSQL connection string |

All other settings (polling interval, privacy mode, proxy, backups) are configured in the app's Settings page after login.

## Architecture

- **Next.js 15** (App Router) — server components + API routes
- **PostgreSQL** + **Drizzle ORM** — schema-first, no raw SQL migrations
- **ECharts** — interactive time-series charts
- **node-cron** — background polling scheduler
- **Argon2** — master password hashing
- **jose** — JWE session tokens (AES-256-GCM)

## Adding a Tracker

1. Go to the sidebar and click **+ Add Tracker**
2. Select from the registry or enter details manually
3. Paste your API token (found in your tracker's security/API settings)
4. The app validates the connection, then starts polling automatically

## Data Storage

All data stays on your machine. There are no external services, analytics, or telemetry.

- **API tokens** — encrypted with AES-256-GCM using a key derived from your master password
- **Snapshots** — stored in PostgreSQL with configurable retention (7 days to 10 years)
- **Backups** — JSON export, optionally encrypted, stored locally or downloaded

## License

[GPL-3.0](LICENSE)
