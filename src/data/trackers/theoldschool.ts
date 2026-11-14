// src/data/trackers/theoldschool.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const theoldschool: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "theoldschool",
  name: "The Old School",
  abbreviation: "TOS",
  url: "https://theoldschool.cc",
  description:
    "French private general tracker for movies and TV, in French and VOSTFR, plus games, software, ebooks and sports.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Sports", "Games", "Apps", "Books"],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#d97706",
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
    // Jackett's theoldschool-api definition: global minimum ratio 0.6, torrents
    // seeded for 2 days regardless of ratio, and a login every 90 days unless at
    // least 1 torrent is seeding.
    minimumRatio: 0.6,
    seedTimeHours: 48,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified. Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
