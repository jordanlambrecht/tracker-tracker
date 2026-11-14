// src/data/trackers/theoldschool.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const theoldschool: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "theoldschool",
  name: "The Old School",
  abbreviation: "TOS",
  url: "https://theoldschool.cc",
  description:
    "French private tracker for movies, TV, documentaries and anime, plus ebooks, software and games. Invitations are issued by staff only.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Documentaries", "Anime", "Sports", "Games", "Apps", "Books"],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7fcbdf",
  logo: "/tracker-logos/theoldschool_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Leech",
      requirements: "Ratio below 0.6. Download, invite and request privileges revoked",
      outsideLadder: "below",
    },
    { name: "User", requirements: "Upload above 0 and ratio above the minimum. 2 download slots" },
    { name: "PowerUser", requirements: "Upload ≥ 5 TiB, age ≥ 3 months" },
    { name: "SuperUser", requirements: "Upload ≥ 15 TiB, age ≥ 6 months" },
    { name: "ExtremeUser", requirements: "Upload ≥ 30 TiB, age ≥ 12 months" },
    {
      name: "InsaneUser",
      requirements: "Upload ≥ 50 TiB, age ≥ 18 months. Automatic torrent approval, invite forums",
    },
    {
      name: "Veteran",
      requirements: "Upload ≥ 100 TiB, age ≥ 24 months. H&R immune, global freeleech",
    },
    {
      name: "Seeder",
      requirements:
        "Seed size ≥ 10 TiB, age ≥ 3 months, avg seedtime ≥ 30 days. Automatic torrent approval",
    },
    {
      name: "Archivist",
      requirements:
        "Seed size ≥ 25 TiB, age ≥ 6 months, avg seedtime ≥ 90 days. H&R immune, global freeleech",
    },
    {
      name: "V.I.P",
      requirements: "Donors. Perks depend on the donation pack",
      outsideLadder: "above",
    },
    {
      name: "Teams",
      requirements: "Release groups on the site, named by staff. H&R immune, global freeleech",
      outsideLadder: "above",
    },
    {
      name: "Uploader",
      requirements: "Staff-assigned. Must make 6 uploads every 6 weeks to keep the status",
      outsideLadder: "above",
    },
    {
      name: "Trustee",
      requirements: "Retired staff and respected people from other trackers",
      outsideLadder: "above",
    },
    {
      name: "Animateur forums",
      requirements: "Runs the shoutbox and forum",
      outsideLadder: "above",
    },
    { name: "Editeur", requirements: "Edits torrent descriptions", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Owner", requirements: "Staff", outsideLadder: "above" },
    { name: "Bot", requirements: "Bot accounts", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [
    "FL3ER",
    "SUNS3T",
    "WoLFHD",
    "Slay3R",
    "3T3AM",
    "BARBiE",
    "Freek911",
    "k0RE",
    "TOXIC",
    "TiPiAK",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // Site rule 2.2.1: "Vous devez seeder les torrents téléchargés au moins 48
    // heures pendant 7 jours, quel que soit votre ratio." Seed time alone clears
    // a torrent, so satisfactionMode is left off.
    minimumRatio: 0.6,
    seedTimeHours: 48,
    loginIntervalDays: 90,
    fulfillmentPeriodHours: 168,
    hnrBanLimit: 5,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Keep a global ratio of 0.6 or better to continue downloading",
      "- Below it you are moved to Leech and lose download, invite and request privileges",
      "",
      "## Seeding / Hit & Run",
      "",
      "- Seed every downloaded torrent for at least 48 hours within 7 days, whatever your ratio",
      "- Downloading less than 3% of a torrent is not a hit and run",
      "- Freeleech torrents must be seeded too",
      "- A hit and run warning stays active for 7 days; the warning history is permanent",
      "- 5 active warnings disable download and request privileges",
      "- 10 active warnings ban the account automatically",
      "- Veteran, Archivist, Teams and Uploader are immune to automated warnings",
      "",
      "## Account inactivity",
      "",
      "- Log in at least once every 90 days or keep at least 1 torrent seeding, or the account is disabled",
      "- A disabled account is pruned after 30 more days",
      "",
      "## Uploads",
      "",
      "- Uploaders must seed for at least 2 days or until there are 5 active seeders",
      "- Descriptions must be in French; video without French audio or subtitles is forbidden",
      "- Team names and tags must not be changed",
      "- Pure audio releases are forbidden",
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
