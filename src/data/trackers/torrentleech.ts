// src/data/trackers/torrentleech.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const torrentleech: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "torrentleech",
  name: "TorrentLeech",
  abbreviation: "TL",
  url: "https://www.torrentleech.org",
  description:
    "Large general tracker known for having open signups very often. Broad content library across most categories.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "torrentleech",
  apiPath: "/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Games", "Music", "Apps", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#2ecc71",
  logo: "/tracker-logos/torrentleech_logo.png",
  bonusName: "TL Points",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "torrent-leech",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // wiki.torrentleech.org/doku.php/user_classes. Staff roles (Uploader, FLS,
  // Moderator, ...) are omitted: they are jobs, not classes.
  userClasses: [
    { name: "Registered", requirements: "Default class. Seed time 10 days" },
    {
      name: "Power User",
      requirements:
        "2 weeks registered, 200 GB uploaded, ratio above 1.1. 3% points bonus, seed time 8 days",
    },
    {
      name: "Super User",
      requirements:
        "12 weeks registered, 1 TB uploaded, ratio above 2.0. 5% points bonus, seed time 7 days",
    },
    {
      name: "Extreme User",
      requirements:
        "24 weeks registered, 10 TB uploaded, ratio above 5.0. 6% points bonus, seed time 6 days",
    },
    {
      name: "TL GOD",
      requirements:
        "52 weeks registered, 50 TB uploaded, ratio above 8.0. 8% points bonus, seed time 4 days",
    },
    {
      name: "VIP",
      requirements: "Assigned to donors by staff. 10% points bonus, no minimum seed time",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // wiki.torrentleech.org/doku.php/hnr gives two routes. Seed a torrent to at
    // least 1:1, or seed it for your class's minimum time. Hence `any`.
    // Freeleech is not exempt from either.
    minimumRatio: 1.0,
    // 10 days, the Registered-class requirement and the longest on the site.
    // The member's class is not knowable from the registry, and over-seeding
    // is the safe direction to be wrong in.
    seedTimeHours: 240,
    satisfactionMode: "any",
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/profile/{username}",
}
