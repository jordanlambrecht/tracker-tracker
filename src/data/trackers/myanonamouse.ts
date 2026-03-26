// src/data/trackers/myanonamouse.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const myanonamouse: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "myanonamouse",
  name: "MyAnonaMouse",
  abbreviation: "MAM",
  url: "https://www.myanonamouse.net",
  description:
    "Book, audiobook, and comics tracker with an open interview for anyone who wants to join and an extremely friendly community.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "mam",
  apiPath: "/jsonLoad.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Books / Audiobooks",
  contentCategories: ["Books", "Audiobooks", "Comics"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ec407a",
  logo: "/tracker-logos/myanonamouse_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "my-anona-mouse",
  statusPageUrl: "https://status.myanonamouse.net/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Mouse", requirements: "Ratio below 1.0 (auto-demotion)" },
    { name: "User", requirements: "Ratio above 1.0" },
    { name: "Power User", requirements: "4 weeks membership, 25 GB uploaded, 2.0 ratio" },
    { name: "Star", requirements: "Donor" },
    { name: "VIP", requirements: "Bonus points or donation (requires Power User first)" },
    { name: "Elite VIP", requirements: "Staff-selected for community contribution" },
    { name: "Elite", requirements: "Staff-selected, immune to auto-demotion" },
    { name: "Supporter", requirements: "Continuous supporter" },
    { name: "Mouseketeer", requirements: "Retired staff" },
    { name: "Uploader", requirements: "Staff-selected for consistent monthly uploads" },
  ],
  stats: {
    userCount: 114812,
    torrentCount: 1128625,
    statsUpdatedAt: "2026-03-26",
  },
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 72,
    loginIntervalDays: 0,
    fulfillmentPeriodHours: 720,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
