// src/data/trackers/seedpool.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedpool: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedpool",
  name: "Seed Pool",
  abbreviation: "SP",
  url: "https://seedpool.org",
  description: "General private tracker.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "",
  contentCategories: [],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#22c55e",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "https://status.seedpool.org/",

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
