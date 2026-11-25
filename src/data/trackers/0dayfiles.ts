// src/data/trackers/0dayfiles.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const zerodayfiles: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "0dayfiles",
  name: "0DayFiles",
  abbreviation: "",
  url: "https://0dayfiles.net",
  description:
    "Invite-only private general tracker for 0-day releases across movies, TV, music, games, software and books.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "0-Day / General",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Documentaries",
    "Music",
    "Games",
    "Apps",
    "Books",
    "Audiobooks",
    "Education",
    "XXX",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f5851f",
  logo: "/tracker-logos/0dayfiles_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Leech",
      requirements: "Ratio below 0.40. Cannot start new downloads",
      outsideLadder: "below",
    },
    { name: "User", requirements: "Starting class, no requirements" },
    { name: "PowerUser", requirements: "Upload ≥ 1 TB, ratio ≥ 0.40, age ≥ 30 days" },
    { name: "SuperUser", requirements: "Upload ≥ 5 TB, ratio ≥ 0.40, age ≥ 60 days" },
    { name: "ExtremeUser", requirements: "Upload ≥ 20 TB, ratio ≥ 0.40, age ≥ 90 days. Trusted" },
    { name: "InsaneUser", requirements: "Upload ≥ 50 TB, ratio ≥ 0.40, age ≥ 180 days. Trusted" },
    { name: "Veteran", requirements: "Upload ≥ 100 TB, ratio ≥ 0.40, age ≥ 365 days. Freeleech" },
    {
      name: "Seeder",
      requirements:
        "Seed size ≥ 5 TB, ratio ≥ 0.40, avg seedtime ≥ 30 days, age ≥ 30 days. Trusted, H&R immune",
    },
    {
      name: "Archivist",
      requirements:
        "Seed size ≥ 10 TB, ratio ≥ 0.40, avg seedtime ≥ 60 days, age ≥ 90 days. Trusted, freeleech, H&R immune",
    },
    { name: "Trustee", requirements: "Staff-assigned", outsideLadder: "above" },
    { name: "Internal", requirements: "Staff-assigned", outsideLadder: "above" },
    { name: "Uploader", requirements: "Staff-assigned", outsideLadder: "above" },
    { name: "Editor", requirements: "Staff-assigned", outsideLadder: "above" },
    { name: "Torrent Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Owner", requirements: "Staff", outsideLadder: "above" },
    { name: "Bot", requirements: "Bot accounts", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // The site clears a torrent at 7 days of seeding or a 1:1 ratio on that torrent,
    // whichever comes first. satisfactionMode is left off because minimumRatio holds
    // the 0.40 account minimum, not that 1:1 per-torrent target.
    // No inactivity period is published, so loginIntervalDays stays 0.
    minimumRatio: 0.4,
    seedTimeHours: 168,
    loginIntervalDays: 0,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- The account minimum ratio is 0.40",
      "- Below it you are moved to Leech and cannot start new downloads until the ratio recovers",
      "- Classes are recalculated once a day, so the change is not instant",
      "",
      "## Seeding / Hit & Run",
      "",
      "- Seed every torrent for 7 days (168 hours) or to a 1:1 ratio on that torrent, whichever comes first",
      "- The rule applies once more than 10% of the torrent has been downloaded",
      "- Freeleech torrents must be seeded too",
      "- An unresolved hit and run becomes a warning, which expires after 14 days",
      "- 3 active warnings disable downloading until they are resolved",
      "- A hit and run can be cleared by seeding again, or bought off with BON or spare upload credit",
      "",
      "## New members",
      "",
      "- For the first 14 days there is a daily limit on new downloads: 10 on day 1, 15 on day 2, then 20 a day",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified. Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
