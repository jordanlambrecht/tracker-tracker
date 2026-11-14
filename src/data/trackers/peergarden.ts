// src/data/trackers/peergarden.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const peergarden: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "peergarden",
  name: "PeerGarden",
  abbreviation: "PG",
  url: "https://peergarden.org",
  description:
    "Private general tracker for movies, TV, music, games, apps, books and audiobooks. Runs Traxary, a UNIT3D-based codebase.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Sports",
    "Music",
    "Games",
    "Apps",
    "Books",
    "Audiobooks",
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
  rules: {
    // Jackett's peergarden definition sets minimumratio 1.0 and minimumseedtime
    // 172800 (2 days), and says accounts are disabled after 90 days of no activity.
    minimumRatio: 1.0,
    seedTimeHours: 48,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified. Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
