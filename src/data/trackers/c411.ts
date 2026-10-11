// src/data/trackers/c411.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const c411: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "c411",
  name: "C411",
  abbreviation: "C411",
  url: "https://c411.org",
  description:
    "French private general tracker covering movies, TV, books, audio, PC and console games, and adult content. Invite-only.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "c411",
  apiPath: "/api/auth/me",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books", "XXX"],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e11d48",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [{ name: "Membre", requirements: "Default member class" }],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.8,
    seedTimeHours: 0,
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
