// src/data/trackers/empornium.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const empornium: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "empornium",
  name: "Empornium",
  abbreviation: "EMP",
  url: "https://empornium.is",
  description: "The top general porn tracker.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Porn",
  contentCategories: ["XXX"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ab47bc",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "empornium",
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
  warning: true,
  warningNote: "Unvalidated",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
