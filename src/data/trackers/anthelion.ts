// src/data/trackers/anthelion.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const anthelion: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "anthelion",
  name: "Anthelion",
  abbreviation: "ANT",
  url: "https://anthelion.me",
  description:
    "General movie tracker featuring a Gazelle-based UI. Lacking in content compared to PTP but growing at a fast rate. Sister site of the TV tracker NBL.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "nebulance",
  apiPath: "/api.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies",
  contentCategories: ["Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#3eaca7",
  logo: "/tracker-logos/anthelion_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "anthelion",
  statusPageUrl: "https://ant.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
