// src/data/trackers/greatposterwall.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const greatposterwall: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "greatposterwall",
  name: "Great Poster Wall",
  abbreviation: "GPW",
  url: "https://greatposterwall.com",
  description: "A Chinese Gazelle-based tracker with movies and some TV.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies",
  contentCategories: ["Movies", "TV"],
  language: "Chinese",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#c0392b",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "great-poster-wall",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unvalidated",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
