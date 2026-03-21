---
title: Installation
description: How to install Tracker Tracker using Docker Compose or Docker Run.
---

# Installation

Tracker Tracker runs as a Docker image. The easiest way to get it running is with Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose v2](https://docs.docker.com/compose/install/) (the `docker compose` plugin, not the legacy `docker-compose` binary)

Nothing else needs to be installed on your host.

!!! info "Architecture support"
    The image supports **linux/amd64** and **linux/arm64**. It runs on x86-64 servers and ARM machines like Raspberry Pi 4/5 or Apple Silicon in Linux VMs — Docker picks the right version automatically.

---

## Step 1 — Create a working directory

```bash
mkdir tracker-tracker && cd tracker-tracker
```

## Step 2 — Download the compose file and env template

```bash
curl -LO https://raw.githubusercontent.com/jordanlambrecht/tracker-tracker/main/docker-compose.yml
curl -L https://raw.githubusercontent.com/jordanlambrecht/tracker-tracker/main/.env.example -o .env
```

Or create the files manually using the contents shown in the next steps.

## Step 3 — Generate secrets

You need two secrets before starting the stack. Run each command and paste the output into `.env`:

```bash
openssl rand -base64 24   # → POSTGRES_PASSWORD
openssl rand -base64 48   # → SESSION_SECRET
```

Open `.env` and fill in the values:

```ini title=".env"
SESSION_SECRET=<output of openssl rand -base64 48>
POSTGRES_PASSWORD=<output of openssl rand -base64 24>
POSTGRES_USER=postgres
TZ=America/Chicago
```

!!! warning "Don't reuse these values"
`SESSION_SECRET` protects your session cookies. `POSTGRES_PASSWORD` protects your database. Generate fresh values — never copy the placeholder text from `.env.example`.

## Step 4 — Start the stack

=== "Docker Compose (recommended)"

    ```bash
    docker compose up -d
    ```

    The app waits for the database to be ready before starting, then sets up the database schema automatically. First boot takes about 15-20 seconds.

    Watch the startup logs:

    ```bash
    docker compose logs -f tracker-tracker-app
    ```

=== "Docker Run (standalone)"

    If you already have PostgreSQL running somewhere else, you can start just the app container:

    ```bash
    docker run -d \
      --name tracker-tracker-app \
      --restart unless-stopped \
      -p 3000:3000 \
      -v ./data:/data \
      -e DATABASE_URL="postgresql://postgres:yourpassword@your-postgres-host:5432/tracker_tracker" \
      -e SESSION_SECRET="your-session-secret-minimum-32-chars" \
      -e TZ="America/Chicago" \
      ghcr.io/jordanlambrecht/tracker-tracker:latest
    ```

    Point `DATABASE_URL` at your existing Postgres instance. The app creates its own schema on startup if it doesn't exist yet.

## Step 5 — Verify it is running

```bash
docker compose ps
```

Both containers should show as running:

```
NAME                    STATUS
tracker-tracker-app     running
tracker-tracker-db      running (healthy)
```

You can also hit the health endpoint:

```bash
curl -s http://localhost:3000/api/health
```

A `200 OK` response means the app is up and connected to the database.

## Step 6 — Open the app

Go to [http://localhost:3000](http://localhost:3000).

On first visit you'll be redirected to `/setup` to create your account. See [First Setup](first-setup.md) for what to do next.

---

## Image registries

The same image is on two registries — either works:

| Registry                  | Image                                            |
| ------------------------- | ------------------------------------------------ |
| GitHub Container Registry | `ghcr.io/jordanlambrecht/tracker-tracker:latest` |
| Docker Hub                | `jordyjordy/tracker-tracker:latest`              |

Pin to a specific version if you want predictable updates:

```bash
ghcr.io/jordanlambrecht/tracker-tracker:2.1.1
```

Check the [CHANGELOG](https://github.com/jordanlambrecht/tracker-tracker/blob/main/CHANGELOG.md) before upgrading.

---

## Using an external database

If you already run PostgreSQL, remove the `tracker-tracker-db` service and the `depends_on` block from `docker-compose.yml`, then set `DATABASE_URL` directly instead of the `POSTGRES_*` variables:

```ini title=".env"
DATABASE_URL=postgresql://myuser:mypassword@192.168.1.10:5432/tracker_tracker
SESSION_SECRET=...
TZ=America/Chicago
```

!!! tip
You only need to create the database itself beforehand. The app handles the rest on first startup — no manual SQL required.
