// src/data/trackers/g3mini.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const g3mini: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "g3mini",
  name: "G3MINI TR4CK3R",
  abbreviation: "G3M",
  url: "https://gemini-tracker.org",
  description:
    "French private general tracker covering movies, TV, documentaries, animation, music, sports, games, books and software.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Documentaries",
    "Anime",
    "Music",
    "Sports",
    "Games",
    "Books",
    "Apps",
    "Education",
  ],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7c3aed",
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
  // Prowlarr Indexers definitions/v11/g3minitr4ck3r-api.yml sets minimumseedtime: 172800
  rules: {
    minimumRatio: 0,
    seedTimeHours: 48,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
