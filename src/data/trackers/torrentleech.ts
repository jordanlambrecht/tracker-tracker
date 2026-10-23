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
    loginIntervalDays: 120,
    fullRulesMarkdown: [
      "## Hit & Run",
      "",
      "- Seed every torrent to ratio 1:1 or for your class minimum: Registered 10 days, Power User 8, Super User 7, Extreme User 6, TL God 4, VIP none",
      "- The requirement applies to freeleech torrents too",
      "- Partially downloaded torrents never accrue seed time and must be seeded to 1:1",
      "- 50+ H&Rs for 5 consecutive days triggers a warning; 3 warnings disable the account",
      "- Clear an H&R by seeding, with TL points, or with surplus upload credit",
      "- VIP clears existing H&Rs and is exempt while active; torrents downloaded during VIP do not gain H&R after it expires",
      "",
      "## Ratio & Client",
      "",
      "- A low ratio can disable the account; keep the torrent client active",
      "- Tracker stats update about every 30 minutes; check the snatchlist before removing a torrent",
      "- Pause a torrent and wait at least 60 minutes for the tracker to update before deleting it",
      "",
      "## Account",
      "",
      "- Do not beg for invites in PMs or IRC",
      "- Use the #tlhelp IRC channel for account issues and wait for staff",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/profile/{username}",
}
