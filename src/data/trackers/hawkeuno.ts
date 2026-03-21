// src/data/trackers/hawkeuno.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hawkeuno: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "hawkeuno",
  name: "HAWKE-UNO",
  abbreviation: "HU",
  url: "https://hawke.uno",
  description:
    "General private tracker powered by UNIT3D. Unsupported — no users API endpoint available.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

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
