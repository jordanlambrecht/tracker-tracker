// src/data/trackers/concertos.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const concertos: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "concertos",
  name: "Concertos",
  abbreviation: "CON",
  url: "https://concertos.live",
  description:
    "Private tracker focused on classical music and live concert recordings. Features a curated library of symphonic, chamber, and operatic works.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Classical Music",
  contentCategories: ["Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#b0b8c4",
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
