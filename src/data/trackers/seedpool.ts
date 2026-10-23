// src/data/trackers/seedpool.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedpool: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedpool",
  name: "seedpool",
  abbreviation: "SP",
  url: "https://seedpool.org",
  description:
    "General private tracker with a focus on long term seeding and a welcoming community. Known for its active IRC.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Games",
    "Apps",
    "Sports",
    "Education",
    "Audiobooks",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#22c55e",
  logo: "/tracker-logos/seedpool_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "https://status.seedpool.org/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Cesspool",
      requirements: "Ratio below 1.00 — download privileges revoked",
      outsideLadder: "below",
    },
    { name: "KiddiePool", requirements: "Timeout zone", outsideLadder: "below" },
    {
      name: "NewPool",
      requirements: "Entry group",
      perks: [
        { type: "download-slots", label: "DL Slots: 1" },
        { type: "custom", label: "Unsatisfied Slots: 1" },
      ],
    },
    {
      name: "User",
      requirements: "Ratio 1.00",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "custom", label: "Unsatisfied Slots: 20" },
      ],
    },
    {
      name: "Pool",
      requirements: "Seedsize 256 GiB, account age 1 month, ratio 1.00",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Can Request" },
        { type: "custom", label: "Unsatisfied Slots: 30" },
      ],
    },
    {
      name: "PowerPool",
      requirements: "Seedsize 512 GiB, account age 3 months, ratio 1.00",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Can Request" },
        { type: "custom", label: "Can Fill Requests" },
        { type: "custom", label: "Unsatisfied Slots: 50" },
      ],
    },
    {
      name: "SuperPool",
      requirements: "Seedsize 1 TiB, account age 6 months, ratio 1.00",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "custom", label: "Invite Forums" },
        { type: "custom", label: "Unsatisfied Slots: 75" },
      ],
    },
    {
      name: "UberPool",
      requirements: "Seedsize 5 TiB, account age 9 months, ratio 1.00",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "custom", label: "Invite Forums" },
        { type: "custom", label: "Unsatisfied Slots: 100" },
      ],
    },
    {
      name: "ProPool",
      requirements: "Bought or gifted with buffer in IRC",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "double-upload", label: "Double Upload" },
        { type: "custom", label: "Unsatisfied Slots: 50" },
      ],
      outsideLadder: "above",
    },
    {
      name: "MegaPool",
      requirements: "Seedsize 25 TiB, account age 12 months, ratio 1.00",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "double-upload", label: "Double Upload" },
        { type: "custom", label: "Invite Forums" },
        { type: "custom", label: "Unsatisfied Slots: 125" },
      ],
    },
    {
      name: "GodPool",
      requirements: "Seedsize 100 TiB, account age 12 months, ratio 1.00",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "double-upload", label: "Double Upload" },
        { type: "custom", label: "Invite Forums" },
        { type: "custom", label: "Unsatisfied Slots: 150" },
      ],
    },
    {
      name: "FoundingPool",
      requirements: "Founding members",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "custom", label: "Invite Forums" },
        { type: "custom", label: "Unsatisfied Slots: 75" },
      ],
      outsideLadder: "above",
    },
    {
      name: "SpecialPool",
      requirements: "Invite-only, outstanding members",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "double-upload", label: "Double Upload" },
        { type: "mod-bypass", label: "Torrent Mod Bypass" },
        { type: "custom", label: "Invite Forums" },
        { type: "custom", label: "Unsatisfied Slots: 100" },
      ],
      outsideLadder: "above",
    },
    {
      name: "External",
      requirements: "Recognized release groups and respected tracker staff",
      perks: [
        { type: "download-slots", label: "DL Slots: ∞" },
        { type: "upload", label: "Upload Torrents" },
        { type: "invite", label: "Send Invite" },
        { type: "freeleech", label: "Freeleech" },
        { type: "mod-bypass", label: "Torrent Mod Bypass" },
        { type: "custom", label: "Invite Forums" },
        { type: "custom", label: "Unsatisfied Slots: 100" },
      ],
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1,
    seedTimeHours: 240,
    loginIntervalDays: 120,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- The overall ratio must be at least 1:1",
      "- There is no required ratio for individual torrents",
      "",
      "## Freeleech",
      "",
      "- Individual TV episodes, anime episodes, remuxes and music packs are freeleech",
      "- Hover the star icon to check a specific torrent",
      "- Freeleech does not remove the minimum seed time",
      "",
      "## Minimum seed time",
      "",
      "- Seed every release for 10 days, freeleech or not, or it becomes Unsatisfied",
      "- Torrents with less than 10% downloaded are exempt",
      "- A torrent is marked Unsatisfied after 72 hours offline",
      "- Unsatisfied torrents reduce download slots; too many leave you with one slot",
      "- Clear an Unsatisfied by completing the seed time or paying the fine",
      "",
      "## Usergroups",
      "",
      "- SuperPool and above with a seedpool above 1 TiB get site-wide freeleech",
      "- Group changes can take up to 24 hours; log out and back in to sync forums and IRC",
      "",
      "## Clients",
      "",
      "- Open-source clients are allowed (qBittorrent, Deluge, rTorrent)",
      "- All versions of uTorrent are banned",
      "",
      "## Uploading",
      "",
      "- Follow the Upload Guide",
      "- Uploading is limited to trusted community members and known rippers and remuxers",
      "- Upload privileges can be earned through quality request fills and community participation",
      "",
      "## IRC & chat",
      "",
      "- Site chat: chat.seedpool.org",
      "- IRC: irc.seedpool.org:6697 (SSL), username as nick and passkey as password",
      "- Join #lobby and type !help; channels include #seedpool, #announce and #music",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
