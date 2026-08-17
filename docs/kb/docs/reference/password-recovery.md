---
title: Recovering a Lost Master Password
description: How to reset the master password on a self-hosted instance without orphaning your encrypted tracker tokens and client credentials.
---

# Recovering a Lost Master Password

There is no "forgot password" email — Tracker Tracker is single-user and has no
mail server. What it has instead is `tt-recover`, a command that ships inside the
app container.

```bash
docker exec -it tracker-tracker-app tt-recover --check
```

That reports whether recovery is possible and writes nothing.

---

## Why you cannot just edit the database

Every secret in your instance — tracker API tokens, download client
credentials, notification webhook configs, your TOTP secret — is encrypted with
a key derived from your master password and `app_settings.encryption_salt`.

So this, which is the first thing everyone tries, is destructive:

```sql
-- ✗ NEVER DO THIS
UPDATE app_settings SET password_hash = '$argon2id$...';
```

It lets you log in. It also gives you a key that decrypts nothing. Every token
and credential in the database becomes unreadable, permanently, with no error
message — you just find empty fields and failing polls.

`tt-recover` exists so that never happens. It recovers your real encryption key,
re-encrypts every secret under the new password, and rewrites the password hash,
all in a single transaction.

!!! info "How recovery is possible at all"

    `app_settings.encrypted_scheduler_key` stores your master key wrapped under a
    key derived from `SESSION_SECRET` alone — no password involved. The scheduler
    needs it to keep polling across restarts while nobody is logged in. That same
    column is what makes a lossless password reset possible.

---

## Before you start

**Take a database dump.** This is the one step you cannot add later.

```bash
docker exec tracker-tracker-db sh -c \
  'pg_dump -U "$POSTGRES_USER" tracker_tracker' > tracker-tracker-backup.sql
```

If anything goes wrong, that file is a complete, restorable copy of your
instance. `tt-recover` is transactional and refuses to write unless it has
already proved it can read your data, but a dump costs seconds.

You also need:

- **`SESSION_SECRET` unchanged.** It must be byte-identical to the value the
  instance has been running with. If you rotated it, the wrapped key is already
  unreadable and no recovery is possible.
- **`-it` on `docker exec`.** The password prompt needs a TTY.

---

## The three commands

### 1. Check

```bash
docker exec -it tracker-tracker-app tt-recover --check
```

Asks for no password and writes nothing. It reports whether the wrapped key is
intact, how many stored secrets it can read, and whether anything is already
unreadable.

### 2. Dry run

```bash
docker exec -it tracker-tracker-app tt-recover
```

Prompts for the new password (hidden, entered twice), does every decryption and
re-encryption in memory, and then writes nothing. Use it to see the exact plan
before committing.

### 3. Apply

```bash
docker exec -it tracker-tracker-app tt-recover --apply
```

Same as the dry run, then commits it in one transaction:

- every encrypted secret re-encrypted under the new password
- `password_hash` replaced
- `failed_login_attempts` and `locked_until` cleared, so you are not still
  locked out when you try to log in
- `encrypted_scheduler_key` re-wrapped around the new key, so polling survives
  the next restart

Restart the app afterwards so the scheduler picks up the new key:

```bash
docker compose restart tracker-tracker-app
```

---

## Flags

| Flag              | What it does                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `--check`         | Report only. No password prompt, no writes.                                                                                                    |
| `--apply`         | Commit. Without it, every run is a dry run.                                                                                                    |
| `--password <pw>` | Supply the password non-interactively. Prefer the prompt — see the warning below.                                                              |
| `--disable-totp`  | Also clear the TOTP secret and backup codes, in the same transaction.                                                                          |
| `--help`          | Usage.                                                                                                                                         |

!!! warning "`--password` is visible to other processes"

    A password passed on the command line lands in your shell history, and for the
    lifetime of the process it is readable in `ps` and `/proc/<pid>/cmdline` by
    anything else running in that container. Use the interactive prompt unless you
    are scripting this.

### If you lost your authenticator too

A password reset leaves two-factor authentication switched on, so you would still
be stopped at the TOTP prompt. If your authenticator is gone as well:

```bash
docker exec -it tracker-tracker-app tt-recover --apply --disable-totp
```

Set 2FA up again from **Settings → Security** once you are back in.

---

## When recovery is not possible

`tt-recover` aborts, without writing anything, in these cases.

### `encrypted_scheduler_key` is NULL

The wrapped copy of your master key is gone. It gets cleared by **emergency
lockdown** (which also rotates `encryption_salt`), by a nuke, or by a restore
that could not re-wrap it.

Past that point there is no password-less recovery: your secrets can only be
decrypted by someone who knows the current master password. Resetting the
password anyway would let you log in and orphan everything, which is exactly why
the tool refuses.

What is left: keep trying the real password, restore a `pg_dump` from before the
key was cleared, or start fresh and re-enter your secrets.

### `SESSION_SECRET` is missing, short, or was rotated

`SESSION_SECRET` is the only thing that can unwrap the master key. Check the
value in your compose file and any `.env` it reads. If the old value is genuinely
gone, so is the recovery path.

### The key unwraps but decrypts nothing

The key is authentic but does not match your data — typically an interrupted
password change, or a restore that mixed one instance's dump with another's
settings row. Re-keying from a key that reads nothing would destroy every secret,
so the tool stops.

---

## What it deliberately leaves alone

- **`encryption_salt`** is reused verbatim, never regenerated. A new salt would
  put your existing ciphertext out of reach of every possible password.
- **Values it cannot decrypt** are left exactly as they are — not cleared, not
  overwritten. They are reported by name so you know what to re-enter. Data that
  is merely unreadable is not the same as data that is gone.
- **Revocation markers.** After an emergency lockdown, tracker tokens hold the
  literal string `LOCKDOWN_REVOKED` rather than ciphertext. Those pass through
  byte-identically, so the evidence that a lockdown happened is not quietly
  erased.
- **Blank-by-design credentials.** A qBittorrent client configured with
  "bypass authentication for clients on localhost" has genuinely empty
  credentials stored as real ciphertext. Those are re-keyed like any other value,
  not collapsed to empty strings.

---

## Running it against an external database

If you moved Tracker Tracker onto your own Postgres, `docker exec` still works —
the CLI rebuilds its connection from the container's environment, preferring
`DATABASE_URL` and otherwise assembling one from `POSTGRES_HOST`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` and `POSTGRES_DB`.

If the app container will not start at all, you can run the same file from a
checkout of the repository on any machine that can reach the database:

```bash
SESSION_SECRET='...' DATABASE_URL='postgresql://...' node scripts/recover.cjs --check
```

Stop the app first so the scheduler is not writing while the re-key transaction
runs, and make sure `SESSION_SECRET` matches exactly.
