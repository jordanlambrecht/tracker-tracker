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
  platform: "custom",
  apiPath: "/api/user",

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
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
