---
title: Stats Explained
description: Plain-language explanations of every stat Tracker Tracker collects from your private tracker accounts.
---

# Stats Explained

We save a snapshot on every poll. Here's what each stat means.

---

## Upload and Download

### Uploaded

Total data you've contributed since signup. It only goes up. Upload is the main currency on private trackers — it drives ratio and buffer.

### Downloaded

Total data you've received since signup. Like upload, it's a lifetime counter. Some trackers run rare "download forgiveness" events that reduce it.

A large download isn't a problem — your ratio relative to it is what matters.

---

## Ratio

### Ratio

Upload divided by download. Upload 400 GiB and download 200 GiB, you get 2.00.

Most trackers enforce a minimum. Fall below it and you lose download access or get warned.

A ratio of `∞` means you uploaded but never downloaded — i.e., you seeded your own uploads.

### Required Ratio

The minimum ratio you must maintain. A requirement of `0.60` means you must upload at least 60% of your download.

Some trackers give new members grace — no requirement for the first few GiB.

**Availability:** Not on UNIT3D. Available on Gazelle and GGn.

---

## Buffer

How far below the required minimum you could fall. A bigger buffer means you can grab more without hitting your ratio floor.

Calculation varies:

- **UNIT3D** — Server-side calculation. Most accurate.
- **Gazelle and GGn** — Upload minus download (net surplus). Doesn't account for your required ratio.

A negative buffer means you're already in deficit.

---

## Seeding and Leeching

### Seeding Count

How many torrents you're currently uploading. Seeding builds upload credit. Some trackers require minimum seeding — i.e., seed each download for a set period.

**Availability:** On UNIT3D. On some Gazelle forks. On GGn, it depends on your paranoia setting — high paranoia hides it from the API.

### Leeching Count

How many torrents you're currently downloading. Usually zero when you're not grabbing.

**Availability:** Same as seeding.

---

## Seedbonus / Gold

A site currency earned by seeding. Earn rate depends on seed time, torrent size, and how many other seeders are active. Spend it on freeleech tokens, upload credit, or store items.

**Platform notes:**

- **UNIT3D** — Called "seedbonus" or "Bonus Points".
- **Gazelle** — Called "Bonus Points" or "BP".
- **GGn** — Uses a separate `gold` currency, spent in GGn's economy (achievements, buffs, store).

---

## Hit & Runs

A hit-and-run is downloading and bailing before seeding to 1:1 or meeting minimum seed time. Trackers penalize members who consume without contributing.

Too many H&Rs lead to warnings or download loss.

**Availability:**

- **UNIT3D** — Available. Shows 0 when you have none.
- **Gazelle** — Not available.
- **GGn** — Available, but may be `null` if the tracker doesn't expose it.

---

## Account Status

### Warned

Whether you're under a staff warning. Warnings come from H&Rs, ratio drops, or conduct. Warned accounts may lose download.

**Availability:**

- **UNIT3D** — Not exposed via API.
- **Gazelle** — Available on sites that support the extended user profile call. Otherwise defaults to no warning.
- **GGn** — Available from your profile.

### Username

Your tracker username. Visibility depends on the "Store Tracker Usernames" setting. See [Settings Reference](./settings.md).

### Class / Rank

Your member class — "Member", "Power User", "Elite", "VIP", "Donor", etc. Promotion is based on ratio, upload, seedbonus, age, and contributions.

We record what the tracker returns. No cross-tracker comparison.

---

## Freeleech Tokens

Apply these to torrents so downloads don't count against ratio. Grab content without penalty.

**Availability:**

- **UNIT3D** — Not available.
- **Gazelle** — Available on some forks. Not all expose it.
- **GGn** — Not available. Uses gold economy instead.

---

## Share Score

A GGn-specific score combining upload activity, seeding time, and other factors.
