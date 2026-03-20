---
title: Stats Explained
description: Plain-language explanations of every stat Tracker Tracker collects from your private tracker accounts.
---

# Stats Explained

At each poll interval, Tracker Tracker fetches a snapshot of your stats from each tracker. This page explains what each stat means and which platforms support it.

---

## Upload and Download

### Uploaded

The total amount of data you have contributed to the swarm across your entire account history. This number only ever goes up. Upload credit is the primary currency on private trackers — it is the basis for your ratio and your buffer.

### Downloaded

The total amount of data your client has received from the swarm. Like uploaded, this is a lifetime counter. A few trackers run occasional "download forgiveness" events that can reduce this number, but that is rare.

A large download total is not a problem on its own. What matters is your ratio relative to it.

---

## Ratio

### Ratio

Your ratio is your uploaded total divided by your downloaded total. If you have uploaded 400 GiB and downloaded 200 GiB, your ratio is 2.00.

Most trackers require a minimum ratio. Falling below it can restrict your ability to download or result in a warning.

A ratio of `∞` means you have uploaded data but downloaded nothing. This typically happens when you seed your own uploads.

### Required Ratio

The minimum ratio your account must maintain, set by the tracker. A required ratio of `0.60` means you must have uploaded at least 60% of what you have downloaded.

Some trackers have a grace period for new members — no requirement for the first few gigabytes, then the requirement kicks in.

**Availability:** Not available on UNIT3D. Available on Gazelle and GGn.

---

## Buffer

Your buffer is the gap between where your ratio is now and where it would need to drop before you hit the tracker's required minimum. A larger buffer means you can grab more content before ratio becomes a concern.

How buffer is calculated depends on the platform:

- **UNIT3D** — The tracker calculates buffer server-side and returns it directly. This is the most accurate value.
- **Gazelle and GGn** — Tracker Tracker calculates buffer as uploaded minus downloaded (your net upload surplus). This is a simplified figure; it does not factor in your required ratio.

A negative buffer means you are already in deficit — your downloaded total exceeds your uploaded total.

---

## Seeding and Leeching

### Seeding Count

The number of torrents your client is currently seeding (uploading to others). Seeding is how you build upload credit over time. Some trackers enforce minimum seeding requirements — for example, requiring you to seed each download for a set amount of time.

**Availability:** Available on UNIT3D. Available on some Gazelle forks. On GGn, this is tied to your account's paranoia setting — if you have high paranoia, this field may not be visible even to the API.

### Leeching Count

The number of torrents your client is currently downloading. This should normally be low or zero when you are not actively grabbing anything.

**Availability:** Same as seeding count.

---

## Seedbonus / Gold

A site currency earned by continuously seeding torrents. The earn rate usually depends on how long you have been seeding, how large the torrent is, and how many other seeders are active. You can typically spend this currency on freeleech tokens, upload credit, or store items.

**Platform notes:**

- **UNIT3D** — Called "seedbonus" or "Bonus Points" depending on the site.
- **Gazelle** — Called "Bonus Points" or "BP" on most forks.
- **GGn** — Uses a distinct `gold` currency. Gold is earned through seeding and spent within GGn's own economy (achievements, buffs, store items).

---

## Hit & Runs

A hit-and-run happens when you download a torrent and disconnect from the swarm before seeding it back to a 1:1 ratio, or before meeting a minimum seed time requirement. Trackers track H&Rs to identify members who consume content without contributing.

Accumulating H&Rs typically leads to warnings or download restrictions.

**Availability:**

- **UNIT3D** — Available. Shows 0 when you have no H&Rs.
- **Gazelle** — Not available. Tracker Tracker shows nothing for Gazelle sites.
- **GGn** — Available, but may be `null` if the tracker does not surface this data for your account.

---

## Account Status

### Warned

Whether your account is currently under a warning from tracker staff. Warnings are issued for rule violations such as hit-and-runs, ratio problems, or conduct issues. A warned account may have restricted download access.

**Availability:**

- **UNIT3D** — Not available via the API.
- **Gazelle** — Available on sites that support the extended user profile call. Without it, Tracker Tracker defaults to showing no warning.
- **GGn** — Available directly from your user profile.

### Username

Your account username on the tracker. Whether this is saved and displayed depends on the "Store Tracker Usernames" setting. See [Settings Reference](./settings.md) for details.

### Class / Rank

Your membership class on the tracker — things like "Member", "Power User", "Elite", "VIP", or "Donor". Trackers promote users based on combinations of ratio, total upload, seedbonus, account age, and community contributions.

Tracker Tracker records whatever class string the tracker returns. It does not compare or rank classes across different trackers.

---

## Freeleech Tokens

Tokens you can apply to individual torrents so that downloading them does not count against your downloaded total. Using a freeleech token lets you grab content without hurting your ratio.

**Availability:**

- **UNIT3D** — Not available.
- **Gazelle** — Available on some forks. Not all Gazelle-based sites expose this field.
- **GGn** — Not available. GGn uses its gold economy instead of separate freeleech tokens.

---

## Share Score

A composite score specific to GGn that combines upload activity, seeding time, and other factors into a single number. Not available on UNIT3D or Gazelle sites.
