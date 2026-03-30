// src/data/trackers/darkpeers.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const darkpeers: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "darkpeers",
  name: "DarkPeers",
  abbreviation: "DP",
  url: "https://darkpeers.org",
  description:
    "Nordic-based general tracker. Movies, TV, audio, games, books, and more. Launched March 2025.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#c0c0c0",
  logo: "/tracker-logos/darkpeers_logo.png",

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
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
