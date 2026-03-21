// src/data/trackers/reelflix.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const reelflix: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "reelflix",
  name: "Reelflix",
  abbreviation: "RF",
  url: "https://reelflix.xyz",
  description:
    "General movie and TV tracker with a focus on high-quality encodes and a streamlined browsing experience.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e50914",
  logo: "/tracker-logos/reelflix_logo.png",

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
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
