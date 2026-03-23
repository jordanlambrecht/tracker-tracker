// src/data/trackers/privatehd.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const privatehd: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "privatehd",
  name: "PrivateHD",
  abbreviation: "PHD",
  url: "https://privatehd.to",
  description: "Former home of EPSiLON. Part of the PrivateHD network.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "HD Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#5c6bc0",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "private-hd",
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
