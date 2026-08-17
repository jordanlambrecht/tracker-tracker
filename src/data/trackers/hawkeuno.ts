// src/data/trackers/hawkeuno.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hawkeuno: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "hawkeuno",
  name: "HAWKE-UNO",
  abbreviation: "HU",
  url: "https://hawke.uno",
  description:
    "General private tracker running its own platform (not UNIT3D). Stats come from /api/profile with a Bearer API key.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "hawke",
  apiPath: "/api/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ef4444",
  logo: "/tracker-logos/hawkeuno_logo.svg",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "hawke-uno",
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
