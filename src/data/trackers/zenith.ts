// src/data/trackers/zenith.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const zenith: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "zenith",
  name: "Zenith",
  abbreviation: "ZN",
  url: "https://znth.cx",
  description: "Private general tracker with a clean UNIT3D interface.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Books", "Audiobooks"],
  language: "English",

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
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/users/{username}",
}
