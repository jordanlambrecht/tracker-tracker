// src/data/trackers/latteam.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const latteam: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "latteam",
  name: "Lat-Team",
  abbreviation: "LAT",
  url: "https://lat-team.com",
  description:
    "Spanish-language private tracker for Latin American audiences, covering movies, TV, anime, telenovelas, music and more.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Latin Spanish Movies / TV",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Music",
    "Sports",
    "Games",
    "Apps",
    "Books",
    "Audiobooks",
    "Comics",
    "Manga",
    "Education",
    "XXX",
  ],
  language: "Spanish",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f59e0b",
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
    // Jackett's lat-team-api definition: global minimum ratio 0.25, torrents seeded
    // for 3 days regardless of ratio, and a login every 90 days unless at least 5
    // torrents are seeding.
    minimumRatio: 0.25,
    seedTimeHours: 72,
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
