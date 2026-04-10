---
title: Tracker Transit Papers
description: Generate tamper-resistant proof-of-membership images for private tracker applications.
---

# Tracker Transit Papers

!!! danger "This feature is currently unreleased"

!!! warning "Beta — Highly Experimental"
    Transit Papers are under active development. The report format, encoding scheme, and verification behavior may change between versions. Reports generated with one version are not guaranteed to verify correctly with a future version. Use at your own risk.

Transit Papers generate tamper-resistant PNG images of your tracker stats to share with moderators when applying to new trackers. Unlike a screenshot (faked in 30 seconds), they use server-side rendering with cryptographically linked elements — edit any part and the links break. The verification tool catches tampering. These reports are **Proofs of Citizenship**.

!!! warning "What Transit Papers are NOT"

    They're **not cryptographic proof** your stats are real. Self-hosted means you control the machine, database, and network. A determined attacker could fake data before generation. But this system makes forgery impractical — faking a screenshot takes 30 seconds; faking a Transit Paper means cloning the project, setting up a database, fabricating internally consistent stats across 10+ math-linked fields, and matching the exact API schema of your target tracker. Much harder. Transit Papers help mods decide — they don't replace human judgment. Direct tracker profile access is always more trustworthy.

---

## Generating a Proof of Citizenship

Go to a tracker's detail page and generate a report. Tracker Tracker renders your most recent snapshot server-side and returns a 1200x630 PNG with:

- **Tracker name and platform** — which tracker and its software
- **Your identity** — username, class/rank, join date (when available)
- **Your stats** — upload, download, ratio, buffer, seeding count, seedbonus, hit & runs (what's available varies by platform)
- **Fractal Seal** — a unique fractal derived from your stats. Different stats = different fractal. Serves as the encryption key for the data strip.
- **Spirograph** — a decorative hypotrochoid pattern from the generation timestamp
- **Data Strip** — a colored barcode near the bottom. Stats are serialized, encrypted with the fractal key, and encoded as colored bands.
- **Footer** — generation timestamp, report version, and full SHA-256 seed hash

---

## Sharing Your Report

### Built-in upload integrations (recommended)

Upload your Proof directly to an image host for a shareable URL. This is most reliable because the image transfers losslessly.

| Host          | Notes                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| **PTPImg**    | Most widely accepted across private trackers. Serves PNGs untouched.               |
| **OnlyImage** | onlyimage.org. Accepted by OnlyEncodes and other trackers.                         |
| **ImgBB**     | Supports auto-delete timers if you want expiring links. May recompress large PNGs. |

Configure API keys in **Settings → General → Image Hosting**.

### Manual sharing

No integration? Share the original PNG directly:

- Attach it to a forum PM or recruitment thread
- Send via IRC DCC
- Upload to any lossless image host manually (ptpimg.me, imgbox.com, catbox.moe)

!!! danger "Do not screenshot the report"

    The verification system reads pixel data from the image. A screenshot of the report is not the report. It will degrade verification or cause it to fail entirely.

---

## Compression and Image Quality

The data strip and fractal seal are verified at the pixel level. Lossy compression (JPEG, resize, re-encoding) shifts pixel colors, breaking verification or triggering fuzzy recovery with lower confidence.

### Lossless (verification works perfectly)

- ptpimg.me
- OnlyImage (onlyimage.org)
- imgbox.com
- catbox.moe
- Direct file attachment (forum PM, IRC, email)
- Discord file attachment (the actual file download, not the embedded preview)
- Telegram "send as file" (not "send as photo")
- Direct download links (Google Drive, Dropbox)

### Lossy (may degrade verification)

- ImgBB (can recompress large PNGs — test your results)
- Discord embedded preview (proxied and resized by Discord's CDN)
- iMessage / SMS
- Twitter / X
- Imgur (sometimes recompresses PNGs)
- Any mobile "send as photo" option
- Screenshotting the image
- Downloading from a web preview instead of the original file

### What happens if the image was compressed

The verifier uses fuzzy recovery: it tries nearby perceptual hash keys until it finds one that decodes successfully. The result shows how many bit corrections were needed:

| Bit flips | What it means                                                                       |
| --------- | ----------------------------------------------------------------------------------- |
| 0         | Perfect. Image arrived losslessly. Highest confidence.                              |
| 1-3       | Mild compression. Verification is still reliable.                                   |
| 4+        | Heavy compression or re-encoding. Result is valid but confidence is reduced.        |
| Failed    | Image too degraded to recover. Request the original file or a lossless-hosted link. |

**For users:** Use a built-in integration or share the original file directly.

**For mods:** If verification shows bit flips, ask the user to reshare via ptpimg or OnlyImage.

---

## For Tracker Mods: Verifying a Report

The verification tool is a standalone static page, completely separate from Tracker Tracker. It runs entirely in your browser with no account, server, or data leaving your machine. Just upload or drag-and-drop the PNG onto the verification page.

### What the verification page shows

- Whether the data strip decoded successfully
- Decoded stats: tracker name, platform, username, class, upload, download, ratio, buffer, seeding count, seedbonus, hit & runs, join date
- Side-by-side fractal comparison: extracted from image vs. regenerated from decoded stats
- Regenerated spirograph from the timestamp
- Bit corrections needed (0 = lossless)
- Overall verification status

### Verification results

**Verified — Seal + Data Match**
: Stats in the strip match the fractal. No tampering after generation. Best result.

**Data Decoded — Seal Mismatch**
: Strip decoded but fractal doesn't match. The image was edited after generation or compressed heavily. Ask for the original.

**Decode Failed**
: Image too degraded or fundamentally altered. Cannot verify.

!!! info "What verification does NOT tell you"

    It confirms internal consistency and no tampering after generation. It doesn't confirm the stats are real — the user controls their instance. Use it as one input with your own judgment.

---

## How It Works

1. Generate a report. Tracker Tracker reads your most recent snapshot.
2. Stats serialize to compact binary, hashed for a fingerprint.
3. The fingerprint determines the fractal. Different stats = different fractal.
4. The fractal derives an encryption key.
5. Stats encrypt with that key, scramble, and encode into the data strip's colored bands.
6. Fractal and strip are linked — change one and the other breaks.
7. A verifier uploads the image. The system extracts the fractal, derives the decryption key, decrypts the strip, recovers the stats, regenerates the fractal from those stats, and compares it to the image.

---

## Trust Model

### What Transit Papers defend against

| Attack                              | Defense                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Inspect element / edit browser page | No DOM — the report is a flat PNG rendered server-side                                     |
| Edit stats text in Photoshop        | Data strip still contains original values — decoded stats will not match visible text      |
| Edit the data strip colors          | Checksum fails — decode is rejected                                                        |
| Replace the fractal seal            | Strip becomes undecryptable — wrong key                                                    |
| Edit both strip and fractal         | New fractal's key will not match the encryption used on the original strip                 |
| Screenshot and re-share             | Fuzzy recovery tolerates minor compression — perceptual hashing corrects small differences |

### What Transit Papers do NOT defend against

| Attack                                                               | Why                                     | Mitigation                                                                                |
| -------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| User modifies their database before generation                       | Self-hosted — user controls the machine | Faker must fabricate internally consistent stats across 10+ mathematically related fields |
| User intercepts/modifies API response before it reaches the renderer | User controls the network stack         | Faker must produce plausible data matching the exact API schema of the target platform    |
| User modifies the source code                                        | Open source — code is public            | Faker must reproduce pixel-perfect output from the full rendering pipeline                |

!!! note "Honest positioning"

    This makes forgery impractical, not impossible. A skilled attacker with instance control could theoretically fake a report. The real threat — someone bluffing their way into a tracker invite — is effectively blocked.

---

## Privacy Considerations

- Reports contain your username, tracker name, platform, and stats — once shared, you can't control distribution.
- Image host URLs are unguessable but publicly accessible with the link.
- ImgBB supports auto-deletion if you want.
- Verification runs in-browser only with no uploads or data transmission.

---

## Image Host Setup

Configure API keys in **Settings → General → Image Hosting**.

| Host      | Where to find your key                                     | Notes                                                                             |
| --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| PTPImg    | Log into ptpimg.me, view page source, find `api_key` value | Most widely accepted. Lossless PNG hosting.                                       |
| OnlyImage | onlyimage.org → user settings → API section                | Key starts with `chv_`                                                            |
| ImgBB     | api.imgbb.com → create account → generate key              | 32-char hex. Supports auto-delete (1 min to 6 months). May recompress large PNGs. |

---

## How Verification Recovers From Compression

If an image gets mildly compressed, the fractal's fingerprint shifts by a few bits. The verifier tests nearby variants until one decrypts the data strip successfully. A checksum stops the search. It's automatic and usually takes under a second.
