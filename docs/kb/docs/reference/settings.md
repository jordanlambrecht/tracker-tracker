---
title: Settings Reference
description: Complete reference for every configurable setting in Tracker Tracker, grouped by tab.
---

# Settings Reference

Every setting available in the Tracker Tracker settings interface is listed here, grouped by tab.

---

## General

| Setting                     | Default    | What it does                                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tracker Poll Interval**   | 60 minutes | How often Tracker Tracker checks all of your active trackers. The minimum is 15 minutes; the maximum is 1440 minutes (24 hours). All trackers are polled together in each cycle — you cannot set a different interval per tracker.                                                                |
| **Snapshot Retention**      | Unlimited  | How many days of polling history to keep. Leave blank to keep data forever. Set a number (between 7 and 3650) to automatically delete old snapshots. Pruning runs at the end of each poll cycle.                                                                                                  |
| **Display Username**        | Enabled    | The name shown in the Tracker Tracker interface. This is your local label — it has nothing to do with your usernames on individual trackers.                                                                                                                                                      |
| **Store Tracker Usernames** | Enabled    | When enabled, your username on each tracker is saved with each snapshot and shown in the UI. When disabled, usernames are masked before being saved and redacted before being shown — even if you had them stored previously. Turning this off does not delete usernames that were already saved. |

---

## Security

| Setting                              | Default    | What it does                                                                                                                                                                                                                  |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session Timeout**                  | None       | How long you can be idle before being automatically logged out. Leave blank to stay logged in until you log out manually.                                                                                                     |
| **Two-Factor Authentication (TOTP)** | Disabled   | Adds a second login step using a time-based one-time code from any authenticator app (Google Authenticator, Aegis, etc.). When you enable TOTP, a set of one-time backup codes is also generated — save these somewhere safe. |
| **Lockout**                          | Enabled    | When enabled, too many failed login attempts will temporarily lock the account.                                                                                                                                               |
| **Lockout Threshold**                | 5 attempts | How many consecutive failed login attempts (password or TOTP) trigger a lockout.                                                                                                                                              |
| **Lockout Duration**                 | 15 minutes | How long the account stays locked after the threshold is hit. The lock clears automatically when the time is up.                                                                                                              |

---

## Proxy

These settings configure a single outbound proxy for tracker requests. Individual trackers can opt in to use this proxy via their own settings.

| Setting            | Default  | What it does                                                                                                   |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| **Proxy Enabled**  | Disabled | Master switch. When off, all tracker requests go out directly, even if individual trackers have proxy enabled. |
| **Proxy Type**     | `socks5` | The proxy protocol. Options: `socks5`, `http`, `https`.                                                        |
| **Proxy Host**     | —        | Hostname or IP address of the proxy server.                                                                    |
| **Proxy Port**     | 1080     | Port the proxy listens on.                                                                                     |
| **Proxy Username** | —        | Username for proxy authentication. Leave blank if your proxy does not require a login.                         |
| **Proxy Password** | —        | Password for proxy authentication. Stored encrypted at rest.                                                   |

---

## Notifications

Notification targets are configured individually. Each target is an independent delivery destination (a Discord webhook, a Gotify server, etc.). The settings below apply per target.

| Setting                        | Default             | What it does                                                                                                                      |
| ------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Target Name**                | —                   | A label for this target, e.g. "Discord #alerts".                                                                                  |
| **Target Type**                | —                   | The delivery platform: `discord`, `gotify`, `telegram`, `slack`, or `email`. Each type has its own credential fields.             |
| **Enabled**                    | Enabled             | Turn a target off temporarily without deleting it.                                                                                |
| **Include Tracker Name**       | Enabled             | When on, notification messages include the name of the tracker that triggered them. Turn off for extra privacy.                   |
| **Scope**                      | All trackers        | Restrict this target to specific trackers. Leave blank to receive notifications from any tracker.                                 |
| **Notify on Ratio Drop**       | Disabled            | Fires when a tracker's ratio drops by more than the configured delta.                                                             |
| **Notify on Hit & Run**        | Disabled            | Fires when a new hit-and-run is detected.                                                                                         |
| **Notify on Tracker Down**     | Disabled            | Fires when a tracker fails to respond during a poll cycle.                                                                        |
| **Notify on Buffer Milestone** | Disabled            | Fires when your uploaded buffer crosses a configured size threshold.                                                              |
| **Notify on Warning**          | Disabled            | Fires when your account enters warned status on a tracker.                                                                        |
| **Notify on Ratio Danger**     | Disabled            | Fires when your ratio falls into a critical zone (typically below the tracker's required ratio).                                  |
| **Notify on Zero Seeding**     | Disabled            | Fires when your seeding count drops to zero.                                                                                      |
| **Notify on Rank Change**      | Disabled            | Fires when your class or rank changes on a tracker.                                                                               |
| **Notify on Anniversary**      | Disabled            | Fires at membership milestones: 1 month, 6 months, then each year after.                                                          |
| **Ratio Drop Delta**           | Application default | How large a ratio drop must be to trigger a notification. Overrides the application default for this target only.                 |
| **Buffer Milestone Threshold** | Application default | The buffer size (in bytes) that triggers a buffer milestone notification. Overrides the application default for this target only. |

---

## Backups

| Setting                    | Default  | What it does                                                                                                                                                                                                               |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scheduled Backups**      | Disabled | Turns on automatic backups. When disabled, you can still export backups manually at any time.                                                                                                                              |
| **Backup Frequency**       | Daily    | How often scheduled backups run: `daily`, `weekly`, or `monthly`. Scheduled backups always run at 03:00 server time.                                                                                                       |
| **Backup Retention Count** | 14       | Maximum number of scheduled backup files to keep on disk. When this limit is exceeded, the oldest file is deleted. This does not affect manual exports, which are downloaded to your browser and not stored on the server. |
| **Backup Encryption**      | Disabled | When enabled, backup files are encrypted with an additional password layer and saved with the `.ttbak` extension.                                                                                                          |
| **Backup Password**        | —        | The password used to encrypt and decrypt backup files. Only relevant when backup encryption is on.                                                                                                                         |
| **Backup Storage Path**    | —        | The folder on the server where scheduled backup files are written. The path must be writable by the application process.                                                                                                   |

---

## Notes

- **Encrypted storage** — Your proxy password, backup password, API tokens, and download client credentials are all encrypted at rest. Changing your master password re-encrypts everything automatically.
- **Restoring a backup** — Your master password and its associated encryption salt are never included in a backup and are never overwritten when you restore one. Your session stays valid after a restore.
- **Lockout and restores** — Restoring a backup always clears any active lockout, regardless of what was in the backup file.
- **Secure cookies** — Session cookies are marked `Secure` (HTTPS-only) when `BASE_URL` starts with `https://` or `SECURE_COOKIES=true` is set. If you access the app over plain HTTP, cookies are not marked `Secure` and this is expected.
