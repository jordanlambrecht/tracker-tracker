---
title: Settings Reference
description: Complete reference for every configurable setting in Tracker Tracker, grouped by tab.
---

# Settings Reference

Every setting, grouped by tab.

---

## General

Controls polling frequency and data retention. All trackers poll together at the configured interval (no per-tracker settings). **Display Username** is your local app label. When **Store Tracker Usernames** is off, they're masked in the UI but existing data isn't deleted.

| Setting                | Default   | Notes                                                                 |
|------------------------|-----------|-----------------------------------------------------------------------|
| **Snapshot Retention** | Unlimited | Set 7–3650 days to auto-delete old snapshots; leave blank for forever |

---

## Security

Manages login security, lockouts, and two-factor authentication. **Session Timeout** defaults to infinite (never logged out by idle). **Lockout** protects against brute force — it auto-clears after the duration expires.

| Setting             | Default | Notes                                                                          |
|---------------------|---------|--------------------------------------------------------------------------------|
| **Session Timeout** | None    | Leave blank to stay logged in forever; otherwise set minutes until auto-logout |

### Two-Factor Authentication

Enable TOTP (time-based one-time password) with any standard authenticator app (Google Authenticator, Aegis, 1Password, Bitwarden, Authy, etc).

**Setup:**

1. Go to **Settings → Security**
2. Click **Enable Two-Factor Authentication**
3. Scan the QR code with your authenticator app
4. Enter the 6-digit code from your app to confirm
5. **Save your 8 backup codes** in a password manager or secure location
6. Click **Confirm**

On login, enter either the current 6-digit code from your app or one of your backup codes. Each backup code works once, then expires.

**Disabling:** Go to **Settings → Security** and click **Disable Two-Factor Authentication**. You'll need to enter your password and a valid TOTP or backup code.

!!! warning "No authenticator app and no backup codes means no login — there is no account recovery."

    Store backup codes immediately and keep them safe.

---

## Proxy

Configures a single outbound proxy for tracker requests. Individual trackers can opt in per their own settings.

All settings are self-explanatory; **Proxy Password** is stored encrypted.

---

## Notifications

Each target is an independent delivery destination (Discord, Gotify, Telegram, Slack, email). Configure what events trigger notifications per target and whether to include tracker names.

| Setting                        | Default             | Notes                                                                       |
|--------------------------------|---------------------|-----------------------------------------------------------------------------|
| **Ratio Drop Delta**           | Application default | Override the app-wide ratio drop threshold for this target only             |
| **Buffer Milestone Threshold** | Application default | Override the app-wide buffer milestone size (in bytes) for this target only |

---

## Backups

Controls automatic backup scheduling, encryption, and retention. Backups always run at 03:00 server time.

| Setting                    | Default | Notes                                                           |
|----------------------------|---------|-----------------------------------------------------------------|
| **Backup Retention Count** | 14      | Number of backups to keep (1–365); oldest deletes when exceeded |

---

## Notes

- **Encrypted storage** — Proxy password, backup password, API tokens, and credentials are encrypted at rest. Changing your master password re-encrypts everything.
- **Restoring a backup** — Your master password and encryption salt are never backed up and never overwritten on restore. Sessions stay valid.
- **Lockout and restores** — Backup restore always clears active lockout.
- **Secure cookies** — Session cookies are marked `Secure` when `BASE_URL` starts with `https://` or `SECURE_COOKIES=true`. Plain HTTP doesn't mark them secure.
