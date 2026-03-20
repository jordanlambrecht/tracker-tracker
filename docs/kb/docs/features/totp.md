---
title: Two-Factor Authentication (TOTP)
description: Add a time-based one-time password requirement to your login flow.
---

# Two-Factor Authentication (TOTP)

You can add a second login step using any standard authenticator app. After entering your password, you'll be prompted for a 6-digit code from the app.

Works with: Google Authenticator, Aegis, 1Password, Bitwarden, Authy, and any other app that supports standard TOTP.

## Enabling 2FA

1. Go to **Settings → Security**.
2. Click **Enable Two-Factor Authentication**.
3. Scan the QR code with your authenticator app.
4. Enter the 6-digit code shown in your app to confirm it worked.
5. Copy your backup codes and store them somewhere safe (see below).
6. Click **Confirm**.

The app won't save anything until you enter a valid code in step 4. If the code is wrong or expired, just try again — nothing gets committed.

## Backup Codes

When you enable 2FA, you get 8 backup codes. Each one looks like this:

```ascii
3A7F-B2C1
```

**Each code works exactly once.** After you use one, it's gone. The remaining codes stay valid.

Use a backup code at the TOTP prompt the same way you'd use a 6-digit code — there's a "Use a backup code" option on the login screen.

!!! warning "Save your backup codes now"
If you lose your authenticator app and don't have backup codes, you cannot log in. There is no account recovery. Store the codes in a password manager or print them and keep them somewhere secure.

## Logging In With 2FA

After entering your password, you'll see a second screen asking for your code. Enter:

- The current 6-digit code from your authenticator app, **or**
- One of your saved backup codes

The app accepts codes from the previous and next 30-second window to account for slight clock drift.

## Disabling 2FA

Turning off 2FA requires both your password and a valid TOTP code (or a backup code). This prevents someone with brief access to your open browser session from removing your 2FA protection.

1. Go to **Settings → Security**.
2. Click **Disable Two-Factor Authentication**.
3. Enter your password.
4. Enter a current TOTP code, or check "Use a backup code" and enter one.
5. Click **Confirm**.

## Failed Login Attempts

Failed TOTP attempts count toward the same lockout limit as failed password attempts. If you've configured a lockout threshold in settings, too many wrong codes will temporarily lock the account.

## After a Backup Restore

!!! warning "2FA may be disabled after restoring a backup"
If you restore a backup from a different Tracker Tracker instance — one that was set up with a different password — the 2FA secret can't be carried over. In that case, 2FA will be turned off automatically as part of the restore.

The restore confirmation screen will tell you if this happened. You'll need to go back to **Settings → Security** and set up 2FA again.

This only applies to cross-instance restores. Restoring a backup on the same instance you created it on is fine.
