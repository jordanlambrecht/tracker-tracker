// src/data/trackers/720pier.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const pier720: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "720pier",
  name: "720pier",
  abbreviation: "720P",
  url: "https://720pier.ru",
  description: "Semi-private tracker for most sports.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Sports",
  contentCategories: ["Sports"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#4caf50",
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
