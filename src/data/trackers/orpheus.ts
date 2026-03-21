// src/data/trackers/orpheus.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const orpheus: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "orpheus",
  name: "Orpheus",
  abbreviation: "OPS",
  url: "https://orpheus.network",
  description:
    "One of the largest and most prestigious private music trackers, Orpheus is renowned for its extensive library of high-quality music releases, active community, and strict quality standards.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Music",
  contentCategories: ["Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1daf8b",
  logo: "/tracker-logos/orpheus_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "orpheus",
  statusPageUrl: "https://ops.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 120,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
