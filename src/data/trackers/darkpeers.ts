// src/data/trackers/darkpeers.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const darkpeers: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "darkpeers",
  name: "DarkPeers",
  abbreviation: "DP",
  url: "https://darkpeers.org",
  description:
    "Nordic-based general tracker covering movies, TV, music, games, and books. UNIT3D. Launched March 2025.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#c0c0c0",
  logo: "/tracker-logos/darkpeers_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Validating", requirements: "New account, no privileges" },
    { name: "User", requirements: "Ratio ≥ 0.8. 10 download slots" },
    {
      name: "PowerUser",
      requirements:
        "Upload ≥ 1 TiB, ratio ≥ 0.8, age ≥ 1 month. 15 download slots, can upload and invite",
    },
    {
      name: "Seeder",
      requirements:
        "Ratio ≥ 0.8, age ≥ 1 month, avg seedtime ≥ 1 month, seed size ≥ 3 TiB. 15 download slots",
    },
    {
      name: "SuperUser",
      requirements: "Upload ≥ 5 TiB, ratio ≥ 0.8, age ≥ 2 months, 5+ uploads. 20 download slots",
    },
    {
      name: "Collector",
      requirements:
        "Ratio ≥ 0.8, age ≥ 2 months, avg seedtime ≥ 2 months, seed size ≥ 8 TiB. 20 download slots",
    },
    {
      name: "ExtremeUser",
      requirements:
        "Upload ≥ 20 TiB, ratio ≥ 0.8, age ≥ 4 months, avg seedtime ≥ 2 months, 15+ uploads. 40 download slots, torrent moderation bypass, invite forum",
    },
    {
      name: "Hoarder",
      requirements:
        "Ratio ≥ 0.8, age ≥ 4 months, avg seedtime ≥ 3 months, seed size ≥ 16 TiB. 40 download slots, torrent moderation bypass, invite forum",
    },
    {
      name: "InsaneUser",
      requirements:
        "Upload ≥ 60 TiB, ratio ≥ 0.8, age ≥ 8 months, avg seedtime ≥ 3 months, seed size ≥ 25 TiB, 25+ uploads. 50 download slots, immune to HnR warnings",
    },
    {
      name: "Veteran",
      requirements:
        "Upload ≥ 120 TiB, ratio ≥ 1.0, age ≥ 1 year, avg seedtime ≥ 4 months, seed size ≥ 40 TiB, 50+ uploads. Unlimited download slots, freeleech",
    },
    {
      name: "Legend",
      requirements:
        "Upload ≥ 200 TiB, ratio ≥ 1.2, age ≥ 2 years, avg seedtime ≥ 5 months, seed size ≥ 50 TiB, 100+ uploads. Unlimited download slots, freeleech, double upload",
    },
  ],
  releaseGroups: ["DarkSouls", "WhiskeyJack"],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.8,
    seedTimeHours: 144,
    loginIntervalDays: 90,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Seeding / Hit & Run",
      "",
      "- Must seed to 1:1 ratio or 144 hours (6 days), whichever comes first",
      "- Applies even to freeleech torrents",
      "- Rule kicks in after downloading ≥ 10% of the torrent",
      "- Seedtime only starts counting at 100% downloaded",
      "- Pre-warning sent after 24 hours disconnected without meeting requirements",
      "- 3+ active warnings → download privileges revoked",
      "- Warnings can be removed with BON (both active and expired)",
      "",
      "## Ratio",
      "",
      "- Minimum ratio: 0.8",
      "- Below 0.8 → lose download privileges, forum posting, chat, and request access",
      "- Buffer formula: (Upload / 0.8) − Download",
      "",
      "## Account Inactivity",
      "",
      "- 90 days without login → account disabled (active seeding prevents disable but does not reset timer)",
      "- 120 consecutive days → account pruned (staff cannot restore)",
      "",
      "## General",
      "",
      "- One account per person",
      "- SFW avatars only",
      "- No DMs to staff — use the support desk",
      "- No links to warez, streaming, serial codes, or other trackers in forums",
      "",
      "## Uploading",
      "",
      "- Must seed uploads for 168 hours (7 days) or until 10+ seeders/snatches",
      "- Original release names only — no renaming or retagging",
      "- No repacks or raw ISOs",
      "- No banned release groups",
      "",
      "## Promotions",
      "",
      "- Checked daily at midnight UTC",
      "- Can also be demoted if you no longer meet requirements",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
