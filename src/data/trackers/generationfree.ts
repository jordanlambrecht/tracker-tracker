// src/data/trackers/generationfree.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const generationfree: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "generationfree",
  name: "Generation-Free",
  abbreviation: "GF-FREE",
  url: "https://generation-free.org",
  description:
    "French private general tracker for movies, TV, documentaries, music, games, software and ebooks. Free with a limited number of spots, so inactive accounts are deleted after 45 days.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Documentaries",
    "Music",
    "Games",
    "Apps",
    "Books",
    "Sports",
    "XXX",
  ],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e11d48",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The site's wiki describes these statuses without numeric thresholds.
  userClasses: [
    { name: "Leech", requirements: "Ratio below 0.50", outsideLadder: "below" },
    { name: "User", requirements: "Base status for active members" },
    { name: "PowerUser", requirements: "More seniority and activity" },
    { name: "SuperUser", requirements: "Very active members" },
    { name: "ExtremeUser", requirements: "Members who share a lot" },
    { name: "InsaneUser", requirements: "The biggest uploaders and seeders" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.5,
    seedTimeHours: 72,
    loginIntervalDays: 45,
    fulfillmentPeriodHours: 360,
    hnrBanLimit: 5,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- The mandatory minimum ratio is 0.50",
      "- Below it you are moved to Leech; downloads can be blocked and privileges removed",
      "",
      "## Seeding / Hit & Run",
      "",
      "- Every downloaded torrent must be seeded for at least 72 hours, whatever your ratio",
      "- You have 15 days after the download to reach those 72 hours",
      "- Freeleech torrents must be seeded too",
      "- Any torrent you start must be finished",
      "- 1 hit and run is a warning, 5 block downloads and 10 mean a permanent ban",
      "",
      "## Account inactivity",
      "",
      "- Accounts with no activity for 45 days are deleted automatically, whatever the rank",
      "",
      "## New uploads",
      "",
      "- New torrents are held back from RSS and the API for 12 hours, and cross-seeding them during that time is forbidden",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified. Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/users/{username}",
}
