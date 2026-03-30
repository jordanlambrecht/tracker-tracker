// src/data/trackers/luminarr.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const luminarr: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "luminarr",
  name: "Luminarr",
  abbreviation: "LUME",
  url: "https://luminarr.me",
  description:
    "Movies and TV tracker with deep Radarr/Sonarr integration and TRaSH Guides quality profiles. Arr-themed UI.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7891d1",
  logo: "/tracker-logos/luminarr_logo.png",

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
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 30,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
