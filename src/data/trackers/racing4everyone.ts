// src/data/trackers/racing4everyone.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const racing4everyone: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "racing4everyone",
  name: "Racing4Everyone",
  abbreviation: "R4E",
  url: "https://racing4everyone.eu",
  description:
    "The go-to tracker for motorsport fans. Covers Formula 1, MotoGP, WRC, NASCAR, endurance racing, and niche series from around the world.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Motorsport",
  contentCategories: ["Sports"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#dc2626",
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
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
