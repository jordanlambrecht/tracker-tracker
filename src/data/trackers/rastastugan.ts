// src/data/trackers/rastastugan.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const rastastugan: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "rastastugan",
  name: "Rastastugan",
  abbreviation: "",
  url: "https://rastastugan.org",
  description:
    "Nordic private general tracker covering movies, TV, music, games, software, books, audiobooks, sports and XXX.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Apps",
    "Games",
    "Audiobooks",
    "Books",
    "Sports",
    "XXX",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#16a34a",
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
  // Prowlarr Indexers definitions/v11/rastastugan-api.yml sets minimumratio: 1.0 and minimumseedtime: 172800
  rules: {
    minimumRatio: 1,
    seedTimeHours: 48,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
