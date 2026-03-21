// src/data/trackers/asiancinema.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const asiancinema: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "asiancinema",
  name: "AsianCinema",
  abbreviation: "AC",
  url: "https://asiancinema.me",
  description:
    "UNIT3D tracker specializing in Asian cinema — movies, TV dramas, music, and variety shows from East and Southeast Asia.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Asian Movies / TV / Music",
  contentCategories: ["Movies", "TV", "Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e63946",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "asian-cinema",
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
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
