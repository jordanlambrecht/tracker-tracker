// src/data/trackers/exoticaz.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const exoticaz: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "exoticaz",
  name: "ExoticaZ",
  abbreviation: "ExZ",
  url: "https://exoticaz.to",
  description: "Mainly Asian porn but some western content. Part of the PrivateHD network.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Asian Adult",
  contentCategories: ["XXX"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ef5350",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "exoticaz",
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
