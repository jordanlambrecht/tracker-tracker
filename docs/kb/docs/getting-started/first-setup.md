---
title: First Setup
description: Creating your account and getting oriented after your first login.
---

# First Setup

Once your stack is up, there are a few one-time things to do before you add trackers.

## Creating your account

Go to [http://localhost:3000](http://localhost:3000). Since this is single-user, you'll land on `/setup` on first visit.

Fill in a username and password on the **Create an account** form. Your password does two things:

1. **Logs you in**—you'll need it every time you access the app.
2. **Encrypts your API tokens**—all tracker tokens are encrypted at rest using your password. Lose the password? You can't recover the tokens, but you can re-enter them manually.

!!! warning "Use a strong password"
    There's no recovery if you forget it—you'll have to reset the database. Use a password manager.

!!! info "Your password never leaves your machine"
    It's hashed on the server before storage. The raw password is never written to disk.

Click **Create Account** and you're in. The dashboard starts empty—that's normal.

---

## Next step

Add your first tracker: [Adding a Tracker](../trackers/adding-a-tracker.md).
