// src/data/trackers/bibliotik.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const bibliotik: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "bibliotik",
  name: "Bibliotik",
  abbreviation: "BIB",
  url: "https://bibliotik.me",
  description:
    "The premier private tracker for e-books, audiobooks, comics, and other written media. Massive library with strict curation.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "E-Books / Audiobooks",
  contentCategories: ["Books", "Audiobooks", "Comics"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#8b5cf6",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "bibliotik",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
