---
title: Tracker Transit Papers
description: Generate tamper-resistant proof-of-membership images for private tracker applications.
---

# Tracker Transit Papers

!!! danger "This feature is currently unreleased"

!!! warning "Beta — Highly Experimental"
    Transit Papers are under active development. The report format, encoding scheme, and verification behavior may change between versions. Reports generated with one version are not guaranteed to verify correctly with a future version. Use at your own risk.

Transit Papers generate a tamper-resistant PNG image showing your stats on a single tracker. The image is designed to be shared with tracker moderators as proof of your membership and standing when applying to other trackers.

Instead of a browser screenshot — which can be faked in seconds with inspect element or Photoshop — Transit Papers produce a server-rendered image with cryptographically linked visual elements. Editing any part of the image (the stats, the fractal seal, or the data strip) breaks the link between them, and the verification tool detects it. Each report is called a **Proof of Citizenship**.

!!! warning "What Transit Papers are NOT"
    Transit Papers are **not zero-trust cryptographic proof** that the stats are real. Tracker Tracker is self-hosted. You control the machine, the database, and the network. A technically motivated user could theoretically fabricate data before generation.

    What this system does is raise the cost of forgery from **trivial** (inspect element, 30 seconds) to **impractical** (clone the project, set up a database, fabricate internally consistent stats across 10+ mathematically related fields, understand the target tracker's API schema).

    Transit Papers are a tool to assist a mod's judgment, not replace it. If a mod has direct access to your profile on the source tracker, that is always more trustworthy than any report.

---

## Generating a Proof of Citizenship

Navigate to a tracker's detail page and generate a report. Tracker Tracker uses your most recent polled snapshot to render the report server-side and returns a PNG for download.

The report is a 1200x630 image containing:

- **Tracker name and platform type** — which tracker and what software it runs
- **Your identity** — username, class/rank, and member-since date appear in a header section above the stats grid (when available).
- **Your stats** — uploaded bytes, downloaded bytes, ratio, buffer, seeding count, seedbonus, and hit & runs. Which fields appear depends on what the platform reports.
- **Fractal Seal** — a unique fractal image derived from your stats. Different stats produce a completely different fractal. This is both decorative and functional — it serves as the encryption key for the data strip.
- **Spirograph** — a decorative hypotrochoid pattern derived from the generation timestamp. Three layered curves, each 120 degrees apart on the color wheel.
- **Data Strip** — a horizontal colored barcode near the bottom of the image. Your stats are serialized, encrypted using a key derived from the fractal, and encoded as colored bands.
- **Footer** — generation timestamp, report version, and the full SHA-256 seed hash.

---

## Sharing Your Report

### Built-in upload integrations (recommended)

Tracker Tracker can upload your Proof of Citizenship directly to an image host and give you a shareable URL. This is the most reliable method because the image is transferred losslessly.

| Host          | Notes                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| **PTPImg**    | Most widely accepted across private trackers. Serves PNGs untouched.               |
| **OnlyImage** | onlyimage.org. Accepted by OnlyEncodes and other trackers.                         |
| **ImgBB**     | Supports auto-delete timers if you want expiring links. May recompress large PNGs. |

Configure API keys in **Settings → General → Image Hosting**. See the [Image Hosting](image-hosting.md) docs for setup instructions.

### Manual sharing

If you are not using an integration, share the original PNG file directly:

- Attach it to a forum PM or recruitment thread
- Send via IRC DCC
- Upload to any lossless image host manually (ptpimg.me, imgbox.com, catbox.moe)

!!! danger "Do not screenshot the report"
    The verification system reads pixel data from the image. A screenshot of the report is not the report. It will degrade verification or cause it to fail entirely.

---

## Compression and Image Quality

The data strip and fractal seal are verified at the pixel level. If the image passes through a lossy compression step (JPEG conversion, resize, re-encoding), pixel colors shift. This can cause verification to fail or require fuzzy recovery that reduces confidence.

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

**For users:** Use a built-in upload integration or share the original file directly.

**For mods:** If verification shows more than 0 bit flips, consider asking the user to reshare via ptpimg or OnlyImage.

---

## For Tracker Mods: Verifying a Report

The verification tool is a standalone static page — completely separate from any Tracker Tracker installation. It runs entirely in your browser. No account, no server connection, no data leaves your machine. You do not need to be a Tracker Tracker user to verify a report.

Upload or drag-and-drop the PNG onto the verification page.

### What the verification page shows

- Whether the data strip was successfully decoded
- The decoded stats: tracker name, platform, username, class, upload, download, ratio, buffer, seeding count, seedbonus, hit & runs, join date
- A side-by-side comparison of the fractal extracted from the image and the fractal regenerated from the decoded stats
- A regenerated spirograph from the decoded timestamp
- How many bit corrections were needed (0 = lossless)
- Overall verification status

### Verification results

**Verified — Seal + Data Match**
: The stats in the strip match the fractal. The image has not been tampered with after generation. This is the best result.

**Data Decoded — Seal Mismatch**
: The strip decoded but the fractal does not match. The image may have been edited after generation, or it experienced heavy compression. Ask for the original file.

**Decode Failed**
: The image is too degraded or has been fundamentally altered. Cannot verify.

!!! info "What verification does NOT tell you"
    Verification confirms the image is internally consistent and has not been tampered with **after generation**. It does not confirm the stats are truthful — the user controls their instance and could have fabricated data before generating the report. Use it as one input alongside your own judgment.

---

## How It Works

1. When you generate a report, Tracker Tracker reads your most recent polled snapshot from its database.
2. It serializes the stats into a compact binary format and hashes them to produce a unique fingerprint.
3. That fingerprint determines the appearance of the fractal seal. Different stats produce a completely different fractal.
4. The fractal image is used to derive an encryption key.
5. The binary stats are encrypted with that key, scrambled, and encoded into the colored bands of the data strip.
6. The fractal and strip are bound together: you cannot change one without breaking the other.
7. When a verifier uploads the image, the system extracts the fractal, derives the decryption key from it, decrypts the strip, recovers the stats, regenerates what the fractal _should_ look like from those stats, and checks that it matches what's actually in the image.

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
    This system raises forgery effort from trivial to impractical. It does not make forgery impossible. A determined attacker with technical skills who controls their instance can theoretically fabricate a valid report. The practical threat — someone trying to bluff their way into a tracker invite — is effectively blocked.

---

## Privacy Considerations

- The report contains your username, tracker name, platform type, and stats. Once shared, you cannot control its distribution.
- Image host URLs (ptpimg, imgbox, etc.) are typically unguessable but publicly accessible if someone has the link.
- ImgBB supports auto-delete timers if you want the image to expire after sharing.
- The verification tool runs entirely in the browser. No images are uploaded to any server — processing happens locally in memory and nothing is stored or transmitted.

---

## Image Host Setup

Configure image hosting API keys in **Settings → General → Image Hosting**. See the [Image Hosting](image-hosting.md) page for full setup instructions.

| Host      | Where to find your key                                     | Notes                                                                             |
| --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| PTPImg    | Log into ptpimg.me, view page source, find `api_key` value | Most widely accepted. Lossless PNG hosting.                                       |
| OnlyImage | onlyimage.org → user settings → API section                | Key starts with `chv_`                                                            |
| ImgBB     | api.imgbb.com → create account → generate key              | 32-char hex. Supports auto-delete (1 min to 6 months). May recompress large PNGs. |

---

## How Verification Recovers From Compression

When an image has been mildly compressed (passed through Discord, re-saved, etc.), the fractal's visual fingerprint may shift by a few bits. The verifier compensates by testing nearby fingerprint variants until it finds one that successfully decrypts the data strip. A checksum embedded in the payload acts as a stop condition. This process is automatic and typically completes in under a second.
