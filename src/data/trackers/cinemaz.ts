// src/data/trackers/cinemaz.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const cinemaz: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "cinemaz",
  name: "CinemaZ",
  abbreviation: "CZ",
  url: "https://cinemaz.to",
  description:
    "Part of the PrivateHD network which often opens for signups. Foreign and non-mainstream movies and TV.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Foreign / Non-mainstream",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#2980b9",
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
