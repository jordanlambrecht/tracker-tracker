---
title: First Setup
description: Creating your account and getting oriented after your first login.
---

# First Setup

Once the stack is running, create your account before you add trackers.

## Creating your account

Go to [http://localhost:3000](http://localhost:3000). Tracker Tracker is single-user, so your first visit goes to `/setup`.

Fill in a username and password on the **Create an account** form. Your password does two things:

1. It logs you in. You need it every time you open the app.
2. It encrypts your API tokens. Your password encrypts all tracker tokens at rest. If you lose it, you can reset it with `tt-recover` without losing the tokens. See [Lost Master Password](../reference/password-recovery.md).

!!! warning "Use a strong password"
    There is no "forgot password" email. Recovery needs your original `SESSION_SECRET`, so keep that safe too. Use a password manager.

!!! info "Your password never leaves your machine"
    It's hashed on the server before storage. The raw password is never written to disk.

Click **Create Account** and you're in. The dashboard starts empty, and that's normal.

---

## Next step

Add your first tracker: [Adding a Tracker](../trackers/adding-a-tracker.md).
