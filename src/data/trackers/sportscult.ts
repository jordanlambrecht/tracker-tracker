// src/data/trackers/sportscult.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const sportscult: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "sportscult",
  name: "Sportscult",
  abbreviation: "SCult",
  url: "https://sportscult.eu",
  description: "Private tracker with semi-frequent signups for most sports.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Sports",
  contentCategories: ["Sports"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ff5722",
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
