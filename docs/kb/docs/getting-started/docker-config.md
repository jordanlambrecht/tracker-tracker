---
title: Docker Configuration
description: Environment variables, volumes, ports, reverse proxy examples, and update instructions.
---

# Docker Configuration

Customize Tracker Tracker via environment variables, volumes, ports, reverse proxies, and update strategies.

---

## Environment variables

### Required

| Variable            | Description                                                                                                               |
|---------------------|---------------------------------------------------------------------------------------------------------------------------|
| `SESSION_SECRET`    | Protects your session cookies. Minimum 32 characters. Generate with `openssl rand -base64 48`.                            |
| `POSTGRES_PASSWORD` | Password for the PostgreSQL container. Generate with `openssl rand -base64 24`. Skip this if you're using `DATABASE_URL`. |

### Optional

| Variable         | Default              | Description                                                                                                                                                     |
|------------------|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `POSTGRES_USER`  | `postgres`           | PostgreSQL username. Match this in both the app and db services.                                                                                                |
| `POSTGRES_DB`    | `tracker_tracker`    | Database name.                                                                                                                                                  |
| `POSTGRES_HOST`  | `tracker-tracker-db` | PostgreSQL hostname. Change only if using an external Postgres instance without `DATABASE_URL`.                                                                 |
| `POSTGRES_PORT`  | `5432`               | PostgreSQL port. If you change it, uncomment the matching lines in `docker-compose.yml`.                                                                        |
| `DATABASE_URL`   | _(auto-built)_       | Full connection string. Use this instead of `POSTGRES_*` variables when pointing to an external Postgres. Format: `postgresql://user:password@host:5432/dbname` |
| `PORT`           | `3000`               | Container port. The host mapping in `docker-compose.yml` follows this.                                                                                          |
| `BASE_URL`       | _(empty)_            | Your public app URL (e.g. `https://trackertracker.example.com`). Used for backup metadata and notification links.                                               |
| `SECURE_COOKIES` | _(auto)_             | Set to `true` to mark session cookies as `Secure`. Auto-enabled when `BASE_URL` is HTTPS. Only set this if you serve HTTPS without `BASE_URL`.                  |
| `TZ`             | `UTC`                | Timezone for scheduled tasks and log timestamps (e.g. `America/Chicago`, `Europe/London`).                                                                      |
| `LOG_LEVEL`      | `info`               | Log verbosity. Options: `error`, `warn`, `info`, `debug`.                                                                                                       |
| `LOG_FILE`       | _(none)_             | Write logs to disk at this container path (e.g. `/data/logs/tracker-tracker.log`).                                                                              |

!!! info "Settings vs environment variables"
    Day-to-day options (polling interval, privacy mode, proxy config, backup schedule, lockout policy) live in the app under **Settings**. Environment variables control infrastructure: database, ports, logging.

---

## Volume mounts

| Host path                    | Container path                    | Purpose                                                       |
|------------------------------|-----------------------------------|---------------------------------------------------------------|
| `./data`                     | `/data`                           | App data (`backups/` and `logs/`).                            |
| `./data/backups`             | `/data/backups`                   | Scheduled backups.                                            |
| `./data/logs`                | `/data/logs`                      | Logs when you set `LOG_FILE`.                                 |
| `pgdata` (named volume)      | `/var/lib/postgresql/data`        | PostgreSQL data. Docker manages it—don't use a network drive. |
| `./postgres/postgresql.conf` | `/etc/postgresql/postgresql.conf` | Custom PostgreSQL config. Required for the bundled database.  |

!!! warning "Back up pgdata"
    This volume holds your entire database. Use the built-in backup (Settings → Backups) for app snapshots. For database-level backups, snapshot the Docker volume or run `pg_dump` separately.

---

## Port configuration

By default the app binds to port `3000`:

```yaml
ports:
  - "${PORT:-3000}:3000"
```

Use a different port? Set it in `.env`:

```ini title=".env"
PORT=8080
```

!!! tip "Running behind a reverse proxy"
    With Nginx, Caddy, or Traefik? Skip the `ports:` block and let your proxy reach the container via Docker's network.

---

## Reverse proxy examples

=== "Nginx"

```nginx title="/etc/nginx/sites-available/tracker-tracker"
server {
    listen 80;
    server_name trackertracker.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trackertracker.example.com;

    ssl_certificate     /etc/letsencrypt/live/trackertracker.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trackertracker.example.com/privkey.pem;

    # Required for live polling status updates
    proxy_buffering off;
    proxy_cache off;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

=== "Caddy"

=== "Traefik"

Add labels to the app service in `docker-compose.yml`:

```yaml title="docker-compose.yml (app service labels)"
services:
    tracker-tracker-app:
    image: ghcr.io/jordanlambrecht/tracker-tracker:latest
    restart: unless-stopped
    container_name: tracker-tracker-app
    labels:
        - "traefik.enable=true"
        - "traefik.http.routers.tracker-tracker.rule=Host(`trackertracker.example.com`)"
        - "traefik.http.routers.tracker-tracker.entrypoints=websecure"
        - "traefik.http.routers.tracker-tracker.tls.certresolver=letsencrypt"
        - "traefik.http.services.tracker-tracker.loadbalancer.server.port=3000"
    # Remove the ports: block when using Traefik
    networks:
        - traefik_proxy
        - default
```

Assumes Traefik is already running with a `websecure` entrypoint and `letsencrypt` resolver.

!!! info "Set BASE_URL with a reverse proxy"
    Add `BASE_URL=https://trackertracker.example.com` in `.env`. This auto-enables secure cookies and ensures backups and notifications use your public URL.

---

## Health check

A built-in health check comes with the container:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
```

The `/api/health` endpoint returns `200 OK` when both the app and database are healthy. Docker Compose waits for Postgres before starting the app.

---

## Updates

```bash
docker compose pull && docker compose up -d
```

The database schema updates automatically. No manual steps needed.

!!! tip "Read the changelog first"
    Check the [CHANGELOG](https://github.com/jordanlambrecht/tracker-tracker/blob/main/CHANGELOG.md) before upgrading, especially major versions—they may break backups or environment variables.

Pin a version by editing `docker-compose.yml`:

```bash
# Change:
image: ghcr.io/jordanlambrecht/tracker-tracker:latest
# To:
image: ghcr.io/jordanlambrecht/tracker-tracker:2.1.1
```

Then run `docker compose pull && docker compose up -d`.
