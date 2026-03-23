// src/data/trackers/oldtoons.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const oldtoons: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "oldtoons",
  name: "OldToons",
  abbreviation: "OT",
  url: "https://oldtoons.world",
  description:
    "Dedicated to classic animation and vintage cartoons. A niche tracker for fans of retro animated content from the golden age of animation.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Classic Animation",
  contentCategories: ["TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#fbbf24",
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
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
