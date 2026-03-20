---
title: First Setup
description: Creating your account and getting oriented after your first login.
---

# First Setup

Once the stack is running, there are a few one-time steps before you can start adding trackers.

## Creating your account

Open [http://localhost:3000](http://localhost:3000) in your browser. Tracker Tracker is a single-user app, so on first visit you're redirected to `/setup`.

Enter a username and password on the **Create an account** form.

Your password does two things:

1. **Logs you in.** You'll type it every time you access the app.
2. **Protects your stored API tokens.** All tracker API tokens are encrypted at rest using a key derived from your password. If you lose your password, those tokens can't be recovered — but you can re-enter them manually.

!!! warning "Choose strong credentials"
There is no recovery mechanism. If you forget your password, you'll need to reset the database and start fresh. Keep it in a password manager.

!!! info "Your password stays on your machine"
It's hashed on the server before being stored. The raw password is never saved anywhere.

Click **Create Account**. You'll be logged in and land on the dashboard.

---

## First look at the dashboard

The dashboard is mostly empty until you add your first tracker — that's expected.

The left sidebar has three sections:

- **Tracker list** — each tracker you add shows up here with a pulse indicator showing its current health.
- **Fleet stats** — combined upload, download, and ratio across all your active trackers.
- **Navigation** — links to Settings and the download client panel (if you've configured one).

The main area shows the tracker overview grid, charts, and leaderboard. Charts fill in automatically as polling history builds up over time.

!!! tip "Polling starts right away"
The moment you add a tracker, the app polls it and records a snapshot. Stats start charting from that first poll. The default polling interval is 60 minutes — you can change it in **Settings → General**.

---

## Next step

Add your first tracker: [Adding a Tracker](../trackers/adding-a-tracker.md).
