---
title: Image Hosting
description: Upload screenshots to PTPImg, OnlyImage, or ImgBB directly from Tracker Tracker.
---

# Image Hosting

!!! danger "Functionality has not been implemented and this currently does nothing"
    This is in preparation for the Tracker Transit Papers that will be launched in an upcoming release. No harm is done from adding your api keys now, but they won't do anything.

Tracker Tracker can upload images to external hosting services and return a direct link. This is useful for uploading screenshots when creating or editing torrent listings on trackers that require images hosted on approved services.

## Supported Hosts

| Host          | URL           | Expiration                  | Notes                                      |
| ------------- | ------------- | --------------------------- | ------------------------------------------ |
| **PTPImg**    | ptpimg.me     | Not supported               | Required by PTP, accepted by most trackers |
| **OnlyImage** | onlyimage.org | Time-based (ISO 8601)       | Used by OnlyEncodes and other trackers     |
| **ImgBB**     | imgbb.com     | Time-based (60s - 180 days) | Widely accepted free host                  |

None of the three services support "burn after reading" (view-count-based self-destruct). PTPImg hosts images permanently. OnlyImage and ImgBB support time-based auto-deletion.

## Setting Up API Keys

Go to **Settings → General → Image Hosting** to add your API keys.

Each key is encrypted at rest using the same AES-256-GCM encryption used for tracker API tokens. The app only stores whether a key is configured (shown as a "configured" badge) — the plaintext key is never returned to the browser after saving.

### Where to Get Your API Key

**PTPImg:** Log into ptpimg.me, view page source, and find the `api_key` value. It looks like a UUID: `44171be4-eb87-444f-9c49-11268f470e12`.

**OnlyImage:** Go to your user settings at onlyimage.org and find the API section. The key is a long hex string starting with `chv_`.

**ImgBB:** Create a free account at api.imgbb.com and generate an API key from the dashboard. It's a 32-character hex string.

### Managing Keys

- **Save Key** — Paste the key and click Save. It's encrypted before storage.
- **Replace Key** — Click "Replace Key" to enter a new one. The old key is overwritten.
- **Remove** — Click "Remove" to delete the stored key. This does not delete any images already uploaded.

## Expiration

When uploading to ImgBB or OnlyImage, you can optionally set images to auto-delete after a set time. PTPImg does not support expiration — all PTPImg uploads are permanent.

| Duration | ImgBB         | OnlyImage |
| -------- | ------------- | --------- |
| 1 minute | Yes (minimum) | Yes       |
| 1 hour   | Yes           | Yes       |
| 1 day    | Yes           | Yes       |
| 1 week   | Yes           | Yes       |
| 30 days  | Yes           | Yes       |
| 180 days | Yes (maximum) | Yes       |

## Supported File Types

JPEG, PNG, GIF, WebP, BMP, and AVIF. Maximum file size is 32 MB.

## Backups

Image hosting API keys are included in backups as encrypted ciphertext. When restoring from a backup created on a different instance (different encryption salt), the keys are automatically re-encrypted using the current instance's key. If re-encryption fails, the keys are silently cleared — you'll need to re-enter them after restore.

Backups created before the image hosting feature was added will not contain these keys. Restoring from such a backup will not affect any keys you've already configured.

## Security

- API keys are encrypted at rest using the same encryption as your tracker tokens
- Keys are never shown after saving — the app only displays whether a key is configured
- Uploads require you to be logged in
- Keys are sent securely to the hosting services (never in URLs where they could leak into logs)
