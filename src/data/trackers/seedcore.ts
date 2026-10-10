// src/data/trackers/seedcore.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedcore",
  name: "SeedCore",
  abbreviation: "",
  url: "https://seedcore.net",
  description:
    "Romanian invite-only general tracker covering movies, TV, music, games, and more. Runs UNIT3D.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "XXX"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f97316",
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
