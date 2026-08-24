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
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "torrent-leech",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // Both routes, verbatim from wiki.torrentleech.org/doku.php/hnr: "There are
    // two ways for you to give back to the community" — seed a torrent to at
    // least 1:1, OR seed it for the minimum time required for your user class.
    // Hence `any`. FreeLeech is explicitly NOT exempt from either.
    minimumRatio: 1.0,
    // 10 days, the Registered-class requirement and the longest one on the
    // site (Power User 8d, Super User 7d, Extreme User 6d, TL GOD 4d, VIP
    // none). Deliberately the longest: the class is not knowable from the
    // registry, and over-seeding is the safe direction to be wrong in.
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
