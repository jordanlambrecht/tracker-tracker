// src/data/trackers/0dayfiles.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const zerodayfiles: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "0dayfiles",
  name: "0DayFiles",
  abbreviation: "",
  url: "https://0dayfiles.net",
  description:
    "Private general tracker for 0-day releases across movies, TV, music, games, software and books.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "0-Day / General",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Documentaries",
    "Music",
    "Games",
    "Apps",
    "Books",
    "Audiobooks",
    "Education",
    "XXX",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#0ea5e9",
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
    // Jackett's 0dayfiles-api definition sets minimumratio 1.0 and minimumseedtime
    // 604800 (7 days). No login interval is published there.
    minimumRatio: 1.0,
    seedTimeHours: 168,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified. Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
