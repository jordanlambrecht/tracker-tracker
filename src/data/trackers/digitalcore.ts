// src/data/trackers/digitalcore.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const digitalcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "digitalcore",
  name: "DigitalCore",
  abbreviation: "DC",
  url: "https://digitalcore.club",
  description:
    "Scene-oriented 0day/general tracker with 1.5M+ torrents. Movies, TV, music, apps, games, ebooks.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "0day / General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ffffff",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Rogue", requirements: "Starting class" },
    {
      name: "Sentinel",
      requirements:
        "Age ≥ 14 days, upload ≥ 50 GiB, ratio ≥ 1.05. Requests, bonus system, moderated uploads",
    },
    {
      name: "Viceroy",
      requirements:
        "Age ≥ 105 days, upload ≥ 300 GiB, ratio ≥ 1.10. Top lists, extended stats, IP logging cleared",
    },
    {
      name: "Sentry",
      requirements:
        "Age ≥ 210 days, upload ≥ 1.2 TiB, ratio ≥ 1.10. 3 request slots, 2 invites, Sentry+ forums",
    },
    {
      name: "Guardian",
      requirements:
        "Age ≥ 500 days, upload ≥ 5 TiB, ratio ≥ 20.0. 5 extra invites, 6 extra request slots, unmoderated uploads",
    },
    {
      name: "Vanguard",
      requirements:
        "Age ≥ 730 days, upload ≥ 20 TiB, ratio ≥ 20.0. 10 extra invites, 10 extra request slots",
    },
    { name: "Uploader", requirements: "Staff-granted for high-volume uploaders" },
    { name: "Titan", requirements: "Staff-granted — highest community honor" },
    { name: "VIP", requirements: "Staff-granted for significant contributions or donation" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.5,
    seedTimeHours: 0,
    loginIntervalDays: 90,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Minimum ratio: 0.5",
      "- Below 0.5 → 5 days to recover (ratio watch), then download privileges revoked",
      "- Leech bonus system: every 10 GB actively seeded = 1% download discount, up to 100% (site-wide freeleech at 1 TiB seeded)",
      "- Inverse scarcity bonus: torrents with fewer seeders give higher bonus",
      "- 24-hour freeleech on all new uploads",
      "- Large torrents may also be freeleech",
      "",
      "## Hit & Run",
      "",
      "- No explicit minimum seed time, but HnR system exists",
      "- Must not abandon torrents after snatching",
      "",
      "## Account Inactivity",
      "",
      "- Must remain active — inactive accounts are disabled",
      "",
      "## General",
      "",
      "- One account per person per lifetime",
      "- Torrent files are unique to you — do not share or use with debrid services",
      "- Cross-seeding is allowed",
      "- VPNs are allowed (bind to torrent client only recommended)",
      "- No buying/selling invites",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
