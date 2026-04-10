---
title: Installation
description: How to install Tracker Tracker using Docker Compose or Docker Run.
---

# Installation

Tracker Tracker runs in Docker. Use Docker Compose to get it up and running.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose v2](https://docs.docker.com/compose/install/) (the `docker compose` plugin, not the legacy `docker-compose` binary)

That's it — nothing else to install.

!!! info "Architecture support"
    We build for **linux/amd64** and **linux/arm64**, so you're covered on x86-64 servers, Raspberry Pi 4/5, and Apple Silicon in Linux VMs. Docker grabs the right one automatically.

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

Or create them manually by copying the examples below.

## Step 3 — Generate secrets

Generate two secrets and paste them into `.env`:

```bash
openssl rand -base64 24   # → POSTGRES_PASSWORD
openssl rand -base64 48   # → SESSION_SECRET
```

Then open `.env` and add them:

```ini title=".env"
SESSION_SECRET=<output of openssl rand -base64 48>
POSTGRES_PASSWORD=<output of openssl rand -base64 24>
POSTGRES_USER=postgres
TZ=America/Chicago
```

!!! warning "Fresh secrets every time"
    Generate new ones each time. `SESSION_SECRET` protects your cookies, `POSTGRES_PASSWORD` protects your database. Don't copy the `.env.example` placeholder.

## Step 4 — Start the stack

=== "Docker Compose (recommended)"

```bash
docker compose up -d
```

The app waits for the database to be ready, then sets up the schema automatically. First boot takes about 15-20 seconds. Peek at the logs if you want to watch:

```bash
docker compose logs -f tracker-tracker-app
```

=== "Docker Run (standalone)"

Running Postgres elsewhere? Start the app container:

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

Point `DATABASE_URL` to your Postgres instance. The app will create its schema on startup if needed.

## Step 5 — Verify it's running

```bash
docker compose ps
```

Both containers should be running:

```md
NAME                    STATUS
tracker-tracker-app     running
tracker-tracker-db      running (healthy)
```

Or test the health endpoint:

```bash
curl -s http://localhost:3000/api/health
```

A `200 OK` means the app is up and talking to the database.

## Step 6 — Open the app

Go to [http://localhost:3000](http://localhost:3000).

On first visit you'll be redirected to `/setup` to create your account. See [First Setup](first-setup.md) for what to do next.

---

## Image registries

Both registries have the same image — use whichever you prefer:

| Registry                  | Image                                            |
| ------------------------- | ------------------------------------------------ |
| GitHub Container Registry | `ghcr.io/jordanlambrecht/tracker-tracker:latest` |
| Docker Hub                | `jordyjordy/tracker-tracker:latest`              |

Pin a specific version if you want predictable updates:

```bash
ghcr.io/jordanlambrecht/tracker-tracker:2.1.1
```

Check the [CHANGELOG](https://github.com/jordanlambrecht/tracker-tracker/blob/main/CHANGELOG.md) before upgrading.

---

## Using an external database

Using an external Postgres instance? Remove the `tracker-tracker-db` service and `depends_on` from `docker-compose.yml`, then set `DATABASE_URL`:

```ini title=".env"
DATABASE_URL=postgresql://myuser:mypassword@192.168.1.10:5432/tracker_tracker
SESSION_SECRET=...
TZ=America/Chicago
```

!!! tip
    Create the database name ahead of time. The app handles the rest on startup—no SQL scripts needed.
