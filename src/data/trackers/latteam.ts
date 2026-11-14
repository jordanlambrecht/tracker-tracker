// src/data/trackers/latteam.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const latteam: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "latteam",
  name: "Lat-Team",
  abbreviation: "",
  url: "https://lat-team.com",
  description:
    "Spanish-language private tracker for Latin American audiences, covering movies, TV, anime, telenovelas, music and more.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Latin Spanish Movies / TV",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Music",
    "Sports",
    "Games",
    "Apps",
    "Books",
    "Audiobooks",
    "Comics",
    "Manga",
    "Education",
    "XXX",
  ],
  language: "Spanish",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ead6b7",
  logo: "/tracker-logos/latteam_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Leech",
      requirements: "Ratio below 0.25. Download privileges revoked",
      outsideLadder: "below",
    },
    { name: "User", requirements: "Ratio ≥ 0.25. 5 download slots" },
    {
      name: "PowerUser",
      requirements: "Upload ≥ 1 TiB, ratio ≥ 0.40, age ≥ 1 month. 10 download slots",
    },
    {
      name: "SuperUser",
      requirements: "Upload ≥ 5 TiB, ratio ≥ 0.40, age ≥ 2 months. 15 download slots",
    },
    {
      name: "ExtremeUser",
      requirements: "Upload ≥ 20 TiB, ratio ≥ 0.40, age ≥ 3 months. 20 download slots",
    },
    {
      name: "InsaneUser",
      requirements: "Upload ≥ 50 TiB, ratio ≥ 0.40, age ≥ 6 months. 25 download slots",
    },
    {
      name: "Veteran",
      requirements: "Upload ≥ 100 TiB, ratio ≥ 0.40, age ≥ 1 year. 30 download slots, H&R immune",
    },
    {
      name: "Seeder",
      requirements:
        "Seed size ≥ 5 TiB, ratio ≥ 0.40, age ≥ 1 month, avg seedtime ≥ 1 month. 35 download slots, H&R immune",
    },
    {
      name: "Archivist",
      requirements:
        "Seed size ≥ 10 TiB, ratio ≥ 0.40, age ≥ 3 months, avg seedtime ≥ 2 months. Unlimited slots, freeleech, H&R immune",
    },
    {
      name: "VIP",
      requirements:
        "Donors. Freeleech, double upload, no H&R or ratio warnings, exempt from inactivity",
      outsideLadder: "above",
    },
    { name: "Junior Uploader", requirements: "Uploader on the rise", outsideLadder: "above" },
    {
      name: "Uploader",
      requirements: "Contributes a lot of quality content",
      outsideLadder: "above",
    },
    {
      name: "Internal",
      requirements: "Uploader of internal Lat-Team releases",
      outsideLadder: "above",
    },
    {
      name: "SyncTeam",
      requirements: "Audio, subtitle and video synchronization team",
      outsideLadder: "above",
    },
    {
      name: "Trustee",
      requirements: "Staff of other respected trackers and retired Lat-Team staff",
      outsideLadder: "above",
    },
    {
      name: "Editor",
      requirements: "Corrects the information of published torrents",
      outsideLadder: "above",
    },
    {
      name: "Torrent Moderator",
      requirements: "Moderates published torrents",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.25,
    seedTimeHours: 72,
    loginIntervalDays: 90,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- The minimum ratio is 0.25",
      "- Below it you are moved to Leech and lose download privileges",
      "",
      "## Seeding / Hit & Run",
      "",
      "- Seed every torrent for 72 hours (3 days) of tracker time, counted from 100% downloaded",
      "- The 72 hours do not have to be continuous, but never go more than 5 days without seeding",
      "- Partial downloads are not allowed",
      "- A pre-warning is sent by PM first; the hit and run warning follows if seeding does not resume",
      "- 3 active warnings revoke download permissions",
      "- Active warnings expire after 30 days or once the torrent is reseeded, but stay in the warning history",
      "",
      "## Account inactivity",
      "",
      "- Log in at least once every 90 days or the account is banned automatically",
      "- VIP donors are exempt",
      "",
      "## Accounts",
      "",
      "- One account per person, for life",
      "- Buying an invitation means a lifetime ban",
      "- Debrid and similar services are forbidden",
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
