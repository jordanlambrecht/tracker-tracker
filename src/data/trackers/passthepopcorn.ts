// src/data/trackers/passthepopcorn.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const passthepopcorn: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "passthepopcorn",
  name: "PassThePopcorn",
  abbreviation: "PTP",
  url: "https://passthepopcorn.me",
  description:
    "The premier movie tracker. Huge selection of both popular and niche content with an active community that should satisfy any movie fan.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies",
  contentCategories: ["Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f1c40f",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "pass-the-popcorn",
  statusPageUrl: "https://ptp.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 48,
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
