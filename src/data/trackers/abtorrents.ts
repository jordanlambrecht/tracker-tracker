// src/data/trackers/abtorrents.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const abtorrents: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "abtorrents",
  name: "AB Torrents",
  abbreviation: "ABT",
  url: "https://abtorrents.me",
  description: "Audiobook and ebook tracker.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Audiobooks / Books",
  contentCategories: ["Audiobooks", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#6d4c41",
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
