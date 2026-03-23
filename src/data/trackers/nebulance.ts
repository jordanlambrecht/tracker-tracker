// src/data/trackers/nebulance.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const nebulance: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "nebulance",
  name: "Nebulance",
  abbreviation: "NBL",
  url: "https://nebulance.io",
  description:
    "Ratioless TV site. Good for popular or new TV, but less popular or older content will often not make it on or will lose seeders.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "nebulance",
  apiPath: "/api.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "TV",
  contentCategories: ["TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1a4fc2",
  logo: "/tracker-logos/nebulance_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "nebulance",
  statusPageUrl: "https://nbl.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
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
