// src/data/trackers/seedcore.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedcore",
  name: "SeedCore",
  abbreviation: "",
  url: "https://seedcore.net",
  description:
    "Romanian invite-only general tracker covering movies, TV, music, games, and more. Runs UNIT3D.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "XXX"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f97316",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Archivist",
      requirements:
        "Ratio ≥ 0.40, account age ≥ 3 months, seed size ≥ 10 TB, avg seedtime ≥ 2 months. 500 download slots, H&R immune, freeleech, double upload, invites, requests, upload",
    },
    {
      name: "Seeder",
      requirements:
        "Ratio ≥ 0.40, account age ≥ 1 month, seed size ≥ 5 TB, avg seedtime ≥ 1 month. 400 download slots, H&R immune, double upload, invites, requests, upload",
    },
    {
      name: "Veteran",
      requirements:
        "Upload ≥ 100 TB, ratio ≥ 0.40, account age ≥ 1 year. 120 download slots, invites, requests, upload",
    },
    {
      name: "InsaneUser",
      requirements:
        "Upload ≥ 50 TB, ratio ≥ 0.40, account age ≥ 6 months. 100 download slots, invites, requests, upload",
    },
    {
      name: "ExtremeUser",
      requirements:
        "Upload ≥ 20 TB, ratio ≥ 0.40, account age ≥ 3 months. 80 download slots, invites, requests, upload",
    },
    {
      name: "SuperUser",
      requirements:
        "Upload ≥ 5 TB, ratio ≥ 0.40, account age ≥ 2 months. 60 download slots, invites, requests, upload",
    },
    {
      name: "PowerUser",
      requirements:
        "Upload ≥ 1 TB, ratio ≥ 0.40, account age ≥ 1 month. 40 download slots, invites, requests, upload",
    },
    {
      name: "User",
      requirements: "No special requirements. 25 download slots, upload",
    },
    {
      name: "Leech",
      requirements: "No special requirements. 0 download slots, no privileges",
    },
    {
      name: "VIP",
      requirements:
        "Manually granted by staff. Unlimited download slots, H&R immune, freeleech, invites, requests, upload",
    },
    {
      name: "Trustee",
      requirements:
        "Manually granted by staff. Unlimited download slots, H&R immune, freeleech, trusted uploads, invites, requests, upload",
    },
    {
      name: "Internal",
      requirements:
        "Manually granted by staff. Unlimited download slots, H&R immune, freeleech, trusted uploads, invites, requests, upload",
    },
    {
      name: "Disabled",
      requirements: "Manually granted by staff. 0 download slots, no privileges",
    },
    {
      name: "Banned",
      requirements: "Manually granted by staff. 0 download slots, no privileges",
    },
    {
      name: "Pruned",
      requirements: "Manually granted by staff. 0 download slots, no privileges",
    },
    {
      name: "Administrator",
      requirements:
        "Staff. Unlimited download slots, H&R immune, freeleech, double upload, trusted uploads, invites, requests, upload, moderator and admin tools",
    },
    {
      name: "Moderator",
      requirements:
        "Staff. Unlimited download slots, H&R immune, freeleech, trusted uploads, invites, requests, upload, moderator tools",
    },
    {
      name: "Torrent Moderator",
      requirements:
        "Staff. Unlimited download slots, H&R immune, freeleech, trusted uploads, invites, requests, upload, torrent moderation and editor tools",
    },
    {
      name: "Editor",
      requirements:
        "Staff. Unlimited download slots, H&R immune, freeleech, trusted uploads, invites, requests, upload, editor tools",
    },
    {
      name: "Uploader",
      requirements:
        "Staff. Unlimited download slots, H&R immune, freeleech, trusted uploads, invites, requests, upload, official uploader status",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 0,
    fullRulesMarkdown: [
      "## Seeding & Ratio",
      "",
      "- Seed every torrent for at least 72 hours (3 days) or until the ratio reaches 1:1",
      "- The 72 hours do not have to be continuous: you can accumulate them within 20 days",
      "- Hit & Run is strictly forbidden",
      "- FREELEECH does not exempt you from the seed time",
      "",
      "## Cheating",
      "",
      "- Ratio cheating, fake seeding, and traffic spoofing lead to a permanent ban on detection, with no warning",
      "- Modified clients, fake announces, and spoofing lead to an instant ban",
      "",
      "## Account",
      "",
      "- One account per person. Multiple accounts lead to a permanent ban",
      "- A valid email address is required",
      "- Rules may change without notice and staff decisions are final",
      "",
      "## Classes",
      "",
      "- Every automatic class requires a ratio of at least 0.40",
      "- Higher classes add upload volume, account age, seed size, and average seedtime requirements",
      "- Promotions and demotions run automatically from your stats (AutoGroup)",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
