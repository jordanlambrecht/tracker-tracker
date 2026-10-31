// src/data/trackers/anthelion.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const anthelion: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "anthelion",
  name: "Anthelion",
  abbreviation: "ANT",
  url: "https://anthelion.me",
  description:
    "General movie tracker with a Gazelle-based UI. Has less content than PTP but is growing fast. Sister site of the TV tracker NBL.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "nebulance",
  nebulanceAuthParam: "apikey",
  apiPath: "/api.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies",
  contentCategories: ["Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#3eaca7",
  logo: "/tracker-logos/anthelion_logo.png",
  bonusName: "Orbs",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "anthelion",
  statusPageUrl: "",

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
