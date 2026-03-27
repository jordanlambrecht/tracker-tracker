---
title: Docker Configuration
description: Environment variables, volumes, ports, reverse proxy examples, and update instructions.
---

# Docker Configuration

Everything you need to customize how Tracker Tracker runs: environment variables, volume mounts, port mapping, reverse proxy setup, and how to update.

---

## Environment variables

### Required

| Variable            | Description                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`    | Protects your session cookies. Minimum 32 characters. Generate with `openssl rand -base64 48`.                                         |
| `POSTGRES_PASSWORD` | Password for the bundled PostgreSQL container. Generate with `openssl rand -base64 24`. Not needed if you set `DATABASE_URL` directly. |

### Optional

| Variable         | Default              | Description                                                                                                                                                             |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`  | `postgres`           | PostgreSQL username. Must match in both the app and db services.                                                                                                        |
| `POSTGRES_DB`    | `tracker_tracker`    | Database name.                                                                                                                                                          |
| `POSTGRES_HOST`  | `tracker-tracker-db` | Hostname of the PostgreSQL server. Only change this if you're using an external database without `DATABASE_URL`.                                                        |
| `POSTGRES_PORT`  | `5432`               | PostgreSQL port. If you change this, uncomment the matching lines in `docker-compose.yml`.                                                                              |
| `DATABASE_URL`   | _(auto-built)_       | Full connection string. Set this to use an external Postgres instance instead of the `POSTGRES_*` variables. Format: `postgresql://user:password@host:5432/dbname`      |
| `PORT`           | `3000`               | Port the app listens on inside the container. The host-side port mapping in `docker-compose.yml` follows this value.                                                    |
| `BASE_URL`       | _(empty)_            | The public URL where your app is reachable, e.g. `https://trackertracker.example.com`. Used in backup file metadata and notification links.                             |
| `SECURE_COOKIES` | _(auto)_             | Set to `true` to mark session cookies as `Secure`. Auto-enabled when `BASE_URL` starts with `https://`. Only needed if you serve over HTTPS without setting `BASE_URL`. |
| `TZ`             | `UTC`                | Timezone for scheduled tasks and log timestamps. Uses standard tz database names, e.g. `America/Chicago`, `Europe/London`.                                              |
| `LOG_LEVEL`      | `info`               | Log verbosity. Options: `error`, `warn`, `info`, `debug`.                                                                                                               |
| `LOG_FILE`       | _(none)_             | Absolute path inside the container to write logs to disk, e.g. `/data/logs/tracker-tracker.log`.                                                                        |

!!! info "Settings vs environment variables"
    Most day-to-day settings — polling interval, privacy mode, proxy config, backup schedule, lockout policy — live inside the app under **Settings**, not in environment variables. Environment variables are just for infrastructure stuff like database connections and ports.

---

## Volume mounts

| Host path                    | Container path                    | Purpose                                                                                        |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `./data`                     | `/data`                           | Application data directory. Contains `backups/` and `logs/` subdirectories.                    |
| `./data/backups`             | `/data/backups`                   | Where scheduled backup files are written.                                                      |
| `./data/logs`                | `/data/logs`                      | Log files when `LOG_FILE` is set.                                                              |
| `pgdata` (named volume)      | `/var/lib/postgresql/data`        | PostgreSQL data directory. Managed by Docker — don't put this on a network drive.              |
| `./postgres/postgresql.conf` | `/etc/postgresql/postgresql.conf` | Custom PostgreSQL config. Included in the repo and required for the bundled database to start. |

!!! warning "Back up the pgdata volume"
    The `pgdata` named volume holds your entire database. Use the built-in backup feature (Settings → Backups) for app-level backups, and separately snapshot the Docker volume or use `pg_dump` if you want a database-level backup.

---

## Port configuration

By default the app binds to port `3000` on your host:

```yaml
ports:
  - "${PORT:-3000}:3000"
```

To use a different port, set `PORT` in `.env`:

```ini title=".env"
PORT=8080
```

!!! tip "Behind a reverse proxy?"
    If Tracker Tracker sits behind Nginx, Caddy, or Traefik, you don't need to expose port 3000 to the outside world at all. Remove the `ports:` block from `docker-compose.yml` and let the reverse proxy talk to the container over the Docker network directly.

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

    ```caddy title="Caddyfile"
    trackertracker.example.com {
        reverse_proxy localhost:3000
    }
    ```

    Caddy handles TLS automatically via Let's Encrypt. That's the whole config.

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

    This assumes Traefik is already running with a `websecure` entrypoint and a `letsencrypt` certificate resolver.

!!! info "Set BASE_URL when using a reverse proxy"
    Set `BASE_URL=https://trackertracker.example.com` in `.env`. This enables secure session cookies automatically and ensures backup files and notification links use your public address.

---

## Health check

The container has a built-in Docker health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
```

The `/api/health` endpoint returns `200 OK` when the app is up and the database connection is healthy. The `depends_on` condition in `docker-compose.yml` waits for PostgreSQL to be ready before starting the app container.

---

## Updating to a new version

```bash
docker compose pull && docker compose up -d
```

The database schema updates automatically on startup. No manual steps required.

!!! tip "Check the changelog first"
    Read the [CHANGELOG](https://github.com/jordanlambrecht/tracker-tracker/blob/main/CHANGELOG.md) before pulling a new image — especially for major version bumps, which may include breaking changes to backup formats or environment variables.

To pin to a specific version and update deliberately:

```bash
# In docker-compose.yml, change:
image: ghcr.io/jordanlambrecht/tracker-tracker:latest
# to:
image: ghcr.io/jordanlambrecht/tracker-tracker:2.1.1
```

Then run `docker compose pull && docker compose up -d` to apply it.
