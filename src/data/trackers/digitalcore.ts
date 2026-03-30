// src/data/trackers/digitalcore.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const digitalcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "digitalcore",
  name: "DigitalCore",
  abbreviation: "DC",
  url: "https://digitalcore.club",
  description:
    "Long-running 0day/general tracker with 1.5M+ torrents. Scene and P2P releases across movies, TV, music, apps, games, and ebooks.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "0day / General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ffffff",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
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
