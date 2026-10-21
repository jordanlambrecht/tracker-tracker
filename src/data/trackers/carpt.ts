// src/data/trackers/carpt.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const carpt: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "carpt",
  name: "CarPT",
  abbreviation: "CPT",
  url: "https://carpt.net",
  description: "Chinese private tracker for HD movies, TV, music and games, running NexusPHP.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "carpt",
  apiPath: "/userdetails.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "HD Movies / TV / Music",
  contentCategories: ["Movies", "TV", "Anime", "Documentaries", "Music", "Games"],
  language: "Chinese",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#2E8B57",
  logo: "",
  bonusName: "Magic Points",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Peasant",
      requirements:
        "Demoted when the ratio falls below the tier for downloaded volume: 0.5 above 50 GB, 0.6 above 100 GB, 0.7 above 200 GB, 0.8 above 400 GB, 0.9 above 800 GB. 10 days to recover",
      outsideLadder: "below",
    },
    { name: "User", requirements: "Entry class" },
    {
      name: "Power User",
      requirements:
        "4 weeks, 40,000 seeding points, 200 GB downloaded, ratio > 2 (demoted below 1.95)",
      perks: [
        { type: "invite", label: "1 Invite" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "View NFO and user list" },
      ],
    },
    {
      name: "Elite User",
      requirements:
        "8 weeks, 80,000 seeding points, 500 GB downloaded, ratio > 3 (demoted below 2.95)",
      perks: [
        { type: "invite", label: "1 Invite" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "Account kept when archived" },
      ],
    },
    {
      name: "Crazy User",
      requirements:
        "15 weeks, 150,000 seeding points, 1 TB downloaded, ratio > 4 (demoted below 3.95)",
      perks: [
        { type: "invite", label: "2 Invites" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "Anonymous mode" },
      ],
    },
    {
      name: "Insane User",
      requirements:
        "25 weeks, 250,000 seeding points, 2 TB downloaded, ratio > 5 (demoted below 4.95)",
      perks: [
        { type: "invite", label: "2 Invites" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "View logs" },
      ],
    },
    {
      name: "Veteran User",
      requirements:
        "40 weeks, 400,000 seeding points, 4 TB downloaded, ratio > 6 (demoted below 5.95)",
      perks: [
        { type: "invite", label: "3 Invites" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "View comment and post history" },
      ],
    },
    {
      name: "Extreme User",
      requirements:
        "60 weeks, 600,000 seeding points, 6 TB downloaded, ratio > 7 (demoted below 6.95)",
      perks: [
        { type: "invite", label: "3 Invites" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "Account retained permanently" },
      ],
    },
    {
      name: "Ultimate User",
      requirements:
        "80 weeks, 800,000 seeding points, 8 TB downloaded, ratio > 8 (demoted below 7.95)",
      perks: [
        { type: "invite", label: "5 Invites" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "Account retained permanently" },
      ],
    },
    {
      name: "Nexus Master",
      requirements:
        "100 weeks, 1,000,000 seeding points, 10 TB downloaded, ratio > 9 (demoted below 8.95)",
      perks: [
        { type: "invite", label: "10 Invites" },
        { type: "upload", label: "Upload Torrents" },
        { type: "custom", label: "Send Invites" },
      ],
    },
    { name: "Star", requirements: "Donation", outsideLadder: "above" },
    {
      name: "VIP",
      requirements: "Staff-granted; exempt from auto-demotion",
      outsideLadder: "above",
    },
    { name: "Retiree", requirements: "Retired staff", outsideLadder: "above" },
    { name: "Uploader", requirements: "Staff-assigned uploader", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Sysop", requirements: "Staff", outsideLadder: "above" },
    { name: "Staff Leader", requirements: "Staff", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // The hard floor is 0.5 above 50 GB downloaded and rises to 0.9 above
    // 800 GB; 0.5 is the value the health alert can represent.
    minimumRatio: 0.5,
    seedTimeHours: 24,
    // Non-parked accounts are banned after 90 days without login.
    loginIntervalDays: 90,
    fulfillmentPeriodHours: 240,
    satisfactionMode: "any",
    hnrBanLimit: 20,
    fullRulesMarkdown: [
      "## Account retention",
      "",
      "- Extreme User and above are retained permanently",
      "- Elite User and above keep an archived account",
      "- Parked accounts are banned after 150 consecutive days without login",
      "- Non-parked accounts are banned after 90 consecutive days without login",
      "- Accounts with no traffic (0 upload and 0 download) are banned after 14 days without login",
      "- Banned accounts are deleted after 200 consecutive days without login",
      "",
      "## Ratio",
      "",
      "- Below 0.5 with more than 50 GB downloaded",
      "- Below 0.6 with more than 100 GB downloaded",
      "- Below 0.7 with more than 200 GB downloaded",
      "- Below 0.8 with more than 400 GB downloaded",
      "- Below 0.9 with more than 800 GB downloaded",
      "- A low ratio can disable download privileges or ban the account",
      "- Power User: 4 weeks, 40,000 seeding points, 200 GB, ratio > 2",
      "- Elite User: 8 weeks, 80,000 points, 500 GB, ratio > 3",
      "- Crazy User: 15 weeks, 150,000 points, 1 TB, ratio > 4",
      "- Insane User: 25 weeks, 250,000 points, 2 TB, ratio > 5",
      "- Veteran User: 40 weeks, 400,000 points, 4 TB, ratio > 6",
      "- Extreme User: 60 weeks, 600,000 points, 6 TB, ratio > 7",
      "- Ultimate User: 80 weeks, 800,000 points, 8 TB, ratio > 8",
      "- Nexus Master: 100 weeks, 1,000,000 points, 10 TB, ratio > 9",
      "",
      "## Hit & Run",
      "",
      "- Seed each download for at least 24 hours within 10 days, or upload 10 times its size",
      "- 20 H&R warnings ban the account",
      "- VIP and Star members are exempt from H&R",
      "- Removing one H&R costs 20,000 magic points",
      "",
      "## Upload speed",
      "",
      "- Non-publishers must stay under 25 MB/s upload",
      "- Exceeding 100 MB/s triggers an automatic ban",
      "- Reported upload is penalised at 3 times the excess volume",
      "",
      "## Accounts and conduct",
      "",
      "- Cheating and multiple accounts are permanent bans",
      "- Never upload CarPT torrents to other trackers",
      "- Invite trading, selling and inviting strangers are prohibited",
      "- Forum trouble: first warning, second permanent ban",
      "",
      "## Promotions and uploads",
      "",
      "- Torrents over 20 GB, Blu-ray, HD DVD and the first episode of a season are free",
      "- Promotions: free, 2x upload, 50% and 30% download; 2x upload has no time limit",
      "- Every torrent becomes 2x upload one month after release",
      "- HD video only; pornographic content is prohibited",
      "- Files under 100 MB, upscaled SD, CAM/TS/SCR, RAR archives and duplicates are not allowed",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/userdetails.php?id={id}",
}
