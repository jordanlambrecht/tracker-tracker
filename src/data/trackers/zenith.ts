// src/data/trackers/zenith.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const zenith: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "zenith",
  name: "Zenith",
  abbreviation: "ZN",
  url: "https://znth.cx",
  description: "Private general tracker with a clean UNIT3D interface.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Books", "Audiobooks", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7c3aed",
  logo: "",
  bonusName: "BON",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "User", requirements: "No thresholds" },
    {
      name: "Explorer",
      requirements: "Seedsize 1 TiB, account age 1 week, weighted average seedtime 3 days",
    },
    {
      name: "Bulker",
      path: "upload",
      requirements:
        "Seedsize 512 GiB, age 1 month, weighted average seedtime 2 weeks, 100 uploaded torrents",
      perks: [
        { type: "download-slots", label: "DL Slots: 15" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Refundable" },
      ],
    },
    {
      name: "Force",
      path: "upload",
      requirements:
        "Seedsize 1.5 TiB, age 3 months, weighted average seedtime 3 weeks, 200 uploaded torrents",
      perks: [
        { type: "download-slots", label: "DL Slots: 30" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "double-upload", label: "Double Upload" },
        { type: "custom", label: "Refundable" },
        { type: "mod-bypass", label: "Torrent Mod Bypass" },
      ],
    },
    {
      name: "Protector",
      path: "upload",
      requirements:
        "Seedsize 3 TiB, age 6 months, weighted average seedtime 4 weeks, 500 uploaded torrents",
      perks: [
        { type: "download-slots", label: "DL Slots: 50" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "double-upload", label: "Double Upload" },
        { type: "custom", label: "Refundable" },
        { type: "hnr-immune", label: "H&R Immune" },
        { type: "mod-bypass", label: "Torrent Mod Bypass" },
      ],
    },
    {
      name: "Climber",
      path: "seedsize",
      requirements: "Seedsize 4 TiB, age 1 month, weighted average seedtime 2 weeks",
      perks: [
        { type: "download-slots", label: "DL Slots: 15" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Refundable" },
      ],
    },
    {
      name: "Builder",
      path: "seedsize",
      requirements: "Seedsize 16 TiB, age 3 months, weighted average seedtime 3 weeks",
      perks: [
        { type: "download-slots", label: "DL Slots: 30" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Refundable" },
      ],
    },
    {
      name: "Hoarder",
      path: "seedsize",
      requirements: "Seedsize 30 TiB, age 6 months, weighted average seedtime 4 weeks",
      perks: [
        { type: "download-slots", label: "DL Slots: 50" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "custom", label: "Refundable" },
        { type: "hnr-immune", label: "H&R Immune" },
      ],
    },
  ],
  rankPaths: [
    { id: "upload", label: "Upload path", description: "Uploaded torrents required" },
    { id: "seedsize", label: "Seedsize path", description: "No uploaded torrents required" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // Zenith is ratioless; ratio only affects rank progression.
    minimumRatio: 0,
    seedTimeHours: 72,
    loginIntervalDays: 150,
    fullRulesMarkdown: [
      "## Seeding & HnR",
      "",
      "- Seed every download for at least 72 hours",
      "- Once 20% of a torrent is downloaded it must be completed and seeded for 72 hours",
      "- Being disconnected for more than 14 days without completing the seed time is a Hit and Run",
      "- Seed your own uploads for at least 1 week, or until 3 other seeders have it",
      "- Seeding a torrent for 69 days earns a refund: its credited download becomes zero",
      "",
      "## Ratio",
      "",
      "- Zenith is ratioless; ratio is only used for rank progression",
      "- Freeleech downloads do not count; double-upload torrents credit 2 GB per 1 GB uploaded",
      "- Torrents 30 GB or larger, 4K, music, eBooks and audiobooks are freeleech",
      "- Featured, encoder and internal releases are freeleech and double upload",
      "",
      "## Ranks",
      "",
      "- Ranks update daily at 00:00 UTC",
      "- Explorer splits into an upload path (Bulker, Force, Protector) and a seedsize path (Climber, Builder, Hoarder)",
      "- You sit in the highest group you qualify for on either path",
      "- Awarded and system groups sit outside the ladder",
      "",
      "## Uploading",
      "",
      "- Use the Torrent Builder; follow the naming guide for each content type",
      "- Games and software are allowed with install and usage instructions",
      "- Fix trumpable uploads before another release replaces them",
      "",
      "## Connectivity & account",
      "",
      "- Never share your announce URL, passkey or .torrent files",
      "- A VPN with port forwarding is recommended; SOCKS proxying is not supported",
      "- One account per person; modified and blacklisted clients are prohibited",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/users/{username}",
}
