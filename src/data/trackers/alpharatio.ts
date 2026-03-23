// src/data/trackers/alpharatio.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const alpharatio: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "alpharatio",
  name: "AlphaRatio",
  abbreviation: "AR",
  url: "https://alpharatio.cc",
  description:
    "General 0-day tracker focused on scene content. Excellent pretimes. Not the biggest content library.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "0-day / Scene",
  contentCategories: ["Movies", "TV", "Games", "Music", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#9b59b6",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "alpha-ratio",
  statusPageUrl: "https://ar.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 72,
    loginIntervalDays: 120,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unvalidated",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
